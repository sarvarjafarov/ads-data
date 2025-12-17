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
 * Audit a website for tracking pixels and events
 * POST /api/website-audit/workspaces/:workspaceId/audit
 */
const auditWebsite = async (req, res) => {
  const startTime = Date.now();

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
      `SELECT id FROM workspaces WHERE id = $1 AND user_id = $2`,
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

    // Check cache
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      console.log('Returning cached audit result for:', normalizedUrl);

      // Log the cached audit access
      await query(
        `INSERT INTO website_audit_logs (workspace_id, user_id, website_url, audit_duration_ms, platforms_analyzed, overall_score, critical_issues_count, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          workspaceId,
          userId,
          normalizedUrl,
          0, // Cached, so 0ms
          JSON.stringify(Object.keys(cachedResult.technicalFindings?.platforms || {})),
          cachedResult.businessAnalysis?.overallScore || null,
          cachedResult.businessAnalysis?.criticalIssues?.length || 0,
          req.ip || req.connection.remoteAddress,
          req.get('user-agent')
        ]
      );

      return res.json({
        success: true,
        data: cachedResult,
        cached: true,
        cachedAt: cachedResult.metadata?.cachedAt
      });
    }

    // Perform technical audit
    console.log('Starting technical audit for:', url);
    const technicalFindings = await websiteAuditService.auditWebsite(url);

    // Perform AI business impact analysis
    console.log('Starting AI business analysis for:', url);
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
    await setCache(cacheKey, auditResult, 3600);

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
        req.ip || req.connection.remoteAddress,
        req.get('user-agent')
      ]
    );

    console.log(`Audit completed in ${auditDuration}ms for:`, url);

    res.json({
      success: true,
      data: auditResult,
      cached: false
    });

  } catch (error) {
    console.error('Website audit error:', error);

    const auditDuration = Date.now() - startTime;

    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage = 'Failed to audit website';

    if (error.message.includes('Invalid URL')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('Cannot audit localhost')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('timeout') || error.message.includes('took too long')) {
      statusCode = 504;
      errorMessage = 'Website took too long to load. Please try again or contact the website owner.';
    } else if (error.message.includes('navigation')) {
      statusCode = 502;
      errorMessage = 'Could not connect to website. Please verify the URL is correct and the site is accessible.';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      auditDuration
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
      `SELECT id FROM workspaces WHERE id = $1 AND user_id = $2`,
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
      `SELECT id FROM workspaces WHERE id = $1 AND user_id = $2`,
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
  getAuditHistory,
  getAuditStats
};
