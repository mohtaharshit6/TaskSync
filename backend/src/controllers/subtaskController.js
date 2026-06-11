const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.listSubtasks = async (req, res, next) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { taskId: req.params.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: subtasks });
  } catch (err) { next(err); }
};

exports.createSubtask = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Subtask title is required' });
    const subtask = await prisma.subtask.create({
      data: { taskId: req.params.id, title: title.trim() }
    });
    res.status(201).json({ success: true, data: subtask });
  } catch (err) { next(err); }
};

exports.toggleSubtask = async (req, res, next) => {
  try {
    const existing = await prisma.subtask.findUnique({ where: { id: req.params.subtaskId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Subtask not found' });
    const updated = await prisma.subtask.update({
      where: { id: req.params.subtaskId },
      data: { done: !existing.done }
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.deleteSubtask = async (req, res, next) => {
  try {
    await prisma.subtask.delete({ where: { id: req.params.subtaskId } });
    res.json({ success: true, message: 'Subtask deleted' });
  } catch (err) { next(err); }
};
