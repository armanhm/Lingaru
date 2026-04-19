import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTopic } from "../api/content";
import { getTopicProgress } from "../api/progress";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";

const TYPE_ICON = { vocab: "📝", vocabulary: "📝", grammar: "📐", text: "📖", reading: "📖" };
const TYPE_LABEL = { vocab: "Vocabulary", vocabulary: "Vocabulary", grammar: "Grammar", text: "Reading", reading: "Reading" };

export default function TopicDetail() {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getTopic(id), getTopicProgress(id)])
      .then(([topicRes, progressRes]) => {
        setTopic(topicRes.data);
        setCompletedIds(new Set(progressRes.data.completed_lesson_ids));
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load topic."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-5 w-24 rounded" />
        <div className="skeleton h-12 w-2/3 rounded-lg" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="space-y-3 pt-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} height="h-20" />)}
        </div>
      </div>
    );
  }

  if (error) return <EmptyState icon="⚠️" title="Couldn't load topic" subtitle={error} tone="warn" />;
  if (!topic) return null;

  const lessons = topic.lessons || [];
  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;
  const pct = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        backTo="/topics"
        backLabel="All topics"
        eyebrow={topic.name_en}
        title={topic.name_fr}
        subtitle={topic.description}
        icon={topic.icon || "📘"}
      />

      {lessons.length > 0 && (
        <div className="card p-4 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">
              {completedCount}/{lessons.length} lessons completed
            </span>
            <span className="text-h4 font-extrabold text-gradient-primary">{Math.round(pct)}%</span>
          </div>
          <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent-500 transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-h3 text-surface-900 dark:text-surface-100">Lessons</h2>
        <span className="badge-neutral !text-[10px]">{lessons.length} total</span>
      </div>

      {lessons.length === 0 ? (
        <EmptyState icon="📚" title="No lessons yet" subtitle="Content is being added soon." />
      ) : (
        <div className="space-y-2.5">
          {lessons.map((lesson, index) => {
            const done = completedIds.has(lesson.id);
            return (
              <Link
                key={lesson.id}
                to={`/lesson/${lesson.id}`}
                className={`group relative overflow-hidden rounded-2xl p-5 flex items-center gap-4 card-hover animate-fade-in-up focus-ring transition-all duration-300 ${
                  done
                    ? "bg-gradient-to-r from-success-50 via-success-50/60 to-white dark:from-success-900/30 dark:via-success-900/15 dark:to-surface-900 border border-success-200 dark:border-success-800/50"
                    : "card"
                }`}
                style={staggerDelay(index, 40)}
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${
                  done
                    ? "bg-gradient-to-br from-success-500 to-success-600 text-white shadow-glow-success"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
                }`}>
                  {done ? "✓" : index + 1}
                </div>

                <div className="shrink-0 text-2xl">{TYPE_ICON[lesson.type] || "📄"}</div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold ${done ? "text-success-800 dark:text-success-200" : "text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400"} transition-colors`}>
                    {lesson.title}
                  </h3>
                  <p className="text-caption text-surface-500 dark:text-surface-400 truncate">{lesson.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge-neutral !text-[10px] hidden sm:inline-flex">{TYPE_LABEL[lesson.type] || lesson.type}</span>
                  {done && <span className="badge-success !text-[10px]">Done</span>}
                  <svg className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
