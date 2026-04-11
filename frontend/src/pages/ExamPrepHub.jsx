import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getExamHub } from "../api/examPrep";
import { staggerDelay } from "../hooks/useAnimations";

const SECTION_CONFIG = {
  CO: { name: "Compréhension orale", sub: "Listening Comprehension", emoji: "🎧", gradient: "from-info-500 to-blue-600", bg: "bg-info-50 dark:bg-info-700/20", border: "border-info-200 dark:border-info-800/50" },
  CE: { name: "Compréhension écrite", sub: "Reading Comprehension", emoji: "📖", gradient: "from-success-500 to-emerald-600", bg: "bg-success-50 dark:bg-success-700/20", border: "border-success-200 dark:border-success-800/50" },
  EE: { name: "Expression écrite", sub: "Writing", emoji: "✏️", gradient: "from-primary-500 to-violet-600", bg: "bg-primary-50 dark:bg-primary-700/20", border: "border-primary-200 dark:border-primary-800/50" },
  EO: { name: "Expression orale", sub: "Speaking", emoji: "🎤", gradient: "from-warn-500 to-amber-600", bg: "bg-warn-50 dark:bg-warn-700/20", border: "border-warn-200 dark:border-warn-800/50" },
};

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function CEFRBar({ level }) {
  if (!level) return null;
  const idx = CEFR_LEVELS.indexOf(level);
  return (
    <div className="flex items-center gap-1 mt-2">
      {CEFR_LEVELS.map((l, i) => (
        <div
          key={l}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i <= idx ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700"
          }`}
        />
      ))}
      <span className="text-xs font-bold text-primary-600 dark:text-primary-400 ml-1">{level}</span>
    </div>
  );
}

export default function ExamPrepHub() {
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExamHub()
      .then((res) => setHub(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const sections = hub?.sections || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100">Exam Preparation</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">Practice for TEF/TCF French proficiency exams</p>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s, i) => {
          const cfg = SECTION_CONFIG[s.code] || {};
          const isReady = s.code === "CE" || s.code === "CO";

          return (
            <div key={s.code} className="animate-fade-in-up" style={staggerDelay(i, 70)}>
              {isReady ? (
                <Link
                  to={`/exam-prep/${s.code}`}
                  className={`block rounded-2xl border ${cfg.border} ${cfg.bg} p-5 h-full hover:shadow-card-hover hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${cfg.gradient} rounded-xl flex items-center justify-center text-2xl shadow-sm`}>
                      {cfg.emoji}
                    </div>
                    {s.estimated_cefr && (
                      <span className="badge-primary">{s.estimated_cefr}</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">{cfg.name}</h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{cfg.sub}</p>

                  {s.exercise_count > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-surface-400 dark:text-surface-500">
                      <span>{s.exercise_count} exercises</span>
                      <span>{s.sessions_completed} completed</span>
                    </div>
                  )}

                  {s.estimated_cefr && <CEFRBar level={s.estimated_cefr} />}

                  {s.best_score_pct > 0 && (
                    <div className="mt-2 w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
                      <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${s.best_score_pct}%` }} />
                    </div>
                  )}
                </Link>
              ) : (
                <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5 h-full opacity-50`}>
                  <div className={`w-12 h-12 bg-gradient-to-br ${cfg.gradient} rounded-xl flex items-center justify-center text-2xl shadow-sm grayscale`}>
                    {cfg.emoji}
                  </div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 mt-3">{cfg.name}</h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{cfg.sub}</p>
                  <span className="inline-block mt-3 text-xs font-medium text-surface-400 dark:text-surface-500 bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded-full">Coming soon</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info card */}
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-bold text-surface-900 dark:text-surface-100">About TEF/TCF</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 leading-relaxed">
              The TEF (Test d'évaluation de français) and TCF (Test de connaissance du français) are official French proficiency exams.
              They evaluate your abilities across 4 skills: listening, reading, writing, and speaking.
              Your results are mapped to CEFR levels from A1 (beginner) to C2 (proficiency).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
