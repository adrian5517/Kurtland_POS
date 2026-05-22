const { db } = require('../../db/pool')

const authRepository = {
  async findUserByEmail(email) {
    const result = await db.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1 LIMIT 1',
      [email],
    )

    return result.rows[0] || null
  },

  async findUserById(id) {
    const result = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = $1 LIMIT 1',
      [id],
    )

    return result.rows[0] || null
  },
}

module.exports = { authRepository }
