const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/config');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware with relaxed CSP for admin panel
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Logging middleware
app.use(morgan('dev'));

// Cookie parser (required for A/B experiment sticky assignment via cookies)
app.use(cookieParser());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// Admin panel routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

app.get('/register-b2c', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register-b2c.html'));
});

app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/verify-email.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/dashboard-viewer', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard-viewer.html'));
});

// app.get('/campaigns', (req, res) => {
//   res.sendFile(path.join(__dirname, '../public/campaigns.html'));
// });

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/pricing.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/privacy.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/terms.html'));
});

app.get('/platforms/meta', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platform-meta.html'));
});

app.get('/platforms/google-ads', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platform-google.html'));
});

app.get('/platforms/tiktok', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platform-tiktok.html'));
});

app.get('/platforms/linkedin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platform-linkedin.html'));
});

app.get('/platforms/search-console', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platform-searchconsole.html'));
});

app.get('/website-audit', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/website-audit.html'));
});

app.get('/experiment-demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/experiment-demo.html'));
});

// Root route - serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
