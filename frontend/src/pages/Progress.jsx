import { useState, useEffect } from "react";
import { getStats, getBadges, getLeaderboard, getXPHistory } from "../api/gamification";

function BadgeCard({ name, description, icon, earned, earnedAt }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        earned ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300" : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60"
      }`}
    >
      <div className="text-2xl mb-2">{icon === "trophy" ? "\u{1F3C6}" : icon === "fire" ? "\u{1F525}" : icon === "star" ? "\u{2B50}" : icon === "gem" ? "\u{1F48E}" : icon === "crown" ? "\u{1F451}" : icon === "medal" ? "\u{1F3C5}" : icon === "chat" ? "\u{1F4AC}" : "\u{1F3C6}"}</div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-200">{name}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      {earned && earnedAt && (
        <p className="text-xs text-yellow-600 mt-1">
          Earned {new Date(earnedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function Progress() {
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState({ earned: [], available: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getBadges(), getLeaderboard(), getXPHistory()])
      .then(([statsRes, badgesRes, lbRes, histRes]) => {
        setStats(statsRes.data);
        setBadges(badgesRes.data);
        setLeaderboard(lbRes.data.results || []);
        setHistory(histRes.data.results || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your Progress</h1>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total XP</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.total_xp ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Level</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.level_name}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Streak</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.current_streak} days</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Longest Streak</p>
          <p className="text-2xl font-bold text-primary-600">{stats?.longest_streak} days</p>
        </div>
      </div>

      {/* Badges */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.earned.map((b) => (
            <BadgeCard
              key={b.id}
              name={b.name}
              description={b.description}
              icon={b.icon}
              earned
              earnedAt={b.earned_at}
            />
          ))}
          {badges.available.map((b) => (
            <BadgeCard
              key={b.id}
              name={b.name}
              description={b.description}
              icon={b.icon}
              earned={false}
            />
          ))}
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Leaderboard</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">User</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">XP</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {leaderboard.map((entry, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{entry.username}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{entry.total_xp}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{entry.current_streak}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* XP History */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Recent XP</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No XP earned yet. Start a quiz!</p>
        ) : (
          <div className="space-y-2">
            {history.map((txn) => (
              <div
                key={txn.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 flex justify-between items-center"
              >
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    +{txn.xp_amount} XP
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {txn.activity_type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(txn.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
