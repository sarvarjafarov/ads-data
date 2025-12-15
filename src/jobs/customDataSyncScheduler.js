/**
 * Custom Data Sync Scheduler
 * Cron-based scheduler for syncing Google Sheets and other custom data sources
 */

const cron = require('node-cron');
const GoogleSheetsSyncService = require('../services/googleSheetsSync');

// Track running jobs to prevent overlaps
let isRunning = false;

/**
 * Sync job that runs periodically
 */
async function runSyncJob() {
  if (isRunning) {
    console.log('⏭️  Skipping sync job - previous job still running');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log('\n🕐 [Sync Scheduler] Starting scheduled sync job...');

    // Sync all Google Sheets sources that are due
    const result = await GoogleSheetsSyncService.syncDueSources();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [Sync Scheduler] Completed in ${duration}s - Processed: ${result.processed}, Success: ${result.successful}, Failed: ${result.failed}\n`);

    // Log individual results
    if (result.results.length > 0) {
      result.results.forEach(r => {
        if (r.success) {
          console.log(`  ✓ ${r.sourceName}: ${r.newRows} new, ${r.updatedRows} updated`);
        } else {
          console.log(`  ✗ ${r.sourceName}: ${r.error}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ [Sync Scheduler] Error during scheduled sync:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize and start the sync scheduler
 */
function startScheduler() {
  console.log('🚀 [Sync Scheduler] Initializing custom data sync scheduler...');

  // Run every hour at minute 0
  // Cron format: minute hour day month weekday
  const hourlySchedule = '0 * * * *'; // Every hour at minute 0

  const hourlyTask = cron.schedule(hourlySchedule, runSyncJob, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log(`✅ [Sync Scheduler] Hourly sync job scheduled (${hourlySchedule})`);

  // Also run every 15 minutes for sources with "frequent" sync
  const frequentSchedule = '*/15 * * * *'; // Every 15 minutes

  const frequentTask = cron.schedule(frequentSchedule, async () => {
    if (isRunning) return;

    try {
      // Only sync sources with "frequent" or "hourly" frequency
      const sources = await GoogleSheetsSyncService.getSourcesDueForSync();
      const frequentSources = sources.filter(s =>
        s.sync_frequency === 'frequent' || s.sync_frequency === 'hourly'
      );

      if (frequentSources.length > 0) {
        console.log(`🔄 [Sync Scheduler] Processing ${frequentSources.length} frequent sync sources`);
        for (const source of frequentSources) {
          await GoogleSheetsSyncService.syncGoogleSheet(source.id, 'scheduled_sync');
        }
      }
    } catch (error) {
      console.error('❌ [Sync Scheduler] Error in frequent sync:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log(`✅ [Sync Scheduler] Frequent sync job scheduled (${frequentSchedule})`);

  // Run daily at midnight to refresh materialized views
  const dailySchedule = '0 0 * * *'; // Every day at midnight UTC

  const dailyTask = cron.schedule(dailySchedule, async () => {
    try {
      console.log('🔄 [Sync Scheduler] Refreshing materialized views...');
      const { query } = require('../config/database');
      await query('SELECT refresh_custom_data_daily_aggregates()');
      console.log('✅ [Sync Scheduler] Materialized views refreshed');
    } catch (error) {
      console.error('❌ [Sync Scheduler] Failed to refresh materialized views:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log(`✅ [Sync Scheduler] Daily maintenance job scheduled (${dailySchedule})`);

  // Return tasks for manual control if needed
  return {
    hourlyTask,
    frequentTask,
    dailyTask,
    stop: () => {
      hourlyTask.stop();
      frequentTask.stop();
      dailyTask.stop();
      console.log('🛑 [Sync Scheduler] All scheduled jobs stopped');
    },
    start: () => {
      hourlyTask.start();
      frequentTask.start();
      dailyTask.start();
      console.log('▶️  [Sync Scheduler] All scheduled jobs started');
    },
  };
}

/**
 * Run sync job immediately (for testing or manual trigger)
 */
async function runImmediately() {
  console.log('🔄 [Sync Scheduler] Running sync job immediately...');
  await runSyncJob();
}

module.exports = {
  startScheduler,
  runImmediately,
};
