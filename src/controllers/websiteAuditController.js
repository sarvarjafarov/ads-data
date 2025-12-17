const websiteAuditService = require('../services/websiteAuditService');
const aiWebsiteAuditService = require('../services/aiWebsiteAudit');
const { getCache, setCache } = require('../config/redis');
const { query } = require('../config/database');

/**
 * Website Audit Controller
 *
 * Handles website tracking audit requests with caching and rate limiting
 */

/**
 * Audit a website for tracking pixels and events (Async)
 * POST /api/website-audit/workspaces/:workspaceId/audit
 *
 * Returns a job ID immediately and processes audit in background
 */
const auditWebsite = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { url } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Website URL is required'
      });
    }

    // Validate workspace access
    const workspaceCheck = await query(
      `SELECT id FROM workspaces WHERE id = $1 AND owner_id = $2`,
      [workspaceId, userId]
    );

    if (workspaceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workspace'
      });
    }

    // Check rate limit - 5 audits per hour per workspace
    const recentAuditsResult = await query(
      `SELECT get_recent_audit_count($1, 1) as count`,
      [workspaceId]
    );

    const recentAudits = recentAuditsResult.rows[0]?.count || 0;

    if (recentAudits >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Maximum 5 audits per hour per workspace.',
        retryAfter: 3600 // seconds
      });
    }

    // Normalize URL for cache key
    const normalizedUrl = url.trim().toLowerCase();
    const cacheKey = `website_audit:${normalizedUrl}`;

    // Check cache first
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      console.log('Returning cached audit result for:', normalizedUrl);
      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        cachedAt: cachedResult.metadata?.cachedAt
      });
    }

    // Create audit job
    const jobResult = await query(
      `INSERT INTO audit_jobs (workspace_id, user_id, website_url, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, status, created_at`,
      [workspaceId, userId, url]
    );

    const job = jobResult.rows[0];

    // Process audit in background (don't await)
    processAuditJob(job.id, workspaceId, userId, url, req.ip, req.get('user-agent')).catch(err => {
      console.error('Background audit processing error:', err);
    });

    // Return job ID immediately
    res.json({
      success: true,
      jobId: job.id,
      status: 'pending',
      message: 'Audit started. Use the job ID to check status.',
      pollUrl: `/api/website-audit/jobs/${job.id}`
    });

  } catch (error) {
    console.error('Website audit error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to start audit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Background job processor for website audits
 */
async function processAuditJob(jobId, workspaceId, userId, url, ipAddress, userAgent) {
  const startTime = Date.now();

  try {
    // Update status to processing
    await query(
      `UPDATE audit_jobs SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [jobId]
    );

    console.log(`[Job ${jobId}] Starting technical audit for:`, url);

    // Perform technical audit
    const technicalFindings = await websiteAuditService.auditWebsite(url);

    // Perform AI business impact analysis
    console.log(`[Job ${jobId}] Starting AI business analysis for:`, url);
    const businessAnalysis = await aiWebsiteAuditService.analyzeBusinessImpact(
      technicalFindings,
      url
    );

    // Combine results
    const auditDuration = Date.now() - startTime;
    const auditResult = {
      websiteUrl: url,
      technicalFindings,
      businessAnalysis,
      metadata: {
        auditDuration,
        timestamp: new Date().toISOString(),
        cachedAt: new Date().toISOString()
      }
    };

    // Cache for 1 hour
    const cacheKey = `website_audit:${url.trim().toLowerCase()}`;
    await setCache(cacheKey, auditResult, 3600);

    // Update job with result
    await query(
      `UPDATE audit_jobs
       SET status = 'completed', result = $1, completed_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(auditResult), jobId]
    );

    // Log audit metadata
    await query(
      `INSERT INTO website_audit_logs (workspace_id, user_id, website_url, audit_duration_ms, platforms_analyzed, overall_score, critical_issues_count, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        workspaceId,
        userId,
        url,
        auditDuration,
        JSON.stringify(Object.keys(technicalFindings.platforms)),
        businessAnalysis.overallScore || null,
        businessAnalysis.criticalIssues?.length || 0,
        ipAddress,
        userAgent
      ]
    );

    console.log(`[Job ${jobId}] Audit completed in ${auditDuration}ms for:`, url);

  } catch (error) {
    console.error(`[Job ${jobId}] Audit error:`, error);

    // Update job with error
    await query(
      `UPDATE audit_jobs
       SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE id = $2`,
      [error.message, jobId]
    );
  }
}

/**
 * Get audit job status
 * GET /api/website-audit/jobs/:jobId
 */
const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    // Get job with workspace validation
    const jobResult = await query(
      `SELECT aj.*, w.owner_id
       FROM audit_jobs aj
       JOIN workspaces w ON w.id = aj.workspace_id
       WHERE aj.id = $1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const job = jobResult.rows[0];

    // Verify user has access to this workspace
    if (job.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Return job status
    const response = {
      success: true,
      jobId: job.id,
      status: job.status,
      websiteUrl: job.website_url,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at
    };

    if (job.status === 'completed' && job.result) {
      response.data = job.result;
    } else if (job.status === 'failed' && job.error_message) {
      response.error = job.error_message;
    }

    res.json(response);

  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve job status'
    });
  }
};

/**
 * Get audit history for a workspace
 * GET /api/website-audit/workspaces/:workspaceId/history
 */
const getAuditHistory = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Validate workspace access
    const workspaceCheck = await query(
      `SELECT id FROM workspaces WHERE id = $1 AND owner_id = $2`,
      [workspaceId, userId]
    );

    if (workspaceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workspace'
      });
    }

    // Get audit history
    const historyResult = await query(
      `SELECT
         id,
         website_url,
         audit_duration_ms,
         platforms_analyzed,
         overall_score,
         critical_issues_count,
         created_at
       FROM website_audit_logs
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM website_audit_logs WHERE workspace_id = $1`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        audits: historyResult.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get audit history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit history'
    });
  }
};

/**
 * Get audit statistics for a workspace
 * GET /api/website-audit/workspaces/:workspaceId/stats
 */
const getAuditStats = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Validate workspace access
    const workspaceCheck = await query(
      `SELECT id FROM workspaces WHERE id = $1 AND owner_id = $2`,
      [workspaceId, userId]
    );

    if (workspaceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workspace'
      });
    }

    // Get statistics using the database function
    const statsResult = await query(
      `SELECT * FROM get_audit_statistics($1)`,
      [workspaceId]
    );

    // Get recent audit count
    const recentAuditsResult = await query(
      `SELECT get_recent_audit_count($1, 1) as count`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        total_audits: statsResult.rows[0]?.total_audits || 0,
        avg_score: statsResult.rows[0]?.avg_score || null,
        avg_duration_ms: statsResult.rows[0]?.avg_duration_ms || null,
        recent_audits_last_hour: recentAuditsResult.rows[0]?.count || 0,
        rate_limit_remaining: Math.max(0, 5 - (recentAuditsResult.rows[0]?.count || 0))
      }
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics'
    });
  }
};

module.exports = {
  auditWebsite,
  getJobStatus,
  getAuditHistory,
  getAuditStats
};
