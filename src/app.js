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

// Cookie parser
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

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/dashboard-viewer', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard-viewer.html'));
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Ads Data API',
    version: '1.0.0',
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
