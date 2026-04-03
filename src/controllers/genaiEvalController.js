const EloScore = require('../models/EloScore');
const genaiEvalService = require('../services/genaiEval');

exports.listApproaches = async (req, res) => {
  try {
    const approaches = genaiEvalService.listApproaches();
    res.json({ success: true, data: { approaches, count: approaches.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.generate = async (req, res) => {
  try {
    const { prompt, approach } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }

    const approachName = approach || genaiEvalService.getRandomApproach();
    const result = await genaiEvalService.generateWithApproach(prompt.trim(), approachName);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.compare = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }

    const trimmedPrompt = prompt.trim();
    const [approachA, approachB] = genaiEvalService.getTwoRandomApproaches();

    // Generate both responses in parallel
    const [resultA, resultB] = await Promise.all([
      genaiEvalService.generateWithApproach(trimmedPrompt, approachA),
      genaiEvalService.generateWithApproach(trimmedPrompt, approachB)
    ]);

    // Store comparison in database
    const comparison = await EloScore.createComparison({
      userId: req.user?.id || null,
      prompt: trimmedPrompt,
      approachA,
      approachB,
      responseA: resultA.response,
      responseB: resultB.response
    });

    res.json({
      success: true,
      data: {
        comparisonId: comparison.comparison_id,
        optionA: {
          approach: resultA.approach,
          description: genaiEvalService.listApproaches().find(a => a.name === approachA)?.description,
          model: resultA.model,
          response: resultA.response,
          tokensUsed: resultA.tokensUsed,
          durationMs: resultA.durationMs
        },
        optionB: {
          approach: resultB.approach,
          description: genaiEvalService.listApproaches().find(a => a.name === approachB)?.description,
          model: resultB.model,
          response: resultB.response,
          tokensUsed: resultB.tokensUsed,
          durationMs: resultB.durationMs
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.submitPreference = async (req, res) => {
  try {
    const { comparisonId, winner } = req.body;

    if (!comparisonId) {
      return res.status(400).json({ success: false, message: 'comparisonId is required' });
    }
    if (!winner || !['a', 'b'].includes(winner)) {
      return res.status(400).json({ success: false, message: 'winner must be "a" or "b"' });
    }

    // Fetch the comparison
    const comparison = await EloScore.getComparisonById(comparisonId);
    if (!comparison) {
      return res.status(404).json({ success: false, message: 'Comparison not found' });
    }

    // Map winner to approach name
    const winnerApproach = winner === 'a' ? comparison.approach_a : comparison.approach_b;
    const loserApproach = winner === 'a' ? comparison.approach_b : comparison.approach_a;

    // Record preference (will throw if already recorded)
    try {
      await EloScore.recordPreference(comparisonId, winnerApproach);
    } catch (err) {
      return res.status(409).json({ success: false, message: err.message });
    }

    // Update ELO ratings
    const ratingUpdate = await EloScore.updateRatings(winnerApproach, loserApproach);

    res.json({
      success: true,
      data: {
        winner: ratingUpdate.winner,
        loser: ratingUpdate.loser
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await EloScore.getAll();
    const totalComparisons = leaderboard.reduce((sum, r) => sum + r.total_comparisons, 0) / 2;

    res.json({
      success: true,
      data: {
        leaderboard: leaderboard.map(r => ({
          rank: leaderboard.indexOf(r) + 1,
          approach: r.approach_name,
          rating: parseFloat(r.rating),
          wins: r.wins,
          losses: r.losses,
          totalComparisons: r.total_comparisons
        })),
        totalPreferencesRecorded: Math.round(totalComparisons)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
