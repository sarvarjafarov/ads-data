const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

// Register new user (B2B registration - requires approval)
const register = async (req, res) => {
  try {
    const { username, email, password, companyName, contactPerson, phone } = req.body;

    // Validation
    if (!username || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, password, and company name',
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Create user with pending status
    const newUser = await User.create({
      username,
      email,
      password,
      companyName,
      contactPerson,
      phone,
      role: 'user',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending approval.',
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Accept either username or email
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password',
      });
    }

    // Find user by username or email (with password hash for verification)
    let user = await User.findByUsernameWithPassword(loginIdentifier);
    if (!user) {
      user = await User.findByEmailWithPassword(loginIdentifier);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is approved
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin approval.',
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact support.',
      });
    }

    // Check password
    const isMatch = await User.verifyPassword(user, password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login timestamp
    await User.updateLastLogin(user.id);

    // Create token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpire }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.company_name,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Logout
const logout = (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logout successful',
  });
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.company_name,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
