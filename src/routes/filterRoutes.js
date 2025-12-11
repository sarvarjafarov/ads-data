const express = require('express');
const {
  getSavedFilters,
  getSavedFilter,
  createSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
} = require('../controllers/filterController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All filter routes require authentication
router.use(authenticate);

// Saved filters for a workspace
router.get('/workspaces/:workspaceId/filters', getSavedFilters);
router.post('/workspaces/:workspaceId/filters', createSavedFilter);

// Individual filter operations
router.get('/filters/:filterId', getSavedFilter);
router.put('/filters/:filterId', updateSavedFilter);
router.delete('/filters/:filterId', deleteSavedFilter);

module.exports = router;
