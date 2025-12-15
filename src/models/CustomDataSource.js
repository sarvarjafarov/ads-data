const { query } = require('../config/database');

class CustomDataSource {
  static async create(data) {
    const {
      workspaceId,
      userId,
      sourceType,
      sourceName,
      description,
      googleSheetId,
      googleSheetUrl,
      oauthTokenId,
      sheetRange,
      filePath,
      fileSize,
      originalFilename,
      detectedSchema,
      columnMappings,
      sampleData,
      syncEnabled,
      syncFrequency,
      dateColumn,
      metricColumns,
      dimensionColumns,
      aiSuggestions,
      recommendedVisualizations
    } = data;

    const result = await query(
      `INSERT INTO custom_data_sources (
        workspace_id, user_id, source_type, source_name, description,
        google_sheet_id, google_sheet_url, oauth_token_id, sheet_range,
        file_path, file_size, original_filename,
        detected_schema, column_mappings, sample_data,
        sync_enabled, sync_frequency,
        date_column, metric_columns, dimension_columns,
        ai_suggestions, recommended_visualizations
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        workspaceId,
        userId,
        sourceType,
        sourceName,
        description || null,
        googleSheetId || null,
        googleSheetUrl || null,
        oauthTokenId || null,
        sheetRange || 'Sheet1',
        filePath || null,
        fileSize || null,
        originalFilename || null,
        JSON.stringify(detectedSchema || {}),
        JSON.stringify(columnMappings || {}),
        JSON.stringify(sampleData || []),
        syncEnabled || false,
        syncFrequency || null,
        dateColumn || null,
        metricColumns || [],
        dimensionColumns || [],
        JSON.stringify(aiSuggestions || {}),
        JSON.stringify(recommendedVisualizations || [])
      ]
    );

    return result.rows[0];
  }

  static async findById(id) {
    const result = await query(
      `SELECT * FROM custom_data_sources WHERE id = $1`,
      [id]
    );

    return result.rows[0];
  }

  static async findByWorkspaceId(workspaceId) {
    const result = await query(
      `SELECT
        id, workspace_id, user_id, source_type, source_name, description,
        google_sheet_id, google_sheet_url, sheet_range,
        file_path, file_size, original_filename,
        detected_schema, column_mappings, sample_data,
        sync_enabled, sync_frequency, sync_status, last_synced_at, next_sync_at,
        row_count, date_column, metric_columns, dimension_columns,
        ai_suggestions, recommended_visualizations,
        created_at, updated_at
      FROM custom_data_sources
      WHERE workspace_id = $1
      ORDER BY created_at DESC`,
      [workspaceId]
    );

    return result.rows;
  }

  static async findBySourceType(workspaceId, sourceType) {
    const result = await query(
      `SELECT * FROM custom_data_sources
       WHERE workspace_id = $1 AND source_type = $2
       ORDER BY created_at DESC`,
      [workspaceId, sourceType]
    );

    return result.rows;
  }

  static async update(id, data) {
    const {
      sourceName,
      description,
      columnMappings,
      syncEnabled,
      syncFrequency,
      dateColumn,
      metricColumns,
      dimensionColumns
    } = data;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (sourceName !== undefined) {
      updates.push(`source_name = $${paramIndex++}`);
      values.push(sourceName);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (columnMappings !== undefined) {
      updates.push(`column_mappings = $${paramIndex++}`);
      values.push(JSON.stringify(columnMappings));
    }
    if (syncEnabled !== undefined) {
      updates.push(`sync_enabled = $${paramIndex++}`);
      values.push(syncEnabled);
    }
    if (syncFrequency !== undefined) {
      updates.push(`sync_frequency = $${paramIndex++}`);
      values.push(syncFrequency);
    }
    if (dateColumn !== undefined) {
      updates.push(`date_column = $${paramIndex++}`);
      values.push(dateColumn);
    }
    if (metricColumns !== undefined) {
      updates.push(`metric_columns = $${paramIndex++}`);
      values.push(metricColumns);
    }
    if (dimensionColumns !== undefined) {
      updates.push(`dimension_columns = $${paramIndex++}`);
      values.push(dimensionColumns);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(id);
    const result = await query(
      `UPDATE custom_data_sources
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async updateRowCount(id, rowCount) {
    const result = await query(
      `UPDATE custom_data_sources
       SET row_count = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [rowCount, id]
    );

    return result.rows[0];
  }

  static async updateSyncStatus(id, status, error = null) {
    const result = await query(
      `UPDATE custom_data_sources
       SET sync_status = $1, sync_error = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, error, id]
    );

    return result.rows[0];
  }

  static async updateLastSynced(id, nextSyncAt = null) {
    const result = await query(
      `UPDATE custom_data_sources
       SET last_synced_at = CURRENT_TIMESTAMP, next_sync_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [nextSyncAt, id]
    );

    return result.rows[0];
  }

  static async updateAISuggestions(id, aiSuggestions, recommendedVisualizations) {
    const result = await query(
      `UPDATE custom_data_sources
       SET ai_suggestions = $1, recommended_visualizations = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(aiSuggestions), JSON.stringify(recommendedVisualizations), id]
    );

    return result.rows[0];
  }

  static async delete(id) {
    await query(
      `DELETE FROM custom_data_sources WHERE id = $1`,
      [id]
    );

    return true;
  }

  static async findDueForSync() {
    const result = await query(
      `SELECT * FROM custom_data_sources
       WHERE sync_enabled = true
         AND (next_sync_at IS NULL OR next_sync_at <= CURRENT_TIMESTAMP)
         AND sync_status != 'syncing'
       ORDER BY next_sync_at NULLS FIRST
       LIMIT 10`
    );

    return result.rows;
  }

  static async findByGoogleSheetId(googleSheetId) {
    const result = await query(
      `SELECT * FROM custom_data_sources WHERE google_sheet_id = $1`,
      [googleSheetId]
    );

    return result.rows[0];
  }

  // Data Records methods
  static async createRecord(data) {
    const {
      sourceId,
      recordDate,
      recordTimestamp,
      dimensions,
      metrics,
      rawData,
      metricKeys,
      hashKey
    } = data;

    const result = await query(
      `INSERT INTO custom_data_records (
        source_id, record_date, record_timestamp,
        dimensions, metrics, raw_data, metric_keys, hash_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (source_id, record_date, hash_key)
      DO UPDATE SET
        metrics = EXCLUDED.metrics,
        raw_data = EXCLUDED.raw_data,
        metric_keys = EXCLUDED.metric_keys,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        sourceId,
        recordDate,
        recordTimestamp || null,
        JSON.stringify(dimensions || {}),
        JSON.stringify(metrics),
        JSON.stringify(rawData || {}),
        metricKeys || [],
        hashKey
      ]
    );

    return result.rows[0];
  }

  static async bulkInsertRecords(records) {
    if (records.length === 0) return [];

    // Build values array for batch insert
    const valuesClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const record of records) {
      valuesClauses.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      values.push(
        record.sourceId,
        record.recordDate,
        record.recordTimestamp || null,
        JSON.stringify(record.dimensions || {}),
        JSON.stringify(record.metrics),
        JSON.stringify(record.rawData || {}),
        record.metricKeys || [],
        record.hashKey
      );
    }

    const result = await query(
      `INSERT INTO custom_data_records (
        source_id, record_date, record_timestamp,
        dimensions, metrics, raw_data, metric_keys, hash_key
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (source_id, record_date, hash_key)
      DO UPDATE SET
        metrics = EXCLUDED.metrics,
        raw_data = EXCLUDED.raw_data,
        metric_keys = EXCLUDED.metric_keys,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`
      ,
      values
    );

    return result.rows;
  }

  static async getRecordsByDateRange(sourceId, startDate, endDate) {
    const result = await query(
      `SELECT * FROM custom_data_records
       WHERE source_id = $1
         AND record_date >= $2
         AND record_date <= $3
       ORDER BY record_date DESC`,
      [sourceId, startDate, endDate]
    );

    return result.rows;
  }

  static async deleteRecordsBySourceId(sourceId) {
    await query(
      `DELETE FROM custom_data_records WHERE source_id = $1`,
      [sourceId]
    );

    return true;
  }

  static async getRecordCount(sourceId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM custom_data_records WHERE source_id = $1`,
      [sourceId]
    );

    return parseInt(result.rows[0].count);
  }

  // Sync Jobs methods
  static async createSyncJob(data) {
    const { sourceId, jobType, totalRows } = data;

    const result = await query(
      `INSERT INTO custom_data_sync_jobs (source_id, job_type, total_rows, status, started_at)
       VALUES ($1, $2, $3, 'processing', CURRENT_TIMESTAMP)
       RETURNING *`,
      [sourceId, jobType, totalRows || null]
    );

    return result.rows[0];
  }

  static async updateSyncJob(jobId, data) {
    const {
      status,
      processedRows,
      failedRows,
      newRows,
      updatedRows,
      errorMessage,
      errorDetails,
      aiAnalysisResult
    } = data;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      if (status === 'completed' || status === 'failed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (processedRows !== undefined) {
      updates.push(`processed_rows = $${paramIndex++}`);
      values.push(processedRows);
    }
    if (failedRows !== undefined) {
      updates.push(`failed_rows = $${paramIndex++}`);
      values.push(failedRows);
    }
    if (newRows !== undefined) {
      updates.push(`new_rows = $${paramIndex++}`);
      values.push(newRows);
    }
    if (updatedRows !== undefined) {
      updates.push(`updated_rows = $${paramIndex++}`);
      values.push(updatedRows);
    }
    if (errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(errorMessage);
    }
    if (errorDetails !== undefined) {
      updates.push(`error_details = $${paramIndex++}`);
      values.push(JSON.stringify(errorDetails));
    }
    if (aiAnalysisResult !== undefined) {
      updates.push(`ai_analysis_result = $${paramIndex++}`);
      values.push(JSON.stringify(aiAnalysisResult));
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(jobId);
    const result = await query(
      `UPDATE custom_data_sync_jobs
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async getSyncJobsBySource(sourceId) {
    const result = await query(
      `SELECT * FROM custom_data_sync_jobs
       WHERE source_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [sourceId]
    );

    return result.rows;
  }

  static async getLatestSyncJob(sourceId) {
    const result = await query(
      `SELECT * FROM custom_data_sync_jobs
       WHERE source_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sourceId]
    );

    return result.rows[0];
  }
}

module.exports = CustomDataSource;
