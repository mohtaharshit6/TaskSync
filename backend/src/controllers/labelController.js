const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.listLabels = async (req, res, next) => {
  try {
    const labels = await prisma.label.findMany({
      where: { projectId: req.params.id },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: labels });
  } catch (err) { next(err); }
};

exports.createLabel = async (req, res, next) => {
  try {
    const { name, color = '#6366f1' } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Label name is required' });
    const label = await prisma.label.create({
      data: { projectId: req.params.id, name: name.trim(), color }
    });
    res.status(201).json({ success: true, data: label });
  } catch (err) { next(err); }
};

exports.deleteLabel = async (req, res, next) => {
  try {
    await prisma.label.delete({ where: { id: req.params.labelId } });
    res.json({ success: true, message: 'Label deleted' });
  } catch (err) { next(err); }
};

exports.assignLabel = async (req, res, next) => {
  try {
    const taskId  = req.params.id;
    const { labelId } = req.params;
    await prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId } },
      create: { taskId, labelId },
      update: {}
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.removeLabel = async (req, res, next) => {
  try {
    const taskId  = req.params.id;
    const { labelId } = req.params;
    await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });
    res.json({ success: true });
  } catch (err) { next(err); }
};
