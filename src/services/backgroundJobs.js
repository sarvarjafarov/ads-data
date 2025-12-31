/**
 * Background Job Service
 * Handles long-running operations that exceed Heroku's 30-second timeout
 * Uses Redis for job queue and status tracking
 */

const { setCache, getCache, deleteCache } = require('../config/redis');
const aiWidgetAnalysis = require('./aiWidgetAnalysis');

/**
 * Job statuses
 */
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Create a background job for AI widget analysis
 *
 * @param {string} jobId - Unique job identifier
 * @param {Object} widget - Widget configuration
 * @param {Object} metricsData - Metrics data
 * @param {Object} options - Analysis options
 * @returns {Promise<void>}
 */
async function processAIAnalysisJob(jobId, widget, metricsData, options = {}) {
  try {
    // Update status to processing
    await setCache(`job:${jobId}:status`, JOB_STATUS.PROCESSING, 600); // 10 min TTL
    await setCache(`job:${jobId}:progress`, 'Analyzing widget data with AI...', 600);

    // Perform the actual AI analysis (this can take 30+ seconds)
    const analysis = await aiWidgetAnalysis.analyzeWidget(widget, metricsData, options);

    // Store results
    await setCache(`job:${jobId}:status`, JOB_STATUS.COMPLETED, 600);
    await setCache(`job:${jobId}:result`, JSON.stringify(analysis), 600);
    await deleteCache(`job:${jobId}:progress`);

    console.log(`[Background Job] AI analysis job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[Background Job] AI analysis job ${jobId} failed:`, error);

    await setCache(`job:${jobId}:status`, JOB_STATUS.FAILED, 600);
    await setCache(`job:${jobId}:error`, error.message, 600);
    await deleteCache(`job:${jobId}:progress`);
  }
}

/**
 * Start an AI analysis background job
 *
 * @param {string} jobId - Unique job identifier
 * @param {Object} widget - Widget configuration
 * @param {Object} metricsData - Metrics data
 * @param {Object} options - Analysis options
 */
function startAIAnalysisJob(jobId, widget, metricsData, options = {}) {
  // Set initial status
  setCache(`job:${jobId}:status`, JOB_STATUS.PENDING, 600);

  // Start processing in background (don't await)
  processAIAnalysisJob(jobId, widget, metricsData, options).catch(err => {
    console.error(`[Background Job] Unhandled error in job ${jobId}:`, err);
  });

  console.log(`[Background Job] AI analysis job ${jobId} started`);
}

/**
 * Get job status and results
 *
 * @param {string} jobId - Job identifier
 * @returns {Promise<Object>} Job information
 */
async function getJobStatus(jobId) {
  const status = await getCache(`job:${jobId}:status`);

  if (!status) {
    return {
      status: 'not_found',
      message: 'Job not found or expired',
    };
  }

  const result = {
    status,
    jobId,
  };

  if (status === JOB_STATUS.PROCESSING) {
    const progress = await getCache(`job:${jobId}:progress`);
    result.progress = progress || 'Processing...';
  }

  if (status === JOB_STATUS.COMPLETED) {
    const resultData = await getCache(`job:${jobId}:result`);
    result.data = resultData ? JSON.parse(resultData) : null;
  }

  if (status === JOB_STATUS.FAILED) {
    const error = await getCache(`job:${jobId}:error`);
    result.error = error || 'Unknown error';
  }

  return result;
}

/**
 * Clean up job data
 *
 * @param {string} jobId - Job identifier
 */
async function cleanupJob(jobId) {
  await deleteCache(`job:${jobId}:status`);
  await deleteCache(`job:${jobId}:result`);
  await deleteCache(`job:${jobId}:error`);
  await deleteCache(`job:${jobId}:progress`);
}

module.exports = {
  JOB_STATUS,
  startAIAnalysisJob,
  getJobStatus,
  cleanupJob,
};
