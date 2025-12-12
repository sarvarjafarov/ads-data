const Workspace = require('../models/Workspace');

/**
 * Get all workspaces for the current user
 */
const getUserWorkspaces = async (req, res) => {
  try {
    let workspaces = await Workspace.findByUserId(req.user.id);

    // Safety net: If user has no workspaces, create a default one
    if (workspaces.length === 0) {
      console.log(`User ${req.user.id} has no workspaces. Creating default workspace.`);

      const User = require('../models/User');
      const user = await User.findById(req.user.id);

      const defaultWorkspace = await Workspace.create({
        name: `${user.company_name || user.username}'s Workspace`,
        ownerId: req.user.id,
        description: 'Default workspace',
        settings: {
          defaultCurrency: 'USD',
          timezone: 'UTC',
        },
      });

      // Re-fetch workspaces to include the newly created one
      workspaces = await Workspace.findByUserId(req.user.id);
    }

    res.json({
      success: true,
      count: workspaces.length,
      data: workspaces,
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspaces',
      error: error.message,
    });
  }
};

/**
 * Get a specific workspace by ID
 */
const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;

    const workspace = await Workspace.findById(id, req.user.id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or you do not have access',
      });
    }

    res.json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace',
      error: error.message,
    });
  }
};

/**
 * Create a new workspace
 */
const createWorkspace = async (req, res) => {
  try {
    const { name, description, settings } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required',
      });
    }

    const workspace = await Workspace.create({
      name,
      ownerId: req.user.id,
      description,
      settings,
    });

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: workspace,
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workspace',
      error: error.message,
    });
  }
};

/**
 * Update a workspace
 */
const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, settings } = req.body;

    // Check if user has admin access
    const hasAccess = await Workspace.hasAdminAccess(id, req.user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this workspace',
      });
    }

    const workspace = await Workspace.update(id, {
      name,
      description,
      settings,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    res.json({
      success: true,
      message: 'Workspace updated successfully',
      data: workspace,
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace',
      error: error.message,
    });
  }
};

/**
 * Delete a workspace
 */
const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    const workspace = await Workspace.findById(id);

    if (!workspace || workspace.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can delete it',
      });
    }

    await Workspace.delete(id);

    res.json({
      success: true,
      message: 'Workspace deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workspace',
      error: error.message,
    });
  }
};

/**
 * Get workspace members
 */
const getWorkspaceMembers = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access to workspace
    const role = await Workspace.isMember(id, req.user.id);

    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this workspace',
      });
    }

    const members = await Workspace.getMembers(id);

    res.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    console.error('Error fetching workspace members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace members',
      error: error.message,
    });
  }
};

/**
 * Add a member to workspace
 */
const addWorkspaceMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    // Check if user has admin access
    const hasAccess = await Workspace.hasAdminAccess(id, req.user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add members',
      });
    }

    const member = await Workspace.addMember(id, userId, role, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: member,
    });
  } catch (error) {
    console.error('Error adding workspace member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member',
      error: error.message,
    });
  }
};

/**
 * Remove a member from workspace
 */
const removeWorkspaceMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Check if user has admin access
    const hasAccess = await Workspace.hasAdminAccess(id, req.user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove members',
      });
    }

    await Workspace.removeMember(id, userId);

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Error removing workspace member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message,
    });
  }
};

module.exports = {
  getUserWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
};
