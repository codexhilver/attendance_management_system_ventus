import { PlayerManagement } from "./PlayerManagement";
import { AttendanceHistory } from "./AttendanceHistory";
import { AdminAuth } from "./AdminAuth";
import { Toaster, toast } from "sonner";
import { useState, useEffect } from "react";

export default function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    // Check if admin was previously authenticated
    const saved = localStorage.getItem("adminAuthenticated");
    if (saved === "true") {
      setIsAdminAuthenticated(true);
    }
  }, []);

  const handleAdminAuth = (authenticated: boolean) => {
    setIsAdminAuthenticated(authenticated);
    localStorage.setItem("adminAuthenticated", authenticated.toString());
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-auto md:h-16 flex flex-col md:flex-row justify-between items-center border-b shadow-sm px-4 py-3 md:py-0 gap-3 md:gap-0">
        <h2 className="text-lg md:text-xl font-semibold text-blue-600">Attendance</h2>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
          {isAdminAuthenticated && (
            <a
              href={`${import.meta.env.VITE_API_URL || ''}/api/attendance/export/today`}
              className="px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 transition-colors shadow-sm hover:shadow"
            >
              Export Today CSV
            </a>
          )}
          <AdminAuth 
            isAuthenticated={isAdminAuthenticated} 
            onAuthenticate={handleAdminAuth} 
          />
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8">
        <AttendanceSystem isAdminAuthenticated={isAdminAuthenticated} />
      </main>
      <Toaster />
    </div>
  );
}

function AttendanceSystem({ isAdminAuthenticated }: { isAdminAuthenticated: boolean }) {
  const [activeTab, setActiveTab] = useState("attendance");
  const [playerId, setPlayerId] = useState("");
  const [debouncedPlayerId, setDebouncedPlayerId] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [player, setPlayer] = useState<any | null>(null);
  const [attendance, setAttendance] = useState<any | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [clearCountdown, setClearCountdown] = useState<number | null>(null);
  

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);


  const refreshToday = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const r = await fetch(`${API_BASE}/api/attendance/today`);
    const data = await r.json();
    setTodayAttendance(data);
  };

  useEffect(() => {
    // today's attendance table
    refreshToday();
  }, [currentTime]);

  // Debounce playerId input to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlayerId(playerId);
    }, 300); // Wait 300ms after user stops typing
    
    return () => clearTimeout(timer);
  }, [playerId]);

  useEffect(() => {
    if (!debouncedPlayerId) {
      setPlayer(null);
      setAttendance(null);
      return;
    }
    // Reset to loading state when playerId changes
    setPlayer(undefined);
    setAttendance(null);
    
    // Use AbortController to cancel stale requests
    const abortController = new AbortController();
    const API_BASE = import.meta.env.VITE_API_URL || '';
    
    fetch(`${API_BASE}/api/players/${encodeURIComponent(debouncedPlayerId)}`, {
      signal: abortController.signal
    })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((p) => setPlayer(p))
      .catch((err) => {
        // Ignore abort errors
        if (err.name !== 'AbortError') {
          console.error('Error fetching player:', err);
          setPlayer(null);
        }
      });
      
    fetch(`${API_BASE}/api/attendance/player/today?playerId=${encodeURIComponent(debouncedPlayerId)}`, {
      signal: abortController.signal
    })
      .then(async (r) => r.json())
      .then((a) => setAttendance(a))
      .catch((err) => {
        // Ignore abort errors
        if (err.name !== 'AbortError') {
          console.error('Error fetching attendance:', err);
        }
      });
    
    // Cleanup: abort pending requests when playerId changes
    return () => abortController.abort();
  }, [debouncedPlayerId]);

  const reloadAttendance = async (id: string) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const r = await fetch(
      `${API_BASE}/api/attendance/player/today?playerId=${encodeURIComponent(id)}`
    );
    const a = await r.json();
    setAttendance(a);
  };

  const handleTimeIn = async () => {
    if (!player) return;
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/attendance/time-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.playerId, playerName: player.fullName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to time in");
      }
      toast.success("Timed in successfully!");
      // Optimistically update local state so Time Out enables immediately
      const now = Date.now();
      setAttendance((prev: any) =>
        prev
          ? { ...prev, timeIn: prev.timeIn ?? now, status: prev.status ?? "present" }
          : {
              id: undefined,
              playerId: player.playerId,
              playerName: player.fullName,
              date: new Date().toISOString().slice(0, 10),
              timeIn: now,
              timeOut: undefined,
              status: "present",
            }
      );
      setCurrentTime(new Date());
      // Ensure we have server-confirmed state
      await reloadAttendance(player.playerId);
      
      // Start countdown and clear player ID after 3 seconds to prevent accidental early time out
      setClearCountdown(3);
      const countdownInterval = setInterval(() => {
        setClearCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      setTimeout(() => {
        setPlayerId("");
        setPlayer(null);
        setAttendance(null);
        setClearCountdown(null);
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to time in");
    }
  };

  const handleTimeOut = async () => {
    if (!player) return;
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/attendance/time-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.playerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to time out");
      }
      toast.success("Timed out successfully!");
      // Optimistically set timeOut
      const now = Date.now();
      setAttendance((prev: any) => (prev ? { ...prev, timeOut: now } : prev));
      setCurrentTime(new Date());
      await reloadAttendance(player.playerId);
      
      // Start countdown and clear player ID after 3 seconds
      setClearCountdown(3);
      const countdownInterval = setInterval(() => {
        setClearCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      setTimeout(() => {
        setPlayerId("");
        setPlayer(null);
        setAttendance(null);
        setClearCountdown(null);
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to time out");
    }
  };

  const formatTime = (timestamp: number) => {
    // Display in UTC+8 with 24-hour format (military time)
    const utc8Date = new Date(timestamp + (8 * 60 * 60 * 1000));
    const hours = utc8Date.getUTCHours();
    const minutes = utc8Date.getUTCMinutes();
    const seconds = utc8Date.getUTCSeconds();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrentTime = (date: Date) => {
    // Display current time in UTC+8 with 24-hour format (military time)
    const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    const hours = utc8Date.getUTCHours();
    const minutes = utc8Date.getUTCMinutes();
    const seconds = utc8Date.getUTCSeconds();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <div className="space-y-8">
      {/* Header with Real-time Clock */}
      <div className="text-center bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h1 className="text-xl md:text-3xl font-bold text-blue-600 mb-2">Boundless Players Attendance</h1>
        <div className="text-sm md:text-lg text-gray-600">
          <div className="font-semibold text-lg md:text-4xl">{formatDate(currentTime)}</div>
          <div className="text-4xl md:text-8xl font-mono text-blue-600 mt-2">
            {formatCurrentTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-4 md:space-x-8 px-4 md:px-6 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab("attendance")}
              className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap ${
                activeTab === "attendance"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Attendance Tracking
            </button>
            <button
              onClick={() => setActiveTab("players")}
              className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap ${
                activeTab === "players"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Player Management
            </button>
            {isAdminAuthenticated && (
              <button
                onClick={() => setActiveTab("history")}
                className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap ${
                  activeTab === "history"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Attendance History
              </button>
            )}
          </nav>
        </div>

        <div className="p-4 md:p-6">
          {activeTab === "attendance" ? (
            <AttendanceTab
              playerId={playerId}
              setPlayerId={setPlayerId}
              player={player}
              attendance={attendance}
              todayAttendance={todayAttendance}
              handleTimeIn={handleTimeIn}
              handleTimeOut={handleTimeOut}
              formatTime={formatTime}
              isAdminAuthenticated={isAdminAuthenticated}
              onRefreshToday={refreshToday}
              clearCountdown={clearCountdown}
            />
          ) : activeTab === "players" ? (
            <PlayerManagement isAdminAuthenticated={isAdminAuthenticated} />
          ) : activeTab === "history" && isAdminAuthenticated ? (
            <AttendanceHistory isAdminAuthenticated={isAdminAuthenticated} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Access denied. Admin authentication required.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttendanceTab({
  playerId,
  setPlayerId,
  player,
  attendance,
  todayAttendance,
  handleTimeIn,
  handleTimeOut,
  formatTime,
  isAdminAuthenticated,
  onRefreshToday,
  clearCountdown,
}: {
  playerId: string;
  setPlayerId: (id: string) => void;
  player: any;
  attendance: any;
  todayAttendance: any;
  handleTimeIn: () => void;
  handleTimeOut: () => void;
  formatTime: (timestamp: number) => string;
  isAdminAuthenticated: boolean;
  onRefreshToday: () => Promise<void> | void;
  clearCountdown: number | null;
}) {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Player Lookup */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Player Lookup</h2>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-4 md:mb-6">
          <input
            type="text"
            placeholder="Enter Player ID"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value.trim())}
            className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setPlayerId("")}
            className="px-4 py-2 text-sm md:text-base bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors w-full sm:w-auto"
          >
            Clear
          </button>
        </div>

        {/* Player Details */}
        {playerId && (
          <div className="border-t pt-4 md:pt-6">
            {player === undefined ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : player === null ? (
              <div className="text-center text-red-600 py-4">
                <p className="text-lg font-semibold">Player not found</p>
                <p className="text-sm">Please check the Player ID and try again</p>
              </div>
            ) : (
              <>
                {/* Countdown Warning */}
                {clearCountdown !== null && (
                  <div className="mb-3 md:mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4 text-center">
                    <p className="text-sm md:text-base text-yellow-800 font-semibold">
                      Form will clear in {clearCountdown} second{clearCountdown !== 1 ? 's' : ''}...
                    </p>
                    <p className="text-xs md:text-sm text-yellow-600 mt-1">
                      Thanks for your hardwork! :)
                    </p>
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                  {/* Player Information */}
                  <div className="space-y-3 md:space-y-4">
                    <h3 className="text-base md:text-lg font-semibold text-gray-800">Player Information</h3>
                    <div className="space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base gap-2">
                      <span className="font-medium text-gray-600">Player ID:</span>
                      <span className="font-semibold break-all text-right">{player.playerId}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base gap-2">
                      <span className="font-medium text-gray-600">Full Name:</span>
                      <span className="font-semibold break-words text-right">{player.fullName}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base gap-2">
                      <span className="font-medium text-gray-600">Age:</span>
                      <span>{player.age}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base gap-2">
                      <span className="font-medium text-gray-600">Email:</span>
                      <span className="break-all text-right">{player.email}</span>
                    </div>
                    {player.phone && (
                      <div className="flex justify-between text-sm md:text-base gap-2">
                        <span className="font-medium text-gray-600">Phone:</span>
                        <span className="break-all text-right">{player.phone}</span>
                      </div>
                    )}
                    {player.position && (
                      <div className="flex justify-between text-sm md:text-base gap-2">
                        <span className="font-medium text-gray-600">Position:</span>
                        <span className="break-words text-right">{player.position}</span>
                      </div>
                    )}
                    {player.team && (
                      <div className="flex justify-between text-sm md:text-base gap-2">
                        <span className="font-medium text-gray-600">Team:</span>
                        <span className="break-words text-right">{player.team}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm md:text-base gap-2">
                      <span className="font-medium text-gray-600">Status:</span>
                      <span className={`font-semibold capitalize ${
                        player.status === "inactive" ? "text-red-600" : "text-green-600"
                      }`}>
                        {player.status || "active"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attendance Actions */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800">Today's Attendance</h3>
                  
                  {/* Current Status */}
                  {attendance && (
                    <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-2">
                      {attendance.isFromYesterday && (
                        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs md:text-sm text-yellow-800">
                          <strong>Night Shift:</strong> This is from yesterday's shift. Please time out to complete.
                        </div>
                      )}
                      {attendance.timeIn && (
                        <div className="flex justify-between text-sm md:text-base gap-2">
                          <span className="font-medium text-gray-600">
                            Time In{attendance.isFromYesterday ? ' (Yesterday)' : ''}:
                          </span>
                          <span className="font-semibold text-green-600">
                            {formatTime(attendance.timeIn)}
                          </span>
                        </div>
                      )}
                      {attendance.timeOut && (
                        <div className="flex justify-between text-sm md:text-base gap-2">
                          <span className="font-medium text-gray-600">Time Out:</span>
                          <span className="font-semibold text-red-600">
                            {formatTime(attendance.timeOut)}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm md:text-base gap-2">
                        <span className="font-medium text-gray-600">Status:</span>
                        <span className={`font-semibold capitalize ${
                          attendance.status === 'present' ? 'text-green-600' : 
                          attendance.status === 'partial' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {attendance.status}
                        </span>
                      </div>
                      {attendance.date && (
                        <div className="flex justify-between text-xs md:text-sm text-gray-500 gap-2">
                          <span>Date:</span>
                          <span>{attendance.date}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {player.status === 'inactive' ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4 text-center">
                      <p className="text-sm md:text-base text-red-600 font-semibold">
                        This player is inactive and cannot perform attendance actions.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attendance?.isFromYesterday && (
                        <div className="text-xs md:text-sm text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                          Please complete yesterday's time out before starting a new shift.
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <button
                          onClick={handleTimeIn}
                          disabled={attendance?.timeIn != null || attendance?.isFromYesterday}
                          className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                          Time In
                        </button>
                        <button
                          onClick={handleTimeOut}
                          disabled={attendance?.timeIn == null || attendance?.timeOut != null}
                          className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                          Time Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Today's Attendance Summary */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Today's Attendance Summary</h2>
        {todayAttendance === undefined ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : todayAttendance.length === 0 ? (
          <p className="text-sm md:text-base text-gray-500 text-center py-4">No attendance records for today</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full table-auto min-w-[640px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Player ID</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Name</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Time In</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Time Out</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance.map((record: any) => (
                  <tr key={`${record.playerId}-${record.date}-${record.isFromYesterday ? 'yesterday' : 'today'}`} className={`border-b hover:bg-gray-50 ${record.isFromYesterday ? 'bg-yellow-50' : ''}`}>
                    <td className="py-2 px-2 md:px-4 font-mono text-xs md:text-sm">{record.playerId}</td>
                    <td className="py-2 px-2 md:px-4 text-xs md:text-sm">
                      {record.playerName}
                      {record.isFromYesterday && (
                        <span className="ml-1 md:ml-2 text-xs text-yellow-700 font-semibold block md:inline">(Night Shift)</span>
                      )}
                    </td>
                    <td className="py-2 px-2 md:px-4 text-xs md:text-sm">
                      {record.timeIn ? formatTime(record.timeIn) : '-'}
                      {record.isFromYesterday && (
                        <span className="ml-1 text-xs text-yellow-600 block md:inline">(Yesterday)</span>
                      )}
                    </td>
                    <td className="py-2 px-2 md:px-4 text-xs md:text-sm">
                      {record.timeOut ? formatTime(record.timeOut) : '-'}
                    </td>
                    <td className="py-2 px-2 md:px-4">
                      <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-semibold ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
                        record.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 md:px-4 text-right">
                      {isAdminAuthenticated ? (
                        <div className="flex flex-col md:flex-row gap-1 md:gap-2 justify-end">
                          <button
                            onClick={async () => {
                              const newStatus = record.status === 'present' ? 'partial' : record.status === 'partial' ? 'absent' : 'present';
                              const API_BASE = import.meta.env.VITE_API_URL || '';
                              const res = await fetch(`${API_BASE}/api/attendance`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', 'x-admin-pin': 'admin' },
                                body: JSON.stringify({ playerId: record.playerId, date: record.date, status: newStatus })
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                toast.error(data.error || 'Failed to update status');
                                return;
                              }
                              toast.success('Status updated');
                              await onRefreshToday();
                            }}
                            className="px-2 md:px-3 py-1 text-xs md:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                          >
                            Cycle Status
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete today's attendance for ${record.playerName}?`)) return;
                              const API_BASE = import.meta.env.VITE_API_URL || '';
                              const url = `${API_BASE}/api/attendance?playerId=${encodeURIComponent(record.playerId)}&date=${encodeURIComponent(record.date)}`;
                              const res = await fetch(url, { method: 'DELETE', headers: { 'x-admin-pin': 'admin' } });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                toast.error(data.error || 'Failed to delete attendance');
                                return;
                              }
                              toast.success('Attendance deleted');
                              await onRefreshToday();
                            }}
                            className="px-2 md:px-3 py-1 text-xs md:text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Admin controls hidden</span>
                      )}
                    </td>
                  </tr>
                ))}
                
              </tbody>
            </table>
          </div>
        )}
      </div>
      
    </div>
  );
}
