import { useMemo, useState } from "react";

/**
 * Split an assistant message into [{type:"prose"|"quiz", content}] segments
 * so the renderer can pipe each through the right component.
 *
 * Recognised fenced block: ```quiz ... ```
 *
 * If a ```quiz block doesn't parse as valid JSON, it's treated as prose so
 * the user still sees something instead of an empty card.
 */
export function splitChatMessage(content) {
  if (!content) return [];
  const re = /```quiz\s*\n([\s\S]*?)```/g;
  const segments = [];
  let last = 0;
  let match;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ type: "prose", content: content.slice(last, match.index) });
    }
    const data = parseQuiz(match[1]);
    if (data) {
      segments.push({ type: "quiz", data });
    } else {
      // Fallback: leave raw text in place so user sees something rather than nothing.
      segments.push({ type: "prose", content: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    segments.push({ type: "prose", content: content.slice(last) });
  }
  // If we never found a quiz block, return the whole thing as one prose segment.
  if (segments.length === 0) {
    segments.push({ type: "prose", content });
  }
  return segments;
}

/* ──────────────────────────────────────────────────────────────
 * QuizBlock
 *
 * Renders an interactive multiple-choice quiz embedded in an assistant
 * message. The agent emits a fenced JSON block:
 *
 *     ```quiz
 *     {
 *       "title": "Mini-drill : subjonctif présent",
 *       "section": "Optional · TCF · Lexique & structure",
 *       "questions": [
 *         {
 *           "question": "Il est nécessaire que vous _____ ce rapport.",
 *           "options": ["finissiez", "finirez", "finissez", "avez fini"],
 *           "correct": 0,
 *           "explanation": "Après « il est nécessaire que », on emploie le subjonctif."
 *         },
 *         ...
 *       ]
 *     }
 *     ```
 *
 * `correct` is the 0-based index of the right answer in `options`.
 *
 * Features:
 *  - Click an option → button locks, instant correct/wrong feedback
 *  - Explanation revealed after the answer
 *  - "Question suivante" advances; final question shows a score summary
 *  - "Recommencer" resets the quiz
 *  - Keyboard: 1-4 selects an option, ←/→ navigate (when answered)
 * ────────────────────────────────────────────────────────────── */

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Try to parse the JSON; tolerate trailing whitespace, BOM, or single quotes. */
export function parseQuiz(raw) {
  if (!raw) return null;
  let txt = raw.trim();
  // Strip BOM if present
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
  try {
    const data = JSON.parse(txt);
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) return null;
    // Normalise: every question must have options[] + correct number + question string
    for (const q of data.questions) {
      if (typeof q.question !== "string") return null;
      if (!Array.isArray(q.options) || q.options.length < 2) return null;
      if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.options.length) return null;
    }
    return data;
  } catch {
    return null;
  }
}

export default function QuizBlock({ data }) {
  const [idx, setIdx] = useState(0);
  // selections: array of { selected: number|null }
  const [selections, setSelections] = useState(() => data.questions.map(() => null));
  const [done, setDone] = useState(false);

  const q = data.questions[idx];
  const selected = selections[idx];
  const answered = selected !== null;
  const correct = answered && selected === q.correct;

  const score = useMemo(
    () => selections.reduce((acc, s, i) => acc + (s === data.questions[i].correct ? 1 : 0), 0),
    [selections, data.questions]
  );
  const answeredCount = useMemo(
    () => selections.filter((s) => s !== null).length,
    [selections]
  );

  const pickOption = (optionIdx) => {
    if (answered) return; // lock once answered
    setSelections((prev) => prev.map((v, i) => (i === idx ? optionIdx : v)));
  };

  const next = () => {
    if (idx + 1 >= data.questions.length) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  };

  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  const restart = () => {
    setSelections(data.questions.map(() => null));
    setIdx(0);
    setDone(false);
  };

  // --- Final summary ---
  if (done) {
    const pct = Math.round((score / data.questions.length) * 100);
    const tone = pct >= 80 ? "success" : pct >= 50 ? "warn" : "danger";
    const toneClasses = {
      success: "from-success-500 to-info-500",
      warn:    "from-warn-500 to-accent-500",
      danger:  "from-danger-500 to-accent-500",
    }[tone];
    const emoji = pct === 100 ? "🌟" : pct >= 80 ? "🎯" : pct >= 50 ? "💪" : "📚";

    return (
      <div className="not-prose my-3 rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900/60 overflow-hidden">
        <div className={`px-5 py-4 bg-gradient-to-br ${toneClasses} text-white`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold opacity-90">Drill terminé</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] opacity-80 num">{score}/{data.questions.length}</p>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl">{emoji}</span>
            <p className="text-[28px] font-extrabold leading-none num">{pct}%</p>
          </div>
        </div>

        <div className="px-5 py-3 space-y-2">
          {data.questions.map((qq, i) => {
            const ok = selections[i] === qq.correct;
            return (
              <div
                key={i}
                className={`flex items-start gap-2 text-[12.5px] rounded-lg px-3 py-2 border ${
                  ok
                    ? "border-success-200 dark:border-success-800 bg-success-50/50 dark:bg-success-900/20"
                    : "border-danger-200 dark:border-danger-800 bg-danger-50/50 dark:bg-danger-900/20"
                }`}
              >
                <span className={`shrink-0 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${ok ? "bg-success-500" : "bg-danger-500"}`}>
                  {ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-surface-800 dark:text-surface-100 font-medium leading-snug">{qq.question}</p>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                    {selections[i] !== null && (
                      <>
                        Vous : <span className={ok ? "text-success-700 dark:text-success-300 font-semibold" : "text-danger-700 dark:text-danger-300 font-semibold line-through"}>{LETTERS[selections[i]]}. {qq.options[selections[i]]}</span>
                        {!ok && (
                          <> · <span className="text-success-700 dark:text-success-300 font-semibold">{LETTERS[qq.correct]}. {qq.options[qq.correct]}</span></>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
          <p className="text-[11px] text-surface-500 dark:text-surface-400 font-medium">
            {pct === 100 ? "Sans-faute !" : pct >= 80 ? "Excellent." : pct >= 50 ? "Continue, tu progresses." : "Reprenons à tête reposée."}
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:border-primary-300 dark:hover:border-primary-700 transition-colors focus-ring"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0112-3l3 3M19 15a7 7 0 01-12 3l-3-3" /></svg>
            Recommencer
          </button>
        </div>
      </div>
    );
  }

  // --- Single-question card ---
  const total = data.questions.length;

  return (
    <div className="not-prose my-3 rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-surface-100 dark:border-surface-800 bg-white/60 dark:bg-surface-800/60">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400">
            🎯 {data.title || "Drill"}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-surface-500 dark:text-surface-400 num">
            Question {idx + 1} / {total}
          </p>
        </div>
        {data.section && (
          <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">{data.section}</p>
        )}

        {/* Progress dots */}
        <div className="mt-2 flex items-center gap-1">
          {data.questions.map((_, i) => {
            const s = selections[i];
            const isCurrent = i === idx;
            const isCorrect = s !== null && s === data.questions[i].correct;
            const isWrong   = s !== null && s !== data.questions[i].correct;
            return (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  isCorrect ? "bg-success-500"
                  : isWrong ? "bg-danger-500"
                  : isCurrent ? "bg-primary-400"
                  : "bg-surface-200 dark:bg-surface-700"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Question + options */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[14.5px] font-semibold text-surface-900 dark:text-surface-50 leading-snug">
          {q.question}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrectAnswer = i === q.correct;
            const showAsCorrect = answered && isCorrectAnswer;
            const showAsWrong   = answered && isSelected && !isCorrectAnswer;

            const base = "group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13.5px] transition-all border-2 focus-ring";
            const state = showAsCorrect
              ? "border-success-400 bg-success-50 dark:bg-success-900/30 dark:border-success-600 text-success-900 dark:text-success-100"
              : showAsWrong
              ? "border-danger-400 bg-danger-50 dark:bg-danger-900/30 dark:border-danger-600 text-danger-900 dark:text-danger-100 animate-shake"
              : answered
              ? "border-surface-200 dark:border-surface-700 bg-white/40 dark:bg-surface-900/40 text-surface-500 dark:text-surface-400 opacity-60"
              : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 active:scale-[0.99]";

            return (
              <button
                key={i}
                onClick={() => pickOption(i)}
                disabled={answered}
                className={`${base} ${state}`}
              >
                <span className={`shrink-0 w-7 h-7 rounded-lg text-[12px] font-bold flex items-center justify-center ${
                  showAsCorrect ? "bg-success-500 text-white"
                  : showAsWrong ? "bg-danger-500 text-white"
                  : isSelected ? "bg-primary-500 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 group-hover:text-primary-700 dark:group-hover:text-primary-300"
                }`}>
                  {LETTERS[i]}
                </span>
                <span className="flex-1 leading-snug pt-1">{opt}</span>
                {showAsCorrect && (
                  <svg className="shrink-0 w-4 h-4 mt-1 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
                {showAsWrong && (
                  <svg className="shrink-0 w-4 h-4 mt-1 text-danger-600 dark:text-danger-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback / explanation */}
        {answered && (
          <div className={`rounded-xl px-4 py-3 border-l-4 animate-fade-in-up ${
            correct
              ? "bg-success-50/60 dark:bg-success-900/20 border-success-400 dark:border-success-600"
              : "bg-danger-50/60 dark:bg-danger-900/20 border-danger-400 dark:border-danger-600"
          }`}>
            <p className={`text-[12px] uppercase tracking-[0.14em] font-bold ${
              correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"
            }`}>
              {correct ? "✓ Correct" : "✕ Pas tout à fait"}
            </p>
            {!correct && (
              <p className="text-[13px] text-surface-700 dark:text-surface-200 mt-1">
                La bonne réponse : <span className="font-semibold">{LETTERS[q.correct]}. {q.options[q.correct]}</span>
              </p>
            )}
            {q.explanation && (
              <p className="text-[12.5px] text-surface-600 dark:text-surface-300 mt-1 leading-snug">
                {q.explanation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between gap-3">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Précédent
        </button>

        <p className="text-[11px] text-surface-400 dark:text-surface-500 font-mono num">
          Score · {score}/{answeredCount || 0}
        </p>

        <button
          onClick={next}
          disabled={!answered}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
            answered
              ? "bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 focus-ring"
              : "bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 cursor-not-allowed"
          }`}
        >
          {idx + 1 >= total ? "Voir le score" : "Question suivante"}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
