import { createClient } from '@supabase/supabase-js';

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
      .order('fullName', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getPlayer(playerId) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('playerId', playerId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    if (!data) return null;
    
    return data;
  },

  async createPlayer(playerData) {
    const { data, error } = await supabase
      .from('players')
      .insert([playerData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updatePlayer(playerId, playerData) {
    const { data, error } = await supabase
      .from('players')
      .update(playerData)
      .eq('playerId', playerId)
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
      .eq('playerId', playerId);
    
    // Then delete the player
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('playerId', playerId);
    
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
      .order('playerName', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getAttendanceByDate(date) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', date)
      .order('playerName', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getAttendanceByDateRange(startDate, endDate) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('playerName', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async getPlayerAttendanceToday(playerId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('playerId', playerId)
      .eq('date', today)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    if (!data) return null;
    
    return data;
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
        .update({ timeIn: now, status: 'present' })
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
          playerId: playerId,
          playerName: playerName,
          date: today,
          timeIn: now,
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
      .update({ timeOut: now })
      .eq('id', record.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateAttendance(playerId, date, updates) {
    const theDate = date || new Date().toISOString().slice(0, 10);
    
    const mappedUpdates = {};
    if (updates.status !== undefined) mappedUpdates.status = updates.status;
    if (updates.timeIn !== undefined) mappedUpdates.timeIn = updates.timeIn;
    if (updates.timeOut !== undefined) mappedUpdates.timeOut = updates.timeOut;
    
    const { data, error } = await supabase
      .from('attendance')
      .update(mappedUpdates)
      .eq('playerId', playerId)
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
      .eq('playerId', playerId)
      .eq('date', theDate);
    
    if (error) throw error;
    return true;
  }
};
