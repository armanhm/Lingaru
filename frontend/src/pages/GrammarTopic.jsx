import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getGrammarTopic, startGrammarSession } from "../api/grammar";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";

export default function GrammarTopic() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getGrammarTopic(slug)
      .then((res) => setTopic(res.data))
      .catch(() => setError("Topic not found."))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleStartDrill = async () => {
    setStarting(true);
    try {
      const res = await startGrammarSession({ topicId: topic.id, mode: "drill" });
      sessionStorage.setItem(`grammar_session_${res.data.session_id}`, JSON.stringify(res.data));
      navigate(`/grammar/drill/${res.data.session_id}`);
    } catch {
      setError("Couldn't start drill — try again.");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-12 w-2/3 rounded-lg" />
        <SkeletonCard height="h-48" />
      </div>
    );
  }

  if (error || !topic) {
    return <EmptyState icon="⚠️" title="Topic not found" subtitle={error} tone="warn" action={
      <Link to="/grammar/library" className="btn-primary btn-md">Browse library</Link>
    } />;
  }

  const status = topic.status || "not_started";
  const masteryPct = topic.mastery || 0;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backTo="/grammar/library"
        backLabel="Library"
        eyebrow={`${topic.category_name} · ${topic.cefr_level}`}
        title={topic.title}
        subtitle={topic.summary}
        icon={topic.category_icon || "🧠"}
      />

      {/* Mastery bar */}
      {status !== "not_started" && (
        <div className="card p-4 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 capitalize">
              {status.replace("_", " ")}
            </span>
            <span className="text-h4 font-extrabold text-gradient-primary">{Math.round(masteryPct)}%</span>
          </div>
          <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                status === "mastered" ? "bg-gradient-to-r from-success-400 to-success-600"
                  : "bg-gradient-to-r from-primary-500 via-primary-400 to-accent-500"
              }`}
              style={{ width: `${masteryPct}%` }}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="card-elevated p-5 mb-6 flex items-center gap-4 animate-fade-in-up">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 text-white flex items-center justify-center text-2xl shadow-glow-primary">
          🎯
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-h4 text-surface-900 dark:text-surface-100">Ready to drill?</h3>
          <p className="text-caption text-surface-500 dark:text-surface-400">
            8 questions · ~3 minutes · earns XP and mastery
          </p>
        </div>
        <button onClick={handleStartDrill} disabled={starting} className="btn-primary btn-md shrink-0">
          {starting ? "Starting…" : "Start drill →"}
        </button>
      </div>

      {/* Explanation */}
      <section className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📖</span>
          <h2 className="text-h4 text-surface-900 dark:text-surface-100">Explanation</h2>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none
          prose-p:my-2 prose-p:text-surface-700 prose-p:dark:text-surface-300 prose-p:leading-relaxed
          prose-strong:text-surface-900 prose-strong:dark:text-surface-100
          prose-li:my-1 prose-ul:my-2">
          <ReactMarkdown>{topic.explanation}</ReactMarkdown>
        </div>
      </section>

      {/* Formula */}
      {topic.formula && (
        <section className="mb-5">
          <p className="section-label mb-2">Formula</p>
          <div className="rounded-2xl px-5 py-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/30 dark:to-purple-900/20 border border-primary-100 dark:border-primary-800/40 font-mono text-sm text-primary-800 dark:text-primary-200">
            {topic.formula}
          </div>
        </section>
      )}

      {/* Examples */}
      {topic.examples?.length > 0 && (
        <section className="mb-5">
          <p className="section-label mb-2">Examples</p>
          <div className="space-y-2">
            {topic.examples.map((ex, i) => (
              <div key={i} className="card p-3 flex items-start gap-3 animate-fade-in-up" style={staggerDelay(i, 50)}>
                <span className="shrink-0 w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">{ex.fr}</p>
                  <p className="text-caption text-surface-500 dark:text-surface-400 mt-0.5 italic">{ex.en}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Exceptions */}
      {topic.exceptions?.length > 0 && (
        <section className="mb-5">
          <p className="section-label mb-2">Exceptions</p>
          <div className="rounded-2xl bg-warn-50 dark:bg-warn-700/15 border border-warn-200 dark:border-warn-700/40 px-4 py-3">
            <ul className="space-y-1.5 list-disc list-inside marker:text-warn-500">
              {topic.exceptions.map((e, i) => (
                <li key={i} className="text-sm text-warn-800 dark:text-warn-200 leading-relaxed">{e}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Common mistakes */}
      {topic.common_mistakes?.length > 0 && (
        <section className="mb-5">
          <p className="section-label mb-2">Common mistakes</p>
          <div className="space-y-2">
            {topic.common_mistakes.map((m, i) => (
              <div key={i} className="card p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-danger-600 dark:text-danger-400 line-through font-medium">{m.wrong}</span>
                  <span className="text-surface-400">→</span>
                  <span className="text-success-600 dark:text-success-400 font-semibold">{m.right}</span>
                </div>
                {m.note && <p className="text-caption text-surface-500 dark:text-surface-400 mt-1.5">{m.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <div className="text-center mt-8">
        <button onClick={handleStartDrill} disabled={starting} className="btn-primary btn-lg">
          {starting ? "Starting…" : "Drill this topic →"}
        </button>
      </div>
    </div>
  );
}
