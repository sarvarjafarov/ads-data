/**
 * Report Scheduler Service
 * Handles scheduling and execution of automated reports using node-cron
 */

const cron = require('node-cron');
const { query } = require('../config/database');
const emailService = require('./emailService');
const reportGenerator = require('./reportGenerator');

class ReportScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start the report scheduler
   * Checks for pending reports every minute
   */
  start() {
    if (this.isRunning) {
      console.log('Report scheduler is already running');
      return;
    }

    // Check for reports to send every minute
    this.mainJob = cron.schedule('* * * * *', async () => {
      await this.checkAndProcessReports();
    });

    this.isRunning = true;
    console.log('Report scheduler started - checking for pending reports every minute');
  }

  /**
   * Stop the report scheduler
   */
  stop() {
    if (this.mainJob) {
      this.mainJob.stop();
      this.isRunning = false;
      console.log('Report scheduler stopped');
    }
  }

  /**
   * Check for reports that need to be sent and process them
   */
  async checkAndProcessReports() {
    try {
      const pendingReports = await this.getPendingReports();

      if (pendingReports.length > 0) {
        console.log(`Found ${pendingReports.length} reports to process`);

        for (const report of pendingReports) {
          await this.processReport(report);
        }
      }
    } catch (error) {
      console.error('Error checking pending reports:', error);
    }
  }

  /**
   * Get reports that are due to be sent
   */
  async getPendingReports() {
    const result = await query(
      `SELECT sr.*, u.email as user_email
       FROM scheduled_reports sr
       JOIN users u ON u.id = sr.user_id
       WHERE sr.is_active = true
         AND sr.next_scheduled_at <= NOW()
         AND (sr.last_sent_at IS NULL OR sr.last_sent_at < sr.next_scheduled_at)
       ORDER BY sr.next_scheduled_at ASC`,
      []
    );

    return result.rows;
  }

  /**
   * Process a single report
   */
  async processReport(report) {
    let execution = null;

    try {
      // Create execution record
      execution = await this.createExecution(report.id);

      console.log(`Processing report: ${report.name} (${report.id})`);

      // Update execution status to processing
      await this.updateExecutionStatus(execution.id, 'processing');

      // Generate report data
      const reportData = await reportGenerator.generateReport(report);

      // Send email
      await emailService.sendScheduledReport({
        to: report.recipients,
        subject: `${report.name} - ${reportData.dateRange}`,
        reportName: report.name,
        reportData,
        includeCharts: report.include_charts,
      });

      // Update execution status to sent
      await this.updateExecutionStatus(execution.id, 'sent', reportData);

      // Update report last_sent_at and calculate next_scheduled_at
      await this.updateReportAfterSending(report.id);

      console.log(`Report sent successfully: ${report.name}`);
    } catch (error) {
      console.error(`Error processing report ${report.name}:`, error);

      if (execution) {
        await this.updateExecutionStatus(execution.id, 'failed', null, error.message);
      }
    }
  }

  /**
   * Create a report execution record
   */
  async createExecution(reportId) {
    const result = await query(
      `INSERT INTO report_executions (scheduled_report_id, status)
       VALUES ($1, 'pending')
       RETURNING id, scheduled_report_id, status, started_at`,
      [reportId]
    );

    return result.rows[0];
  }

  /**
   * Update execution status
   */
  async updateExecutionStatus(executionId, status, reportData = null, errorMessage = null) {
    await query(
      `UPDATE report_executions
       SET status = $1,
           completed_at = CASE WHEN $1 IN ('sent', 'failed') THEN NOW() ELSE NULL END,
           report_data = $2,
           error_message = $3
       WHERE id = $4`,
      [status, reportData ? JSON.stringify(reportData) : null, errorMessage, executionId]
    );
  }

  /**
   * Update report after successful sending
   */
  async updateReportAfterSending(reportId) {
    // Update last_sent_at to NOW
    // The trigger will automatically update next_scheduled_at based on frequency
    await query(
      `UPDATE scheduled_reports
       SET last_sent_at = NOW()
       WHERE id = $1`,
      [reportId]
    );
  }

  /**
   * Manually trigger a report (for testing)
   */
  async triggerReport(reportId) {
    const result = await query(
      `SELECT sr.*, u.email as user_email
       FROM scheduled_reports sr
       JOIN users u ON u.id = sr.user_id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      throw new Error('Report not found');
    }

    await this.processReport(result.rows[0]);
    return { success: true, message: 'Report triggered successfully' };
  }

  /**
   * Get report execution history
   */
  async getExecutionHistory(reportId, limit = 10) {
    const result = await query(
      `SELECT id, scheduled_report_id, status, started_at, completed_at, error_message
       FROM report_executions
       WHERE scheduled_report_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [reportId, limit]
    );

    return result.rows;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.jobs.size,
    };
  }
}

module.exports = new ReportScheduler();
