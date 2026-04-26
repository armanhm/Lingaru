import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { submitGrammarAnswer, completeGrammarSession } from "../api/grammar";
import { useToast } from "../contexts/ToastContext";
import { TriumphHero, EmptyState } from "../components/ui";
import { markActivity, clearActivity } from "../hooks/useResumeSession";

const FEEDBACK_DELAY = 350;

/* ── Comparison helpers ─────────────────────────────────── */
function stripAccents(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function normalize(s) {
  return stripAccents((s || "").trim().toLowerCase()).replace(/\s+/g, " ").replace(/[.,!?;:]+$/, "");
}
function isAnswerCorrect(item, userAnswer) {
  const u = normalize(userAnswer);
  const c = normalize(item.correct_answer);
  if (u === c) return true;
  // For comma-separated answers (e.g. "ne, pas") allow both orders
  if (c.includes(",")) {
    const parts = c.split(",").map(p => normalize(p));
    const userParts = u.split(/[,\s]+/).map(p => normalize(p));
    return parts.every(p => userParts.includes(p));
  }
  return false;
}

/* ── MCQ ─────────────────────────────────────────────────── */
function MCQQuestion({ item, locked, selection, onSelect, feedback }) {
  return (
    <div>
      <p className="text-h3 text-surface-900 dark:text-surface-100 mb-5 leading-snug">{item.prompt}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(item.options || []).map((opt, i) => {
          const isSelected = selection === opt;
          const isCorrect = feedback && opt === item.correct_answer;
          const isWrongPick = feedback && isSelected && opt !== item.correct_answer;
          let cls = "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 hover:border-primary-300 dark:hover:border-primary-700 hover:-translate-y-0.5 hover:shadow-card-hover";
          if (feedback) {
            if (isCorrect) cls = "border-success-400 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-200 shadow-glow-success";
            else if (isWrongPick) cls = "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-700 dark:text-danger-200 animate-shake";
            else cls = "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-400 opacity-50";
          } else if (isSelected) {
            cls = "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 shadow-glow-primary";
          }
          return (
            <button
              key={i}
              onClick={() => !locked && onSelect(opt)}
              disabled={locked}
              className={`p-4 rounded-2xl border-2 text-left font-medium transition-all duration-150 focus-ring active:scale-[0.98] ${cls}`}
            >
              <span className="flex items-center gap-3">
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-caption font-bold ${
                  isSelected || (feedback && isCorrect) ? "bg-primary-500 text-white"
                    : "bg-surface-100 dark:bg-surface-700 text-surface-500"
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Text answer (fill_blank, transform, error_detect) ─── */
function TextQuestion({ item, locked, value, onChange, onSubmit, feedback }) {
  const ringClass = feedback
    ? feedback.is_correct
      ? "border-success-400 focus:border-success-500 focus:ring-success-500/30"
      : "border-danger-400 focus:border-danger-500 focus:ring-danger-500/30"
    : "";
  const labelByType = {
    fill_blank:   "Type the missing word(s)",
    transform:    "Rewrite the sentence",
    error_detect: "Type the wrong word from the sentence",
    reorder:      "Type the sentence in order",
  };
  return (
    <div>
      <p className="text-h3 text-surface-900 dark:text-surface-100 mb-2 leading-snug">{item.prompt}</p>
      <p className="text-caption text-surface-500 dark:text-surface-400 mb-4">{labelByType[item.type] || "Type your answer"}</p>
      <form onSubmit={(e) => { e.preventDefault(); !locked && value.trim() && onSubmit(); }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Your answer…"
          className={`input text-base ${ringClass}`}
        />
        {!locked && (
          <button type="submit" disabled={!value.trim()} className="btn-primary btn-md mt-3">
            Check
          </button>
        )}
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */

export default function GrammarDrill() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);  // [{item, isCorrect, userAnswer}]

  const [textValue, setTextValue] = useState("");
  const [mcqSelection, setMcqSelection] = useState(null);
  const [feedback, setFeedback] = useState(null);   // {is_correct} | null
  const [submitting, setSubmitting] = useState(false);

  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState(null);

  // Load session payload from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(`grammar_session_${sessionId}`);
    if (!stored) {
      setError("Session expired. Please start a new drill from the topic page.");
      return;
    }
    try {
      const payload = JSON.parse(stored);
      setData(payload);
      markActivity(`Grammar drill: ${payload.topic?.title || "in progress"}`, `/grammar/topics/${payload.topic?.slug || ""}`);
    } catch {
      setError("Couldn't load session.");
    }
  }, [sessionId]);

  const item = data?.items?.[idx];
  const total = data?.items?.length ?? 0;
  const progress = total > 0 ? (idx / total) * 100 : 0;

  const checkText = useCallback(() => {
    if (!item || feedback || submitting) return;
    const correct = isAnswerCorrect(item, textValue);
    handleAnswered(textValue, correct);
  }, [item, feedback, submitting, textValue]); // eslint-disable-line

  const handleSelectMcq = useCallback((opt) => {
    if (feedback || submitting) return;
    setMcqSelection(opt);
    const correct = normalize(opt) === normalize(item.correct_answer);
    handleAnswered(opt, correct);
  }, [feedback, submitting, item]); // eslint-disable-line

  const handleAnswered = (userAnswer, isCorrect) => {
    setSubmitting(true);
    setResults((prev) => [...prev, { item, isCorrect, userAnswer }]);
    if (isCorrect) setScore((s) => s + 1);
    submitGrammarAnswer(sessionId, item.id, userAnswer, isCorrect).catch(() => {});
    setTimeout(() => {
      setFeedback({ is_correct: isCorrect });
      setSubmitting(false);
    }, FEEDBACK_DELAY);
  };

  const handleNext = useCallback(async () => {
    setFeedback(null);
    setMcqSelection(null);
    setTextValue("");
    if (idx + 1 < total) {
      setIdx((i) => i + 1);
    } else {
      try {
        const res = await completeGrammarSession(sessionId);
        setSummary(res.data);
        setDone(true);
        clearActivity();
        if (res.data.xp_earned) showToast(`+${res.data.xp_earned} XP earned!`, "success");
      } catch {
        setError("Couldn't save your session. Please try again.");
      }
    }
  }, [idx, total, sessionId, showToast]);

  // Enter / Space to continue after feedback
  useEffect(() => {
    if (!feedback) return;
    const handler = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [feedback, handleNext]);

  if (error) {
    return <EmptyState icon="⚠️" title="Drill unavailable" subtitle={error} tone="warn" action={
      <Link to="/grammar" className="btn-primary btn-md">Back to Grammar</Link>
    } />;
  }

  if (!data || !item) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  /* ── Done ────────────────────────────────────────────── */
  if (done && summary) {
    const acc = summary.accuracy ?? 0;
    const emoji = acc === 100 ? "🌟" : acc >= 70 ? "🎉" : acc >= 50 ? "👍" : "💪";
    const headline = acc === 100 ? "Perfect drill!" : acc >= 70 ? "Strong work" : acc >= 50 ? "Keep going" : "Practice pays off";
    const subline = summary.new_status === "mastered"
      ? "Topic mastered — it'll resurface for review in a few weeks."
      : summary.mastery_delta > 0
        ? `Mastery climbed by ${summary.mastery_delta} points. Repeat the drill to push higher.`
        : "Repetition is the path. Try again — the next round will feel easier.";

    return (
      <TriumphHero
        emoji={emoji}
        headline={headline}
        subline={subline}
        tone={acc >= 70 ? "celebratory" : acc >= 50 ? "neutral" : "retry"}
        celebrate={acc >= 80}
        stats={[
          { value: `${summary.score}/${summary.total}`, label: "correct", color: "text-primary-600 dark:text-primary-400" },
          { value: `${Math.round(acc)}%`, label: "accuracy", color: acc >= 70 ? "text-success-600 dark:text-success-400" : "text-warn-600 dark:text-warn-400" },
          ...(summary.xp_earned ? [{ value: `+${summary.xp_earned}`, label: "XP earned", color: "text-accent-600 dark:text-accent-400" }] : []),
        ]}
        extra={
          summary.mastery_after != null && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-caption mb-1">
                <span className="text-surface-500 dark:text-surface-400">Mastery</span>
                <span className="font-bold text-surface-900 dark:text-surface-100">{Math.round(summary.mastery_after)}%</span>
              </div>
              <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-primary-500 via-accent-500 to-success-500 transition-all duration-1000"
                  style={{ width: `${Math.round(summary.mastery_after)}%` }}
                />
              </div>
            </div>
          )
        }
        actions={
          <>
            <Link to={`/grammar/topics/${data.topic.slug}`} className="btn-secondary btn-md">Topic page</Link>
            <button onClick={() => navigate(`/grammar/topics/${data.topic.slug}`)} className="btn-primary btn-md">
              Drill again
            </button>
          </>
        }
      />
    );
  }

  /* ── Live drill ──────────────────────────────────────── */
  const correctness = feedback ? feedback.is_correct : null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link to={`/grammar/topics/${data.topic?.slug || ""}`} className="text-caption font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 inline-flex items-center gap-1.5 focus-ring rounded-md -mx-1 px-1 py-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Exit drill
        </Link>
        <div className="flex items-center gap-2">
          <span className="badge-primary !text-[10px]">{data.topic?.cefr_level}</span>
          <span className="text-caption text-surface-500 dark:text-surface-400 font-medium">
            {idx + 1} / {total}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-1.5 mb-6 overflow-hidden">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent-500 transition-all duration-500"
             style={{ width: `${progress}%` }} />
      </div>

      {/* Topic title */}
      <p className="eyebrow-primary mb-1">Drilling</p>
      <h1 className="text-h2 text-surface-900 dark:text-surface-100 mb-6">{data.topic?.title}</h1>

      {/* Question card */}
      <div
        className={`card p-6 mb-4 transition-all duration-300 ${
          correctness === true ? "ring-2 ring-success-500/50"
            : correctness === false ? "ring-2 ring-danger-500/50"
            : ""
        }`}
        key={item.id}
      >
        {item.type === "mcq" ? (
          <MCQQuestion item={item} locked={!!feedback || submitting} selection={mcqSelection} onSelect={handleSelectMcq} feedback={feedback} />
        ) : (
          <TextQuestion item={item} locked={!!feedback || submitting} value={textValue} onChange={setTextValue} onSubmit={checkText} feedback={feedback} />
        )}
      </div>

      {/* Feedback panel */}
      {feedback && (
        <div className={`card p-4 mb-4 animate-fade-in-up ${
          feedback.is_correct
            ? "border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-700/15"
            : "border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-700/15"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{feedback.is_correct ? "✅" : "❌"}</span>
            <span className={`font-bold ${feedback.is_correct ? "text-success-700 dark:text-success-200" : "text-danger-700 dark:text-danger-200"}`}>
              {feedback.is_correct ? "Correct!" : "Not quite"}
            </span>
          </div>
          {!feedback.is_correct && (
            <p className="text-sm text-surface-700 dark:text-surface-300">
              The answer was <strong className="text-surface-900 dark:text-surface-100">{item.correct_answer}</strong>
            </p>
          )}
          {item.explanation && (
            <p className="text-caption text-surface-600 dark:text-surface-400 mt-1.5">{item.explanation}</p>
          )}
          <button onClick={handleNext} className="btn-primary btn-sm mt-3">
            {idx + 1 < total ? "Next →" : "See results"}
          </button>
        </div>
      )}

      <p className="text-caption text-center text-surface-400 dark:text-surface-500 mt-4">
        Press <kbd className="kbd">Enter</kbd> to continue after answering
      </p>
    </div>
  );
}
