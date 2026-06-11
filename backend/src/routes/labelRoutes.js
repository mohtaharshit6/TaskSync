const express = require('express');
const router = express.Router();
const labelController = require('../controllers/labelController');
const authMiddleware = require('../middleware/authMiddleware');
const requireProjectMember = require('../middleware/projectMembership');
const { requireProjectRole } = require('../middleware/roleMiddleware');

// Project label CRUD
router.get('/projects/:id/labels',
  authMiddleware, requireProjectMember('project'),
  labelController.listLabels);

router.post('/projects/:id/labels',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  labelController.createLabel);

router.delete('/projects/:id/labels/:labelId',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  labelController.deleteLabel);

// Assign / remove label on a task
router.post('/tasks/:id/labels/:labelId',
  authMiddleware, requireProjectMember('task:param'),
  labelController.assignLabel);

router.delete('/tasks/:id/labels/:labelId',
  authMiddleware, requireProjectMember('task:param'),
  labelController.removeLabel);

module.exports = router;
