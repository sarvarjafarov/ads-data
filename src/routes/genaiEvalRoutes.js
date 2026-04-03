const express = require('express');
const {
  listApproaches,
  generate,
  compare,
  submitPreference,
  getLeaderboard
} = require('../controllers/genaiEvalController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/approaches', listApproaches);
router.post('/generate', generate);
router.post('/compare', compare);
router.post('/preference', submitPreference);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
