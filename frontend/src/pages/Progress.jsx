import { useState, useEffect } from "react";
import { getStats, getBadges, getLeaderboard, getXPHistory } from "../api/gamification";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";

const ICON_MAP = {
  trophy: "🏆", fire: "🔥", star: "⭐", gem: "💎",
  crown: "👑", medal: "🏅", chat: "💬",
};

function BadgeCard({ name, description, icon, earned, earnedAt }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 transition-all hover:scale-[1.03] hover:-translate-y-0.5 ${
        earned
          ? "bg-gradient-to-br from-warn-50 via-accent-50 to-warn-100 dark:from-warn-900/30 dark:via-accent-900/20 dark:to-warn-900/30 border border-warn-300 dark:border-warn-700/50 shadow-sm"
          : "bg-surface-50 dark:bg-surface-900/40 border border-surface-100 dark:border-surface-800 opacity-50 grayscale"
      }`}
    >
      {earned && (
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-warn-400/30 to-accent-400/30 rounded-full blur-2xl" />
      )}
      <div className={`relative text-3xl mb-2 ${earned ? "animate-float" : ""}`}>
        {ICON_MAP[icon] || ICON_MAP.trophy}
      </div>
      <h3 className="relative font-bold text-surface-800 dark:text-surface-200">{name}</h3>
      <p className="relative text-caption text-surface-500 dark:text-surface-400 mt-0.5">{description}</p>
      {earned && earnedAt && (
        <p className="relative text-[10px] font-semibold text-warn-600 dark:text-warn-400 mt-2 uppercase tracking-wider">
          Earned {new Date(earnedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, delay }) {
  return (
    <div
      className="card card-hover p-5 text-center animate-fade-in-up"
      style={staggerDelay(delay)}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <p className={`text-h2 font-extrabold tracking-tight ${color}`}>{value}</p>
      <p className="text-eyebrow uppercase text-surface-500 dark:text-surface-400 mt-1">{label}</p>
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-10 w-56 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} height="h-28" />)}
        </div>
        <SkeletonCard height="h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Your journey"
        title="Your Progress"
        subtitle="Track XP, streaks, badges, and your place on the leaderboard."
        icon="📈"
        gradient
      />

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total XP" value={animatedXP} icon="⚡" color="text-primary-600 dark:text-primary-400" delay={0} />
        <StatCard label="Level" value={stats?.level_name} icon="🎯" color="text-primary-600 dark:text-primary-400" delay={1} />
        <StatCard label="Current Streak" value={`${animatedStreak}d`} icon="🔥" color="text-accent-600 dark:text-accent-400" delay={2} />
        <StatCard label="Longest Streak" value={`${animatedLongest}d`} icon="🏆" color="text-warn-600 dark:text-warn-400" delay={3} />
      </div>

      {/* Badges */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-h3 text-surface-900 dark:text-surface-100">Badges</h2>
          <span className="badge-neutral !text-[10px]">{badges.earned.length} earned</span>
        </div>
        {badges.earned.length === 0 && badges.available.length === 0 ? (
          <EmptyState icon="🏅" title="No badges yet" subtitle="Complete lessons and drills to earn your first badge." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-h3 text-surface-900 dark:text-surface-100">Leaderboard</h2>
          <span className="badge-neutral !text-[10px]">Top {leaderboard.length}</span>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/40 border-b border-surface-100 dark:border-surface-800/70">
                <th className="px-4 py-3 text-left text-eyebrow uppercase text-surface-500 dark:text-surface-400">Rank</th>
                <th className="px-4 py-3 text-left text-eyebrow uppercase text-surface-500 dark:text-surface-400">User</th>
                <th className="px-4 py-3 text-right text-eyebrow uppercase text-surface-500 dark:text-surface-400">XP</th>
                <th className="px-4 py-3 text-right text-eyebrow uppercase text-surface-500 dark:text-surface-400">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/70">
              {leaderboard.map((entry, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/30 animate-fade-in-up transition-colors"
                  style={staggerDelay(idx, 40)}
                >
                  <td className="px-4 py-3 text-base font-bold">
                    {idx === 0 ? <span className="text-2xl">🥇</span> : idx === 1 ? <span className="text-2xl">🥈</span> : idx === 2 ? <span className="text-2xl">🥉</span> : <span className="text-surface-400 dark:text-surface-500">#{idx + 1}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-surface-800 dark:text-surface-200">{entry.username}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-primary-600 dark:text-primary-400">{entry.total_xp}</td>
                  <td className="px-4 py-3 text-sm text-right text-surface-500 dark:text-surface-400">{entry.current_streak}d 🔥</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* XP History */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-h3 text-surface-900 dark:text-surface-100">Recent XP</h2>
          <span className="badge-neutral !text-[10px]">{history.length} events</span>
        </div>
        {history.length === 0 ? (
          <EmptyState icon="📊" title="No activity yet" subtitle="Start a quiz, drill, or game to earn XP." />
        ) : (
          <div className="space-y-2">
            {history.map((txn, i) => (
              <div
                key={txn.id}
                className="card card-hover px-4 py-3 flex justify-between items-center animate-slide-in-right"
                style={staggerDelay(i, 30)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-success-100 to-success-200 dark:from-success-700/30 dark:to-success-800/30 flex items-center justify-center text-success-700 dark:text-success-300 text-xs font-extrabold">
                    +{txn.xp_amount}
                  </span>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300 capitalize">
                    {txn.activity_type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-caption text-surface-400 dark:text-surface-500">
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
