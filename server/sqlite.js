import Database from "better-sqlite3";
import fs from "fs";

export function getDb(filePath) {
  const firstTime = !fs.existsSync(filePath);
  const db = new Database(filePath);
  if (firstTime) {
    db.pragma("journal_mode = WAL");
  }
  db.exec(
    `CREATE TABLE IF NOT EXISTS players (
      playerId TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      age INTEGER NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      team TEXT
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId TEXT NOT NULL,
      playerName TEXT NOT NULL,
      date TEXT NOT NULL,
      timeIn INTEGER,
      timeOut INTEGER,
      status TEXT NOT NULL CHECK (status IN ('present','absent','partial')),
      UNIQUE(playerId, date)
    );
    -- Helpful indexes for common lookups
    CREATE INDEX IF NOT EXISTS attendance_by_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS attendance_by_player_date ON attendance(playerId, date);

    -- Enforce that timeOut, if present, is not before timeIn
    CREATE TRIGGER IF NOT EXISTS attendance_time_order_insert
    BEFORE INSERT ON attendance
    FOR EACH ROW WHEN NEW.timeOut IS NOT NULL AND (NEW.timeIn IS NULL OR NEW.timeOut < NEW.timeIn)
    BEGIN
      SELECT RAISE(ABORT, 'timeOut must be >= timeIn');
    END;

    CREATE TRIGGER IF NOT EXISTS attendance_time_order_update
    BEFORE UPDATE OF timeOut, timeIn ON attendance
    FOR EACH ROW WHEN NEW.timeOut IS NOT NULL AND (NEW.timeIn IS NULL OR NEW.timeOut < NEW.timeIn)
    BEGIN
      SELECT RAISE(ABORT, 'timeOut must be >= timeIn');
    END;
    `
  );
  return db;
}


