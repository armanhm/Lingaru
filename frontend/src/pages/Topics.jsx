import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTopics } from "../api/content";
import { useAuth } from "../contexts/AuthContext";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard, EmptyState } from "../components/ui";

// CEFR levels share difficulty_level=5 for C1/C2 because the seed content
// bundles them as a single "C1-C2" level. Keep the user-facing tabs split.
const LEVELS = [
  { key: "A1", difficulty: 1, badge: "badge-success", label: "Beginner" },
  { key: "A2", difficulty: 2, badge: "badge-success", label: "Elementary" },
  { key: "B1", difficulty: 3, badge: "badge-info",    label: "Intermediate" },
  { key: "B2", difficulty: 4, badge: "badge-info",    label: "Upper Intermediate" },
  { key: "C1", difficulty: 5, badge: "badge-warn",    label: "Advanced" },
  { key: "C2", difficulty: 5, badge: "badge-danger",  label: "Proficiency" },
];

const LEVEL_BY_KEY = Object.fromEntries(LEVELS.map((l) => [l.key, l]));

export default function Topics() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Initial tab; may be wrong on first render because AuthContext loads
  // the profile asynchronously (user is null until /users/me/ resolves).
  // The effect below corrects it once target_level is known.
  const [activeLevel, setActiveLevel] = useState(() => {
    return LEVEL_BY_KEY[user?.target_level] ? user.target_level : "B2";
  });

  useEffect(() => {
    if (user?.target_level && LEVEL_BY_KEY[user.target_level]) {
      setActiveLevel(user.target_level);
    }
  }, [user?.target_level]);

  useEffect(() => {
    getTopics()
      .then((res) => setTopics(res.data.results || res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load topics."))
      .finally(() => setLoading(false));
  }, []);

  const countsByLevel = useMemo(() => {
    const counts = Object.fromEntries(LEVELS.map((l) => [l.key, 0]));
    for (const t of topics) {
      for (const l of LEVELS) {
        if (t.difficulty_level === l.difficulty) counts[l.key] += 1;
      }
    }
    return counts;
  }, [topics]);

  const visibleTopics = useMemo(() => {
    const target = LEVEL_BY_KEY[activeLevel]?.difficulty;
    return topics.filter((t) => t.difficulty_level === target);
  }, [topics, activeLevel]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="space-y-2 mb-7">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-10 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-44" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState
          icon="⚠️"
          title="Couldn't load topics"
          subtitle={error}
          tone="warn"
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Browse & learn"
        title="Topics"
        subtitle="Structured lessons on vocabulary, grammar, and culture. Pick a topic to begin."
        icon="📚"
        gradient
      />

      {/* Level tabs — defaults to the user's target_level from settings.
          On md+ they span the same width as the 3-column card grid below
          (6 equal columns), on mobile they wrap with a flexible gap. */}
      <div
        role="tablist"
        aria-label="CEFR level"
        className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2"
      >
        {LEVELS.map((level) => {
          const isActive = activeLevel === level.key;
          const count = countsByLevel[level.key];
          return (
            <button
              key={level.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveLevel(level.key)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-left transition-all focus-ring ${
                isActive
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold">{level.key}</span>
                <span className={`text-[11px] ${isActive ? "opacity-90" : "opacity-60"}`}>
                  {level.label}
                </span>
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  isActive ? "opacity-90" : "opacity-60"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visibleTopics.length === 0 ? (
        <EmptyState
          icon="📚"
          title={`No ${activeLevel} topics yet`}
          subtitle="Pick another level above, or check back soon."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleTopics.map((topic, i) => (
            <Link
              key={topic.id}
              to={`/topics/${topic.id}`}
              className="group relative overflow-hidden card card-hover focus-ring p-0 animate-fade-in-up"
              style={staggerDelay(i, 40)}
            >
              {/* Top accent band */}
              <div className="h-1 bg-gradient-to-r from-primary-400 via-accent-400 to-success-400 opacity-60 group-hover:opacity-100 transition-opacity" />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-700 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    {topic.icon || "📘"}
                  </div>
                  <span className={LEVEL_BY_KEY[activeLevel]?.badge || "badge-neutral"}>
                    {activeLevel}
                  </span>
                </div>

                <h2 className="text-h4 text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {topic.name_fr}
                </h2>
                <p className="text-caption text-surface-500 dark:text-surface-400 mb-2">{topic.name_en}</p>
                <p className="text-caption text-surface-600 dark:text-surface-400 line-clamp-2 leading-relaxed">
                  {topic.description}
                </p>

                <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800/50 flex items-center justify-between">
                  <span className="text-caption text-surface-500 dark:text-surface-400">
                    <span className="font-bold text-surface-900 dark:text-surface-100">{topic.lesson_count}</span> {topic.lesson_count === 1 ? "lesson" : "lessons"}
                  </span>
                  <span className="text-primary-500 group-hover:translate-x-1 transition-transform">
                    <svg className="w-4 h-4" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
