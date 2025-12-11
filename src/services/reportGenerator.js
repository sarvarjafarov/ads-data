/**
 * Report Generator Service
 * Generates report data for scheduled reports
 */

const { query } = require('../config/database');
const { getPlatformService } = require('./platforms');

class ReportGenerator {
  /**
   * Generate report data based on scheduled report configuration
   * @param {Object} reportConfig - Scheduled report configuration
   */
  async generateReport(reportConfig) {
    const {
      workspace_id,
      report_type,
      ad_account_ids,
      platforms,
      metrics,
      date_range,
    } = reportConfig;

    const { startDate, endDate } = this.getDateRangeFromConfig(date_range);

    let reportData = {
      dateRange: this.formatDateRange(startDate, endDate, date_range),
      generatedAt: new Date().toISOString(),
    };

    switch (report_type) {
      case 'performance_summary':
        reportData = await this.generatePerformanceSummary(
          workspace_id,
          ad_account_ids,
          platforms,
          startDate,
          endDate,
          metrics
        );
        break;
      case 'platform_comparison':
        reportData = await this.generatePlatformComparison(
          workspace_id,
          ad_account_ids,
          platforms,
          startDate,
          endDate
        );
        break;
      case 'budget_report':
        reportData = await this.generateBudgetReport(
          workspace_id,
          ad_account_ids,
          startDate,
          endDate
        );
        break;
      default:
        reportData = await this.generatePerformanceSummary(
          workspace_id,
          ad_account_ids,
          platforms,
          startDate,
          endDate,
          metrics
        );
    }

    reportData.dateRange = this.formatDateRange(startDate, endDate, date_range);
    return reportData;
  }

  /**
   * Generate performance summary report
   */
  async generatePerformanceSummary(workspaceId, accountIds, platforms, startDate, endDate, requestedMetrics) {
    // Get ad accounts for the workspace
    const accounts = await this.getAdAccounts(workspaceId, accountIds, platforms);

    if (accounts.length === 0) {
      return this.getEmptyReport();
    }

    // For demo purposes, generate sample data
    // In production, this would fetch real metrics from the platform APIs
    const summary = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      averageCTR: 0,
      averageCPC: 0,
      spendChange: 0,
      impressionsChange: 0,
      clicksChange: 0,
      ctrChange: 0,
    };

    const platformData = [];
    const topPerformers = [];

    // Generate summary data for each platform
    for (const account of accounts) {
      const platformMetrics = this.generateDemoMetrics(account.platform);

      summary.totalSpend += platformMetrics.spend;
      summary.totalImpressions += platformMetrics.impressions;
      summary.totalClicks += platformMetrics.clicks;
      summary.totalConversions += platformMetrics.conversions;

      platformData.push({
        platform: account.platform,
        account_name: account.account_name,
        spend: platformMetrics.spend,
        impressions: platformMetrics.impressions,
        clicks: platformMetrics.clicks,
        conversions: platformMetrics.conversions,
        ctr: (platformMetrics.clicks / platformMetrics.impressions) * 100,
        cpc: platformMetrics.spend / platformMetrics.clicks,
        roas: platformMetrics.revenue / platformMetrics.spend,
      });

      // Add top campaigns for this account
      topPerformers.push({
        name: `${account.account_name} - Campaign ${Math.floor(Math.random() * 100)}`,
        platform: account.platform,
        spend: platformMetrics.spend * 0.3,
        conversions: platformMetrics.conversions * 0.4,
        roas: (platformMetrics.revenue / platformMetrics.spend) * 1.2,
      });
    }

    // Calculate averages
    summary.averageCTR = (summary.totalClicks / summary.totalImpressions) * 100;
    summary.averageCPC = summary.totalSpend / summary.totalClicks;

    // Generate comparison changes (demo data)
    summary.spendChange = (Math.random() - 0.5) * 30;
    summary.impressionsChange = (Math.random() - 0.5) * 40;
    summary.clicksChange = (Math.random() - 0.5) * 35;
    summary.ctrChange = (Math.random() - 0.5) * 20;

    // Sort top performers by ROAS
    topPerformers.sort((a, b) => b.roas - a.roas);

    return {
      summary,
      platforms: platformData,
      topPerformers: topPerformers.slice(0, 5),
    };
  }

  /**
   * Generate platform comparison report
   */
  async generatePlatformComparison(workspaceId, accountIds, platforms, startDate, endDate) {
    const result = await this.generatePerformanceSummary(
      workspaceId,
      accountIds,
      platforms,
      startDate,
      endDate,
      []
    );

    // Add platform-specific insights
    result.insights = this.generatePlatformInsights(result.platforms);

    return result;
  }

  /**
   * Generate budget report
   */
  async generateBudgetReport(workspaceId, accountIds, startDate, endDate) {
    const accounts = await this.getAdAccounts(workspaceId, accountIds, null);

    const budgetData = accounts.map(account => {
      const spent = Math.random() * 5000;
      const budget = spent / (0.6 + Math.random() * 0.4); // 60-100% spent

      return {
        platform: account.platform,
        account_name: account.account_name,
        budget,
        spent,
        remaining: budget - spent,
        pacing: (spent / budget) * 100,
        daysRemaining: 7,
        projectedSpend: spent * 1.15,
      };
    });

    const totalBudget = budgetData.reduce((sum, d) => sum + d.budget, 0);
    const totalSpent = budgetData.reduce((sum, d) => sum + d.spent, 0);

    return {
      summary: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        overallPacing: (totalSpent / totalBudget) * 100,
      },
      accounts: budgetData,
    };
  }

  /**
   * Get ad accounts for the workspace
   */
  async getAdAccounts(workspaceId, accountIds, platforms) {
    let sql = `
      SELECT id, platform, account_id, account_name, currency, timezone
      FROM ad_accounts
      WHERE workspace_id = $1
    `;
    const params = [workspaceId];

    if (accountIds && accountIds.length > 0) {
      sql += ` AND id = ANY($2)`;
      params.push(accountIds);
    }

    if (platforms && platforms.length > 0) {
      const paramIndex = params.length + 1;
      sql += ` AND platform = ANY($${paramIndex})`;
      params.push(platforms);
    }

    sql += ` ORDER BY platform, account_name`;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Generate demo metrics for a platform (replace with real API calls)
   */
  generateDemoMetrics(platform) {
    const baseMetrics = {
      facebook: { spend: 2500, impressions: 150000, clicks: 4500, conversions: 120, revenue: 6000 },
      google: { spend: 3500, impressions: 200000, clicks: 6000, conversions: 180, revenue: 9000 },
      meta: { spend: 2800, impressions: 170000, clicks: 5100, conversions: 140, revenue: 7200 },
      linkedin: { spend: 1200, impressions: 50000, clicks: 1500, conversions: 45, revenue: 2500 },
      twitter: { spend: 800, impressions: 80000, clicks: 2400, conversions: 60, revenue: 1800 },
    };

    const base = baseMetrics[platform] || baseMetrics.google;

    // Add some randomness to make it look realistic
    return {
      spend: base.spend * (0.8 + Math.random() * 0.4),
      impressions: base.impressions * (0.8 + Math.random() * 0.4),
      clicks: base.clicks * (0.8 + Math.random() * 0.4),
      conversions: base.conversions * (0.8 + Math.random() * 0.4),
      revenue: base.revenue * (0.8 + Math.random() * 0.4),
    };
  }

  /**
   * Generate platform insights
   */
  generatePlatformInsights(platformData) {
    const insights = [];

    // Find best performing platform by ROAS
    const bestROAS = platformData.reduce((best, p) =>
      (p.roas > best.roas ? p : best), platformData[0]);
    insights.push(`${this.formatPlatformName(bestROAS.platform)} has the highest ROAS at ${bestROAS.roas.toFixed(2)}x`);

    // Find platform with best CTR
    const bestCTR = platformData.reduce((best, p) =>
      (p.ctr > best.ctr ? p : best), platformData[0]);
    insights.push(`${this.formatPlatformName(bestCTR.platform)} has the highest CTR at ${bestCTR.ctr.toFixed(2)}%`);

    return insights;
  }

  /**
   * Get date range from configuration
   */
  getDateRangeFromConfig(dateRangeConfig) {
    const now = new Date();
    let startDate, endDate;

    switch (dateRangeConfig) {
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        break;
      case 'last_7_days':
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case 'last_30_days':
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 29);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  /**
   * Format date range for display
   */
  formatDateRange(startDate, endDate, configName) {
    const labels = {
      yesterday: 'Yesterday',
      last_7_days: 'Last 7 Days',
      last_30_days: 'Last 30 Days',
      last_month: 'Last Month',
    };

    const label = labels[configName] || 'Custom Range';
    return `${label} (${startDate} to ${endDate})`;
  }

  /**
   * Format platform name for display
   */
  formatPlatformName(platform) {
    const names = {
      facebook: 'Facebook',
      google: 'Google Ads',
      meta: 'Meta Ads',
      search_console: 'Google Search Console',
      linkedin: 'LinkedIn',
      twitter: 'Twitter/X',
    };
    return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  /**
   * Get empty report data
   */
  getEmptyReport() {
    return {
      summary: {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        averageCTR: 0,
        averageCPC: 0,
      },
      platforms: [],
      topPerformers: [],
    };
  }
}

module.exports = new ReportGenerator();
