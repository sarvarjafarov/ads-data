const express = require('express');
const {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
} = require('../controllers/goalController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All goal routes require authentication
router.use(authenticate);

// Goals for a workspace
router.get('/workspaces/:workspaceId/goals', getGoals);
router.post('/workspaces/:workspaceId/goals', createGoal);

// Individual goal operations
router.get('/goals/:goalId', getGoal);
router.put('/goals/:goalId', updateGoal);
router.delete('/goals/:goalId', deleteGoal);

module.exports = router;
