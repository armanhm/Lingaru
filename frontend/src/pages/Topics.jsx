import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTopics } from "../api/content";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard, EmptyState } from "../components/ui";

const DIFFICULTY_BADGE = {
  A1: "badge-success", A2: "badge-success",
  B1: "badge-info",    B2: "badge-info",
  C1: "badge-warn",    C2: "badge-danger",
};

export default function Topics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopics()
      .then((res) => setTopics(res.data.results || res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load topics."))
      .finally(() => setLoading(false));
  }, []);

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

      {topics.length === 0 ? (
        <EmptyState icon="📚" title="No topics yet" subtitle="Content is being added — check back soon." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((topic, i) => (
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
                  <span className={DIFFICULTY_BADGE[topic.difficulty_level] || "badge-neutral"}>
                    {topic.difficulty_level}
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
