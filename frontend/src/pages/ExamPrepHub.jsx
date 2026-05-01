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

      {/* ── Exam comparison ──────────────────────────────────── */}
      <div className="mb-3">
        <p className="eyebrow-primary mb-1">About the exams</p>
        <h2 className="text-h3 text-surface-900 dark:text-surface-100">TEF vs TCF — pick the right one</h2>
        <p className="text-caption text-surface-500 dark:text-surface-400 mt-1">
          Both are official, both map to the CEFR (A1 → C2). They differ in who issues them, who accepts them, and how they're scored.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TEF card */}
        <div className="card p-0 overflow-hidden relative animate-fade-in-up">
          <div className="h-1.5 bg-gradient-to-r from-info-500 via-primary-500 to-purple-600" />
          <div className="p-5">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-info-500 to-primary-600 text-white flex items-center justify-center text-lg shadow-sm">🇨🇦</span>
                <div>
                  <h3 className="text-h4 text-surface-900 dark:text-surface-100">TEF</h3>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-tight">Test d'évaluation de français</p>
                </div>
              </div>
              <span className="badge-info !text-[10px]">CCI Paris</span>
            </div>

            <p className="text-caption text-surface-700 dark:text-surface-200 leading-relaxed mb-4">
              Issued by the Paris Île-de-France Chamber of Commerce. <strong>Most often used for Canadian immigration</strong> (TEF Canada / TEFAQ for Quebec) and as proof of language for work or university in France.
            </p>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Format</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">5 modules · ~3.5 h total</dd>

              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Scoring</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">/900 per skill · NCLC 1–12</dd>

              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Validity</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">2 years</dd>

              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Best for</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">Canada PR · Express Entry</dd>
            </dl>
          </div>
        </div>

        {/* TCF card */}
        <div className="card p-0 overflow-hidden relative animate-fade-in-up" style={staggerDelay(1, 70)}>
          <div className="h-1.5 bg-gradient-to-r from-accent-500 via-warn-500 to-danger-500" />
          <div className="p-5">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-danger-500 text-white flex items-center justify-center text-lg shadow-sm">🇫🇷</span>
                <div>
                  <h3 className="text-h4 text-surface-900 dark:text-surface-100">TCF</h3>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-tight">Test de connaissance du français</p>
                </div>
              </div>
              <span className="badge-accent !text-[10px]">France Éducation</span>
            </div>

            <p className="text-caption text-surface-700 dark:text-surface-200 leading-relaxed mb-4">
              Issued by France Éducation international (the French ministry's testing arm). <strong>Standard for French nationality, university admission</strong>, and Quebec immigration (TCF Québec / TCF Canada).
            </p>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Format</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">5 épreuves · ~3 h total</dd>

              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Scoring</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">/699 total · A1–C2</dd>

              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Validity</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">2 years</dd>

              <dt className="text-surface-500 dark:text-surface-400 font-mono uppercase tracking-wider text-[10px]">Best for</dt>
              <dd className="text-surface-800 dark:text-surface-200 font-medium">Naturalisation · Université</dd>
            </dl>
          </div>
        </div>
      </div>

      {/* Quick CEFR primer */}
      <div className="mt-6 rounded-2xl border border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900/40 p-5">
        <p className="eyebrow-primary mb-2">CEFR levels — what each means</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { level: "A1", label: "Beginner",        desc: "Basic phrases, slow speech" },
            { level: "A2", label: "Elementary",      desc: "Simple, familiar topics" },
            { level: "B1", label: "Intermediate",    desc: "Travel, work, opinions" },
            { level: "B2", label: "Upper Int.",      desc: "Complex texts, fluent" },
            { level: "C1", label: "Advanced",        desc: "Nuance, professional" },
            { level: "C2", label: "Mastery",         desc: "Native-like precision" },
          ].map((l, i) => (
            <div key={l.level} className="rounded-xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-3 animate-fade-in-up" style={staggerDelay(i, 40)}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[15px] font-extrabold tracking-tight text-primary-600 dark:text-primary-400 num">{l.level}</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-surface-400 dark:text-surface-500">{l.label}</span>
              </div>
              <p className="text-[11.5px] text-surface-600 dark:text-surface-300 leading-snug">{l.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
