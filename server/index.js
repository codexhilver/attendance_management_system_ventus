import 'dotenv/config';
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./sqlite.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const db = getDb(path.join(__dirname, "attendance.db"));

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatLocal(ms) {
  if (ms === null || ms === undefined) return null;
  try {
    return new Date(Number(ms)).toLocaleString();
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
app.get("/api/players", (req, res) => {
  const rows = db.prepare("SELECT playerId, fullName, age, email, phone, position, team FROM players ORDER BY fullName ASC").all();
  res.json(rows);
});

app.get("/api/players/:playerId", (req, res) => {
  const row = db.prepare("SELECT playerId, fullName, age, email, phone, position, team FROM players WHERE playerId = ?").get(req.params.playerId);
  if (!row) return res.status(404).json(null);
  res.json(row);
});

app.post("/api/players", (req, res) => {
  const { playerId, fullName, age, email, phone, position, team } = req.body ?? {};
  if (!playerId || !fullName || typeof age !== "number" || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    db.prepare(
      "INSERT INTO players (playerId, fullName, age, email, phone, position, team) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(playerId, fullName, age, email, phone ?? null, position ?? null, team ?? null);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Player ID already exists" });
    }
    res.status(500).json({ error: "Failed to create player" });
  }
});

app.put("/api/players/:playerId", (req, res) => {
  const { playerId } = req.params;
  const { fullName, age, email, phone, position, team } = req.body ?? {};
  if (!fullName || typeof age !== "number" || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const info = db
    .prepare(
      "UPDATE players SET fullName = ?, age = ?, email = ?, phone = ?, position = ?, team = ? WHERE playerId = ?"
    )
    .run(fullName, age, email, phone ?? null, position ?? null, team ?? null, playerId);
  if (info.changes === 0) return res.status(404).json({ error: "Player not found" });
  res.json({ ok: true });
});

app.delete("/api/players/:playerId", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { playerId } = req.params;
  const info = db.prepare("DELETE FROM players WHERE playerId = ?").run(playerId);
  // Also delete today's attendance for cleanliness (optional)
  db.prepare("DELETE FROM attendance WHERE playerId = ?").run(playerId);
  if (info.changes === 0) return res.status(404).json({ error: "Player not found" });
  res.json({ ok: true });
});

// Attendance
app.get("/api/attendance/today", (req, res) => {
  const today = getToday();
  const rows = db.prepare(
    "SELECT id, playerId, playerName, date, timeIn, timeOut, status FROM attendance WHERE date = ? ORDER BY playerName ASC"
  ).all(today);
  res.json(rows.map((r) => ({
    ...r,
    timeInFormatted: formatLocal(r.timeIn),
    timeOutFormatted: formatLocal(r.timeOut),
  })));
});

// (Removed totals API per request)

app.get("/api/attendance/by-date", (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
  const rows = db.prepare(
    "SELECT id, playerId, playerName, date, timeIn, timeOut, status FROM attendance WHERE date = ? ORDER BY playerName ASC"
  ).all(String(date));
  res.json(rows.map((r) => ({
    ...r,
    timeInFormatted: formatLocal(r.timeIn),
    timeOutFormatted: formatLocal(r.timeOut),
  })));
});

// Attendance in an inclusive date range [start, end] (YYYY-MM-DD)
app.get("/api/attendance/range", (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "start and end query params required (YYYY-MM-DD)" });
  const rows = db.prepare(
    "SELECT id, playerId, playerName, date, timeIn, timeOut, status FROM attendance WHERE date >= ? AND date <= ? ORDER BY date ASC, playerName ASC"
  ).all(String(start), String(end));
  res.json(rows);
});

// (Removed totals API per request)

app.get("/api/attendance/player/today", (req, res) => {
  const { playerId } = req.query;
  if (!playerId) return res.status(400).json({ error: "playerId is required" });
  const today = getToday();
  const row = db.prepare(
    "SELECT id, playerId, playerName, date, timeIn, timeOut, status FROM attendance WHERE playerId = ? AND date = ?"
  ).get(String(playerId), today);
  if (!row) return res.json(null);
  res.json({
    ...row,
    timeInFormatted: formatLocal(row.timeIn),
    timeOutFormatted: formatLocal(row.timeOut),
  });
});

app.post("/api/attendance/time-in", (req, res) => {
  const { playerId, playerName } = req.body ?? {};
  if (!playerId || !playerName) return res.status(400).json({ error: "playerId and playerName are required" });
  const today = getToday();
  const now = Date.now();
  const existing = db.prepare("SELECT id, timeIn FROM attendance WHERE playerId = ? AND date = ?").get(playerId, today);
  try {
    if (existing) {
      if (existing.timeIn) return res.status(400).json({ error: "Already timed in today" });
      db.prepare("UPDATE attendance SET timeIn = ?, status = 'present' WHERE id = ?").run(now, existing.id);
      return res.json({ ok: true, id: existing.id });
    } else {
      const info = db.prepare(
        "INSERT INTO attendance (playerId, playerName, date, timeIn, status) VALUES (?, ?, ?, ?, 'present')"
      ).run(playerId, playerName, today, now);
      return res.status(201).json({ ok: true, id: info.lastInsertRowid });
    }
  } catch (e) {
    const msg = String(e?.message || e || "");
    return res.status(500).json({ error: msg.includes('timeOut must be >= timeIn') ? 'Invalid time sequence' : 'Failed to time in' });
  }
});

app.post("/api/attendance/time-out", (req, res) => {
  const { playerId } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: "playerId is required" });
  const today = getToday();
  const now = Date.now();
  const record = db.prepare("SELECT id, timeIn, timeOut FROM attendance WHERE playerId = ? AND date = ?").get(playerId, today);
  if (!record) return res.status(404).json({ error: "No attendance record found for today" });
  if (!record.timeIn) return res.status(400).json({ error: "Must time in first" });
  if (record.timeOut) return res.status(400).json({ error: "Already timed out today" });
  try {
    db.prepare("UPDATE attendance SET timeOut = ? WHERE id = ?").run(now, record.id);
    return res.json({ ok: true, id: record.id });
  } catch (e) {
    const msg = String(e?.message || e || "");
    return res.status(500).json({ error: msg.includes('timeOut must be >= timeIn') ? 'Invalid time sequence' : 'Failed to time out' });
  }
});

// Update attendance fields (status/timeIn/timeOut) for today or a specific date
app.patch("/api/attendance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { playerId, date, status, timeIn, timeOut } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: "playerId required" });
  const theDate = date ?? getToday();
  const existing = db
    .prepare("SELECT id FROM attendance WHERE playerId = ? AND date = ?")
    .get(playerId, theDate);
  if (!existing) return res.status(404).json({ error: "Attendance not found" });
  const sets = [];
  const vals = [];
  if (status !== undefined) {
    sets.push("status = ?");
    vals.push(String(status));
  }
  if (timeIn !== undefined) {
    sets.push("timeIn = ?");
    vals.push(timeIn);
  }
  if (timeOut !== undefined) {
    sets.push("timeOut = ?");
    vals.push(timeOut);
  }
  if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
  vals.push(existing.id);
  db.prepare(`UPDATE attendance SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Delete attendance (today or by date)
app.delete("/api/attendance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { playerId, date } = req.query;
  if (!playerId) return res.status(400).json({ error: "playerId required" });
  const theDate = date ?? getToday();
  const info = db
    .prepare("DELETE FROM attendance WHERE playerId = ? AND date = ?")
    .run(String(playerId), String(theDate));
  if (info.changes === 0) return res.status(404).json({ error: "Attendance not found" });
  res.json({ ok: true });
});

// CSV export for today's attendance
app.get("/api/attendance/export/today", (req, res) => {
  const today = getToday();
  const rows = db.prepare(
    "SELECT playerId, playerName, date, timeIn, timeOut, status FROM attendance WHERE date = ? ORDER BY playerName ASC"
  ).all(today);
  const header = ["Player ID", "Name", "Date", "Time In", "Time Out", "Total Hours", "Status"];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  };
  const formatTime = (ms) => (ms ? new Date(ms).toLocaleTimeString() : "");
  const toHMS = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  const now = Date.now();
  const rowLines = rows.map((r) => {
    const worked = r.timeIn ? toHMS(Math.max(0, (r.timeOut ?? now) - r.timeIn)) : "";
    return [r.playerId, r.playerName, r.date, formatTime(r.timeIn), formatTime(r.timeOut), worked, r.status]
      .map(escape)
      .join(",");
  });
  const csv = [header.join(","), ...rowLines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=attendance_${today}.csv`);
  res.send(csv);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;
app.listen(PORT, () => {
  console.log(`Local API listening on http://localhost:${PORT}`);
});


