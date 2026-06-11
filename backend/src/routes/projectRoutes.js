const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');
const requireProjectMember = require('../middleware/projectMembership');
const { requireProjectRole } = require('../middleware/roleMiddleware');
const { createProjectValidators, updateProjectValidators, addMemberValidators } = require('../validators/projectValidators');
const validate = require('../middleware/validate');

// No membership check — anyone authenticated can create a project or list their own
router.post('/projects', authMiddleware, createProjectValidators, validate, projectController.createProject);
router.get('/projects', authMiddleware, projectController.listProjects);

// Membership required for all single-project operations
router.get('/projects/:id',
  authMiddleware, requireProjectMember('project'),
  projectController.getProject);

router.put('/projects/:id',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  updateProjectValidators, validate, projectController.updateProject);

router.delete('/projects/:id',
  authMiddleware, requireProjectMember('project'),
  projectController.deleteProject);

router.post('/projects/:id/members',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  addMemberValidators, validate, projectController.addMember);

router.delete('/projects/:id/members/:userId',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  projectController.removeMember);

router.put('/projects/:id/members/:userId/role',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  projectController.updateMemberRole);

router.put('/projects/:id/transfer',
  authMiddleware, requireProjectMember('project'),
  projectController.transferOwnership);

// Invite code — admin only; no membership check needed for join
router.get('/projects/:id/invite-code',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  projectController.getInviteCode);

router.put('/projects/:id/invite-code',
  authMiddleware, requireProjectMember('project'), requireProjectRole('admin'),
  projectController.regenerateInviteCode);

router.post('/projects/join', authMiddleware, projectController.joinViaCode);

router.put('/projects/:id/archive',
  authMiddleware, requireProjectMember('project'),
  projectController.archiveProject);

router.put('/projects/:id/unarchive',
  authMiddleware, requireProjectMember('project'),
  projectController.unarchiveProject);

module.exports = router;
