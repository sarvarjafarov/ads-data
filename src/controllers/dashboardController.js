const Dashboard = require('../models/Dashboard');
const Workspace = require('../models/Workspace');
const widgetDataService = require('../services/widgetDataService');
const { startAIAnalysisJob, getJobStatus } = require('../services/backgroundJobs');
const crypto = require('crypto');

// Get all dashboards for a workspace
const getWorkspaceDashboards = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === workspaceId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this workspace',
      });
    }

    const dashboards = await Dashboard.findByWorkspaceId(workspaceId);

    res.json({
      success: true,
      data: dashboards,
    });
  } catch (error) {
    console.error('Get workspace dashboards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboards',
      error: error.message,
    });
  }
};

// Get single dashboard with widgets
const getDashboard = async (req, res) => {
  try {
    const { id } = req.params;

    const dashboard = await Dashboard.getWithWidgets(id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard',
      error: error.message,
    });
  }
};

// Create new dashboard
const createDashboard = async (req, res) => {
  try {
    const { name, workspaceId, description } = req.body;

    if (!name || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Name and workspace ID are required',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === workspaceId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this workspace',
      });
    }

    const dashboard = await Dashboard.create({
      name,
      workspaceId,
      createdBy: req.user.id,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Dashboard created successfully',
      data: dashboard,
    });
  } catch (error) {
    console.error('Create dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dashboard',
      error: error.message,
    });
  }
};

// Update dashboard
const updateDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const dashboard = await Dashboard.findById(id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    const updatedDashboard = await Dashboard.update(id, {
      name,
      description,
    });

    res.json({
      success: true,
      message: 'Dashboard updated successfully',
      data: updatedDashboard,
    });
  } catch (error) {
    console.error('Update dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dashboard',
      error: error.message,
    });
  }
};

// Delete dashboard
const deleteDashboard = async (req, res) => {
  try {
    const { id } = req.params;

    const dashboard = await Dashboard.findById(id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    await Dashboard.delete(id);

    res.json({
      success: true,
      message: 'Dashboard deleted successfully',
    });
  } catch (error) {
    console.error('Delete dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dashboard',
      error: error.message,
    });
  }
};

// Add widget to dashboard
const addWidget = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { widgetType, title, description, position, dataSource, chartConfig, filters } = req.body;

    if (!widgetType || !title) {
      return res.status(400).json({
        success: false,
        message: 'Widget type and title are required',
      });
    }

    const dashboard = await Dashboard.findById(dashboardId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    const widget = await Dashboard.addWidget(dashboardId, {
      widgetType,
      title,
      description,
      position,
      dataSource,
      chartConfig,
      filters,
    });

    res.status(201).json({
      success: true,
      message: 'Widget added successfully',
      data: widget,
    });
  } catch (error) {
    console.error('Add widget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add widget',
      error: error.message,
    });
  }
};

// Update widget
const updateWidget = async (req, res) => {
  try {
    const { widgetId } = req.params;
    const { widgetType, title, description, position, dataSource, chartConfig, filters } = req.body;

    const widget = await Dashboard.updateWidget(widgetId, {
      widgetType,
      title,
      description,
      position,
      dataSource,
      chartConfig,
      filters,
    });

    if (!widget) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found',
      });
    }

    res.json({
      success: true,
      message: 'Widget updated successfully',
      data: widget,
    });
  } catch (error) {
    console.error('Update widget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update widget',
      error: error.message,
    });
  }
};

// Delete widget
const deleteWidget = async (req, res) => {
  try {
    const { widgetId } = req.params;

    const widget = await Dashboard.deleteWidget(widgetId);

    if (!widget) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found',
      });
    }

    res.json({
      success: true,
      message: 'Widget deleted successfully',
    });
  } catch (error) {
    console.error('Delete widget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete widget',
      error: error.message,
    });
  }
};

// Create share link for dashboard
const createShareLink = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { expiresAt, password, allowExport } = req.body;

    const dashboard = await Dashboard.findById(dashboardId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    const shareLink = await Dashboard.createShareLink(dashboardId, req.user.id, {
      expiresAt,
      password,
      allowExport,
    });

    res.status(201).json({
      success: true,
      message: 'Share link created successfully',
      data: shareLink,
    });
  } catch (error) {
    console.error('Create share link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create share link',
      error: error.message,
    });
  }
};

// Get all share links for a dashboard
const getShareLinks = async (req, res) => {
  try {
    const { dashboardId } = req.params;

    const dashboard = await Dashboard.findById(dashboardId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    const shareLinks = await Dashboard.getShareLinks(dashboardId);

    res.json({
      success: true,
      data: shareLinks,
    });
  } catch (error) {
    console.error('Get share links error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch share links',
      error: error.message,
    });
  }
};

// Get shared dashboard (public access)
const getSharedDashboard = async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { password } = req.query;

    // Validate password if required
    const isValid = await Dashboard.validateSharePassword(shareToken, password || '');
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
        requiresPassword: true,
      });
    }

    const result = await Dashboard.getByShareToken(shareToken);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found or expired',
      });
    }

    res.json({
      success: true,
      data: {
        dashboard: result.dashboard,
        allowExport: result.share.allow_export,
      },
    });
  } catch (error) {
    console.error('Get shared dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shared dashboard',
      error: error.message,
    });
  }
};

// Delete share link
const deleteShareLink = async (req, res) => {
  try {
    const { shareId } = req.params;

    const result = await Dashboard.deleteShareLink(shareId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found',
      });
    }

    res.json({
      success: true,
      message: 'Share link deleted successfully',
    });
  } catch (error) {
    console.error('Delete share link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete share link',
      error: error.message,
    });
  }
};

// Toggle share link active status
const toggleShareLink = async (req, res) => {
  try {
    const { shareId } = req.params;
    const { isActive } = req.body;

    const result = await Dashboard.toggleShareLink(shareId, isActive);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found',
      });
    }

    res.json({
      success: true,
      message: `Share link ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: result,
    });
  } catch (error) {
    console.error('Toggle share link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle share link',
      error: error.message,
    });
  }
};

// Template functions
const { getTemplates, getTemplateById } = require('../services/templates');

// AI Dashboard generation
const {
  generateDashboardFromPrompt,
  generateRecommendations,
  suggestDashboardImprovements,
  AVAILABLE_WIDGETS,
  AVAILABLE_METRICS,
} = require('../services/aiDashboard');

// Get all available templates
const listTemplates = async (req, res) => {
  try {
    const templates = getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
  }
};

// Create dashboard from template
const createFromTemplate = async (req, res) => {
  try {
    const { templateId, workspaceId, name, adAccountId } = req.body;

    if (!templateId || !workspaceId || !name) {
      return res.status(400).json({ success: false, message: 'Template ID, workspace ID, and name are required' });
    }

    // Verify access
    const workspaces = await Workspace.findByUserId(req.user.id);
    if (!workspaces.some(w => w.id === workspaceId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this workspace' });
    }

    // Get template
    const template = getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Create dashboard
    const dashboard = await Dashboard.create({
      name,
      workspaceId,
      createdBy: req.user.id,
      description: `Created from ${template.name} template`,
    });

    // Create widgets from template
    for (const widgetDef of template.widgets) {
      await Dashboard.addWidget(dashboard.id, {
        widgetType: widgetDef.widgetType,
        title: widgetDef.title,
        position: widgetDef.position,
        dataSource: {
          adAccountId: adAccountId || null,
          metric: widgetDef.metric,
          dateRange: 'last_30_days',
        },
        chartConfig: {},
        filters: {},
      });
    }

    // Get complete dashboard with widgets
    const completeDashboard = await Dashboard.getWithWidgets(dashboard.id);

    res.status(201).json({
      success: true,
      message: `Dashboard created from ${template.name} template`,
      data: completeDashboard,
    });
  } catch (error) {
    console.error('Create from template error:', error);
    res.status(500).json({ success: false, message: 'Failed to create dashboard from template', error: error.message });
  }
};

// Generate dashboard from AI prompt
const generateAIDashboard = async (req, res) => {
  try {
    const { prompt, workspaceId, adAccountId, customSourceIds = [], createDashboard: shouldCreate } = req.body;

    if (!prompt || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Prompt and workspace ID are required',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === workspaceId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this workspace',
      });
    }

    // Generate dashboard configuration using AI
    const result = await generateDashboardFromPrompt(prompt, {
      adAccountId,
      workspaceId,
      customSourceIds, // Include custom data sources for AI
    });

    // If shouldCreate is true, create the actual dashboard
    if (shouldCreate && result.success) {
      const dashboardConfig = result.dashboard;

      // Create the dashboard
      const dashboard = await Dashboard.create({
        name: dashboardConfig.name,
        workspaceId,
        createdBy: req.user.id,
        description: dashboardConfig.description,
      });

      // Create widgets from AI configuration
      for (const widgetDef of dashboardConfig.widgets) {
        await Dashboard.addWidget(dashboard.id, {
          widgetType: widgetDef.widgetType,
          title: widgetDef.title,
          description: widgetDef.description,
          position: widgetDef.position,
          dataSource: widgetDef.dataSource,
          chartConfig: {},
          filters: {},
        });
      }

      // Get complete dashboard with widgets
      const completeDashboard = await Dashboard.getWithWidgets(dashboard.id);

      return res.status(201).json({
        success: true,
        message: 'AI-generated dashboard created successfully',
        data: {
          dashboard: completeDashboard,
          insights: dashboardConfig.insights,
          tokensUsed: result.tokensUsed,
        },
      });
    }

    // Return just the configuration for preview
    res.json({
      success: true,
      message: 'Dashboard configuration generated successfully',
      data: {
        config: result.dashboard,
        tokensUsed: result.tokensUsed,
      },
    });
  } catch (error) {
    console.error('Generate AI dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate dashboard',
      error: error.message,
    });
  }
};

// Get AI recommendations for a dashboard
const getAIRecommendations = async (req, res) => {
  try {
    const { dashboardId } = req.params;

    const dashboard = await Dashboard.getWithWidgets(dashboardId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    // Get metrics data for the dashboard (mock for now - would fetch real data)
    const metricsData = {
      dashboardName: dashboard.name,
      widgetCount: dashboard.widgets?.length || 0,
      widgets: dashboard.widgets?.map(w => ({
        title: w.title,
        type: w.widget_type,
        metric: w.data_source?.metric,
      })),
    };

    const recommendations = await generateRecommendations(dashboardId, metricsData);

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('Get AI recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message,
    });
  }
};

// Get AI suggestions for dashboard improvements
const getAIImprovements = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { goals } = req.body;

    const dashboard = await Dashboard.getWithWidgets(dashboardId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dashboard',
      });
    }

    const suggestions = await suggestDashboardImprovements(
      dashboard.widgets || [],
      goals || 'Improve overall dashboard effectiveness'
    );

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Get AI improvements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get improvement suggestions',
      error: error.message,
    });
  }
};

// Get available widgets and metrics for AI generation
const getAIOptions = async (req, res) => {
  res.json({
    success: true,
    data: {
      widgets: AVAILABLE_WIDGETS,
      metrics: AVAILABLE_METRICS,
    },
  });
};

// Analyze widget with AI
const analyzeWidgetWithAI = async (req, res) => {
  try {
    const { widgetId } = req.params;
    const { includeHistorical = false } = req.body;

    console.log(`[AI Analysis] Starting analysis for widget ${widgetId}`);

    // Get widget
    const widget = await Dashboard.getWidget(widgetId);

    if (!widget) {
      console.log(`[AI Analysis] Widget ${widgetId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Widget not found',
      });
    }

    console.log(`[AI Analysis] Widget found: ${widget.title} (${widget.widget_type})`);

    // Get dashboard to verify access
    const dashboard = await Dashboard.findById(widget.dashboard_id);

    if (!dashboard) {
      console.log(`[AI Analysis] Dashboard ${widget.dashboard_id} not found`);
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found',
      });
    }

    // Verify user has access to workspace
    const workspaces = await Workspace.findByUserId(req.user.id);
    const hasAccess = workspaces.some(w => w.id === dashboard.workspace_id);

    if (!hasAccess) {
      console.log(`[AI Analysis] Access denied for user ${req.user.id} to workspace ${dashboard.workspace_id}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied to this widget',
      });
    }

    console.log(`[AI Analysis] Access verified. Fetching widget data...`);

    // Fetch current metrics data
    const metricsData = await widgetDataService.fetchWidgetData(
      widget,
      widget.data_source?.dateRange || 'last_30_days'
    );

    if (!metricsData) {
      console.log(`[AI Analysis] No metrics data returned for widget ${widgetId}`);
      return res.status(400).json({
        success: false,
        message: 'Unable to fetch widget data. Please ensure the widget is configured correctly.',
      });
    }

    console.log(`[AI Analysis] Metrics data fetched. Type: ${metricsData.type || 'value'}, Has timeSeries: ${!!metricsData.timeSeries}`);

    // Generate unique job ID
    const jobId = crypto.randomBytes(16).toString('hex');

    // Start background job (Sonnet takes 60-120s, exceeds Heroku 30s timeout)
    console.log(`[AI Analysis] Starting background job ${jobId} with Sonnet 4.5...`);
    startAIAnalysisJob(jobId, widget, metricsData, { includeHistorical });

    // Return job ID immediately (client will poll for results)
    res.json({
      success: true,
      jobId,
      message: 'AI analysis started in background. Poll /api/dashboards/ai-jobs/:jobId for results.',
      estimatedTime: '60-120 seconds'
    });

  } catch (error) {
    console.error('[AI Analysis] Error:', error);
    console.error('[AI Analysis] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze widget',
      error: error.message,
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get AI analysis job status and results
 */
const getAIJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    console.log(`[AI Job Status] Checking job ${jobId}`);
    const jobInfo = await getJobStatus(jobId);

    res.json(jobInfo);

  } catch (error) {
    console.error('[AI Job Status] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
};

module.exports = {
  getWorkspaceDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  deleteWidget,
  createShareLink,
  getShareLinks,
  getSharedDashboard,
  deleteShareLink,
  toggleShareLink,
  listTemplates,
  createFromTemplate,
  generateAIDashboard,
  getAIRecommendations,
  getAIImprovements,
  getAIOptions,
  analyzeWidgetWithAI,
  getAIJobStatus,
};
