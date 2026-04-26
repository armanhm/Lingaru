import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getGrammarTopics } from "../api/grammar";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard, EmptyState } from "../components/ui";

const CEFR_LEVELS = ["all", "A1", "A2", "B1", "B2", "C1", "C2"];

const STATUS_BADGE = {
  not_started: { label: "New",       className: "badge-neutral" },
  learning:    { label: "Learning",  className: "badge-warn" },
  practiced:   { label: "Practiced", className: "badge-info" },
  mastered:    { label: "Mastered",  className: "badge-success" },
};

function MasteryDot({ status }) {
  const color = {
    mastered:    "bg-success-500 shadow-glow-success",
    practiced:   "bg-info-500",
    learning:    "bg-warn-500",
    not_started: "bg-surface-300 dark:bg-surface-700",
  }[status] || "bg-surface-300";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function GrammarLibrary() {
  const [params, setParams] = useSearchParams();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const category = params.get("category") || "";
  const level = params.get("level") || "";

  useEffect(() => {
    setLoading(true);
    getGrammarTopics({ category: category || undefined, level: level || undefined })
      .then((res) => setTopics(res.data))
      .finally(() => setLoading(false));
  }, [category, level]);

  const visible = useMemo(() => {
    if (statusFilter === "all") return topics;
    return topics.filter((t) => t.status === statusFilter);
  }, [topics, statusFilter]);

  const categories = useMemo(() => {
    const seen = new Map();
    topics.forEach((t) => seen.set(t.category_slug, { name: t.category_name, icon: t.category_icon, slug: t.category_slug }));
    return Array.from(seen.values());
  }, [topics]);

  const setLevelFilter = (lvl) => {
    const next = new URLSearchParams(params);
    if (lvl === "all") next.delete("level"); else next.set("level", lvl);
    setParams(next, { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        backTo="/grammar"
        backLabel="Grammar Booster"
        eyebrow="Library"
        title="All grammar topics"
        subtitle="Filter by category, CEFR level, or mastery state. Tap any topic to learn or drill."
        icon="📚"
      />

      {/* Filters */}
      <div className="space-y-4 mb-6">
        {/* Category filter (only if no preselect) */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { const n = new URLSearchParams(params); n.delete("category"); setParams(n, { replace: true }); }}
              className={`px-3 py-1.5 rounded-full text-caption font-semibold transition-all focus-ring ${
                !category
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => { const n = new URLSearchParams(params); n.set("category", c.slug); setParams(n, { replace: true }); }}
                className={`px-3 py-1.5 rounded-full text-caption font-semibold transition-all focus-ring ${
                  category === c.slug
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
                }`}
              >
                <span className="mr-1">{c.icon}</span>{c.name}
              </button>
            ))}
          </div>
        )}

        {/* Level + status filters */}
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex p-1 rounded-2xl bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 gap-0.5">
            {CEFR_LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={`px-3 py-1.5 rounded-xl text-caption font-bold transition-all focus-ring ${
                  (l === "all" && !level) || level === l
                    ? "bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
                }`}
              >
                {l === "all" ? "All" : l}
              </button>
            ))}
          </div>

          <div className="inline-flex p-1 rounded-2xl bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 gap-0.5">
            {["all", "not_started", "learning", "practiced", "mastered"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-caption font-bold transition-all focus-ring capitalize ${
                  statusFilter === s
                    ? "bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
                }`}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-32" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon="🔍" title="No topics match" subtitle="Try a different filter combination." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((t, i) => {
            const status = STATUS_BADGE[t.status] || STATUS_BADGE.not_started;
            return (
              <Link
                key={t.id}
                to={`/grammar/topics/${t.slug}`}
                className="group relative overflow-hidden card card-hover p-5 focus-ring animate-fade-in-up flex gap-4"
                style={staggerDelay(i, 30)}
              >
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-700 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  {t.category_icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={status.className}><MasteryDot status={t.status} /> {status.label}</span>
                    <span className="badge-neutral !text-[10px]">{t.cefr_level}</span>
                  </div>
                  <h3 className="text-h4 text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                    {t.title}
                  </h3>
                  <p className="text-caption text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">
                    {t.summary}
                  </p>
                  {t.mastery > 0 && (
                    <div className="mt-2 w-full bg-surface-100 dark:bg-surface-800 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-1 rounded-full transition-all ${t.status === "mastered" ? "bg-success-500" : "bg-primary-500"}`}
                        style={{ width: `${t.mastery}%` }}
                      />
                    </div>
                  )}
                </div>
                <svg className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all shrink-0 self-center" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
