const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');
const requireProjectMember = require('../middleware/projectMembership');
const { createCommentValidators, listCommentValidators } = require('../validators/commentValidators');
const validate = require('../middleware/validate');

// Validate first so taskId is guaranteed present before the membership check
router.post('/comments',
  authMiddleware, createCommentValidators, validate,
  requireProjectMember('comment:body'),
  commentController.addComment);

router.get('/comments',
  authMiddleware, listCommentValidators, validate,
  requireProjectMember('comment:query'),
  commentController.listComments);

// comment:param fetches comment + task and attaches req.comment; controller reuses it
router.delete('/comments/:id',
  authMiddleware, requireProjectMember('comment:param'),
  commentController.deleteComment);

module.exports = router;
