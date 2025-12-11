/**
 * Comment Controller
 * Handles comments and collaboration features
 */

const { query } = require('../config/database');

/**
 * Get comments for an entity
 */
const getComments = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { entity_type, entity_id } = req.query;

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
      SELECT c.*, u.username, u.email
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = $1
    `;
    const queryParams = [workspaceId];
    let paramIndex = 2;

    if (entity_type) {
      queryText += ` AND c.entity_type = $${paramIndex}`;
      queryParams.push(entity_type);
      paramIndex++;
    }

    if (entity_id) {
      queryText += ` AND c.entity_id = $${paramIndex}`;
      queryParams.push(entity_id);
      paramIndex++;
    }

    queryText += ` ORDER BY c.created_at DESC`;

    const result = await query(queryText, queryParams);

    // Organize comments into threads
    const comments = result.rows;
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create map
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into threads
    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    res.json({
      success: true,
      data: rootComments,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message,
    });
  }
};

/**
 * Create a new comment
 */
const createComment = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      entity_type,
      entity_id,
      parent_comment_id,
      comment_text,
      mentions,
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
    if (!entity_type || !entity_id || !comment_text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const result = await query(
      `INSERT INTO comments (
        workspace_id, entity_type, entity_id, parent_comment_id,
        user_id, comment_text, mentions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        workspaceId,
        entity_type,
        entity_id,
        parent_comment_id || null,
        req.user.id,
        comment_text,
        JSON.stringify(mentions || []),
      ]
    );

    // Get user info
    const commentWithUser = await query(
      `SELECT c.*, u.username, u.email
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [result.rows[0].id]
    );

    // TODO: Send notifications to mentioned users

    res.status(201).json({
      success: true,
      data: commentWithUser.rows[0],
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create comment',
      error: error.message,
    });
  }
};

/**
 * Update a comment
 */
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { comment_text, is_resolved } = req.body;

    // Get comment and verify ownership
    const commentResult = await query(
      `SELECT * FROM comments WHERE id = $1`,
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const comment = commentResult.rows[0];

    // Only owner can update comment text, anyone in workspace can resolve
    if (comment_text && comment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the author can edit the comment',
      });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (comment_text) {
      updates.push(`comment_text = $${paramIndex}`);
      values.push(comment_text);
      paramIndex++;
    }

    if (is_resolved !== undefined) {
      updates.push(`is_resolved = $${paramIndex}`);
      values.push(is_resolved);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(commentId);

    const result = await query(
      `UPDATE comments
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comment',
      error: error.message,
    });
  }
};

/**
 * Delete a comment
 */
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    // Get comment and verify ownership
    const commentResult = await query(
      `SELECT * FROM comments WHERE id = $1`,
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const comment = commentResult.rows[0];

    // Only owner can delete
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the author can delete this comment',
      });
    }

    await query('DELETE FROM comments WHERE id = $1', [commentId]);

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message,
    });
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
};
