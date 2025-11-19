const express = require('express');
const {
  getUserWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
} = require('../controllers/workspaceController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All workspace routes require authentication
router.use(authenticate);

// Workspace CRUD
router.get('/', getUserWorkspaces);
router.get('/:id', getWorkspaceById);
router.post('/', createWorkspace);
router.put('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);

// Workspace members
router.get('/:id/members', getWorkspaceMembers);
router.post('/:id/members', addWorkspaceMember);
router.delete('/:id/members/:userId', removeWorkspaceMember);

module.exports = router;
