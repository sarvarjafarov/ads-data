/**
 * Google Sheets Sync Service
 * Handles real-time and scheduled synchronization of Google Sheets data
 */

const { GoogleSheetsService } = require('./platforms');
const CustomDataSource = require('../models/CustomDataSource');
const CustomDataParser = require('./customDataParser');
const AICustomData = require('./aiCustomData');
const { query } = require('../config/database');
const config = require('../config/config');
const { invalidateSourceCache } = require('./widgetDataService');

/**
 * Sync a Google Sheet data source
 * @param {string} sourceId - Custom data source ID
 * @param {string} jobType - Type of sync job (scheduled_sync, manual_refresh, etc.)
 * @returns {Object} Sync result
 */
async function syncGoogleSheet(sourceId, jobType = 'scheduled_sync') {
  console.log(`🔄 Starting Google Sheets sync for source ${sourceId} (${jobType})`);

  let syncJob = null;

  try {
    // Get source details
    const source = await CustomDataSource.findById(sourceId);
    if (!source) {
      throw new Error('Custom data source not found');
    }

    if (source.source_type !== 'google_sheets') {
      throw new Error('Source is not a Google Sheets source');
    }

    // Create sync job
    syncJob = await CustomDataSource.createSyncJob({
      sourceId,
      jobType,
    });

    // Update source sync status
    await CustomDataSource.updateSyncStatus(sourceId, 'syncing');

    // Get OAuth token
    const tokenResult = await query(
      `SELECT access_token, refresh_token, expires_at
       FROM oauth_tokens
       WHERE id = $1`,
      [source.oauth_token_id]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('OAuth token not found');
    }

    let { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = tokenResult.rows[0];

    // Check if token needs refresh
    const now = new Date();
    const tokenExpiry = new Date(expiresAt);
    if (tokenExpiry <= now) {
      console.log('🔑 Refreshing expired access token...');
      const refreshedToken = await GoogleSheetsService.refreshAccessToken(config, refreshToken);
      accessToken = refreshedToken.accessToken;

      // Update token in database
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshedToken.expiresIn);
      await query(
        `UPDATE oauth_tokens
         SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [accessToken, newExpiresAt, source.oauth_token_id]
      );
    }

    // Check if sheet structure has changed
    const expectedHeaders = source.detected_schema?.columns?.map(col => col.name) || [];
    let structureValidation = null;

    try {
      structureValidation = await GoogleSheetsService.validateSheetStructure(
        source.google_sheet_id,
        source.sheet_range,
        accessToken,
        expectedHeaders
      );

      if (!structureValidation.valid) {
        console.warn(`⚠️  Sheet structure has changed for source ${sourceId}:`, structureValidation.changes);
        // Continue with sync but log warning
      }
    } catch (validationError) {
      console.error('Structure validation failed:', validationError);
      // Continue with sync anyway
    }

    // Fetch latest data from Google Sheets
    const sheetData = await GoogleSheetsService.fetchSheetData(
      source.google_sheet_id,
      source.sheet_range,
      accessToken
    );

    console.log(`📊 Fetched ${sheetData.totalRows} rows from Google Sheet`);

    // Update sync job with total rows
    await CustomDataSource.updateSyncJob(syncJob.id, {
      totalRows: sheetData.totalRows,
    });

    // Transform rows to records format
    const records = CustomDataParser.transformRowsToRecords(
      sheetData.rows,
      source.detected_schema,
      sourceId
    );

    // Sync records with deduplication
    const syncResult = await syncRecords(sourceId, records);

    // Update row count
    await CustomDataSource.updateRowCount(sourceId, syncResult.totalRecords);

    // Update sync job as completed
    await CustomDataSource.updateSyncJob(syncJob.id, {
      status: 'completed',
      processedRows: syncResult.processedRows,
      newRows: syncResult.newRows,
      updatedRows: syncResult.updatedRows,
      failedRows: syncResult.failedRows,
    });

    // Update source sync status
    await CustomDataSource.updateSyncStatus(sourceId, 'active', null);

    // Calculate next sync time
    const nextSyncAt = calculateNextSyncTime(source.sync_frequency);
    await CustomDataSource.updateLastSynced(sourceId, nextSyncAt);

    // Invalidate cache for this source
    await invalidateSourceCache(sourceId);

    console.log(`✅ Sync completed for source ${sourceId}: ${syncResult.newRows} new, ${syncResult.updatedRows} updated`);

    return {
      success: true,
      syncJobId: syncJob.id,
      ...syncResult,
    };

  } catch (error) {
    console.error(`❌ Sync failed for source ${sourceId}:`, error);

    // Update sync job as failed
    if (syncJob) {
      await CustomDataSource.updateSyncJob(syncJob.id, {
        status: 'failed',
        errorMessage: error.message,
        errorDetails: { stack: error.stack },
      });
    }

    // Update source sync status with error
    await CustomDataSource.updateSyncStatus(sourceId, 'error', error.message);

    throw error;
  }
}

/**
 * Sync records with deduplication and upserting
 * @param {string} sourceId - Source ID
 * @param {Array} records - Records to sync
 * @returns {Object} Sync statistics
 */
async function syncRecords(sourceId, records) {
  let processedRows = 0;
  let newRows = 0;
  let updatedRows = 0;
  let failedRows = 0;

  // Get existing hash keys for deduplication check
  const existingHashesResult = await query(
    `SELECT DISTINCT hash_key FROM custom_data_records WHERE source_id = $1`,
    [sourceId]
  );
  const existingHashes = new Set(existingHashesResult.rows.map(r => r.hash_key));

  // Separate new and existing records
  const newRecords = [];
  const updateRecords = [];

  for (const record of records) {
    if (existingHashes.has(record.hashKey)) {
      updateRecords.push(record);
    } else {
      newRecords.push(record);
    }
  }

  // Batch insert new records
  if (newRecords.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize);
      try {
        const inserted = await CustomDataSource.bulkInsertRecords(batch);
        newRows += inserted.length;
        processedRows += batch.length;
      } catch (error) {
        console.error(`Batch insert failed for rows ${i} to ${i + batch.length}:`, error);
        failedRows += batch.length;
      }
    }
  }

  // Update existing records (upsert will handle this via ON CONFLICT)
  if (updateRecords.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < updateRecords.length; i += batchSize) {
      const batch = updateRecords.slice(i, i + batchSize);
      try {
        const upserted = await CustomDataSource.bulkInsertRecords(batch);
        updatedRows += batch.length; // Approximate, actual updated count not easily available
        processedRows += batch.length;
      } catch (error) {
        console.error(`Batch upsert failed for rows ${i} to ${i + batch.length}:`, error);
        failedRows += batch.length;
      }
    }
  }

  // Get total record count
  const countResult = await query(
    `SELECT COUNT(*) as count FROM custom_data_records WHERE source_id = $1`,
    [sourceId]
  );
  const totalRecords = parseInt(countResult.rows[0].count);

  return {
    processedRows,
    newRows,
    updatedRows,
    failedRows,
    totalRecords,
  };
}

/**
 * Calculate next sync time based on frequency
 * @param {string} frequency - Sync frequency (hourly, daily, weekly)
 * @returns {Date|null} Next sync time
 */
function calculateNextSyncTime(frequency) {
  if (!frequency) return null;

  const now = new Date();
  const nextSync = new Date(now);

  switch (frequency.toLowerCase()) {
    case 'hourly':
      nextSync.setHours(nextSync.getHours() + 1);
      break;
    case 'daily':
      nextSync.setDate(nextSync.getDate() + 1);
      break;
    case 'weekly':
      nextSync.setDate(nextSync.getDate() + 7);
      break;
    case 'manual':
      return null; // No automatic next sync
    default:
      nextSync.setHours(nextSync.getHours() + 1); // Default to hourly
  }

  return nextSync;
}

/**
 * Trigger manual sync for a Google Sheet
 * @param {string} sourceId - Source ID
 * @returns {Object} Sync result
 */
async function triggerManualSync(sourceId) {
  return await syncGoogleSheet(sourceId, 'manual_refresh');
}

/**
 * Handle Google Drive webhook notification
 * @param {Object} notification - Webhook payload
 * @returns {Object} Processing result
 */
async function handleWebhookNotification(notification) {
  try {
    const { resourceId, channelId } = notification;

    // Find source by channel ID (stored in metadata)
    const sourceResult = await query(
      `SELECT id FROM custom_data_sources
       WHERE source_type = 'google_sheets'
         AND sync_enabled = true
         AND google_sheet_id = $1`,
      [resourceId]
    );

    if (sourceResult.rows.length === 0) {
      console.log(`No active source found for resource ${resourceId}`);
      return { processed: false, reason: 'No matching source' };
    }

    const sourceId = sourceResult.rows[0].id;

    // Check last sync time to avoid too frequent syncs
    const source = await CustomDataSource.findById(sourceId);
    const lastSynced = source.last_synced_at ? new Date(source.last_synced_at) : null;
    const now = new Date();

    if (lastSynced && (now - lastSynced) < 5 * 60 * 1000) {
      // Less than 5 minutes since last sync, skip
      console.log(`⏭️  Skipping sync for ${sourceId} - too soon after last sync`);
      return { processed: false, reason: 'Too soon after last sync' };
    }

    // Trigger sync in background
    syncGoogleSheet(sourceId, 'webhook_triggered')
      .then(result => {
        console.log(`✅ Webhook-triggered sync completed for ${sourceId}`);
      })
      .catch(error => {
        console.error(`❌ Webhook-triggered sync failed for ${sourceId}:`, error);
      });

    return { processed: true, sourceId };

  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
}

/**
 * Get sources that are due for sync
 * @returns {Array} Sources due for sync
 */
async function getSourcesDueForSync() {
  const sources = await CustomDataSource.findDueForSync();
  return sources.filter(s => s.source_type === 'google_sheets');
}

/**
 * Sync all sources that are due
 * @returns {Object} Sync results
 */
async function syncDueSources() {
  const sources = await getSourcesDueForSync();

  if (sources.length === 0) {
    console.log('📭 No sources due for sync');
    return { processed: 0, results: [] };
  }

  console.log(`🔄 Syncing ${sources.length} sources due for update`);

  const results = [];

  for (const source of sources) {
    try {
      const result = await syncGoogleSheet(source.id, 'scheduled_sync');
      results.push({
        sourceId: source.id,
        sourceName: source.source_name,
        success: true,
        ...result,
      });
    } catch (error) {
      results.push({
        sourceId: source.id,
        sourceName: source.source_name,
        success: false,
        error: error.message,
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Completed ${successCount}/${sources.length} syncs successfully`);

  return {
    processed: sources.length,
    successful: successCount,
    failed: sources.length - successCount,
    results,
  };
}

module.exports = {
  syncGoogleSheet,
  triggerManualSync,
  handleWebhookNotification,
  getSourcesDueForSync,
  syncDueSources,
  syncRecords,
  calculateNextSyncTime,
};
