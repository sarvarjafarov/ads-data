const { query } = require('../config/database');

class Workspace {
  /**
   * Create a new workspace
   */
  static async create(data) {
    const { name, ownerId, description, settings } = data;

    const result = await query(
      `INSERT INTO workspaces (name, owner_id, description, settings)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, owner_id, description, settings, created_at, updated_at`,
      [name, ownerId, description || null, JSON.stringify(settings || {})]
    );

    const workspace = result.rows[0];

    // Add owner as a workspace member with owner role
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
       VALUES ($1, $2, 'owner', $2)`,
      [workspace.id, ownerId]
    );

    return workspace;
  }

  /**
   * Get all workspaces for a user
   */
  static async findByUserId(userId) {
    const result = await query(
      `SELECT w.id, w.name, w.owner_id, w.description, w.settings,
              wm.role, w.created_at, w.updated_at
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get a workspace by ID
   */
  static async findById(workspaceId, userId = null) {
    let queryText = `
      SELECT w.id, w.name, w.owner_id, w.description, w.settings,
             w.created_at, w.updated_at
      FROM workspaces w
    `;

    const params = [workspaceId];

    if (userId) {
      queryText += `
        JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE w.id = $1 AND wm.user_id = $2
      `;
      params.push(userId);
    } else {
      queryText += ' WHERE w.id = $1';
    }

    const result = await query(queryText, params);
    return result.rows[0] || null;
  }

  /**
   * Update a workspace
   */
  static async update(workspaceId, data) {
    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCounter++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCounter++}`);
      values.push(data.description);
    }
    if (data.settings !== undefined) {
      updates.push(`settings = $${paramCounter++}`);
      values.push(JSON.stringify(data.settings));
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(workspaceId);

    const result = await query(
      `UPDATE workspaces
       SET ${updates.join(', ')}
       WHERE id = $${paramCounter}
       RETURNING id, name, owner_id, description, settings, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a workspace
   */
  static async delete(workspaceId) {
    const result = await query(
      'DELETE FROM workspaces WHERE id = $1 RETURNING id',
      [workspaceId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get workspace members
   */
  static async getMembers(workspaceId) {
    const result = await query(
      `SELECT wm.id, wm.user_id, wm.role, wm.permissions, wm.joined_at,
              u.username, u.email, u.company_name
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.joined_at ASC`,
      [workspaceId]
    );

    return result.rows;
  }

  /**
   * Add a member to workspace
   */
  static async addMember(workspaceId, userId, role, invitedBy) {
    const result = await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, workspace_id, user_id, role, permissions, joined_at`,
      [workspaceId, userId, role || 'member', invitedBy]
    );

    return result.rows[0];
  }

  /**
   * Remove a member from workspace
   */
  static async removeMember(workspaceId, userId) {
    const result = await query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 RETURNING id',
      [workspaceId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Update member role
   */
  static async updateMemberRole(workspaceId, userId, role) {
    const result = await query(
      `UPDATE workspace_members
       SET role = $1
       WHERE workspace_id = $2 AND user_id = $3
       RETURNING id, workspace_id, user_id, role, permissions, joined_at`,
      [role, workspaceId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if user is a member of workspace
   */
  static async isMember(workspaceId, userId) {
    const result = await query(
      `SELECT role FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    return result.rows.length > 0 ? result.rows[0].role : null;
  }

  /**
   * Check if user is owner or admin of workspace
   */
  static async hasAdminAccess(workspaceId, userId) {
    const result = await query(
      `SELECT role FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')`,
      [workspaceId, userId]
    );

    return result.rows.length > 0;
  }
}

module.exports = Workspace;
