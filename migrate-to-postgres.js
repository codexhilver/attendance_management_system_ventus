import dotenv from 'dotenv';
dotenv.config();
import Database from 'better-sqlite3';
import { sql } from '@vercel/postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlitePath = path.join(__dirname, 'server', 'attendance.db');

async function migrate() {
  console.log('Starting migration from SQLite to Postgres...\n');
  
  try {
    // Open SQLite database
    const db = new Database(sqlitePath, { readonly: true });
    
    // Ensure Postgres schema exists
    console.log('Creating Postgres schema...');
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
    console.log('✓ Schema created\n');
    
    // Migrate players
    console.log('Migrating players...');
    const players = db.prepare('SELECT * FROM players').all();
    console.log(`Found ${players.length} players`);
    
    let playersInserted = 0;
    for (const player of players) {
      try {
        await sql`
          INSERT INTO players ("playerId", "fullName", age, email, phone, position, team, status)
          VALUES (
            ${player.playerId},
            ${player.fullName},
            ${player.age},
            ${player.email},
            ${player.phone || null},
            ${player.position || null},
            ${player.team || null},
            ${player.status || 'active'}
          )
          ON CONFLICT ("playerId") DO UPDATE SET
            "fullName" = EXCLUDED."fullName",
            age = EXCLUDED.age,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            position = EXCLUDED.position,
            team = EXCLUDED.team,
            status = EXCLUDED.status
        `;
        playersInserted++;
        console.log(`  ✓ ${player.playerId} - ${player.fullName}`);
      } catch (error) {
        console.error(`  ✗ Error migrating player ${player.playerId}:`, error.message);
      }
    }
    console.log(`✓ Migrated ${playersInserted}/${players.length} players\n`);
    
    // Migrate attendance
    console.log('Migrating attendance records...');
    const attendance = db.prepare('SELECT * FROM attendance').all();
    console.log(`Found ${attendance.length} attendance records`);
    
    let attendanceInserted = 0;
    for (const record of attendance) {
      try {
        await sql`
          INSERT INTO attendance ("playerId", "playerName", date, "timeIn", "timeOut", status)
          VALUES (
            ${record.playerId},
            ${record.playerName},
            ${record.date},
            ${record.timeIn || null},
            ${record.timeOut || null},
            ${record.status}
          )
          ON CONFLICT ("playerId", date) DO UPDATE SET
            "playerName" = EXCLUDED."playerName",
            "timeIn" = EXCLUDED."timeIn",
            "timeOut" = EXCLUDED."timeOut",
            status = EXCLUDED.status
        `;
        attendanceInserted++;
        console.log(`  ✓ ${record.playerId} - ${record.date}`);
      } catch (error) {
        console.error(`  ✗ Error migrating attendance ${record.id}:`, error.message);
      }
    }
    console.log(`✓ Migrated ${attendanceInserted}/${attendance.length} attendance records\n`);
    
    // Verify migration
    console.log('Verifying migration...');
    const { rows: playerRows } = await sql`SELECT COUNT(*) as count FROM players`;
    const { rows: attendanceRows } = await sql`SELECT COUNT(*) as count FROM attendance`;
    
    console.log(`\n✓ Migration complete!`);
    console.log(`  Players in Postgres: ${playerRows[0].count}`);
    console.log(`  Attendance records in Postgres: ${attendanceRows[0].count}`);
    
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
