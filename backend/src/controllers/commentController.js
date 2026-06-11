const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');
const { createNotification } = require('./notificationController');
const prisma = new PrismaClient();

exports.addComment = async (req, res, next) => {
  try {
    const { taskId, content } = req.body;

    const comment = await prisma.comment.create({
      data: { taskId, userId: req.user.id, content },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    });

    getIO().to(`project:${req.task.projectId}`).emit('new_comment', { comment, taskId });

    // Collect unique recipients: assignee + all admins, excluding the commenter
    const toNotify = new Set();
    if (req.task.assignedTo && req.task.assignedTo !== req.user.id) {
      toNotify.add(req.task.assignedTo);
    }
    const admins = await prisma.projectMember.findMany({
      where: { projectId: req.task.projectId, role: 'admin' }
    });
    for (const a of admins) {
      if (a.userId !== req.user.id) toNotify.add(a.userId);
    }
    for (const userId of toNotify) {
      try {
        await createNotification(userId, 'comment_added', `New comment on task "${req.task.title}"`, req.task.projectId, taskId);
      } catch {}
    }

    // @mention detection — notify any project member whose name is @mentioned
    const mentionMatches = content.match(/@([^\s@]+)/g) || [];
    if (mentionMatches.length > 0) {
      const allMembers = await prisma.projectMember.findMany({
        where: { projectId: req.task.projectId },
        include: { user: { select: { id: true, name: true } } }
      });
      for (const match of mentionMatches) {
        const mentionedName = match.slice(1).toLowerCase();
        const member = allMembers.find(m => m.user.name.toLowerCase().replace(/\s+/g, '') === mentionedName || m.user.name.toLowerCase() === mentionedName);
        if (member && member.userId !== req.user.id) {
          try { await createNotification(member.userId, 'mentioned', `You were mentioned in a comment on "${req.task.title}"`, req.task.projectId, taskId); } catch {}
        }
      }
    }

    // Log activity
    try { await prisma.taskActivity.create({ data: { taskId, userId: req.user.id, action: 'commented' } }); } catch {}

    res.status(201).json({ success: true, data: comment });
  } catch (err) { next(err); }
};

exports.listComments = async (req, res, next) => {
  try {
    const { taskId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { taskId }, skip, take: Number(limit),
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.comment.count({ where: { taskId } })
    ]);

    res.json({
      success: true, data: comments,
      pagination: { total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) { next(err); }
};

exports.deleteComment = async (req, res, next) => {
  try {
    if (req.comment.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Can only delete your own comments' });
    }
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(req.comment.createdAt) < fiveMinutesAgo) {
      return res.status(403).json({ success: false, message: 'Comments can only be deleted within 5 minutes of posting' });
    }
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) { next(err); }
};
