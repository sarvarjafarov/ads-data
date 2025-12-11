/**
 * Health Monitoring Controller
 * System health checks and metrics
 */

const { query } = require('../config/database');
const redis = require('../config/redis');
const os = require('os');

/**
 * Basic health check
 */
const getHealth = async (req, res) => {
  try {
    // Check database connection
    await query('SELECT 1');

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
};

/**
 * Detailed system metrics
 */
const getSystemMetrics = async (req, res) => {
  try {
    // Database health
    let dbStatus = 'unknown';
    let dbConnections = 0;
    try {
      const dbResult = await query('SELECT COUNT(*) as count FROM pg_stat_activity');
      dbConnections = parseInt(dbResult.rows[0].count);
      dbStatus = 'healthy';
    } catch (error) {
      dbStatus = 'unhealthy';
    }

    // Redis health
    const redisStatus = redis.isAvailable() ? 'healthy' : 'unavailable';
    let redisCacheStats = null;
    if (redisStatus === 'healthy') {
      redisCacheStats = await redis.getCacheStats();
    }

    // System metrics
    const systemMetrics = {
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
      },
      process: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
      },
      system: {
        platform: os.platform(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
    };

    // Application metrics from database
    const [errorCount, activeUsers, activeWorkspaces] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM error_logs
             WHERE created_at > NOW() - INTERVAL '1 hour'`),
      query(`SELECT COUNT(DISTINCT user_id) as count FROM api_rate_limits
             WHERE window_start > NOW() - INTERVAL '1 hour'`),
      query(`SELECT COUNT(DISTINCT id) as count FROM workspaces WHERE is_active = true`),
    ]);

    const appMetrics = {
      recentErrors: parseInt(errorCount.rows[0].count),
      activeUsersLastHour: parseInt(activeUsers.rows[0].count),
      activeWorkspaces: parseInt(activeWorkspaces.rows[0].count),
    };

    // Store system health metrics
    await recordSystemMetrics(systemMetrics, dbStatus, redisStatus);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          connections: dbConnections,
        },
        redis: {
          status: redisStatus,
          ...redisCacheStats,
        },
      },
      system: systemMetrics,
      application: appMetrics,
    });
  } catch (error) {
    console.error('Get system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system metrics',
      error: error.message,
    });
  }
};

/**
 * Get error logs
 */
const getErrorLogs = async (req, res) => {
  try {
    const { limit = 50, offset = 0, errorType } = req.query;

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (errorType) {
      whereClause = `WHERE error_type = $${paramIndex}`;
      params.push(errorType);
      paramIndex++;
    }

    const result = await query(
      `SELECT
        id,
        error_type,
        error_message,
        request_url,
        request_method,
        status_code,
        created_at
      FROM error_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM error_logs ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get error logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch error logs',
      error: error.message,
    });
  }
};

/**
 * Get performance metrics
 */
const getPerformanceMetrics = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const result = await query(
      `SELECT
        DATE_TRUNC('hour', created_at) as hour,
        metric_name,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value
      FROM system_health_metrics
      WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
      GROUP BY hour, metric_name
      ORDER BY hour DESC, metric_name`,
      []
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics',
      error: error.message,
    });
  }
};

/**
 * Record system health metrics to database
 */
const recordSystemMetrics = async (systemMetrics, dbStatus, redisStatus) => {
  try {
    const metrics = [
      {
        name: 'cpu_load_1min',
        value: systemMetrics.cpu.loadAverage[0],
        unit: 'load',
        status: systemMetrics.cpu.loadAverage[0] < 1 ? 'normal' : 'high',
      },
      {
        name: 'memory_percent_used',
        value: parseFloat(systemMetrics.memory.percentUsed),
        unit: 'percent',
        status: parseFloat(systemMetrics.memory.percentUsed) < 80 ? 'normal' : 'high',
      },
      {
        name: 'process_memory_rss',
        value: systemMetrics.process.memoryUsage.rss / 1024 / 1024,
        unit: 'MB',
        status: systemMetrics.process.memoryUsage.rss < 512 * 1024 * 1024 ? 'normal' : 'high',
      },
      {
        name: 'database_status',
        value: dbStatus === 'healthy' ? 1 : 0,
        unit: 'boolean',
        status: dbStatus,
      },
      {
        name: 'redis_status',
        value: redisStatus === 'healthy' ? 1 : 0,
        unit: 'boolean',
        status: redisStatus,
      },
    ];

    for (const metric of metrics) {
      await query(
        `INSERT INTO system_health_metrics (
          metric_name, metric_value, metric_unit, status, metadata
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          metric.name,
          metric.value,
          metric.unit,
          metric.status,
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      );
    }
  } catch (error) {
    console.error('Record system metrics error:', error);
  }
};

/**
 * Clean up old health metrics
 */
const cleanupHealthMetrics = async () => {
  try {
    // Keep metrics for 7 days
    await query(
      `DELETE FROM system_health_metrics
       WHERE created_at < NOW() - INTERVAL '7 days'`
    );
  } catch (error) {
    console.error('Health metrics cleanup error:', error);
  }
};

// Run cleanup daily
setInterval(cleanupHealthMetrics, 86400000);

module.exports = {
  getHealth,
  getSystemMetrics,
  getErrorLogs,
  getPerformanceMetrics,
};
