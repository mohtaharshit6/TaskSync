const { body } = require('express-validator');

const createProjectValidators = [
  body('name').trim().notEmpty().withMessage('Project name is required')
    .isLength({ max: 150 }).withMessage('Name must be under 150 characters'),
  body('description').optional().trim()
];

const updateProjectValidators = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 150 }),
  body('description').optional().trim(),
  body('status').optional().isIn(['active', 'archived']).withMessage('Status must be active or archived')
];

const addMemberValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member')
];

module.exports = { createProjectValidators, updateProjectValidators, addMemberValidators };
