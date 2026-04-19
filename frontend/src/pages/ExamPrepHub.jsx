import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getExamHub } from "../api/examPrep";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard } from "../components/ui";

const SECTION_CONFIG = {
  CO: { name: "Compréhension orale", sub: "Listening Comprehension", emoji: "🎧", gradient: "from-info-500 via-info-600 to-primary-600" },
  CE: { name: "Compréhension écrite", sub: "Reading Comprehension", emoji: "📖", gradient: "from-success-500 via-success-600 to-info-600" },
  EE: { name: "Expression écrite",    sub: "Writing",                 emoji: "✏️", gradient: "from-primary-500 via-primary-600 to-purple-600" },
  EO: { name: "Expression orale",     sub: "Speaking",                emoji: "🎤", gradient: "from-accent-500 via-accent-600 to-danger-500" },
};

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function CEFRBar({ level }) {
  if (!level) return null;
  const idx = CEFR_LEVELS.indexOf(level);
  return (
    <div className="flex items-center gap-1 mt-3">
      {CEFR_LEVELS.map((l, i) => (
        <div key={l} className="flex-1">
          <div className={`h-1 rounded-full transition-all ${i <= idx ? "bg-gradient-to-r from-primary-500 to-primary-600" : "bg-surface-200 dark:bg-surface-800"}`} />
          <span className={`block text-[8px] mt-1 text-center font-semibold ${i === idx ? "text-primary-600 dark:text-primary-400" : "text-surface-400 dark:text-surface-600"}`}>
            {l}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ExamPrepHub() {
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExamHub().then((res) => setHub(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-7 space-y-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-10 w-72 rounded-lg" />
          <div className="skeleton h-4 w-96 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} height="h-48" />)}
        </div>
      </div>
    );
  }

  const sections = hub?.sections || [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="TEF / TCF exam prep"
        title="Exam Preparation"
        subtitle="Practice the four skills of the French proficiency exams — at your own pace."
        icon="🎓"
        gradient
      />

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {sections.map((s, i) => {
          const cfg = SECTION_CONFIG[s.code] || {};
          return (
            <Link
              key={s.code}
              to={`/exam-prep/${s.code}`}
              className="group relative overflow-hidden card card-hover focus-ring animate-fade-in-up p-0"
              style={staggerDelay(i, 70)}
            >
              {/* Gradient top band */}
              <div className={`h-1.5 bg-gradient-to-r ${cfg.gradient}`} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-14 h-14 bg-gradient-to-br ${cfg.gradient} rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    {cfg.emoji}
                  </div>
                  {s.estimated_cefr ? (
                    <span className="badge-primary">{s.estimated_cefr}</span>
                  ) : (
                    <span className="badge-neutral !text-[10px]">Not started</span>
                  )}
                </div>

                <h3 className="text-h3 text-surface-900 dark:text-surface-100 mb-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {cfg.name}
                </h3>
                <p className="text-caption text-surface-500 dark:text-surface-400">{cfg.sub}</p>

                <div className="mt-4 flex items-center justify-between text-caption">
                  <span className="text-surface-500 dark:text-surface-400">
                    <span className="font-bold text-surface-900 dark:text-surface-100">{s.exercise_count}</span> exercises
                  </span>
                  {s.sessions_completed > 0 && (
                    <span className="text-surface-500 dark:text-surface-400">
                      <span className="font-bold text-success-600 dark:text-success-400">{s.sessions_completed}</span> completed
                    </span>
                  )}
                </div>

                <CEFRBar level={s.estimated_cefr} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info panel */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-mesh opacity-30 pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-xl shadow-glow-primary">
            📋
          </div>
          <div>
            <h3 className="text-h4 text-surface-900 dark:text-surface-100">About TEF/TCF</h3>
            <p className="text-body text-surface-500 dark:text-surface-400 mt-1 leading-relaxed max-w-2xl">
              The <strong className="text-surface-700 dark:text-surface-300">TEF</strong> (Test d'évaluation de français) and <strong className="text-surface-700 dark:text-surface-300">TCF</strong> (Test de connaissance du français) are official French proficiency exams accepted for immigration, university admission, and citizenship applications. They evaluate four skills mapped to CEFR levels from A1 (beginner) to C2 (mastery).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
