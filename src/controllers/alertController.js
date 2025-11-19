const Alert = require('../models/Alert');
const Workspace = require('../models/Workspace');

// Get all alerts for a workspace
const getWorkspaceAlerts = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify access
    const workspaces = await Workspace.findByUserId(req.user.id);
    if (!workspaces.some(w => w.id === workspaceId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const alerts = await Alert.findByWorkspaceId(workspaceId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts', error: error.message });
  }
};

// Create alert
const createAlert = async (req, res) => {
  try {
    const { workspaceId, name, description, adAccountId, metric, condition, threshold, comparisonPeriod, notificationChannels } = req.body;

    if (!workspaceId || !name || !metric || !condition || threshold === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Verify access
    const workspaces = await Workspace.findByUserId(req.user.id);
    if (!workspaces.some(w => w.id === workspaceId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const alert = await Alert.create({
      workspaceId,
      createdBy: req.user.id,
      name,
      description,
      adAccountId,
      metric,
      condition,
      threshold,
      comparisonPeriod,
      notificationChannels,
    });

    res.status(201).json({ success: true, message: 'Alert created successfully', data: alert });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to create alert', error: error.message });
  }
};

// Update alert
const updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    // Verify access
    const workspaces = await Workspace.findByUserId(req.user.id);
    if (!workspaces.some(w => w.id === alert.workspace_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updatedAlert = await Alert.update(id, req.body);
    res.json({ success: true, message: 'Alert updated successfully', data: updatedAlert });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert', error: error.message });
  }
};

// Delete alert
const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    // Verify access
    const workspaces = await Workspace.findByUserId(req.user.id);
    if (!workspaces.some(w => w.id === alert.workspace_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Alert.delete(id);
    res.json({ success: true, message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete alert', error: error.message });
  }
};

// Get alert history
const getAlertHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await Alert.getHistory(id);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get alert history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch history', error: error.message });
  }
};

// Get recent alerts for workspace
const getRecentAlerts = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify access
    const workspaces = await Workspace.findByUserId(req.user.id);
    if (!workspaces.some(w => w.id === workspaceId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const alerts = await Alert.getRecentAlerts(workspaceId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Get recent alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent alerts', error: error.message });
  }
};

// Acknowledge alert
const acknowledgeAlert = async (req, res) => {
  try {
    const { historyId } = req.params;
    const result = await Alert.acknowledgeAlert(historyId, req.user.id);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Alert history not found' });
    }

    res.json({ success: true, message: 'Alert acknowledged', data: result });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to acknowledge alert', error: error.message });
  }
};

module.exports = {
  getWorkspaceAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  getAlertHistory,
  getRecentAlerts,
  acknowledgeAlert,
};
