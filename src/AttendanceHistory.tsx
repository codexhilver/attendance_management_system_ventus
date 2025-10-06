import { useEffect, useState } from "react";
import { toast } from "sonner";

export function AttendanceHistory({ isAdminAuthenticated }: { isAdminAuthenticated?: boolean }) {
  const [dates, setDates] = useState<string[] | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<any[] | undefined>(undefined);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const refreshDates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance/dates`);
      const data = await res.json();
      setDates(data);
    } catch (error) {
      console.error('Error fetching dates:', error);
      toast.error('Failed to load attendance dates');
    }
  };

  useEffect(() => {
    refreshDates();
  }, []);

  const loadAttendanceForDate = async (date: string) => {
    setSelectedDate(date);
    setIsLoadingData(true);
    try {
      const res = await fetch(`${API_BASE}/api/attendance/by-date?date=${encodeURIComponent(date)}`);
      const data = await res.json();
      setAttendanceData(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
      setAttendanceData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleExportCSV = (date: string) => {
    window.open(`${API_BASE}/api/attendance/export/by-date?date=${encodeURIComponent(date)}`, '_blank');
    toast.success('CSV download started');
  };

  const handleDeleteDate = async (date: string) => {
    if (!isAdminAuthenticated) {
      toast.error("Admin authentication required");
      return;
    }

    if (!confirm(`Delete all attendance records for ${formatDateDisplay(date)}?\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/attendance/by-date?date=${encodeURIComponent(date)}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': 'admin' }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete attendance');
      }

      toast.success('Attendance records deleted successfully');
      
      // Refresh dates list
      await refreshDates();
      
      // Clear selected date if it was deleted
      if (selectedDate === date) {
        setSelectedDate(null);
        setAttendanceData(undefined);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete attendance');
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '-';
    const utc8Date = new Date(timestamp + (8 * 60 * 60 * 1000));
    const hours = utc8Date.getUTCHours();
    const minutes = utc8Date.getUTCMinutes();
    const seconds = utc8Date.getUTCSeconds();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const calculateTotalRecords = (date: string) => {
    // This would require a separate API call or we can show it when date is selected
    return '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Attendance History</h2>
        <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">
          View, download, and manage attendance records by date. Click on a date to view details.
        </p>
      </div>

      {/* Dates List */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Available Dates</h3>
        
        {dates === undefined ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : dates.length === 0 ? (
          <p className="text-sm md:text-base text-gray-500 text-center py-8">No attendance records found</p>
        ) : (
          <div className="space-y-2">
            {dates.map((date) => (
              <div
                key={date}
                className={`border rounded-lg p-4 transition-all ${
                  selectedDate === date
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => loadAttendanceForDate(date)}
                    className="flex-1 text-left"
                  >
                    <div className="font-semibold text-gray-900 text-sm md:text-base">{formatDateDisplay(date)}</div>
                    <div className="text-xs md:text-sm text-gray-500">{date}</div>
                  </button>
                  
                  <div className="flex gap-2 ml-2 md:ml-4">
                    <button
                      onClick={() => handleExportCSV(date)}
                      className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Download CSV"
                    >
                      Download CSV
                    </button>
                    
                    {isAdminAuthenticated && (
                      <button
                        onClick={() => handleDeleteDate(date)}
                        className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="Delete all records for this date"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base md:text-lg font-semibold">
              Attendance for {formatDateDisplay(selectedDate)}
            </h3>
            <button
              onClick={() => {
                setSelectedDate(null);
                setAttendanceData(undefined);
              }}
              className="text-sm md:text-base text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          {isLoadingData ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : attendanceData && attendanceData.length === 0 ? (
            <p className="text-sm md:text-base text-gray-500 text-center py-8">No attendance records for this date</p>
          ) : attendanceData ? (
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
                  {attendanceData.map((record: any) => (
                    <tr key={`${record.playerId}-${record.date}`} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 md:px-4 font-mono text-xs md:text-sm">{record.playerId}</td>
                      <td className="py-2 px-2 md:px-4 text-xs md:text-sm">{record.playerName}</td>
                      <td className="py-2 px-2 md:px-4 text-xs md:text-sm">{formatTime(record.timeIn)}</td>
                      <td className="py-2 px-2 md:px-4 text-xs md:text-sm">{formatTime(record.timeOut)}</td>
                      <td className="py-2 px-2 md:px-4">
                        <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-semibold ${
                          record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="mt-4 text-xs md:text-sm text-gray-600">
                Total records: {attendanceData.length}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
