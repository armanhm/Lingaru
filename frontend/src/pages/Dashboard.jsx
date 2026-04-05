import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getStats, getXPHistory } from "../api/gamification";
import { getTopics } from "../api/content";
import { getSRSDueCards } from "../api/progress";
import { getFeed } from "../api/discover";
import AudioPlayButton from "../components/AudioPlayButton";

const FRENCH_DAYS = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];
const FRENCH_MONTHS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

function frenchDate() {
  const d = new Date();
  return `${FRENCH_DAYS[d.getDay()]} ${d.getDate()} ${FRENCH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const QUICK_ACTIONS = [
  { label: "Start Quiz", desc: "Pick a topic", to: "/topics", color: "bg-indigo-500", icon: "?" },
  { label: "SRS Review", desc: "Spaced repetition", to: "/practice/srs", color: "bg-emerald-500", icon: "S", badgeKey: "srsDue" },
  { label: "Dictation", desc: "Listen & write", to: "/practice/dictation", color: "bg-amber-500", icon: "D" },
  { label: "Conjugation", desc: "Verb drills", to: "/practice/conjugation", color: "bg-rose-500", icon: "C" },
  { label: "AI Chat", desc: "Practice conversation", to: "/assistant", color: "bg-violet-500", icon: "A" },
  { label: "Pronunciation", desc: "Speak & compare", to: "/practice/pronunciation", color: "bg-cyan-500", icon: "P" },
];

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <SkeletonBlock className="h-16 w-2/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [srsDue, setSrsDue] = useState(0);
  const [xpHistory, setXpHistory] = useState([]);
  const [todayWord, setTodayWord] = useState(null);
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      getStats(),
      getSRSDueCards(1),
      getXPHistory(),
      getFeed(),
      getTopics(),
    ]).then(([statsRes, srsRes, historyRes, feedRes, topicsRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);

      if (srsRes.status === "fulfilled") {
        const data = srsRes.value.data;
        setSrsDue(data.count ?? data.results?.length ?? 0);
      }

      if (historyRes.status === "fulfilled") {
        const data = historyRes.value.data;
        setXpHistory((data.results ?? data).slice(0, 5));
      }

      if (feedRes.status === "fulfilled") {
        const cards = feedRes.value.data.results ?? feedRes.value.data ?? [];
        const vocab = cards.find((c) => c.card_type === "vocabulary" || c.french);
        if (vocab) setTodayWord(vocab);
      }

      if (topicsRes.status === "fulfilled") {
        const data = topicsRes.value.data;
        setTopics((data.results ?? data).filter((t) => t.progress > 0 && t.progress < 100).slice(0, 3));
      }

      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Bonjour, {user?.username}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 capitalize">{frenchDate()}</p>
      </div>

      {/* Stats ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total XP</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {stats?.total_xp ?? 0}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stats?.level_name || "Debutant"}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Streak</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            {stats?.current_streak ?? 0} days {(stats?.current_streak ?? 0) > 0 && "\uD83D\uDD25"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SRS Due</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{srsDue}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">cards to review</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Leaderboard</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">
            #{stats?.rank ?? "-"}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="relative flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className={`flex-shrink-0 w-11 h-11 ${action.color} rounded-lg flex items-center justify-center text-white font-bold text-lg`}>
                {action.icon}
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{action.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{action.desc}</p>
              </div>
              {action.badgeKey === "srsDue" && srsDue > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {srsDue > 99 ? "99+" : srsDue}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom row: Today's Word + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Word */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Today&apos;s Word</h2>
          {todayWord ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-indigo-700">
                  {todayWord.french ?? todayWord.front_text}
                </span>
                <AudioPlayButton text={todayWord.french ?? todayWord.front_text} />
              </div>
              {todayWord.pronunciation && (
                <p className="text-sm text-indigo-400 mt-1">/{todayWord.pronunciation}/</p>
              )}
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {todayWord.english ?? todayWord.back_text ?? todayWord.translation}
              </p>
              {todayWord.example_sentence && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                  &ldquo;{todayWord.example_sentence}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No vocabulary available yet. Start learning to see words here!</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Recent Activity</h2>
          {xpHistory.length > 0 ? (
            <ul className="space-y-3">
              {xpHistory.map((entry, i) => (
                <li key={entry.id ?? i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate mr-2">
                    {entry.description || entry.reason || "Activity"}
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 whitespace-nowrap">
                    +{entry.amount ?? entry.xp} XP
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activity. Complete a lesson or quiz to earn XP!</p>
          )}
        </div>
      </div>

      {/* Continue Learning */}
      {topics.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Continue Learning</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                to={`/topics/${topic.id}`}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
              >
                <p className="font-semibold text-gray-800 dark:text-gray-200">{topic.title ?? topic.name}</p>
                <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.round(topic.progress)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{Math.round(topic.progress)}% complete</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
