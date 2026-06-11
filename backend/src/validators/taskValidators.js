const { body, query } = require('express-validator');

const createTaskValidators = [
  body('projectId').notEmpty().withMessage('Project ID required'),
  body('title').trim().notEmpty().withMessage('Task title is required')
    .isLength({ max: 255 }).withMessage('Title must be under 255 characters'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('assignedTo').optional({ nullable: true }).isUUID().withMessage('Invalid user ID'),
  body('dueDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid date format')
];

const updateTaskValidators = [
  body('title').optional().trim().notEmpty().isLength({ max: 255 }),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo', 'in_progress', 'done']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('assignedTo').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('Invalid user ID'),
  body('dueDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid date format')
];

const listTaskValidators = [
  query('projectId').notEmpty().withMessage('Project ID required'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt()
];

module.exports = { createTaskValidators, updateTaskValidators, listTaskValidators };
