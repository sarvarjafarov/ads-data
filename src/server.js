const app = require('./app');
const config = require('./config/config');
const reportScheduler = require('./services/reportScheduler');

const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);

  // Start the report scheduler
  reportScheduler.start();
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

  server.close(() => {
    console.log('Process terminated');
  });
});
