const express = require('express');
const router = express.Router();
const subtaskController = require('../controllers/subtaskController');
const authMiddleware = require('../middleware/authMiddleware');
const requireProjectMember = require('../middleware/projectMembership');

router.get('/tasks/:id/subtasks',
  authMiddleware, requireProjectMember('task:param'),
  subtaskController.listSubtasks);

router.post('/tasks/:id/subtasks',
  authMiddleware, requireProjectMember('task:param'),
  subtaskController.createSubtask);

router.patch('/tasks/:id/subtasks/:subtaskId',
  authMiddleware, requireProjectMember('task:param'),
  subtaskController.toggleSubtask);

router.delete('/tasks/:id/subtasks/:subtaskId',
  authMiddleware, requireProjectMember('task:param'),
  subtaskController.deleteSubtask);

module.exports = router;
