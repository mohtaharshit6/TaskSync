const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');
const { createNotification } = require('./notificationController');
const prisma = new PrismaClient();

const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

exports.createTask = async (req, res, next) => {
  try {
    const { projectId, title, description, priority, assignedTo, dueDate } = req.body;

    if (assignedTo) {
      const isMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: assignedTo } }
      });
      if (!isMember) return res.status(400).json({ success: false, message: 'Assigned user is not a project member' });
    }

    const task = await prisma.task.create({
      data: {
        projectId, title, description,
        priority: priority || 'medium',
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });

    getIO().to(`project:${projectId}`).emit('task_created', { task });

    if (assignedTo) {
      try { await createNotification(assignedTo, 'task_assigned', `You were assigned to "${title}"`, projectId, task.id); } catch {}
    }

    try { await prisma.taskActivity.create({ data: { taskId: task.id, userId: req.user.id, action: 'created' } }); } catch {}

    res.status(201).json({ success: true, data: task });
  } catch (err) { next(err); }
};

exports.listTasks = async (req, res, next) => {
  try {
    const { projectId, page = 1, limit = 20, status, priority, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      projectId,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(search && { title: { contains: search, mode: 'insensitive' } })
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where, skip, take: Number(limit),
        include: {
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          labels: { include: { label: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.task.count({ where })
    ]);

    res.json({
      success: true, data: tasks,
      pagination: { total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) { next(err); }
};

exports.getTask = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        },
        labels: { include: { label: true } },
        subtasks: { orderBy: { createdAt: 'asc' } }
      }
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

exports.listTaskActivity = async (req, res, next) => {
  try {
    const activities = await prisma.taskActivity.findMany({
      where: { taskId: req.params.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: activities });
  } catch (err) { next(err); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, assignedTo, dueDate } = req.body;
    const oldTask = req.task; // set by requireProjectMember('task:param')

    const isAdmin = req.membership.role === 'admin';

    // Field edits (anything other than status) require admin
    const isEditingFields = title !== undefined || description !== undefined ||
      priority !== undefined || assignedTo !== undefined || dueDate !== undefined;
    if (isEditingFields && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only admins can edit task details' });
    }

    // Validate assignedTo is a project member
    if (assignedTo) {
      const isMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: req.task.projectId, userId: assignedTo } }
      });
      if (!isMember) return res.status(400).json({ success: false, message: 'Assigned user is not a project member' });
    }

    // Move permission: only assignee or admin can change status on an assigned task
    if (status !== undefined && status !== oldTask.status && oldTask.assignedTo) {
      const isAssignee = oldTask.assignedTo === req.user.id;
      if (!isAssignee && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Only the assignee or a project admin can move this task' });
      }
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null })
      },
      include: { assignee: { select: { id: true, name: true, email: true } } }
    });

    getIO().to(`project:${updated.projectId}`).emit('task_updated', {
      taskId: updated.id,
      changes: { title, description, status, priority, assignedTo, dueDate }
    });

    // Notify all project members (except mover) when a task is moved
    if (status !== undefined && status !== oldTask.status) {
      const members = await prisma.projectMember.findMany({ where: { projectId: updated.projectId } });
      for (const m of members) {
        if (m.userId !== req.user.id) {
          try {
            await createNotification(
              m.userId, 'task_moved',
              `"${updated.title}" moved to ${STATUS_LABEL[status] || status}`,
              updated.projectId, updated.id
            );
          } catch {}
        }
      }
    }

    // Notify newly assigned user (always, even if self-assigned)
    if (assignedTo !== undefined && assignedTo && assignedTo !== oldTask.assignedTo) {
      try {
        await createNotification(
          assignedTo, 'task_assigned',
          `You were assigned to "${updated.title}"`,
          updated.projectId, updated.id
        );
      } catch {}
    }

    // Log activity
    if (status !== undefined && status !== oldTask.status) {
      try { await prisma.taskActivity.create({ data: { taskId: updated.id, userId: req.user.id, action: 'status_changed', detail: `${STATUS_LABEL[oldTask.status]} → ${STATUS_LABEL[status] || status}` } }); } catch {}
    }
    if (isEditingFields) {
      try { await prisma.taskActivity.create({ data: { taskId: updated.id, userId: req.user.id, action: 'edited' } }); } catch {}
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.getMyTasks = async (req, res, next) => {
  try {
    // Only return tasks from projects where the user is still a member
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user.id },
      select: { projectId: true }
    });
    const projectIds = memberships.map(m => m.projectId);

    const tasks = await prisma.task.findMany({
      where: { assignedTo: req.user.id, projectId: { in: projectIds } },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } }
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    });

    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
};

exports.deleteTask = async (req, res, next) => {
  try {
    if (req.membership.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can delete tasks' });
    }
    await prisma.task.delete({ where: { id: req.params.id } });
    getIO().to(`project:${req.task.projectId}`).emit('task_deleted', { taskId: req.task.id });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { next(err); }
};
