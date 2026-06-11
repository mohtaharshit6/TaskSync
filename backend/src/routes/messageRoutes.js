const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');
const requireProjectMember = require('../middleware/projectMembership');
const { requireProjectRole } = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');

router.get('/projects/:id/messages',
  authMiddleware, requireProjectMember('project'),
  messageController.listMessages);

router.post('/projects/:id/messages',
  authMiddleware, requireProjectMember('project'),
  body('content').trim().notEmpty().withMessage('Message cannot be empty')
    .isLength({ max: 1000 }).withMessage('Message must be under 1000 characters'),
  validate,
  messageController.sendMessage);

router.delete('/projects/:id/messages/:messageId',
  authMiddleware, requireProjectMember('project'),
  messageController.deleteMessage);

router.put('/projects/:id/chat/freeze',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  messageController.toggleFreeze);

module.exports = router;
