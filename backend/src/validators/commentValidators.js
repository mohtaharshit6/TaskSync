const { body, query } = require('express-validator');

const createCommentValidators = [
  body('taskId').notEmpty().withMessage('Task ID required'),
  body('content').trim().notEmpty().withMessage('Comment content is required')
    .isLength({ max: 2000 }).withMessage('Comment must be under 2000 characters')
];

const listCommentValidators = [
  query('taskId').notEmpty().withMessage('Task ID required'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

module.exports = { createCommentValidators, listCommentValidators };
