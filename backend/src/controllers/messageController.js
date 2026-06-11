const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../socket');
const prisma = new PrismaClient();

exports.listMessages = async (req, res, next) => {
  try {
    const messages = await prisma.message.findMany({
      where: { projectId: req.params.id },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty' });

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { chatFrozen: true }
    });

    if (project.chatFrozen && req.membership.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chat is frozen. Only admins can send messages.' });
    }

    const message = await prisma.message.create({
      data: { projectId: req.params.id, userId: req.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    });

    getIO().to(`project:${req.params.id}`).emit('new_message', { message });
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Cannot delete someone else\'s message' });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(message.createdAt) < fiveMinutesAgo) {
      return res.status(403).json({ success: false, message: 'Messages can only be deleted within 5 minutes of sending' });
    }

    await prisma.message.delete({ where: { id: req.params.messageId } });
    getIO().to(`project:${req.params.id}`).emit('message_deleted', { messageId: req.params.messageId });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.toggleFreeze = async (req, res, next) => {
  try {
    const { frozen } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { chatFrozen: Boolean(frozen) },
      select: { chatFrozen: true }
    });
    getIO().to(`project:${req.params.id}`).emit('chat_freeze_changed', { frozen: project.chatFrozen });
    res.json({ success: true, data: { chatFrozen: project.chatFrozen } });
  } catch (err) { next(err); }
};
