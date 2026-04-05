import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getStats } from "../api/gamification";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Bonjour, {user?.username}!
      </h1>
      <p className="text-gray-600">
        Welcome to Lingaru. Your French learning journey starts here.
      </p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Level</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : stats?.level_name || "Debutant"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">XP</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : stats?.total_xp ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Streak</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : `${stats?.current_streak ?? 0} days`}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Rank</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {loading ? "..." : `#${stats?.rank ?? "-"}`}
          </p>
        </div>
      </div>
    </div>
  );
}
