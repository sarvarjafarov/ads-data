const express = require('express');
const {
  listApproaches,
  generate,
  compare,
  submitPreference,
  getLeaderboard
} = require('../controllers/genaiEvalController');
const authenticate = require('../middleware/auth');
const promptGuard = require('../middleware/promptGuard');

const router = express.Router();

router.use(authenticate);

const guardPrompt = promptGuard({
  fields: [{ path: 'body.prompt' }],
  profile: 'strict',
});

router.get('/approaches', listApproaches);
router.post('/generate', guardPrompt, generate);
router.post('/compare', guardPrompt, compare);
router.post('/preference', submitPreference);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
