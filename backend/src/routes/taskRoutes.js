const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');
const requireProjectMember = require('../middleware/projectMembership');
const { createTaskValidators, updateTaskValidators, listTaskValidators } = require('../validators/taskValidators');
const validate = require('../middleware/validate');

// Validate first so projectId is guaranteed present before the membership check
router.post('/tasks',
  authMiddleware, createTaskValidators, validate,
  requireProjectMember('task:body'),
  taskController.createTask);

router.get('/tasks',
  authMiddleware, listTaskValidators, validate,
  requireProjectMember('task:query'),
  taskController.listTasks);

// My Tasks — must be before /tasks/:id so "my" isn't treated as a task id
router.get('/tasks/my', authMiddleware, taskController.getMyTasks);

// task:param fetches the task and attaches req.task; controllers reuse it
router.get('/tasks/:id',
  authMiddleware, requireProjectMember('task:param'),
  taskController.getTask);

router.put('/tasks/:id',
  authMiddleware, updateTaskValidators, validate,
  requireProjectMember('task:param'),
  taskController.updateTask);

router.delete('/tasks/:id',
  authMiddleware, requireProjectMember('task:param'),
  taskController.deleteTask);

router.get('/tasks/:id/activity',
  authMiddleware, requireProjectMember('task:param'),
  taskController.listTaskActivity);

module.exports = router;
