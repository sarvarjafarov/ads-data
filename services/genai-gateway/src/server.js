const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, config.host, () => {
  console.log(`GenAI Inference Gateway running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`Health check: http://localhost:${config.port}/api/health`);
  console.log(`Metrics:      http://localhost:${config.port}/api/metrics`);
});

process.on('unhandledRejection', (err) => {
  console.error('[GenAI Gateway] Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('[GenAI Gateway] SIGTERM received, shutting down');
  server.close(() => {
    console.log('[GenAI Gateway] Process terminated');
  });
});
