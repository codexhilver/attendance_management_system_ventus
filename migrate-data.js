import Database from "better-sqlite3";
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Supabase configuration
const supabaseUrl = 'https://pxyklohssmbrngkhomxw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase environment variable. Please set SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// SQLite database path
const sqlitePath = path.join(__dirname, 'server', 'attendance.db');

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite database not found at: ${sqlitePath}`);
  process.exit(1);
}

const sqliteDb = new Database(sqlitePath);

async function migrateData() {
  console.log('Starting data migration from SQLite to Supabase...');
  
  try {
    // Migrate players
    console.log('Migrating players...');
    const players = sqliteDb.prepare("SELECT * FROM players").all();
    console.log(`Found ${players.length} players to migrate`);
    
    for (const player of players) {
      try {
        // Map camelCase to lowercase column names
        const mappedPlayer = {
          playerid: player.playerId,
          fullname: player.fullName,
          age: player.age,
          email: player.email,
          phone: player.phone,
          position: player.position,
          team: player.team,
          status: player.status
        };
        
        const { error } = await supabase
          .from('players')
          .insert([mappedPlayer]);
        
        if (error) {
          console.error(`Error inserting player ${player.playerId}:`, error);
        } else {
          console.log(`✓ Migrated player: ${player.playerId}`);
        }
      } catch (err) {
        console.error(`Error migrating player ${player.playerId}:`, err);
      }
    }
    
    // Migrate attendance
    console.log('Migrating attendance records...');
    const attendance = sqliteDb.prepare("SELECT * FROM attendance").all();
    console.log(`Found ${attendance.length} attendance records to migrate`);
    
    for (const record of attendance) {
      try {
        // Map camelCase to lowercase column names
        const mappedRecord = {
          id: record.id,
          playerid: record.playerId,
          playername: record.playerName,
          date: record.date,
          timein: record.timeIn,
          timeout: record.timeOut,
          status: record.status
        };
        
        const { error } = await supabase
          .from('attendance')
          .insert([mappedRecord]);
        
        if (error) {
          console.error(`Error inserting attendance record ${record.id}:`, error);
        } else {
          console.log(`✓ Migrated attendance record: ${record.id}`);
        }
      } catch (err) {
        console.error(`Error migrating attendance record ${record.id}:`, err);
      }
    }
    
    console.log('Data migration completed!');
    
    // Verify migration
    console.log('Verifying migration...');
    const { data: playersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    const { data: attendanceCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Supabase now has ${playersCount} players and ${attendanceCount} attendance records`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    sqliteDb.close();
  }
}

migrateData();
