import { useState, useEffect } from "react";
import { getStats, getBadges, getLeaderboard, getXPHistory } from "../api/gamification";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";

const ICON_MAP = {
  trophy: "\u{1F3C6}", fire: "\u{1F525}", star: "\u{2B50}", gem: "\u{1F48E}",
  crown: "\u{1F451}", medal: "\u{1F3C5}", chat: "\u{1F4AC}",
};

function BadgeCard({ name, description, icon, earned, earnedAt }) {
  return (
    <div
      className={`card p-4 transition-all hover:scale-[1.03] ${
        earned
          ? "bg-gradient-to-br from-warn-50 to-amber-50 dark:from-warn-700/20 dark:to-amber-900/20 border-warn-300 dark:border-warn-700"
          : "opacity-50"
      }`}
    >
      <div className={`text-2xl mb-2 ${earned ? "animate-bounce-in" : ""}`}>
        {ICON_MAP[icon] || ICON_MAP.trophy}
      </div>
      <h3 className="font-semibold text-surface-800 dark:text-surface-200">{name}</h3>
      <p className="text-sm text-surface-500 dark:text-surface-400">{description}</p>
      {earned && earnedAt && (
        <p className="text-xs text-warn-600 dark:text-warn-400 mt-1">
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

  const animatedXP = useCountUp(stats?.total_xp ?? 0);
  const animatedStreak = useCountUp(stats?.current_streak ?? 0, 600);
  const animatedLongest = useCountUp(stats?.longest_streak ?? 0, 600);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 animate-fade-in">Your Progress</h1>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total XP", value: animatedXP, color: "text-primary-600 dark:text-primary-400", icon: "⚡" },
          { label: "Level", value: stats?.level_name, color: "text-primary-600 dark:text-primary-400", icon: "🎯" },
          { label: "Current Streak", value: `${animatedStreak}d`, color: "text-warn-600 dark:text-warn-400", icon: "🔥" },
          { label: "Longest Streak", value: `${animatedLongest}d`, color: "text-warn-600 dark:text-warn-400", icon: "🏆" },
        ].map((s, i) => (
          <div key={s.label} className="card p-4 text-center animate-fade-in-up hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300" style={staggerDelay(i)}>
            <span className="text-xl">{s.icon}</span>
            <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      <section>
        <h2 className="text-lg font-bold text-surface-800 dark:text-surface-200 mb-4">Badges</h2>
        {badges.earned.length === 0 && badges.available.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl">🏅</span>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">Complete lessons and drills to earn badges!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {badges.earned.map((b) => (
              <BadgeCard key={b.id} name={b.name} description={b.description} icon={b.icon} earned earnedAt={b.earned_at} />
            ))}
            {badges.available.map((b) => (
              <BadgeCard key={b.id} name={b.name} description={b.description} icon={b.icon} earned={false} />
            ))}
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="text-lg font-bold text-surface-800 dark:text-surface-200 mb-4">Leaderboard</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-100 dark:border-surface-700/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">User</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">XP</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
              {leaderboard.map((entry, idx) => (
                <tr key={idx} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 animate-fade-in-up transition-colors" style={staggerDelay(idx, 40)}>
                  <td className="px-4 py-3 text-sm font-bold text-surface-900 dark:text-surface-100">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-surface-700 dark:text-surface-300">{entry.username}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-primary-600 dark:text-primary-400">{entry.total_xp}</td>
                  <td className="px-4 py-3 text-sm text-right text-surface-500 dark:text-surface-400">{entry.current_streak}d 🔥</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* XP History */}
      <section>
        <h2 className="text-lg font-bold text-surface-800 dark:text-surface-200 mb-4">Recent XP</h2>
        {history.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl">📊</span>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">No XP earned yet. Start a quiz!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((txn, i) => (
              <div
                key={txn.id}
                className="card px-4 py-3 flex justify-between items-center animate-slide-in-right card-hover"
                style={staggerDelay(i, 40)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-700/20 flex items-center justify-center text-success-600 dark:text-success-400 text-xs font-bold">
                    +{txn.xp_amount}
                  </span>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {txn.activity_type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-surface-400 dark:text-surface-500">
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
