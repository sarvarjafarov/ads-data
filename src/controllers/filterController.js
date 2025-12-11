/**
 * Filter Controller
 * Handles saved filters and views endpoints
 */

const { query } = require('../config/database');

/**
 * Get all saved filters for a workspace
 */
const getSavedFilters = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { filterType } = req.query;

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
      SELECT sf.*, u.username as created_by_name
      FROM saved_filters sf
      LEFT JOIN users u ON u.id = sf.user_id
      WHERE sf.workspace_id = $1
        AND (sf.user_id = $2 OR sf.is_shared = true)
    `;
    const queryParams = [workspaceId, req.user.id];

    if (filterType) {
      queryText += ` AND sf.filter_type = $3`;
      queryParams.push(filterType);
    }

    queryText += ` ORDER BY sf.is_default DESC, sf.view_count DESC, sf.created_at DESC`;

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get saved filters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved filters',
      error: error.message,
    });
  }
};

/**
 * Get a single saved filter
 */
const getSavedFilter = async (req, res) => {
  try {
    const { filterId } = req.params;

    const result = await query(
      `SELECT sf.*, u.username as created_by_name
       FROM saved_filters sf
       LEFT JOIN users u ON u.id = sf.user_id
       WHERE sf.id = $1`,
      [filterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Saved filter not found',
      });
    }

    const filter = result.rows[0];

    // Verify access (owner or shared)
    if (filter.user_id !== req.user.id && !filter.is_shared) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Increment view count
    await query(
      `UPDATE saved_filters SET view_count = view_count + 1 WHERE id = $1`,
      [filterId]
    );

    res.json({
      success: true,
      data: filter,
    });
  } catch (error) {
    console.error('Get saved filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved filter',
      error: error.message,
    });
  }
};

/**
 * Create a new saved filter
 */
const createSavedFilter = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      name,
      description,
      filter_type,
      filter_config,
      is_default,
      is_shared,
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
    if (!name || !filter_type || !filter_config) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, filter_type, filter_config',
      });
    }

    // If this is set as default, unset other defaults of same type
    if (is_default) {
      await query(
        `UPDATE saved_filters
         SET is_default = false
         WHERE workspace_id = $1 AND user_id = $2 AND filter_type = $3`,
        [workspaceId, req.user.id, filter_type]
      );
    }

    const result = await query(
      `INSERT INTO saved_filters (
        workspace_id, user_id, name, description, filter_type,
        filter_config, is_default, is_shared
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        workspaceId,
        req.user.id,
        name,
        description,
        filter_type,
        JSON.stringify(filter_config),
        is_default || false,
        is_shared || false,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create saved filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create saved filter',
      error: error.message,
    });
  }
};

/**
 * Update a saved filter
 */
const updateSavedFilter = async (req, res) => {
  try {
    const { filterId } = req.params;
    const updates = req.body;

    // Get filter and verify ownership
    const filterResult = await query(
      `SELECT * FROM saved_filters WHERE id = $1`,
      [filterId]
    );

    if (filterResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Saved filter not found',
      });
    }

    const filter = filterResult.rows[0];

    // Only owner can update
    if (filter.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can update this filter',
      });
    }

    // If setting as default, unset other defaults
    if (updates.is_default) {
      await query(
        `UPDATE saved_filters
         SET is_default = false
         WHERE workspace_id = $1 AND user_id = $2 AND filter_type = $3 AND id != $4`,
        [filter.workspace_id, req.user.id, filter.filter_type, filterId]
      );
    }

    // Build update query dynamically
    const allowedFields = [
      'name',
      'description',
      'filter_config',
      'is_default',
      'is_shared',
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'filter_config') {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(filterId);

    const result = await query(
      `UPDATE saved_filters
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
    console.error('Update saved filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update saved filter',
      error: error.message,
    });
  }
};

/**
 * Delete a saved filter
 */
const deleteSavedFilter = async (req, res) => {
  try {
    const { filterId } = req.params;

    // Get filter and verify ownership
    const filterResult = await query(
      `SELECT * FROM saved_filters WHERE id = $1`,
      [filterId]
    );

    if (filterResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Saved filter not found',
      });
    }

    const filter = filterResult.rows[0];

    // Only owner can delete
    if (filter.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can delete this filter',
      });
    }

    await query('DELETE FROM saved_filters WHERE id = $1', [filterId]);

    res.json({
      success: true,
      message: 'Saved filter deleted successfully',
    });
  } catch (error) {
    console.error('Delete saved filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete saved filter',
      error: error.message,
    });
  }
};

module.exports = {
  getSavedFilters,
  getSavedFilter,
  createSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
};
