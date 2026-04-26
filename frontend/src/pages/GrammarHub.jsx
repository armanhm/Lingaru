import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getGrammarHub } from "../api/grammar";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard, EmptyState } from "../components/ui";

const CATEGORY_TINTS = {
  tenses:    "from-primary-500 to-purple-600",
  pronouns:  "from-info-500 to-primary-600",
  articles:  "from-success-500 to-info-600",
  negation:  "from-danger-500 to-accent-600",
  moods:     "from-accent-500 to-primary-600",
  structure: "from-warn-500 to-accent-500",
};

function MasteryRing({ pct, size = 56 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const tone = pct >= 80 ? "stroke-success-500" : pct >= 50 ? "stroke-primary-500" : pct > 0 ? "stroke-warn-500" : "stroke-surface-300 dark:stroke-surface-700";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-surface-200 dark:stroke-surface-800" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={`${tone} transition-all duration-700`} strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-caption font-bold text-surface-700 dark:text-surface-200">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function GrammarHub() {
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGrammarHub().then((res) => setHub(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-10 w-72 rounded-lg" />
        </div>
        <SkeletonCard height="h-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-32" />)}
        </div>
      </div>
    );
  }

  const categories = hub?.categories || [];
  const recommended = hub?.recommended_topic;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Build the bones"
        title="Grammar Booster"
        subtitle="A library of French grammar topics, with focused drills that adapt to what you already know."
        icon="🧠"
        gradient
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-h2 font-extrabold text-primary-600 dark:text-primary-400">{hub?.total_topics ?? 0}</p>
          <p className="text-eyebrow uppercase text-surface-500 dark:text-surface-400 mt-1">topics</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-h2 font-extrabold text-success-600 dark:text-success-400">{hub?.total_mastered ?? 0}</p>
          <p className="text-eyebrow uppercase text-surface-500 dark:text-surface-400 mt-1">mastered</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-h2 font-extrabold text-warn-600 dark:text-warn-400">{hub?.due_for_review ?? 0}</p>
          <p className="text-eyebrow uppercase text-surface-500 dark:text-surface-400 mt-1">due to review</p>
        </div>
      </div>

      {/* Recommended */}
      {recommended && (
        <Link
          to={`/grammar/topics/${recommended.slug}`}
          className="group block relative overflow-hidden rounded-3xl card-elevated p-0 mb-8 card-hover focus-ring animate-fade-in-up"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-accent-500/5 to-success-500/10 dark:from-primary-500/20 dark:via-accent-500/10 dark:to-success-500/20 pointer-events-none" />
          <div className="absolute -top-8 -right-8 w-48 h-48 bg-gradient-mesh opacity-30 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-5 p-5 sm:p-6">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 text-white flex items-center justify-center text-3xl shadow-glow-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              {recommended.category_icon || "🧠"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="eyebrow-primary mb-0.5">{recommended.status === "not_started" ? "Recommended for you" : recommended.status === "mastered" ? "Refresh today" : "Continue with"}</p>
              <h3 className="text-h3 text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                {recommended.title}
              </h3>
              <p className="text-caption text-surface-500 dark:text-surface-400 truncate">
                {recommended.summary || `${recommended.cefr_level} · ${recommended.category_name}`}
              </p>
            </div>
            <div className="shrink-0 hidden sm:block">
              <span className="btn-primary btn-md pointer-events-none">
                Drill now
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Categories */}
      <h2 className="text-h3 text-surface-900 dark:text-surface-100 mb-4">Browse by category</h2>
      {categories.length === 0 ? (
        <EmptyState icon="📚" title="No grammar content yet" subtitle="Run the seed_grammar command to populate topics." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c, i) => (
            <Link
              key={c.id}
              to={`/grammar/library?category=${c.slug}`}
              className="group relative overflow-hidden card card-hover p-0 focus-ring animate-fade-in-up"
              style={staggerDelay(i, 60)}
            >
              <div className={`h-1.5 bg-gradient-to-r ${CATEGORY_TINTS[c.slug] || "from-primary-500 to-purple-600"}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${CATEGORY_TINTS[c.slug] || "from-primary-500 to-purple-600"} rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    {c.icon || "🧠"}
                  </div>
                  <MasteryRing pct={c.avg_mastery} size={48} />
                </div>
                <h3 className="text-h4 text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {c.name}
                </h3>
                <p className="text-caption text-surface-500 dark:text-surface-400 mt-1">
                  <span className="font-bold text-surface-700 dark:text-surface-300">{c.topic_count}</span> topics
                  {c.mastered_count > 0 && <> · <span className="text-success-600 dark:text-success-400 font-bold">{c.mastered_count}</span> mastered</>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Browse all link */}
      <div className="mt-6 text-center">
        <Link to="/grammar/library" className="btn-secondary btn-md">
          Browse all topics →
        </Link>
      </div>
    </div>
  );
}
