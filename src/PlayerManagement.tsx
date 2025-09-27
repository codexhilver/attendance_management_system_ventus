import { useEffect, useState } from "react";
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
  });

  const [players, setPlayers] = useState<any[] | undefined>(undefined);

  const refresh = () => {
    fetch("http://localhost:5174/api/players")
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
        ? "http://localhost:5174/api/players"
        : `http://localhost:5174/api/players/${encodeURIComponent(editingId)}`;
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
      });
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : editingId ? "Failed to update player" : "Failed to create player"
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    });
    setShowForm(true);
  };

  const handleDelete = async (playerId: string) => {
    if (!isAdminAuthenticated) {
      toast.error("Admin authentication required");
      return;
    }
    if (!confirm(`Delete player ${playerId}?`)) return;
    const res = await fetch(`http://localhost:5174/api/players/${encodeURIComponent(playerId)}`, {
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

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Player Management</h2>
        {isAdminAuthenticated ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? "Cancel" : "Add Player"}
          </button>
        ) : (
          <span className="text-sm text-gray-500">Admin authentication required to add players</span>
        )}
      </div>

      {showForm && isAdminAuthenticated && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-lg">
          <div className="grid md:grid-cols-2 gap-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-6">
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {editingId ? "Update Player" : "Create Player"}
            </button>
          </div>
        </form>
      )}

      {/* Players List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">All Players</h3>
        {players === undefined ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : players.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No players registered yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Player ID</th>
                  <th className="text-left py-2 px-4">Name</th>
                  <th className="text-left py-2 px-4">Age</th>
                  <th className="text-left py-2 px-4">Email</th>
                  <th className="text-left py-2 px-4">Position</th>
                  <th className="text-left py-2 px-4">Team</th>
                  <th className="text-right py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.playerId} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-mono">{player.playerId}</td>
                    <td className="py-2 px-4">{player.fullName}</td>
                    <td className="py-2 px-4">{player.age}</td>
                    <td className="py-2 px-4">{player.email}</td>
                    <td className="py-2 px-4">{player.position || '-'}</td>
                    <td className="py-2 px-4">{player.team || '-'}</td>
                    <td className="py-2 px-4 text-right">
                      {isAdminAuthenticated ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(player)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(player.playerId)}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
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
