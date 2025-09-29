import { createClient } from '@supabase/supabase-js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Supabase configuration
const supabaseUrl = 'https://pxyklohssmbrngkhomxw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  throw new Error('Missing Supabase environment variable. Please set SUPABASE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions for database operations
export const db = {
  // Players operations
  async getPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('fullname', { ascending: true });
    
    if (error) throw error;
    // Map lowercase column names back to camelCase for the frontend
    return data.map(player => ({
      playerId: player.playerid,
      fullName: player.fullname,
      age: player.age,
      email: player.email,
      phone: player.phone,
      position: player.position,
      team: player.team,
      status: player.status
    }));
  },

  async getPlayer(playerId) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('playerid', playerId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    if (!data) return null;
    
    // Map lowercase column names back to camelCase for the frontend
    return {
      playerId: data.playerid,
      fullName: data.fullname,
      age: data.age,
      email: data.email,
      phone: data.phone,
      position: data.position,
      team: data.team,
      status: data.status
    };
  },

  async createPlayer(playerData) {
    // Map camelCase to lowercase column names
    const mappedData = {
      playerid: playerData.playerId,
      fullname: playerData.fullName,
      age: playerData.age,
      email: playerData.email,
      phone: playerData.phone,
      position: playerData.position,
      team: playerData.team,
      status: playerData.status
    };
    
    const { data, error } = await supabase
      .from('players')
      .insert([mappedData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updatePlayer(playerId, playerData) {
    // Map camelCase to lowercase column names
    const mappedData = {
      fullname: playerData.fullName,
      age: playerData.age,
      email: playerData.email,
      phone: playerData.phone,
      position: playerData.position,
      team: playerData.team,
      status: playerData.status
    };
    
    const { data, error } = await supabase
      .from('players')
      .update(mappedData)
      .eq('playerid', playerId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletePlayer(playerId) {
    // First delete attendance records
    await supabase
      .from('attendance')
      .delete()
      .eq('playerid', playerId);
    
    // Then delete the player
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('playerid', playerId);
    
    if (error) throw error;
    return true;
  },

  // Attendance operations
  async getTodayAttendance() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today)
      .order('playername', { ascending: true });
    
    if (error) throw error;
    // Map lowercase column names back to camelCase for the frontend
    return data.map(record => ({
      id: record.id,
      playerId: record.playerid,
      playerName: record.playername,
      date: record.date,
      timeIn: record.timein,
      timeOut: record.timeout,
      status: record.status
    }));
  },

  async getAttendanceByDate(date) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', date)
      .order('playername', { ascending: true });
    
    if (error) throw error;
    // Map lowercase column names back to camelCase for the frontend
    return data.map(record => ({
      id: record.id,
      playerId: record.playerid,
      playerName: record.playername,
      date: record.date,
      timeIn: record.timein,
      timeOut: record.timeout,
      status: record.status
    }));
  },

  async getAttendanceByDateRange(startDate, endDate) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('playername', { ascending: true });
    
    if (error) throw error;
    // Map lowercase column names back to camelCase for the frontend
    return data.map(record => ({
      id: record.id,
      playerId: record.playerid,
      playerName: record.playername,
      date: record.date,
      timeIn: record.timein,
      timeOut: record.timeout,
      status: record.status
    }));
  },

  async getPlayerAttendanceToday(playerId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('playerid', playerId)
      .eq('date', today)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    if (!data) return null;
    
    // Map lowercase column names back to camelCase for the frontend
    return {
      id: data.id,
      playerId: data.playerid,
      playerName: data.playername,
      date: data.date,
      timeIn: data.timein,
      timeOut: data.timeout,
      status: data.status
    };
  },

  async timeIn(playerId, playerName) {
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    
    // Check if record exists
    const existing = await this.getPlayerAttendanceToday(playerId);
    
    if (existing) {
      if (existing.timeIn) {
        throw new Error('Already timed in today');
      }
      
      // Update existing record
      const { data, error } = await supabase
        .from('attendance')
        .update({ timein: now, status: 'present' })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          playerid: playerId,
          playername: playerName,
          date: today,
          timein: now,
          status: 'present'
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  async timeOut(playerId) {
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    
    const record = await this.getPlayerAttendanceToday(playerId);
    
    if (!record) {
      throw new Error('No attendance record found for today');
    }
    
    if (!record.timeIn) {
      throw new Error('Must time in first');
    }
    
    if (record.timeOut) {
      throw new Error('Already timed out today');
    }
    
    const { data, error } = await supabase
      .from('attendance')
      .update({ timeout: now })
      .eq('id', record.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateAttendance(playerId, date, updates) {
    const theDate = date || new Date().toISOString().slice(0, 10);
    
    // Map camelCase to lowercase column names
    const mappedUpdates = {};
    if (updates.status !== undefined) mappedUpdates.status = updates.status;
    if (updates.timeIn !== undefined) mappedUpdates.timein = updates.timeIn;
    if (updates.timeOut !== undefined) mappedUpdates.timeout = updates.timeOut;
    
    const { data, error } = await supabase
      .from('attendance')
      .update(mappedUpdates)
      .eq('playerid', playerId)
      .eq('date', theDate)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteAttendance(playerId, date) {
    const theDate = date || new Date().toISOString().slice(0, 10);
    
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('playerid', playerId)
      .eq('date', theDate);
    
    if (error) throw error;
    return true;
  }
};
