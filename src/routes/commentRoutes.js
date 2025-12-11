const express = require('express');
const {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} = require('../controllers/commentController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All comment routes require authentication
router.use(authenticate);

// Comments for a workspace
router.get('/workspaces/:workspaceId/comments', getComments);
router.post('/workspaces/:workspaceId/comments', createComment);

// Individual comment operations
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

module.exports = router;
