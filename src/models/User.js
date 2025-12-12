const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

class User {
  /**
   * Get all users (without password hashes)
   */
  static async findAll() {
    const result = await query(`
      SELECT id, username, email, role, status, company_name,
             contact_person, phone, created_at, updated_at, last_login_at
      FROM users
      ORDER BY created_at DESC
    `);
    return result.rows;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT id, username, email, role, status, company_name,
              contact_person, phone, created_at, updated_at, last_login_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by ID (including password hash for authentication)
   */
  static async findByIdWithPassword(id) {
    const result = await query(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const result = await query(
      `SELECT id, username, email, role, status, company_name,
              contact_person, phone, created_at, updated_at, last_login_at
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email (including password hash for authentication)
   */
  static async findByEmailWithPassword(email) {
    const result = await query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    const result = await query(
      `SELECT id, username, email, role, status, company_name,
              contact_person, phone, created_at, updated_at, last_login_at
       FROM users WHERE username = $1`,
      [username]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by username (including password hash for authentication)
   */
  static async findByUsernameWithPassword(username) {
    const result = await query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all pending users
   */
  static async findPending() {
    const result = await query(`
      SELECT id, username, email, role, status, company_name,
             contact_person, phone, created_at, updated_at, last_login_at
      FROM users
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);
    return result.rows;
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    const {
      username,
      email,
      password,
      role = 'user',
      status = 'pending',
      companyName,
      contactPerson,
      phone,
      customerType = 'b2b'
    } = userData;

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, email, password_hash, role, status,
                          company_name, contact_person, phone, customer_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, email, role, status, company_name,
                 contact_person, phone, customer_type, created_at, updated_at, last_login_at`,
      [username, email, passwordHash, role, status, companyName, contactPerson, phone, customerType]
    );

    return result.rows[0];
  }

  /**
   * Update user by ID
   */
  static async update(id, userData) {
    const updates = [];
    const values = [];
    let paramCounter = 1;

    // Build dynamic update query
    if (userData.username !== undefined) {
      updates.push(`username = $${paramCounter++}`);
      values.push(userData.username);
    }
    if (userData.email !== undefined) {
      updates.push(`email = $${paramCounter++}`);
      values.push(userData.email);
    }
    if (userData.password !== undefined) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      updates.push(`password_hash = $${paramCounter++}`);
      values.push(passwordHash);
    }
    if (userData.role !== undefined) {
      updates.push(`role = $${paramCounter++}`);
      values.push(userData.role);
    }
    if (userData.status !== undefined) {
      updates.push(`status = $${paramCounter++}`);
      values.push(userData.status);
    }
    if (userData.companyName !== undefined) {
      updates.push(`company_name = $${paramCounter++}`);
      values.push(userData.companyName);
    }
    if (userData.contactPerson !== undefined) {
      updates.push(`contact_person = $${paramCounter++}`);
      values.push(userData.contactPerson);
    }
    if (userData.phone !== undefined) {
      updates.push(`phone = $${paramCounter++}`);
      values.push(userData.phone);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCounter}
       RETURNING id, username, email, role, status, company_name,
                 contact_person, phone, created_at, updated_at, last_login_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete user by ID
   */
  static async delete(id) {
    const result = await query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Verify password
   */
  static async verifyPassword(user, password) {
    if (!user || !user.password_hash) {
      return false;
    }
    return await bcrypt.compare(password, user.password_hash);
  }

  /**
   * Approve a user
   */
  static async approve(id) {
    const result = await query(
      `UPDATE users
       SET status = 'approved'
       WHERE id = $1
       RETURNING id, username, email, role, status, company_name,
                 contact_person, phone, created_at, updated_at, last_login_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Reject a user
   */
  static async reject(id) {
    const result = await query(
      `UPDATE users
       SET status = 'rejected'
       WHERE id = $1
       RETURNING id, username, email, role, status, company_name,
                 contact_person, phone, created_at, updated_at, last_login_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id) {
    await query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  }

  /**
   * Generate and store email verification token
   */
  static async generateVerificationToken(userId) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token valid for 24 hours

    await query(
      `UPDATE users
       SET verification_token = $1, verification_token_expires = $2
       WHERE id = $3`,
      [token, expiresAt, userId]
    );

    return token;
  }

  /**
   * Find user by verification token
   */
  static async findByVerificationToken(token) {
    const result = await query(
      `SELECT id, username, email, role, status, company_name,
              contact_person, phone, email_verified, verification_token_expires
       FROM users
       WHERE verification_token = $1`,
      [token]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token) {
    const user = await this.findByVerificationToken(token);

    if (!user) {
      throw new Error('Invalid verification token');
    }

    // Check if token has expired
    if (new Date() > new Date(user.verification_token_expires)) {
      throw new Error('Verification token has expired');
    }

    // Update user: mark as verified and approved
    const result = await query(
      `UPDATE users
       SET email_verified = TRUE,
           status = 'approved',
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE id = $1
       RETURNING id, username, email, role, status, company_name,
                 contact_person, phone, created_at, updated_at`,
      [user.id]
    );

    return result.rows[0];
  }

  /**
   * Resend verification email (generate new token)
   */
  static async regenerateVerificationToken(email) {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.email_verified) {
      throw new Error('Email is already verified');
    }

    return await this.generateVerificationToken(user.id);
  }
}

module.exports = User;
