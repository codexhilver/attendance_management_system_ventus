import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import cors from "cors";
import { db } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

function getToday() {
  // Get today's date in UTC+8
  const utc8Date = new Date(Date.now() + (8 * 60 * 60 * 1000));
  return utc8Date.toISOString().slice(0, 10);
}

function formatLocal(ms) {
  if (ms === null || ms === undefined) return null;
  try {
    // Format in UTC+8 with 24-hour format
    const utc8Date = new Date(Number(ms) + (8 * 60 * 60 * 1000));
    const year = utc8Date.getUTCFullYear();
    const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Date.getUTCDate()).padStart(2, '0');
    const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
    const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return null;
  }
}

const ADMIN_PIN = process.env.ADMIN_PIN || ""; // When empty, destructive routes are open (dev mode)
function requireAdmin(req, res) {
  if (!ADMIN_PIN) return true; // no pin set, allow
  const pin = req.header('x-admin-pin');
  if (pin && pin === ADMIN_PIN) return true;
  res.status(403).json({ error: 'Admin PIN required' });
  return false;
}

// Players
app.get("/api/players", async (req, res) => {
  try {
    const rows = await db.getPlayers();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

app.get("/api/players/:playerId", async (req, res) => {
  try {
    const row = await db.getPlayer(req.params.playerId);
    if (!row) return res.status(404).json(null);
    res.json(row);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: "Failed to fetch player" });
  }
});

app.post("/api/players", async (req, res) => {
  const { playerId, fullName, age, email, phone, position, team } = req.body ?? {};
  if (!playerId || !fullName || typeof age !== "number" || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    await db.createPlayer({ playerId, fullName, age, email, phone, position, team });
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes("duplicate key") || String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Player ID already exists" });
    }
    console.error('Error creating player:', e);
    res.status(500).json({ error: "Failed to create player" });
  }
});

app.put("/api/players/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const { fullName, age, email, phone, position, team, status } = req.body ?? {};
  if (!fullName || typeof age !== "number" || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    await db.updatePlayer(playerId, { fullName, age, email, phone, position, team, status });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes("No rows")) {
      return res.status(404).json({ error: "Player not found" });
    }
    console.error('Error updating player:', e);
    res.status(500).json({ error: "Failed to update player" });
  }
});

app.delete("/api/players/:playerId", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { playerId } = req.params;
  try {
    await db.deletePlayer(playerId);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting player:', e);
    res.status(500).json({ error: "Failed to delete player" });
  }
});

// Attendance
app.get("/api/attendance/today", async (req, res) => {
  try {
    const rows = await db.getTodayAttendance();
    res.json(rows.map((r) => ({
      ...r,
      timeInFormatted: formatLocal(r.timeIn),
      timeOutFormatted: formatLocal(r.timeOut),
    })));
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ error: "Failed to fetch today's attendance" });
  }
});

app.get("/api/attendance/by-date", async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
  try {
    const rows = await db.getAttendanceByDate(String(date));
    res.json(rows.map((r) => ({
      ...r,
      timeInFormatted: formatLocal(r.timeIn),
      timeOutFormatted: formatLocal(r.timeOut),
    })));
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Attendance in an inclusive date range [start, end] (YYYY-MM-DD)
app.get("/api/attendance/range", async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "start and end query params required (YYYY-MM-DD)" });
  try {
    const rows = await db.getAttendanceByDateRange(String(start), String(end));
    res.json(rows);
  } catch (error) {
    console.error('Error fetching attendance range:', error);
    res.status(500).json({ error: "Failed to fetch attendance range" });
  }
});

app.get("/api/attendance/player/today", async (req, res) => {
  const { playerId } = req.query;
  if (!playerId) return res.status(400).json({ error: "playerId is required" });
  try {
    const row = await db.getPlayerAttendanceToday(String(playerId));
    if (!row) return res.json(null);
    res.json({
      ...row,
      timeInFormatted: formatLocal(row.timeIn),
      timeOutFormatted: formatLocal(row.timeOut),
    });
  } catch (error) {
    console.error('Error fetching player attendance:', error);
    res.status(500).json({ error: "Failed to fetch player attendance" });
  }
});

app.post("/api/attendance/time-in", async (req, res) => {
  const { playerId, playerName } = req.body ?? {};
  if (!playerId || !playerName) return res.status(400).json({ error: "playerId and playerName are required" });
  try {
    const result = await db.timeIn(playerId, playerName);
    res.status(201).json({ ok: true, id: result.id });
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (msg.includes('Already timed in')) {
      return res.status(400).json({ error: msg });
    }
    console.error('Error timing in:', e);
    res.status(500).json({ error: 'Failed to time in' });
  }
});

app.post("/api/attendance/time-out", async (req, res) => {
  const { playerId } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: "playerId is required" });
  try {
    const result = await db.timeOut(playerId);
    res.json({ ok: true, id: result.id });
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (msg.includes('No attendance record') || msg.includes('Must time in') || msg.includes('Already timed out')) {
      return res.status(400).json({ error: msg });
    }
    console.error('Error timing out:', e);
    res.status(500).json({ error: 'Failed to time out' });
  }
});

// Update attendance fields (status/timeIn/timeOut) for today or a specific date
app.patch("/api/attendance", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { playerId, date, status, timeIn, timeOut } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: "playerId required" });
  
  const updates = {};
  if (status !== undefined) updates.status = String(status);
  if (timeIn !== undefined) updates.timeIn = timeIn;
  if (timeOut !== undefined) updates.timeOut = timeOut;
  
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });
  
  try {
    await db.updateAttendance(playerId, date, updates);
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('No rows')) {
      return res.status(404).json({ error: "Attendance not found" });
    }
    console.error('Error updating attendance:', e);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});

// Delete attendance (today or by date)
app.delete("/api/attendance", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { playerId, date } = req.query;
  if (!playerId) return res.status(400).json({ error: "playerId required" });
  try {
    await db.deleteAttendance(String(playerId), date);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting attendance:', e);
    res.status(500).json({ error: "Failed to delete attendance" });
  }
});

// CSV export for today's attendance
app.get("/api/attendance/export/today", async (req, res) => {
  try {
    const rows = await db.getTodayAttendance();
    
    const header = ["Player ID", "Name", "Date", "Time In", "Time Out", "Total Hours", "Status"];
    const escape = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return '"' + s.replaceAll('"', '""') + '"';
      }
      return s;
    };
    // Format time in UTC+8 with 12-hour format for CSV
    const formatTime = (ms) => {
      if (!ms) return "";
      // Convert to UTC+8 (add 8 hours in milliseconds)
      const utc8Date = new Date(ms + (8 * 60 * 60 * 1000));
      const hours24 = utc8Date.getUTCHours();
      const minutes = utc8Date.getUTCMinutes();
      const seconds = utc8Date.getUTCSeconds();
      
      // Convert to 12-hour format
      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      const pad = (n) => String(n).padStart(2, '0');
      return `${hours12}:${pad(minutes)}:${pad(seconds)} ${period}`;
    };
    const toDecimalHours = (ms) => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const hours = totalSeconds / 3600;
      return hours.toFixed(2); // Return as decimal number string
    };
    const now = Date.now();
    const rowLines = rows.map((r) => {
      const worked = r.timeIn ? toDecimalHours(Math.max(0, (r.timeOut ?? now) - r.timeIn)) : "";
      return [r.playerId, r.playerName, r.date, formatTime(r.timeIn), formatTime(r.timeOut), worked, r.status]
        .map(escape)
        .join(",");
    });
    const csv = [header.join(","), ...rowLines].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=attendance_${getToday()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// When running on Vercel serverless, we export the Express app as the handler.
// When running locally (e.g., `npm run dev`), we start a listener.
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
if (!process.env.VERCEL) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Local API listening on http://127.0.0.1:${PORT}`);
  });
}

export default app;


