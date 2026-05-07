import { useMemo, useState } from "react";

/**
 * Polymorphic quiz block — handles all five `kind`s defined by
 * apps.assistant.blocks: mcq, multi, true_false, matching, short.
 *
 * One question at a time, sequential progress dots, instant feedback +
 * explanation, score summary at the end with restart. Each kind has its
 * own answer surface but shares the shell + summary, so styling stays
 * coherent.
 *
 * Distinct from the older `<QuizBlock>` (still used by lesson
 * ` ```quiz ` fences); they coexist intentionally.
 */

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// ── Per-kind correctness ─────────────────────────────────────────
function isCorrect(question, answer) {
  if (answer == null) return false;
  switch (question.kind) {
    case "mcq":
      return answer === question.correct;
    case "multi": {
      if (!Array.isArray(answer) || !Array.isArray(question.correct)) return false;
      const a = [...answer].sort();
      const b = [...question.correct].sort();
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    case "true_false":
      return answer === question.correct;
    case "matching": {
      // answer: { [pairIndex]: chosenRightIndex }
      if (typeof answer !== "object") return false;
      return question.pairs.every((_, i) => Number(answer[i]) === i);
    }
    case "short":
      if (typeof answer !== "string") return false;
      return question.accept.some(
        (a) => a.trim().toLowerCase() === answer.trim().toLowerCase(),
      );
    default:
      return false;
  }
}

function defaultAnswer(kind) {
  if (kind === "multi") return [];
  if (kind === "matching") return {};
  if (kind === "short") return "";
  return null;
}

// ── Renderers per kind ──────────────────────────────────────────
function McqAnswer({ question, answer, onChange, locked }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {question.options.map((opt, i) => {
        const isSelected = answer === i;
        const showCorrect = locked && i === question.correct;
        const showWrong = locked && isSelected && i !== question.correct;
        return (
          <OptionButton
            key={i}
            letter={LETTERS[i]}
            label={opt}
            selected={isSelected}
            disabled={locked}
            onClick={() => onChange(i)}
            tone={showCorrect ? "correct" : showWrong ? "wrong" : locked ? "muted" : "neutral"}
          />
        );
      })}
    </div>
  );
}

function MultiAnswer({ question, answer, onChange, locked }) {
  const sel = Array.isArray(answer) ? answer : [];
  const toggle = (i) => {
    onChange(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]);
  };
  const correctSet = new Set(question.correct || []);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {question.options.map((opt, i) => {
        const isSelected = sel.includes(i);
        const isCorrectAns = correctSet.has(i);
        let tone = "neutral";
        if (locked) {
          if (isCorrectAns && isSelected) tone = "correct";
          else if (isCorrectAns && !isSelected) tone = "missed";
          else if (!isCorrectAns && isSelected) tone = "wrong";
          else tone = "muted";
        }
        return (
          <OptionButton
            key={i}
            letter={LETTERS[i]}
            label={opt}
            selected={isSelected}
            disabled={locked}
            onClick={() => toggle(i)}
            tone={tone}
            checkbox
          />
        );
      })}
    </div>
  );
}

function TrueFalseAnswer({ question, answer, onChange, locked }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((value) => {
        const isSelected = answer === value;
        const showCorrect = locked && value === question.correct;
        const showWrong = locked && isSelected && value !== question.correct;
        const tone = showCorrect ? "correct" : showWrong ? "wrong" : locked ? "muted" : "neutral";
        return (
          <OptionButton
            key={String(value)}
            letter={value ? "✓" : "✕"}
            label={value ? "Vrai" : "Faux"}
            selected={isSelected}
            disabled={locked}
            onClick={() => onChange(value)}
            tone={tone}
          />
        );
      })}
    </div>
  );
}

function MatchingAnswer({ question, answer, onChange, locked }) {
  // answer is { [leftIndex]: rightIndex }
  const choice = answer || {};
  const used = new Set(Object.values(choice));
  return (
    <div className="space-y-2">
      {question.pairs.map((pair, i) => {
        const chosen = choice[i];
        const correctRight = i;
        let tone = "neutral";
        if (locked) {
          tone = chosen === correctRight ? "correct" : "wrong";
        }
        return (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-colors ${
              tone === "correct"
                ? "border-success-400 bg-success-50 dark:bg-success-900/30 dark:border-success-600"
                : tone === "wrong"
                ? "border-danger-400 bg-danger-50 dark:bg-danger-900/30 dark:border-danger-600"
                : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900"
            }`}
          >
            <span className="text-[13.5px] font-semibold text-surface-900 dark:text-surface-50 flex-1">
              {pair.left}
            </span>
            <svg className="w-3 h-3 text-surface-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <select
              value={chosen ?? ""}
              disabled={locked}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                onChange({ ...choice, [i]: v });
              }}
              className="flex-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[13px] px-2 py-1.5 focus-ring disabled:opacity-60"
            >
              <option value="">— choisir —</option>
              {question.pairs.map((p, j) => (
                <option key={j} value={j} disabled={!locked && used.has(j) && chosen !== j}>
                  {p.right}
                </option>
              ))}
            </select>
            {locked && tone === "wrong" && (
              <span className="text-[11px] text-success-700 dark:text-success-300 font-semibold whitespace-nowrap">
                ↳ {question.pairs[correctRight].right}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShortAnswer({ question, answer, onChange, locked }) {
  const value = typeof answer === "string" ? answer : "";
  const ok = locked && question.accept.some((a) => a.trim().toLowerCase() === value.trim().toLowerCase());
  return (
    <div>
      <input
        type="text"
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tapez votre réponse…"
        className={`w-full rounded-xl border-2 px-3 py-2.5 text-[14px] font-sans bg-white dark:bg-surface-900 transition-colors focus-ring disabled:opacity-90 ${
          locked
            ? ok
              ? "border-success-400 dark:border-success-600 text-success-900 dark:text-success-100"
              : "border-danger-400 dark:border-danger-600 text-danger-900 dark:text-danger-100"
            : "border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-50"
        }`}
      />
      {locked && !ok && (
        <p className="mt-1.5 text-[12px] text-success-700 dark:text-success-300">
          Réponses acceptées : <span className="font-semibold">{question.accept.join(" / ")}</span>
        </p>
      )}
    </div>
  );
}

// Shared option button (mcq / multi / true_false)
function OptionButton({ letter, label, selected, disabled, onClick, tone, checkbox }) {
  const stateClass = {
    correct: "border-success-400 bg-success-50 dark:bg-success-900/30 dark:border-success-600 text-success-900 dark:text-success-100",
    wrong: "border-danger-400 bg-danger-50 dark:bg-danger-900/30 dark:border-danger-600 text-danger-900 dark:text-danger-100",
    missed: "border-success-300 dark:border-success-700 bg-success-50/40 dark:bg-success-900/15 text-success-800 dark:text-success-200",
    muted: "border-surface-200 dark:border-surface-700 bg-white/40 dark:bg-surface-900/40 text-surface-500 dark:text-surface-400 opacity-60",
    neutral: selected
      ? "border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100"
      : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 active:scale-[0.99]",
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13.5px] transition-all border-2 focus-ring ${stateClass}`}
    >
      <span
        className={`shrink-0 w-7 h-7 ${checkbox ? "rounded-md" : "rounded-lg"} text-[12px] font-bold flex items-center justify-center ${
          tone === "correct" || tone === "missed"
            ? "bg-success-500 text-white"
            : tone === "wrong"
            ? "bg-danger-500 text-white"
            : selected
            ? "bg-primary-500 text-white"
            : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300"
        }`}
      >
        {letter}
      </span>
      <span className="flex-1 leading-snug pt-1">{label}</span>
    </button>
  );
}

// ── Main ────────────────────────────────────────────────────────
export default function QuizBlockV2({ block }) {
  // Hooks first (rules of hooks). Early-out below uses `questions.length`.
  const questions = block.questions || [];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => questions.map((q) => defaultAnswer(q.kind)));
  const [locked, setLocked] = useState(() => questions.map(() => false));
  const [done, setDone] = useState(false);

  const score = useMemo(
    () => answers.reduce((acc, ans, i) => acc + (locked[i] && isCorrect(questions[i], ans) ? 1 : 0), 0),
    [answers, locked, questions],
  );

  if (questions.length === 0) return null;

  const q = questions[idx];
  const isLocked = locked[idx];
  const answer = answers[idx];
  const correct = isLocked && isCorrect(q, answer);

  const setAnswer = (val) => setAnswers((prev) => prev.map((v, i) => (i === idx ? val : v)));

  const submit = () => {
    setLocked((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };
  const next = () => {
    if (idx + 1 >= questions.length) setDone(true);
    else setIdx(idx + 1);
  };
  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
  };
  const restart = () => {
    setAnswers(questions.map((q) => defaultAnswer(q.kind)));
    setLocked(questions.map(() => false));
    setIdx(0);
    setDone(false);
  };

  // ── Final summary ──────────────────────────────────────────
  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    const tone = pct >= 80 ? "success" : pct >= 50 ? "warn" : "danger";
    const toneClasses = {
      success: "from-success-500 to-info-500",
      warn: "from-warn-500 to-accent-500",
      danger: "from-danger-500 to-accent-500",
    }[tone];
    const emoji = pct === 100 ? "🌟" : pct >= 80 ? "🎯" : pct >= 50 ? "💪" : "📚";

    return (
      <div className="not-prose rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900/60 overflow-hidden">
        <div className={`px-5 py-4 bg-gradient-to-br ${toneClasses} text-white`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold opacity-90">
              Quiz terminé
            </p>
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] opacity-80">
              {score}/{questions.length}
            </p>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl">{emoji}</span>
            <p className="text-[28px] font-extrabold leading-none">{pct}%</p>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center justify-between">
          <p className="text-[11px] text-surface-500 dark:text-surface-400 font-medium">
            {pct === 100
              ? "Sans-faute !"
              : pct >= 80
              ? "Excellent."
              : pct >= 50
              ? "Continue, tu progresses."
              : "Reprenons à tête reposée."}
          </p>
          <button
            onClick={restart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:border-primary-300 dark:hover:border-primary-700 transition-colors focus-ring"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0112-3l3 3M19 15a7 7 0 01-12 3l-3-3" />
            </svg>
            Recommencer
          </button>
        </div>
      </div>
    );
  }

  // ── Single-question card ──────────────────────────────────
  const total = questions.length;

  return (
    <div className="not-prose rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-surface-100 dark:border-surface-800 bg-white/60 dark:bg-surface-800/60">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400">
            🎯 Quiz · {kindLabel(q.kind)}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-surface-500 dark:text-surface-400">
            {idx + 1} / {total}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-1">
          {questions.map((_, i) => {
            const lockedI = locked[i];
            const correctI = lockedI && isCorrect(questions[i], answers[i]);
            return (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  lockedI && correctI
                    ? "bg-success-500"
                    : lockedI
                    ? "bg-danger-500"
                    : i === idx
                    ? "bg-primary-400"
                    : "bg-surface-200 dark:bg-surface-700"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Question + answer */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[14.5px] font-semibold text-surface-900 dark:text-surface-50 leading-snug">
          {q.prompt}
        </p>

        {q.kind === "mcq" && <McqAnswer question={q} answer={answer} onChange={setAnswer} locked={isLocked} />}
        {q.kind === "multi" && <MultiAnswer question={q} answer={answer} onChange={setAnswer} locked={isLocked} />}
        {q.kind === "true_false" && <TrueFalseAnswer question={q} answer={answer} onChange={setAnswer} locked={isLocked} />}
        {q.kind === "matching" && <MatchingAnswer question={q} answer={answer} onChange={setAnswer} locked={isLocked} />}
        {q.kind === "short" && <ShortAnswer question={q} answer={answer} onChange={setAnswer} locked={isLocked} />}

        {isLocked && (
          <div
            className={`rounded-xl px-4 py-3 border-l-4 animate-fade-in-up ${
              correct
                ? "bg-success-50/60 dark:bg-success-900/20 border-success-400 dark:border-success-600"
                : "bg-danger-50/60 dark:bg-danger-900/20 border-danger-400 dark:border-danger-600"
            }`}
          >
            <p
              className={`text-[12px] uppercase tracking-[0.14em] font-bold ${
                correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"
              }`}
            >
              {correct ? "✓ Correct" : "✕ Pas tout à fait"}
            </p>
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
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Précédent
        </button>

        {!isLocked ? (
          <button
            onClick={submit}
            disabled={!isAnswered(q, answer)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
              isAnswered(q, answer)
                ? "bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 focus-ring"
                : "bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 cursor-not-allowed"
            }`}
          >
            Vérifier
          </button>
        ) : (
          <button
            onClick={next}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 focus-ring"
          >
            {idx + 1 >= total ? "Voir le score" : "Suivant"}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function isAnswered(q, answer) {
  switch (q.kind) {
    case "mcq":
    case "true_false":
      return answer !== null && answer !== undefined;
    case "multi":
      return Array.isArray(answer) && answer.length > 0;
    case "matching":
      return (
        answer && q.pairs.every((_, i) => answer[i] !== null && answer[i] !== undefined)
      );
    case "short":
      return typeof answer === "string" && answer.trim() !== "";
    default:
      return false;
  }
}

function kindLabel(kind) {
  return {
    mcq: "Choix multiple",
    multi: "Plusieurs réponses",
    true_false: "Vrai / faux",
    matching: "Associer",
    short: "Réponse courte",
  }[kind] || "Quiz";
}
