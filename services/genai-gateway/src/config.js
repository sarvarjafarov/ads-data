const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: process.env.PORT || 4000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
};
