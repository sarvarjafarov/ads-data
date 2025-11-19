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
      phone
    } = userData;

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, email, password_hash, role, status,
                          company_name, contact_person, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, email, role, status, company_name,
                 contact_person, phone, created_at, updated_at, last_login_at`,
      [username, email, passwordHash, role, status, companyName, contactPerson, phone]
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
}

module.exports = User;
