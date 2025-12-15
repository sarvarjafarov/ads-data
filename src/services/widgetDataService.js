/**
 * Widget Data Service
 * Unified service for fetching data from platform sources (Meta, Google, etc.)
 * and custom data sources (Excel, Google Sheets)
 */

const { query } = require('../config/database');
const { getPlatformService } = require('./platforms');
const CustomDataSource = require('../models/CustomDataSource');
const { getCache, setCache, isAvailable: isRedisAvailable } = require('../config/redis');
const crypto = require('crypto');

/**
 * Generate cache key for widget data
 * @param {Object} dataSource - Data source configuration
 * @param {Object} dateRange - Date range
 * @returns {String} Cache key
 */
function generateCacheKey(dataSource, dateRange) {
  const keyData = {
    dataSource,
    dateRange,
  };
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(keyData))
    .digest('hex');
  return `widget:data:${hash}`;
}

/**
 * Fetch data for a dashboard widget
 * Routes to appropriate data source based on widget configuration
 * @param {Object} widget - Widget configuration from dashboard_widgets table
 * @param {Object} dateRange - Date range for data fetching
 * @returns {Object} Widget data with values and time series
 */
async function fetchWidgetData(widget, dateRange = null) {
  const dataSource = widget.data_source || {};

  // Generate cache key
  const cacheKey = generateCacheKey(dataSource, dateRange);

  // Try to get from cache if Redis is available
  if (isRedisAvailable()) {
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return {
        ...cachedData,
        cached: true,
      };
    }
  }

  // Determine source type and fetch data
  let data;
  if (dataSource.type === 'custom_data') {
    data = await fetchCustomData(dataSource, dateRange);
  } else if (dataSource.type === 'platform' || dataSource.adAccountId) {
    data = await fetchPlatformData(dataSource, dateRange);
  } else if (dataSource.type === 'mixed') {
    data = await fetchMixedData(dataSource, dateRange);
  } else {
    throw new Error('Invalid or missing data source configuration');
  }

  // Cache the result with 5-minute TTL
  if (isRedisAvailable() && data) {
    await setCache(cacheKey, data, 300); // 5 minutes
  }

  return data;
}

/**
 * Fetch data from custom data source
 * @param {Object} dataSource - Data source configuration
 * @param {Object} dateRange - Date range
 * @returns {Object} Aggregated data
 */
async function fetchCustomData(dataSource, dateRange) {
  const {
    customSourceId,
    metric,
    aggregation = 'sum',
    filters = {},
    groupBy = [],
    dateColumn,
  } = dataSource;

  if (!customSourceId || !metric) {
    throw new Error('customSourceId and metric are required for custom data source');
  }

  // Get custom data source metadata
  const source = await CustomDataSource.findById(customSourceId);
  if (!source) {
    throw new Error('Custom data source not found');
  }

  // Parse date range
  const { startDate, endDate } = parseDateRange(dateRange);

  // Determine the date column to use
  const actualDateColumn = dateColumn || source.date_column || 'record_date';

  // Build base query
  let baseQuery = `
    SELECT
      ${actualDateColumn} as date,
      ${buildAggregationExpression(metric, aggregation)} as value
    FROM custom_data_records
    WHERE source_id = $1
      AND ${actualDateColumn} >= $2
      AND ${actualDateColumn} <= $3
  `;

  const params = [customSourceId, startDate, endDate];
  let paramIndex = 4;

  // Add filters for dimensions
  if (filters && Object.keys(filters).length > 0) {
    const filterClauses = [];
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        // IN clause for array values
        filterClauses.push(`dimensions->>'${key}' = ANY($${paramIndex})`);
        params.push(value);
        paramIndex++;
      } else {
        // Equality for single values
        filterClauses.push(`dimensions @> $${paramIndex}::jsonb`);
        params.push(JSON.stringify({ [key]: value }));
        paramIndex++;
      }
    }
    baseQuery += ` AND ${filterClauses.join(' AND ')}`;
  }

  // Add GROUP BY if specified
  if (groupBy.length > 0) {
    const groupByColumns = groupBy.map(col => `dimensions->>'${col}'`).join(', ');
    baseQuery += ` GROUP BY ${actualDateColumn}, ${groupByColumns}`;
  } else {
    baseQuery += ` GROUP BY ${actualDateColumn}`;
  }

  baseQuery += ` ORDER BY ${actualDateColumn} ASC`;

  // Execute query
  const result = await query(baseQuery, params);

  // Calculate total and time series
  const timeSeries = result.rows.map(row => ({
    date: row.date,
    value: parseFloat(row.value) || 0,
  }));

  const totalValue = timeSeries.reduce((sum, item) => sum + item.value, 0);

  // Calculate previous period for comparison
  const previousValue = await fetchPreviousPeriodValue(
    customSourceId,
    metric,
    aggregation,
    startDate,
    endDate,
    actualDateColumn,
    filters
  );

  const changePercent = previousValue > 0
    ? ((totalValue - previousValue) / previousValue) * 100
    : 0;

  return {
    value: totalValue,
    previousValue,
    changePercent,
    label: metric,
    dateRange: { startDate, endDate },
    timeSeries,
    metadata: {
      sourceType: 'custom_data',
      sourceName: source.source_name,
      aggregation,
    },
  };
}

/**
 * Fetch data from platform source (Meta, Google Ads, etc.)
 * @param {Object} dataSource - Data source configuration
 * @param {Object} dateRange - Date range
 * @returns {Object} Platform data
 */
async function fetchPlatformData(dataSource, dateRange) {
  const { adAccountId, metric, platform = 'meta' } = dataSource;

  if (!adAccountId || !metric) {
    throw new Error('adAccountId and metric are required for platform data source');
  }

  // Get ad account details
  const accountResult = await query(
    `SELECT a.*, o.access_token, o.refresh_token, o.expires_at
     FROM ad_accounts a
     JOIN oauth_tokens o ON a.oauth_token_id = o.id
     WHERE a.id = $1`,
    [adAccountId]
  );

  if (accountResult.rows.length === 0) {
    throw new Error('Ad account not found');
  }

  const account = accountResult.rows[0];

  // Check if token needs refresh
  const now = new Date();
  const expiresAt = new Date(account.expires_at);
  if (expiresAt <= now) {
    // TODO: Implement token refresh
    throw new Error('Access token expired. Please reconnect your account.');
  }

  // Get platform service
  const PlatformService = getPlatformService(account.platform);

  // Parse date range
  const { startDate, endDate } = parseDateRange(dateRange);

  // Fetch metrics from platform
  const platformData = await PlatformService.fetchMetrics(
    account.account_id,
    account.access_token,
    metric,
    startDate,
    endDate,
    { platform: account.platform }
  );

  return {
    ...platformData,
    metadata: {
      sourceType: 'platform',
      platform: account.platform,
      accountName: account.account_name,
    },
  };
}

/**
 * Fetch and mix data from multiple sources (platform + custom)
 * @param {Object} dataSource - Data source configuration
 * @param {Object} dateRange - Date range
 * @returns {Object} Mixed data
 */
async function fetchMixedData(dataSource, dateRange) {
  const { sources = [] } = dataSource;

  if (!sources || sources.length === 0) {
    throw new Error('At least one source is required for mixed data');
  }

  // Fetch data from all sources in parallel
  const promises = sources.map(source =>
    source.type === 'custom_data'
      ? fetchCustomData(source, dateRange)
      : fetchPlatformData(source, dateRange)
  );

  const results = await Promise.all(promises);

  // Combine time series data
  const combinedTimeSeries = combineTimeSeries(results.map(r => r.timeSeries));

  // Calculate totals
  const totalValue = results.reduce((sum, r) => sum + (r.value || 0), 0);
  const previousValue = results.reduce((sum, r) => sum + (r.previousValue || 0), 0);
  const changePercent = previousValue > 0
    ? ((totalValue - previousValue) / previousValue) * 100
    : 0;

  return {
    value: totalValue,
    previousValue,
    changePercent,
    timeSeries: combinedTimeSeries,
    metadata: {
      sourceType: 'mixed',
      sourceCount: sources.length,
      sources: results.map(r => r.metadata),
    },
  };
}

/**
 * Build SQL aggregation expression for metrics
 * @param {string} metric - Metric column name
 * @param {string} aggregation - Aggregation type (sum, avg, count, min, max)
 * @returns {string} SQL expression
 */
function buildAggregationExpression(metric, aggregation) {
  const metricPath = `(metrics->>'${metric}')::numeric`;

  switch (aggregation.toLowerCase()) {
    case 'sum':
      return `COALESCE(SUM(${metricPath}), 0)`;
    case 'avg':
    case 'average':
      return `COALESCE(AVG(${metricPath}), 0)`;
    case 'count':
      return `COUNT(${metricPath})`;
    case 'min':
      return `COALESCE(MIN(${metricPath}), 0)`;
    case 'max':
      return `COALESCE(MAX(${metricPath}), 0)`;
    default:
      return `COALESCE(SUM(${metricPath}), 0)`;
  }
}

/**
 * Fetch previous period value for comparison
 * @param {string} sourceId - Custom data source ID
 * @param {string} metric - Metric name
 * @param {string} aggregation - Aggregation type
 * @param {string} startDate - Current period start date
 * @param {string} endDate - Current period end date
 * @param {string} dateColumn - Date column name
 * @param {Object} filters - Dimension filters
 * @returns {number} Previous period value
 */
async function fetchPreviousPeriodValue(sourceId, metric, aggregation, startDate, endDate, dateColumn, filters = {}) {
  try {
    // Calculate previous period dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysDiff);

    // Build query
    let baseQuery = `
      SELECT ${buildAggregationExpression(metric, aggregation)} as value
      FROM custom_data_records
      WHERE source_id = $1
        AND ${dateColumn} >= $2
        AND ${dateColumn} <= $3
    `;

    const params = [sourceId, prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]];
    let paramIndex = 4;

    // Add filters
    if (filters && Object.keys(filters).length > 0) {
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          baseQuery += ` AND dimensions->>'${key}' = ANY($${paramIndex})`;
          params.push(value);
        } else {
          baseQuery += ` AND dimensions @> $${paramIndex}::jsonb`;
          params.push(JSON.stringify({ [key]: value }));
        }
        paramIndex++;
      }
    }

    const result = await query(baseQuery, params);
    return parseFloat(result.rows[0]?.value) || 0;
  } catch (error) {
    console.error('Error fetching previous period value:', error);
    return 0;
  }
}

/**
 * Parse date range from various formats
 * @param {Object|string} dateRange - Date range configuration
 * @returns {Object} { startDate, endDate }
 */
function parseDateRange(dateRange) {
  if (!dateRange) {
    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  if (typeof dateRange === 'object' && dateRange.startDate && dateRange.endDate) {
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
  }

  // Handle preset ranges
  const endDate = new Date();
  let startDate = new Date();

  switch (dateRange) {
    case 'last_7_days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last_30_days':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'last_90_days':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'this_month':
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
      endDate.setDate(0); // Last day of previous month
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Combine time series from multiple sources
 * @param {Array} timeSeriesArray - Array of time series
 * @returns {Array} Combined time series
 */
function combineTimeSeries(timeSeriesArray) {
  const dateMap = new Map();

  // Aggregate values by date
  timeSeriesArray.forEach(series => {
    series.forEach(({ date, value }) => {
      const existing = dateMap.get(date) || 0;
      dateMap.set(date, existing + value);
    });
  });

  // Convert to array and sort
  return Array.from(dateMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Query custom data with advanced filtering and grouping
 * @param {string} sourceId - Custom data source ID
 * @param {Object} options - Query options
 * @returns {Array} Query results
 */
async function queryCustomData(sourceId, options = {}) {
  const {
    select = [],
    filters = {},
    groupBy = [],
    orderBy = [],
    limit = 100,
    offset = 0,
    dateRange = null,
  } = options;

  // Validate source exists
  const source = await CustomDataSource.findById(sourceId);
  if (!source) {
    throw new Error('Custom data source not found');
  }

  // Build SELECT clause
  const selectClauses = select.length > 0
    ? select.map(col => {
        if (col.includes('(')) {
          // Already an expression
          return col;
        } else if (source.metric_columns?.includes(col)) {
          return `(metrics->>'${col}')::numeric as ${col}`;
        } else if (source.dimension_columns?.includes(col)) {
          return `dimensions->>'${col}' as ${col}`;
        } else {
          return `raw_data->>'${col}' as ${col}`;
        }
      }).join(', ')
    : 'raw_data';

  // Build WHERE clause
  const whereClauses = [`source_id = $1`];
  const params = [sourceId];
  let paramIndex = 2;

  // Add date range filter
  if (dateRange) {
    const { startDate, endDate } = parseDateRange(dateRange);
    whereClauses.push(`record_date >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
    whereClauses.push(`record_date <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  // Add dimension filters
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      whereClauses.push(`dimensions->>'${key}' = ANY($${paramIndex})`);
      params.push(value);
    } else if (value === null) {
      whereClauses.push(`dimensions->>'${key}' IS NULL`);
    } else {
      whereClauses.push(`dimensions @> $${paramIndex}::jsonb`);
      params.push(JSON.stringify({ [key]: value }));
    }
    paramIndex++;
  }

  // Build GROUP BY clause
  const groupByClause = groupBy.length > 0
    ? `GROUP BY ${groupBy.map(col => `dimensions->>'${col}'`).join(', ')}`
    : '';

  // Build ORDER BY clause
  const orderByClause = orderBy.length > 0
    ? `ORDER BY ${orderBy.join(', ')}`
    : 'ORDER BY record_date DESC';

  // Build final query
  const sqlQuery = `
    SELECT ${selectClauses}
    FROM custom_data_records
    WHERE ${whereClauses.join(' AND ')}
    ${groupByClause}
    ${orderByClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  // Execute query
  const result = await query(sqlQuery, params);
  return result.rows;
}

/**
 * Invalidate cache for a specific custom data source
 * Called when source is updated or synced
 * @param {String} sourceId - Custom data source ID
 */
async function invalidateSourceCache(sourceId) {
  if (!isRedisAvailable()) {
    return;
  }

  const { clearCachePattern } = require('../config/redis');

  try {
    // Clear all cache entries that contain this source ID
    const pattern = `widget:data:*${sourceId}*`;
    await clearCachePattern(pattern);
    console.log(`✓ Cache invalidated for source: ${sourceId}`);
  } catch (error) {
    console.error('Error invalidating source cache:', error);
  }
}

/**
 * Invalidate all widget data cache
 * Use sparingly, only for major system updates
 */
async function invalidateAllWidgetCache() {
  if (!isRedisAvailable()) {
    return;
  }

  const { clearCachePattern } = require('../config/redis');

  try {
    await clearCachePattern('widget:data:*');
    console.log('✓ All widget cache invalidated');
  } catch (error) {
    console.error('Error invalidating all cache:', error);
  }
}

module.exports = {
  fetchWidgetData,
  fetchCustomData,
  fetchPlatformData,
  fetchMixedData,
  queryCustomData,
  parseDateRange,
  invalidateSourceCache,
  invalidateAllWidgetCache,
};
