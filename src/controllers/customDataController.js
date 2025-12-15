const multer = require('multer');
const CustomDataSource = require('../models/CustomDataSource');
const CustomDataParser = require('../services/customDataParser');
const AICustomData = require('../services/aiCustomData');
const Workspace = require('../models/Workspace');
const { fetchCustomData, queryCustomData, invalidateSourceCache } = require('../services/widgetDataService');
const GoogleSheetsSyncService = require('../services/googleSheetsSync');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];

    if (allowedMimeTypes.includes(file.mimetype) ||
        file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

// Middleware for multer error handling
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum file size is 50MB.'
      });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

/**
 * Upload and preview Excel/CSV file
 * POST /api/workspaces/:workspaceId/custom-data/upload
 */
const uploadFile = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse file
    const parsedData = await CustomDataParser.parseFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Validate data
    const validation = CustomDataParser.validateData(parsedData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid file data',
        details: validation.errors
      });
    }

    // Get sample data
    const sampleData = CustomDataParser.getSampleData(parsedData.rows);

    // Basic type detection (regex-based)
    const basicDetection = CustomDataParser.detectColumnTypes(sampleData);

    // AI-powered schema detection (enhanced)
    let aiSchemaResult = null;
    let aiVisualizationSuggestions = null;

    try {
      // Run AI schema detection
      aiSchemaResult = await AICustomData.detectSchema(
        sampleData,
        req.file.originalname,
        basicDetection
      );

      // Get visualization suggestions based on detected schema
      if (aiSchemaResult.success) {
        aiVisualizationSuggestions = await AICustomData.suggestVisualizations(
          aiSchemaResult.schema,
          sampleData
        );
      }
    } catch (aiError) {
      console.error('AI schema detection failed, falling back to basic detection:', aiError);
      // Continue with basic detection if AI fails
    }

    // Use AI-detected schema if available, otherwise fall back to basic detection
    const detectedSchema = aiSchemaResult?.success
      ? aiSchemaResult.schema
      : {
          columns: basicDetection.columns,
          confidence: basicDetection.confidence,
          primaryDateColumn: null,
          warnings: [],
          suggestions: []
        };

    // Prepare preview response
    const preview = {
      filename: req.file.originalname,
      totalRows: parsedData.totalRows,
      headers: parsedData.headers,
      sampleData,
      detectedSchema,
      aiSuggestions: aiVisualizationSuggestions?.recommendations || null,
      warnings: validation.warnings.concat(detectedSchema.warnings || []),
      fileSize: req.file.size
    };

    res.json({
      success: true,
      preview,
      message: 'File parsed successfully. Review the AI-detected schema and confirm import.'
    });

  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      error: 'Failed to process file',
      details: error.message
    });
  }
};

/**
 * Confirm import and save to database
 * POST /api/workspaces/:workspaceId/custom-data/confirm
 */
const confirmImport = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const {
      sourceName,
      description,
      detectedSchema,
      parsedRows, // All parsed rows from the file
      filename,
      fileSize,
      syncEnabled,
      syncFrequency,
      aiSuggestions
    } = req.body;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    // Validate input
    if (!sourceName || !detectedSchema || !parsedRows || parsedRows.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: sourceName, detectedSchema, parsedRows'
      });
    }

    // Extract column information from schema
    const dateColumn = detectedSchema.primaryDateColumn || null;
    const metricColumns = detectedSchema.columns
      .filter(col => col.role === 'metric')
      .map(col => col.name);
    const dimensionColumns = detectedSchema.columns
      .filter(col => col.role === 'dimension')
      .map(col => col.name);

    // Create custom data source
    const source = await CustomDataSource.create({
      workspaceId,
      userId,
      sourceType: filename.endsWith('.csv') ? 'csv' : 'excel',
      sourceName,
      description: description || null,
      originalFilename: filename,
      fileSize: fileSize || null,
      detectedSchema,
      columnMappings: {}, // User can modify later
      sampleData: parsedRows.slice(0, 10),
      syncEnabled: syncEnabled || false,
      syncFrequency: syncFrequency || null,
      dateColumn,
      metricColumns,
      dimensionColumns,
      aiSuggestions: aiSuggestions || {},
      recommendedVisualizations: aiSuggestions?.recommendedWidgets || []
    });

    // Transform rows into records format
    const records = CustomDataParser.transformRowsToRecords(
      parsedRows,
      detectedSchema,
      source.id
    );

    // Bulk insert records in batches of 1000
    const batchSize = 1000;
    let insertedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        await CustomDataSource.bulkInsertRecords(batch);
        insertedCount += batch.length;
      } catch (batchError) {
        console.error(`Batch insert failed for rows ${i} to ${i + batch.length}:`, batchError);
        failedCount += batch.length;
      }
    }

    // Update row count
    await CustomDataSource.updateRowCount(source.id, insertedCount);

    // Create sync job record
    const syncJob = await CustomDataSource.createSyncJob({
      sourceId: source.id,
      jobType: 'initial_import',
      totalRows: parsedRows.length
    });

    // Update sync job with results
    await CustomDataSource.updateSyncJob(syncJob.id, {
      status: failedCount > 0 ? 'completed_with_errors' : 'completed',
      processedRows: insertedCount + failedCount,
      newRows: insertedCount,
      failedRows: failedCount
    });

    // Run AI data quality analysis in background (non-blocking)
    AICustomData.analyzeDataQuality(parsedRows, detectedSchema)
      .then(async (qualityResult) => {
        if (qualityResult.success) {
          // Store AI analysis in sync job
          await CustomDataSource.updateSyncJob(syncJob.id, {
            aiAnalysisResult: qualityResult.analysis
          });
        }
      })
      .catch(error => {
        console.error('Background AI analysis failed:', error);
      });

    res.json({
      success: true,
      source: {
        id: source.id,
        name: source.source_name,
        type: source.source_type,
        rowCount: insertedCount,
        dateColumn,
        metricColumns,
        dimensionColumns
      },
      import: {
        totalRows: parsedRows.length,
        insertedRows: insertedCount,
        failedRows: failedCount,
        syncJobId: syncJob.id
      },
      aiSuggestions: aiSuggestions || null,
      message: failedCount > 0
        ? `Import completed with ${failedCount} failed rows. ${insertedCount} rows successfully imported.`
        : `Successfully imported ${insertedCount} rows.`
    });

  } catch (error) {
    console.error('Confirm import error:', error);
    res.status(500).json({
      error: 'Failed to confirm import',
      details: error.message
    });
  }
};

/**
 * Get all custom data sources for workspace
 * GET /api/workspaces/:workspaceId/custom-data/sources
 */
const getSources = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const sources = await CustomDataSource.findByWorkspaceId(workspaceId);

    res.json({
      success: true,
      sources,
      count: sources.length
    });

  } catch (error) {
    console.error('Get sources error:', error);
    res.status(500).json({
      error: 'Failed to fetch custom data sources',
      details: error.message
    });
  }
};

/**
 * Get single custom data source with details
 * GET /api/workspaces/:workspaceId/custom-data/sources/:sourceId
 */
const getSource = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    // Get record count
    const recordCount = await CustomDataSource.getRecordCount(sourceId);

    // Get latest sync job
    const latestSync = await CustomDataSource.getLatestSyncJob(sourceId);

    res.json({
      success: true,
      source: {
        ...source,
        recordCount
      },
      latestSync
    });

  } catch (error) {
    console.error('Get source error:', error);
    res.status(500).json({
      error: 'Failed to fetch custom data source',
      details: error.message
    });
  }
};

/**
 * Update custom data source
 * PUT /api/workspaces/:workspaceId/custom-data/sources/:sourceId
 */
const updateSource = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;
    const {
      sourceName,
      description,
      columnMappings,
      syncEnabled,
      syncFrequency
    } = req.body;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    const updatedSource = await CustomDataSource.update(sourceId, {
      sourceName,
      description,
      columnMappings,
      syncEnabled,
      syncFrequency
    });

    // Invalidate cache for this source
    await invalidateSourceCache(sourceId);

    res.json({
      success: true,
      source: updatedSource
    });

  } catch (error) {
    console.error('Update source error:', error);
    res.status(500).json({
      error: 'Failed to update custom data source',
      details: error.message
    });
  }
};

/**
 * Delete custom data source and all its records
 * DELETE /api/workspaces/:workspaceId/custom-data/sources/:sourceId
 */
const deleteSource = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    // Invalidate cache for this source before deletion
    await invalidateSourceCache(sourceId);

    // Delete source (CASCADE will delete records and sync jobs)
    await CustomDataSource.delete(sourceId);

    res.json({
      success: true,
      message: 'Custom data source deleted successfully'
    });

  } catch (error) {
    console.error('Delete source error:', error);
    res.status(500).json({
      error: 'Failed to delete custom data source',
      details: error.message
    });
  }
};

/**
 * Get metrics data for widget
 * GET /api/workspaces/:workspaceId/custom-data/sources/:sourceId/metrics
 */
const getMetrics = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;
    const {
      metric,
      startDate,
      endDate,
      aggregation = 'sum',
      filters,
      groupBy,
      dateRange = 'last_30_days'
    } = req.query;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    // Validate metric exists in source
    if (metric && !source.metric_columns?.includes(metric)) {
      return res.status(400).json({
        error: 'Invalid metric',
        message: `Metric '${metric}' not found in source. Available metrics: ${source.metric_columns?.join(', ')}`
      });
    }

    // Parse filters from query string (if JSON string)
    let parsedFilters = {};
    if (filters) {
      try {
        parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
      } catch (err) {
        return res.status(400).json({
          error: 'Invalid filters format',
          message: 'Filters must be valid JSON'
        });
      }
    }

    // Parse groupBy from query string (if comma-separated)
    const parsedGroupBy = groupBy
      ? (typeof groupBy === 'string' ? groupBy.split(',') : groupBy)
      : [];

    // Build data source configuration for widget data service
    const dataSourceConfig = {
      customSourceId: sourceId,
      metric: metric || source.metric_columns[0], // Use first metric if not specified
      aggregation,
      filters: parsedFilters,
      groupBy: parsedGroupBy,
      dateColumn: source.date_column,
    };

    // Determine date range
    let dateRangeConfig = dateRange;
    if (startDate && endDate) {
      dateRangeConfig = { startDate, endDate };
    }

    // Fetch data using widget data service
    const metricsData = await fetchCustomData(dataSourceConfig, dateRangeConfig);

    res.json({
      success: true,
      data: metricsData,
      source: {
        id: source.id,
        name: source.source_name,
        type: source.source_type,
      },
    });

  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      details: error.message
    });
  }
};

/**
 * Query custom data with advanced filtering
 * POST /api/workspaces/:workspaceId/custom-data/sources/:sourceId/query
 */
const queryData = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;
    const {
      select = [],
      filters = {},
      groupBy = [],
      orderBy = [],
      limit = 100,
      offset = 0,
      dateRange = null,
    } = req.body;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    // Validate limit
    if (limit > 1000) {
      return res.status(400).json({
        error: 'Limit too large',
        message: 'Maximum limit is 1000 rows'
      });
    }

    // Query data using widget data service
    const results = await queryCustomData(sourceId, {
      select,
      filters,
      groupBy,
      orderBy,
      limit,
      offset,
      dateRange,
    });

    // Get total count for pagination
    const { query: dbQuery } = require('../config/database');
    const countResult = await dbQuery(
      'SELECT COUNT(*) as total FROM custom_data_records WHERE source_id = $1',
      [sourceId]
    );
    const totalRecords = parseInt(countResult.rows[0]?.total) || 0;

    res.json({
      success: true,
      data: results,
      pagination: {
        limit,
        offset,
        total: totalRecords,
        hasMore: offset + results.length < totalRecords,
      },
      source: {
        id: source.id,
        name: source.source_name,
        type: source.source_type,
      },
    });

  } catch (error) {
    console.error('Query data error:', error);
    res.status(500).json({
      error: 'Failed to query data',
      details: error.message
    });
  }
};

/**
 * Trigger manual sync for Google Sheet
 * POST /api/workspaces/:workspaceId/custom-data/sources/:sourceId/sync
 */
const triggerSync = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    // Check if source is Google Sheets
    if (source.source_type !== 'google_sheets') {
      return res.status(400).json({
        error: 'Invalid source type',
        message: 'Manual sync is only available for Google Sheets sources'
      });
    }

    // Check if sync is already running
    if (source.sync_status === 'syncing') {
      return res.status(409).json({
        error: 'Sync already in progress',
        message: 'Please wait for the current sync to complete'
      });
    }

    // Trigger sync in background
    GoogleSheetsSyncService.triggerManualSync(sourceId)
      .then(result => {
        console.log(`✅ Manual sync completed for source ${sourceId}`);
      })
      .catch(error => {
        console.error(`❌ Manual sync failed for source ${sourceId}:`, error);
      });

    res.json({
      success: true,
      message: 'Sync started',
      sourceId,
      syncStatus: 'syncing'
    });

  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({
      error: 'Failed to trigger sync',
      details: error.message
    });
  }
};

/**
 * Get sync history for a source
 * GET /api/workspaces/:workspaceId/custom-data/sources/:sourceId/sync-history
 */
const getSyncHistory = async (req, res) => {
  try {
    const { workspaceId, sourceId } = req.params;
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Verify workspace access
    const workspace = await Workspace.findByUserIdAndWorkspaceId(userId, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const source = await CustomDataSource.findById(sourceId);
    if (!source || source.workspace_id !== workspaceId) {
      return res.status(404).json({ error: 'Custom data source not found' });
    }

    // Get sync jobs
    const syncJobs = await CustomDataSource.getSyncJobsBySource(sourceId);

    res.json({
      success: true,
      syncHistory: syncJobs.slice(0, parseInt(limit)),
      source: {
        id: source.id,
        name: source.source_name,
        lastSynced: source.last_synced_at,
        nextSync: source.next_sync_at,
        syncStatus: source.sync_status,
      },
    });

  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({
      error: 'Failed to fetch sync history',
      details: error.message
    });
  }
};

/**
 * Handle Google Drive webhook notifications
 * POST /api/webhooks/google-drive
 */
const handleGoogleDriveWebhook = async (req, res) => {
  try {
    // Google sends a sync message to verify the webhook
    if (req.headers['x-goog-resource-state'] === 'sync') {
      return res.status(200).send('OK');
    }

    const notification = {
      resourceId: req.headers['x-goog-resource-id'],
      resourceState: req.headers['x-goog-resource-state'],
      resourceUri: req.headers['x-goog-resource-uri'],
      channelId: req.headers['x-goog-channel-id'],
      channelToken: req.headers['x-goog-channel-token'],
      channelExpiration: req.headers['x-goog-channel-expiration'],
      messageNumber: req.headers['x-goog-message-number'],
      changed: req.headers['x-goog-changed'],
    };

    console.log('📨 Received Google Drive webhook notification:', notification);

    // Process webhook in background
    if (notification.resourceState === 'update' || notification.resourceState === 'change') {
      GoogleSheetsSyncService.handleWebhookNotification(notification)
        .then(result => {
          console.log('✅ Webhook processed:', result);
        })
        .catch(error => {
          console.error('❌ Webhook processing failed:', error);
        });
    }

    // Respond immediately to acknowledge receipt
    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
};

module.exports = {
  upload: upload.single('file'),
  handleMulterError,
  uploadFile,
  confirmImport,
  getSources,
  getSource,
  updateSource,
  deleteSource,
  getMetrics,
  queryData,
  triggerSync,
  getSyncHistory,
  handleGoogleDriveWebhook
};
