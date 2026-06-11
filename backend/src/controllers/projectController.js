const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { getIO } = require('../socket');
const { createNotification } = require('./notificationController');
const prisma = new PrismaClient();

const generateCode = () => crypto.randomBytes(8).toString('hex').toUpperCase();

exports.createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await prisma.project.create({
      data: {
        name, description, ownerId: req.user.id,
        inviteCode: generateCode(),
        members: { create: { userId: req.user.id, role: 'admin' } }
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
};

exports.listProjects = async (req, res, next) => {
  try {
    const { status = 'active' } = req.query;
    const now = new Date();
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: req.user.id } }, status },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true, members: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Attach overdue task count per project
    const projectIds = projects.map(p => p.id);
    const overdueCounts = await prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { not: 'done' } },
      _count: { id: true }
    });
    const overdueMap = Object.fromEntries(overdueCounts.map(o => [o.projectId, o._count.id]));
    const result = projects.map(p => ({ ...p, overdueCount: overdueMap[p.id] ?? 0 }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        _count: { select: { tasks: true } }
      }
    });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status })
      }
    });
    getIO().to(`project:${project.id}`).emit('project_updated', { projectId: project.id, changes: { name, description, status } });
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Only the owner can delete this project' });
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) { next(err); }
};

exports.addMember = async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: user.id } }
    });
    if (existing) return res.status(409).json({ success: false, message: 'User is already a member' });

    const member = await prisma.projectMember.create({
      data: { projectId: req.params.id, userId: user.id, role },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    getIO().to(`project:${req.params.id}`).emit('member_added', { user: member.user, role });

    try { await createNotification(user.id, 'member_added', `You were added to a project`, req.params.id); } catch {}

    res.status(201).json({ success: true, data: member });
  } catch (err) { next(err); }
};

exports.removeMember = async (req, res, next) => {
  try {
    const { id: projectId, userId } = req.params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.ownerId === userId) return res.status(400).json({ success: false, message: 'Cannot remove the project owner' });

    // Only the owner can remove other admins
    const target = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
    if (target?.role === 'admin' && project.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can remove admins' });
    }

    await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    await prisma.notification.deleteMany({ where: { userId, projectId } });
    res.json({ success: true, message: 'Member removed' });
  } catch (err) { next(err); }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { id: projectId, userId } = req.params;
    const { role } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can change member roles' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const updated = await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    getIO().to(`project:${projectId}`).emit('member_role_changed', { userId, role });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.transferOwnership = async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const { newOwnerId } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the project owner can transfer ownership' });
    }
    if (newOwnerId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You are already the owner' });
    }

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: newOwnerId } }
    });
    if (!target) return res.status(404).json({ success: false, message: 'User is not a member of this project' });
    if (target.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Ownership can only be transferred to an existing admin' });
    }

    // Transfer ownership; previous owner stays as admin
    await prisma.project.update({ where: { id: projectId }, data: { ownerId: newOwnerId } });
    getIO().to(`project:${projectId}`).emit('ownership_transferred', { newOwnerId, previousOwnerId: req.user.id });
    res.json({ success: true, message: 'Ownership transferred successfully' });
  } catch (err) { next(err); }
};

exports.getInviteCode = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { inviteCode: true }
    });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: { inviteCode: project.inviteCode } });
  } catch (err) { next(err); }
};

exports.regenerateInviteCode = async (req, res, next) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { inviteCode: generateCode() },
      select: { inviteCode: true }
    });
    res.json({ success: true, data: { inviteCode: project.inviteCode } });
  } catch (err) { next(err); }
};

exports.archiveProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Only the owner can archive this project' });
    await prisma.project.update({ where: { id: req.params.id }, data: { status: 'archived' } });
    res.json({ success: true, message: 'Project archived' });
  } catch (err) { next(err); }
};

exports.unarchiveProject = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Only the owner can restore this project' });
    await prisma.project.update({ where: { id: req.params.id }, data: { status: 'active' } });
    res.json({ success: true, message: 'Project restored' });
  } catch (err) { next(err); }
};

exports.joinViaCode = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ success: false, message: 'inviteCode is required' });

    const project = await prisma.project.findUnique({
      where: { inviteCode },
      include: { members: true }
    });
    if (!project) return res.status(404).json({ success: false, message: 'Invalid invite code' });

    const existing = project.members.find(m => m.userId === req.user.id);
    if (existing) return res.status(409).json({ success: false, message: 'You are already a member of this project' });

    const member = await prisma.projectMember.create({
      data: { projectId: project.id, userId: req.user.id, role: 'member' },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    getIO().to(`project:${project.id}`).emit('member_added', { user: member.user, role: 'member' });

    for (const m of project.members) {
      try {
        await createNotification(m.userId, 'member_added', `${member.user.name} joined the project`, project.id);
      } catch {}
    }

    res.status(201).json({ success: true, data: { projectId: project.id, name: project.name } });
  } catch (err) { next(err); }
};
