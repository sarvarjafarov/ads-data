const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const emailService = require('../services/emailService');
const Workspace = require('../models/Workspace');

// Register new user (Supports both B2B and B2C)
const register = async (req, res) => {
  try {
    const { username, email, password, companyName, contactPerson, phone, customerType } = req.body;

    // Determine customer type (default to B2B for backward compatibility)
    const type = customerType || 'b2b';

    // Validation - companyName required for B2B, optional for B2C
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password',
      });
    }

    if (type === 'b2b' && !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required for business accounts',
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

    // Create user with unverified status
    const newUser = await User.create({
      username,
      email,
      password,
      companyName: companyName || null,
      contactPerson,
      phone,
      role: 'user',
      status: 'unverified',
      customerType: type,
    });

    // Generate verification token
    const verificationToken = await User.generateVerificationToken(newUser.id);

    // Send verification email
    try {
      await emailService.sendVerificationEmail({
        to: email,
        username,
        verificationToken,
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue anyway - user can request resend later
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
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

    // Check if email is verified
    if (user.status === 'unverified') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address. Check your inbox for the verification link.',
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

// Verify email with token
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    // Verify email and update user status
    const user = await User.verifyEmail(token);

    // Create default workspace for the user
    try {
      await Workspace.create({
        name: `${user.company_name || user.username}'s Workspace`,
        ownerId: user.id,
        description: 'Default workspace',
        settings: {
          defaultCurrency: 'USD',
          timezone: 'UTC',
        },
      });
    } catch (workspaceError) {
      console.error('Error creating workspace:', workspaceError);
      // Continue anyway - workspace can be created on first login
    }

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in to your account.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);

    // Handle specific error messages
    if (error.message === 'Invalid verification token') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link. Please request a new one.',
      });
    }

    if (error.message === 'Verification token has expired') {
      return res.status(400).json({
        success: false,
        message: 'Verification link has expired. Please request a new one.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Email verification failed. Please try again.',
      error: error.message,
    });
  }
};

// Resend verification email
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Generate new verification token
    const verificationToken = await User.regenerateVerificationToken(email);

    // Get user info for email
    const user = await User.findByEmail(email);

    // Send verification email
    await emailService.sendVerificationEmail({
      to: email,
      username: user.username,
      verificationToken,
    });

    res.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);

    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    if (error.message === 'Email is already verified') {
      return res.status(400).json({
        success: false,
        message: 'Your email is already verified. You can log in to your account.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send verification email. Please try again.',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
};
