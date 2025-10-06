import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

export function PlayerManagement({ isAdminAuthenticated }: { isAdminAuthenticated?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    playerId: "",
    fullName: "",
    age: "",
    email: "",
    phone: "",
    position: "",
    team: "",
    status: "active", // Add status field
  });

  const [players, setPlayers] = useState<any[] | undefined>(undefined);
  const [search, setSearch] = useState("");

  // Ref for the form section
  const formRef = useRef<HTMLDivElement>(null);

  // Use environment variable for API base URL
  const API_BASE = import.meta.env.VITE_API_URL || '';

  const refresh = () => {
    fetch(`${API_BASE}/api/players`)
      .then(async (r) => r.json())
      .then(setPlayers);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const creating = editingId === null;
      const url = creating
        ? `${API_BASE}/api/players`
        : `${API_BASE}/api/players/${encodeURIComponent(editingId)}`;
      const method = creating ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: isAdminAuthenticated
          ? { "Content-Type": "application/json", 'x-admin-pin': 'admin' }
          : { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: formData.playerId,
          fullName: formData.fullName,
          age: parseInt(formData.age),
          email: formData.email,
          phone: formData.phone || undefined,
          position: formData.position || undefined,
          team: formData.team || undefined,
          status: formData.status || "active", // Include status
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || (creating ? "Failed to create player" : "Failed to update player"));
      }
      toast.success(creating ? "Player created successfully!" : "Player updated successfully!");
      refresh();
      setFormData({
        playerId: "",
        fullName: "",
        age: "",
        email: "",
        phone: "",
        position: "",
        team: "",
        status: "active",
      });
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : editingId ? "Failed to update player" : "Failed to create player"
      );
    }
  };

  // Support dropdown/select for status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEdit = (p: any) => {
    if (!isAdminAuthenticated) {
      toast.error("Admin authentication required");
      return;
    }
    setEditingId(p.playerId);
    setFormData({
      playerId: p.playerId,
      fullName: p.fullName,
      age: String(p.age),
      email: p.email,
      phone: p.phone ?? "",
      position: p.position ?? "",
      team: p.team ?? "",
      status: p.status ?? "active",
    });
    setShowForm(true);

    // Scroll to form section
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDelete = async (playerId: string) => {
    if (!isAdminAuthenticated) {
      toast.error("Admin authentication required");
      return;
    }
    if (!confirm(`Delete player ${playerId}?`)) return;
    const res = await fetch(`${API_BASE}/api/players/${encodeURIComponent(playerId)}`, {
      method: "DELETE",
      headers: isAdminAuthenticated ? { 'x-admin-pin': 'admin' } : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete player");
      return;
    }
    toast.success("Player deleted");
    refresh();
  };

  // Filtered and unique players
  const filteredPlayers = Array.from(
    new Map(
      (players ?? [])
        .filter(
          p =>
            p.playerId.toLowerCase().includes(search.toLowerCase()) ||
            p.fullName.toLowerCase().includes(search.toLowerCase()) ||
            p.email.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => a.playerId.localeCompare(b.playerId))
        .map(player => [player.playerId, player])
    ).values()
  );

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h2 className="text-lg md:text-xl font-semibold">Player Management</h2>
        {isAdminAuthenticated ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto"
          >
            {showForm ? "Cancel" : "Add Player"}
          </button>
        ) : (
          <span className="text-xs md:text-sm text-gray-500">Admin authentication required to add players</span>
        )}
      </div>

      {/* Form section with ref for scroll */}
      <div ref={formRef}>
        {showForm && isAdminAuthenticated && (
          <form onSubmit={handleSubmit} className="mb-8 p-4 md:p-6 bg-gray-50 rounded-lg">
            <div className="grid md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player ID *
                </label>
                <input
                  type="text"
                  name="playerId"
                  value={formData.playerId}
                  onChange={handleInputChange}
                  disabled={editingId !== null}
                  required
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age *
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  required
                  min="1"
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team
                </label>
                <input
                  type="text"
                  name="team"
                  value={formData.team}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-4 md:mt-6">
              <button
                type="submit"
                className="px-4 md:px-6 py-2 text-sm md:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors w-full md:w-auto"
              >
                {editingId ? "Update Player" : "Create Player"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by Player ID, Name, or Email"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-1/3 px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Players List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">All Players</h3>
        {players === undefined ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No players found</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full table-auto min-w-[800px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Player ID</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Name</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Age</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Email</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Position</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Team</th>
                  <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">Status</th>
                  <th className="text-right py-2 px-2 md:px-4 text-xs md:text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player, idx) => (
                  <tr
                    key={player.playerId}
                    className={`border-b hover:bg-gray-50 ${player.status === "inactive" ? "bg-red-100" : ""}`}
                  >
                    <td className={`py-2 px-2 md:px-4 font-mono text-xs md:text-sm ${player.status === "inactive" ? "text-red-600 font-bold" : ""}`}>
                      {player.playerId}
                    </td>
                    <td className={`py-2 px-2 md:px-4 text-xs md:text-sm ${player.status === "inactive" ? "text-red-600 font-bold" : ""}`}>
                      {player.fullName}
                    </td>
                    <td className={`py-2 px-2 md:px-4 text-xs md:text-sm ${player.status === "inactive" ? "text-red-600 font-bold" : ""}`}>
                      {player.age}
                    </td>
                    <td className={`py-2 px-2 md:px-4 text-xs md:text-sm ${player.status === "inactive" ? "text-red-600 font-bold" : ""}`}>
                      {player.email}
                    </td>
                    <td className={`py-2 px-2 md:px-4 text-xs md:text-sm ${player.status === "inactive" ? "text-red-600 font-bold" : ""}`}>
                      {player.position || '-'}
                    </td>
                    <td className={`py-2 px-2 md:px-4 text-xs md:text-sm ${player.status === "inactive" ? "text-red-600 font-bold" : ""}`}>
                      {player.team || '-'}
                    </td>
                    <td className="py-2 px-2 md:px-4">
                      {isAdminAuthenticated ? (
                        <select
                          value={player.status || "active"}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            try {
                              // Update status on backend
                              const res = await fetch(`${API_BASE}/api/players/${encodeURIComponent(player.playerId)}`, {
                                method: 'PUT',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'x-admin-pin': 'admin'
                                },
                                body: JSON.stringify({
                                  playerId: player.playerId,
                                  fullName: player.fullName,
                                  age: player.age,
                                  email: player.email,
                                  phone: player.phone,
                                  position: player.position,
                                  team: player.team,
                                  status: newStatus
                                })
                              });
                              
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(data.error || 'Failed to update status');
                              }
                              
                              // Update local state after successful backend update
                              const updatedPlayers = [...players];
                              const index = updatedPlayers.findIndex(p => p.playerId === player.playerId);
                              if (index !== -1) {
                                updatedPlayers[index] = { ...player, status: newStatus };
                                setPlayers(updatedPlayers);
                              }
                              toast.success('Status updated successfully');
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'Failed to update status');
                              // Refresh to get correct state from server
                              refresh();
                            }
                          }}
                          className={`px-2 py-1 text-xs md:text-sm rounded ${player.status === "inactive" ? "bg-red-200 text-red-700 font-bold" : ""}`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs md:text-sm font-semibold capitalize ${
                          player.status === "inactive" ? "text-red-600" : "text-green-600"
                        }`}>
                          {player.status || "active"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 md:px-4 text-right">
                      {isAdminAuthenticated ? (
                        <div className="flex flex-col md:flex-row gap-1 md:gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(player)}
                            className="px-2 md:px-3 py-1 text-xs md:text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(player.playerId)}
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
