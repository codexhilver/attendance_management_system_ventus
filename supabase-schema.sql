-- Supabase Database Schema for Attendance Management System
-- This file contains the SQL to create the tables in Supabase

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  playerId TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  age INTEGER NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  team TEXT,
  status TEXT DEFAULT 'active'
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  playerId TEXT NOT NULL,
  playerName TEXT NOT NULL,
  date TEXT NOT NULL,
  timeIn BIGINT,
  timeOut BIGINT,
  status TEXT NOT NULL CHECK (status IN ('present','absent','partial')),
  UNIQUE(playerId, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS attendance_by_date ON attendance(date);
CREATE INDEX IF NOT EXISTS attendance_by_player_date ON attendance(playerId, date);

-- Enable Row Level Security (RLS) - optional but recommended
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations on attendance" ON attendance FOR ALL USING (true);
