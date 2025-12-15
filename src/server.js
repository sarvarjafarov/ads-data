const app = require('./app');
const config = require('./config/config');
const reportScheduler = require('./services/reportScheduler');
const customDataSyncScheduler = require('./jobs/customDataSyncScheduler');
const { initRedis } = require('./config/redis');

// Store scheduler instances
let syncSchedulerInstance = null;

const server = app.listen(config.port, async () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);

  // Initialize Redis cache
  try {
    await initRedis();
    console.log('✅ Redis cache initialized successfully');
  } catch (error) {
    console.warn('⚠️  Redis initialization failed, running without cache:', error.message);
  }

  // Start the report scheduler
  reportScheduler.start();

  // Start the custom data sync scheduler
  syncSchedulerInstance = customDataSyncScheduler.startScheduler();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Stop the report scheduler
  reportScheduler.stop();

  // Stop the custom data sync scheduler
  if (syncSchedulerInstance) {
    syncSchedulerInstance.stop();
  }

  server.close(() => {
    console.log('Process terminated');
  });
});
