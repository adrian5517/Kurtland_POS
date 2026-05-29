const { db } = require('../../db/pool')

const userRepository = {
  async findAll() {
    const result = await db.query(
      `SELECT id, email, name, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC`,
    )
    return result.rows
  },

  async findById(id) {
    const result = await db.query(
      `SELECT id, email, name, role, is_active, created_at
       FROM users WHERE id = $1`,
      [id],
    )
    return result.rows[0] || null
  },

  async findByEmail(email) {
    const result = await db.query(
      `SELECT id, email, name, role, is_active FROM users WHERE email = $1`,
      [email],
    )
    return result.rows[0] || null
  },

  async create({ email, name, passwordHash, role }) {
    const result = await db.query(
      `INSERT INTO users (email, name, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, name, role, is_active, created_at`,
      [email, name, passwordHash, role],
    )
    return result.rows[0]
  },

  async update(id, { name, role }) {
    const result = await db.query(
      `UPDATE users SET name = $2, role = $3
       WHERE id = $1
       RETURNING id, email, name, role, is_active, created_at`,
      [id, name, role],
    )
    return result.rows[0] || null
  },

  async updateProfile(id, { name, email }) {
    const result = await db.query(
      `UPDATE users SET name = $2, email = $3
       WHERE id = $1
       RETURNING id, email, name, role, is_active, created_at`,
      [id, name, email],
    )
    return result.rows[0] || null
  },

  async setActiveStatus(id, isActive) {
    const result = await db.query(
      `UPDATE users SET is_active = $2
       WHERE id = $1
       RETURNING id, email, name, role, is_active, created_at`,
      [id, isActive],
    )
    return result.rows[0] || null
  },

  async updatePassword(id, passwordHash) {
    await db.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [id, passwordHash],
    )
  },

  async delete(id) {
    await db.query(`DELETE FROM users WHERE id = $1`, [id])
  },

  async getPasswordHash(id) {
    const result = await db.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [id],
    )
    return result.rows[0]?.password_hash || null
  },
}

module.exports = { userRepository }
