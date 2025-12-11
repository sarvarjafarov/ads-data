const User = require('../models/User');
const Workspace = require('../models/Workspace');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get pending users (admin only)
const getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await User.findPending();

    res.json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve user (admin only)
const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.approve(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Create a default workspace for the approved user
    try {
      const existingWorkspaces = await Workspace.findByUserId(user.id);

      if (existingWorkspaces.length === 0) {
        await Workspace.create({
          name: `${user.company_name || user.username}'s Workspace`,
          ownerId: user.id,
          description: 'Default workspace',
          settings: {
            defaultCurrency: 'USD',
            timezone: 'UTC',
          },
        });
      }
    } catch (workspaceError) {
      console.error('Error creating workspace for approved user:', workspaceError);
      // Don't fail the approval if workspace creation fails
    }

    res.json({
      success: true,
      message: 'User approved successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reject user (admin only)
const rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.reject(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User rejected successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  deleteUser,
};
