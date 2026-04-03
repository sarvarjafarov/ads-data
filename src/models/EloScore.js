const { query } = require('../config/database');

class EloScore {
  static async getAll() {
    const result = await query(
      'SELECT * FROM elo_scores ORDER BY rating DESC'
    );
    return result.rows;
  }

  static async getByApproach(approachName) {
    const result = await query(
      'SELECT * FROM elo_scores WHERE approach_name = $1',
      [approachName]
    );
    return result.rows[0] || null;
  }

  static async updateRatings(winnerApproach, loserApproach) {
    const K = 32;

    // Fetch current ratings
    const winnerResult = await query(
      'SELECT * FROM elo_scores WHERE approach_name = $1',
      [winnerApproach]
    );
    const loserResult = await query(
      'SELECT * FROM elo_scores WHERE approach_name = $1',
      [loserApproach]
    );

    if (!winnerResult.rows[0] || !loserResult.rows[0]) {
      throw new Error('Approach not found');
    }

    const rWinner = parseFloat(winnerResult.rows[0].rating);
    const rLoser = parseFloat(loserResult.rows[0].rating);

    // ELO expected scores
    const eWinner = 1 / (1 + Math.pow(10, (rLoser - rWinner) / 400));
    const eLoser = 1 / (1 + Math.pow(10, (rWinner - rLoser) / 400));

    // New ratings
    const newWinnerRating = rWinner + K * (1 - eWinner);
    const newLoserRating = rLoser + K * (0 - eLoser);

    // Update winner
    await query(
      `UPDATE elo_scores
       SET rating = $1, wins = wins + 1, total_comparisons = total_comparisons + 1, updated_at = NOW()
       WHERE approach_name = $2`,
      [newWinnerRating.toFixed(2), winnerApproach]
    );

    // Update loser
    await query(
      `UPDATE elo_scores
       SET rating = $1, losses = losses + 1, total_comparisons = total_comparisons + 1, updated_at = NOW()
       WHERE approach_name = $2`,
      [newLoserRating.toFixed(2), loserApproach]
    );

    return {
      winner: { approach: winnerApproach, oldRating: rWinner, newRating: parseFloat(newWinnerRating.toFixed(2)) },
      loser: { approach: loserApproach, oldRating: rLoser, newRating: parseFloat(newLoserRating.toFixed(2)) }
    };
  }

  static async createComparison({ userId, prompt, approachA, approachB, responseA, responseB }) {
    const result = await query(
      `INSERT INTO elo_comparisons (user_id, prompt, approach_a, approach_b, response_a, response_b)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, prompt, approachA, approachB, responseA, responseB]
    );
    return result.rows[0];
  }

  static async recordPreference(comparisonId, winner) {
    const result = await query(
      `UPDATE elo_comparisons
       SET winner = $2
       WHERE comparison_id = $1 AND winner IS NULL
       RETURNING *`,
      [comparisonId, winner]
    );
    if (!result.rows[0]) {
      throw new Error('Preference already recorded or comparison not found');
    }
    return result.rows[0];
  }

  static async getComparisonById(comparisonId) {
    const result = await query(
      'SELECT * FROM elo_comparisons WHERE comparison_id = $1',
      [comparisonId]
    );
    return result.rows[0] || null;
  }
}

module.exports = EloScore;
