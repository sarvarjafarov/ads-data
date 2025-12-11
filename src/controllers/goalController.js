/**
 * Goal Tracking Controller
 * Handles campaign goals and progress tracking
 */

const { query } = require('../config/database');

/**
 * Get all goals for a workspace
 */
const getGoals = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { status, campaign_id } = req.query;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    let queryText = `
      SELECT cg.*, u.username as created_by_name,
             CASE
               WHEN target_value > 0 THEN ROUND((current_value / target_value * 100)::numeric, 2)
               ELSE 0
             END as progress_percentage
      FROM campaign_goals cg
      LEFT JOIN users u ON u.id = cg.created_by
      WHERE cg.workspace_id = $1
    `;
    const queryParams = [workspaceId];
    let paramIndex = 2;

    if (status) {
      queryText += ` AND cg.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (campaign_id) {
      queryText += ` AND cg.campaign_id = $${paramIndex}`;
      queryParams.push(campaign_id);
      paramIndex++;
    }

    queryText += ` ORDER BY cg.end_date DESC, cg.created_at DESC`;

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goals',
      error: error.message,
    });
  }
};

/**
 * Get a single goal with progress history
 */
const getGoal = async (req, res) => {
  try {
    const { goalId } = req.params;

    const result = await query(
      `SELECT cg.*, u.username as created_by_name,
              CASE
                WHEN target_value > 0 THEN ROUND((current_value / target_value * 100)::numeric, 2)
                ELSE 0
              END as progress_percentage
       FROM campaign_goals cg
       LEFT JOIN users u ON u.id = cg.created_by
       WHERE cg.id = $1`,
      [goalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
    }

    const goal = result.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [goal.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get progress history
    const historyResult = await query(
      `SELECT * FROM goal_progress_history
       WHERE goal_id = $1
       ORDER BY recorded_at DESC
       LIMIT 100`,
      [goalId]
    );

    res.json({
      success: true,
      data: {
        ...goal,
        progress_history: historyResult.rows,
      },
    });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goal',
      error: error.message,
    });
  }
};

/**
 * Create a new goal
 */
const createGoal = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      campaign_id,
      goal_name,
      goal_type,
      target_value,
      start_date,
      end_date,
      alert_threshold,
      platform,
    } = req.body;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Validate required fields
    if (!goal_name || !goal_type || !target_value || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const result = await query(
      `INSERT INTO campaign_goals (
        workspace_id, campaign_id, goal_name, goal_type, target_value,
        start_date, end_date, alert_threshold, platform, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        workspaceId,
        campaign_id || null,
        goal_name,
        goal_type,
        target_value,
        start_date,
        end_date,
        alert_threshold || 80,
        platform || null,
        req.user.id,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create goal',
      error: error.message,
    });
  }
};

/**
 * Update a goal
 */
const updateGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const updates = req.body;

    // Get goal and verify access
    const goalResult = await query(
      `SELECT * FROM campaign_goals WHERE id = $1`,
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
    }

    const goal = goalResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [goal.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Build update query
    const allowedFields = [
      'goal_name',
      'target_value',
      'current_value',
      'start_date',
      'end_date',
      'status',
      'alert_threshold',
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Record progress history if current_value is being updated
    if (updates.current_value !== undefined) {
      const progressPercentage =
        goal.target_value > 0
          ? (updates.current_value / goal.target_value) * 100
          : 0;

      await query(
        `INSERT INTO goal_progress_history (goal_id, recorded_value, progress_percentage)
         VALUES ($1, $2, $3)`,
        [goalId, updates.current_value, progressPercentage]
      );
    }

    values.push(goalId);

    const result = await query(
      `UPDATE campaign_goals
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update goal',
      error: error.message,
    });
  }
};

/**
 * Delete a goal
 */
const deleteGoal = async (req, res) => {
  try {
    const { goalId } = req.params;

    // Get goal and verify access
    const goalResult = await query(
      `SELECT * FROM campaign_goals WHERE id = $1`,
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
    }

    const goal = goalResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [goal.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await query('DELETE FROM campaign_goals WHERE id = $1', [goalId]);

    res.json({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete goal',
      error: error.message,
    });
  }
};

module.exports = {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
};
