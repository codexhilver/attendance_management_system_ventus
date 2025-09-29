import { sql } from '@vercel/postgres';

// Ensure schema exists on first import
let ensured = false;
async function ensureSchema() {
  if (ensured) return;
  ensured = true;
  await sql`
    CREATE TABLE IF NOT EXISTS players (
      "playerId" TEXT PRIMARY KEY,
      "fullName" TEXT NOT NULL,
      age INTEGER NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      team TEXT,
      status TEXT DEFAULT 'active'
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      "playerId" TEXT NOT NULL,
      "playerName" TEXT NOT NULL,
      date TEXT NOT NULL,
      "timeIn" BIGINT,
      "timeOut" BIGINT,
      status TEXT NOT NULL CHECK (status IN ('present','absent','partial')),
      UNIQUE("playerId", date)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS attendance_by_date ON attendance(date);`;
  await sql`CREATE INDEX IF NOT EXISTS attendance_by_player_date ON attendance("playerId", date);`;
}

export const db = {
  async getPlayers() {
    await ensureSchema();
    const { rows } = await sql`SELECT * FROM players ORDER BY "fullName" ASC`;
    return rows;
  },

  async getPlayer(playerId) {
    await ensureSchema();
    const { rows } = await sql`SELECT * FROM players WHERE "playerId" = ${playerId} LIMIT 1`;
    return rows[0] || null;
  },

  async createPlayer(playerData) {
    await ensureSchema();
    const { playerId, fullName, age, email, phone, position, team, status } = playerData;
    const { rows } = await sql`
      INSERT INTO players ("playerId", "fullName", age, email, phone, position, team, status)
      VALUES (${playerId}, ${fullName}, ${age}, ${email}, ${phone ?? null}, ${position ?? null}, ${team ?? null}, ${status ?? 'active'})
      RETURNING *
    `;
    return rows[0];
  },

  async updatePlayer(playerId, playerData) {
    await ensureSchema();
    const { fullName, age, email, phone, position, team, status } = playerData;
    const { rows } = await sql`
      UPDATE players
      SET "fullName" = ${fullName}, age = ${age}, email = ${email}, phone = ${phone ?? null}, position = ${position ?? null}, team = ${team ?? null}, status = ${status ?? 'active'}
      WHERE "playerId" = ${playerId}
      RETURNING *
    `;
    return rows[0];
  },

  async deletePlayer(playerId) {
    await ensureSchema();
    await sql`DELETE FROM attendance WHERE "playerId" = ${playerId}`;
    await sql`DELETE FROM players WHERE "playerId" = ${playerId}`;
    return true;
  },

  async getTodayAttendance() {
    await ensureSchema();
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await sql`
      SELECT * FROM attendance WHERE date = ${today} ORDER BY "playerName" ASC
    `;
    return rows;
  },

  async getAttendanceByDate(date) {
    await ensureSchema();
    const { rows } = await sql`
      SELECT * FROM attendance WHERE date = ${date} ORDER BY "playerName" ASC
    `;
    return rows;
  },

  async getAttendanceByDateRange(startDate, endDate) {
    await ensureSchema();
    const { rows } = await sql`
      SELECT * FROM attendance
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date ASC, "playerName" ASC
    `;
    return rows;
  },

  async getPlayerAttendanceToday(playerId) {
    await ensureSchema();
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await sql`
      SELECT * FROM attendance WHERE "playerId" = ${playerId} AND date = ${today} LIMIT 1
    `;
    return rows[0] || null;
  },

  async timeIn(playerId, playerName) {
    await ensureSchema();
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    const existing = await this.getPlayerAttendanceToday(playerId);
    if (existing) {
      if (existing.timeIn) throw new Error('Already timed in today');
      const { rows } = await sql`
        UPDATE attendance SET "timeIn" = ${now}, status = 'present' WHERE id = ${existing.id} RETURNING *
      `;
      return rows[0];
    } else {
      const { rows } = await sql`
        INSERT INTO attendance ("playerId", "playerName", date, "timeIn", status)
        VALUES (${playerId}, ${playerName}, ${today}, ${now}, 'present')
        ON CONFLICT ("playerId", date) DO UPDATE SET "timeIn" = EXCLUDED."timeIn", status = EXCLUDED.status
        RETURNING *
      `;
      return rows[0];
    }
  },

  async timeOut(playerId) {
    await ensureSchema();
    const record = await this.getPlayerAttendanceToday(playerId);
    if (!record) throw new Error('No attendance record found for today');
    if (!record.timeIn) throw new Error('Must time in first');
    if (record.timeOut) throw new Error('Already timed out today');

    const now = Date.now();
    const { rows } = await sql`
      UPDATE attendance SET "timeOut" = ${now} WHERE id = ${record.id} RETURNING *
    `;
    return rows[0];
  },

  async updateAttendance(playerId, date, updates) {
    await ensureSchema();
    const theDate = date || new Date().toISOString().slice(0, 10);

    const fields = [];
    const values = [];
    if (updates.status !== undefined) { fields.push('status'); values.push(updates.status); }
    if (updates.timeIn !== undefined) { fields.push('"timeIn"'); values.push(updates.timeIn); }
    if (updates.timeOut !== undefined) { fields.push('"timeOut"'); values.push(updates.timeOut); }

    if (fields.length === 0) throw new Error('Nothing to update');

    // Build dynamic SET clause
    const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const params = values.concat([playerId, theDate]);
    const text = `UPDATE attendance SET ${sets} WHERE "playerId" = $${fields.length + 1} AND date = $${fields.length + 2} RETURNING *`;
    const { rows } = await sql.query(text, params);
    return rows[0];
  },

  async deleteAttendance(playerId, date) {
    await ensureSchema();
    const theDate = date || new Date().toISOString().slice(0, 10);
    await sql`DELETE FROM attendance WHERE "playerId" = ${playerId} AND date = ${theDate}`;
    return true;
  }
};
