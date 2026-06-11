const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');
const prisma = new PrismaClient();

// Internal helper — called by task and project controllers to create a notification
// and deliver it in real-time to the recipient's personal socket room.
const createNotification = async (userId, type, message, projectId, taskId = null) => {
  const notification = await prisma.notification.create({
    data: { userId, type, message, projectId, taskId }
  });
  try { getIO().to(`user:${userId}`).emit('notification', notification); } catch {}
  return notification;
};

exports.createNotification = createNotification;

exports.listNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { project: { select: { id: true, name: true } } }
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) { next(err); }
};

exports.markOneRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
        ...(projectId && { projectId })
      },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};
