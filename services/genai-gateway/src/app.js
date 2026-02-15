const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const rateLimiter = require('./middleware/rateLimiter');
const { usageLogger } = require('./middleware/usageLogger');

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));

// Logging
app.use(morgan('dev'));

// Body parsing — increased limit for large AI payloads (time series, audit data)
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Usage tracking
app.use(usageLogger);

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[GenAI Gateway] Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;
