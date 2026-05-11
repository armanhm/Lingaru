import { useState, useEffect, useCallback } from "react";
import { getRandomVocabulary } from "../../../api/content";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * Inline Speed Round (single question variant): show a French word and a
 * proposed English translation. User taps ✓ Correct or ✗ Wrong.
 *
 * The full-page version chains 12 questions with a global timer; inline
 * we do exactly one so it fits in chat.
 */

const WRONG_RATIO = 0.5;   // 50% of inline rounds present a mismatched translation

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SpeedRoundInline() {
  const [question, setQuestion] = useState(null);   // { french, shownTranslation, isCorrect, real }
  const [picked, setPicked] = useState(null);       // 'yes' | 'no' | null
  const [loading, setLoading] = useState(true);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setPicked(null);
    try {
      const { data } = await getRandomVocabulary(4, { singleWord: true });
      const list = Array.isArray(data) ? data : data?.results || [];
      if (list.length < 2) {
        setQuestion(null);
        return;
      }
      const pool = shuffle(list);
      const word = pool[0];
      const showWrong = Math.random() < WRONG_RATIO;
      const others = pool.slice(1).filter((w) => w.english !== word.english);
      const shown = showWrong && others.length ? others[0].english : word.english;
      setQuestion({
        french: word.french,
        shownTranslation: shown,
        isCorrect: shown === word.english,
        real: word.english,
      });
    } catch {
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  const pick = (choice) => {
    if (picked) return;
    setPicked(choice);
  };

  // After the user picks, did they get it right?
  const correct = picked
    ? (picked === "yes" && question.isCorrect) || (picked === "no" && !question.isCorrect)
    : null;

  return (
    <InlineRoundWidget
      title="Speed Round"
      emoji="⚡"
      loading={loading}
      empty={!question && !loading}
      emptyMessage="Pas assez de vocabulaire pour générer une question."
      score={picked ? { correct: correct ? 1 : 0, total: 1 } : null}
      onAgain={picked ? loadRound : null}
      fullSessionTo="/mini-games/speed-round"
    >
      {question && (
        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 text-center">
            La traduction est-elle correcte ?
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-[16px] font-bold text-surface-900 dark:text-surface-50">
              {question.french}
            </span>
            <span className="text-surface-400">=</span>
            <span className={`px-3 py-1.5 rounded-lg text-[16px] font-bold ${
              picked
                ? question.isCorrect
                  ? "bg-success-100 dark:bg-success-900/40 text-success-800 dark:text-success-200"
                  : "bg-danger-100 dark:bg-danger-900/40 text-danger-800 dark:text-danger-200"
                : "bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-50"
            }`}>
              {question.shownTranslation}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => pick("yes")}
              disabled={!!picked}
              className={`py-2.5 rounded-xl border-2 text-[14px] font-extrabold transition-all active:scale-95 focus-ring ${
                !picked
                  ? "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 hover:border-success-400"
                  : picked === "yes"
                  ? (correct ? "border-success-500 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300" : "border-danger-500 bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300")
                  : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 opacity-50"
              }`}
            >
              ✓ Correct
            </button>
            <button
              type="button"
              onClick={() => pick("no")}
              disabled={!!picked}
              className={`py-2.5 rounded-xl border-2 text-[14px] font-extrabold transition-all active:scale-95 focus-ring ${
                !picked
                  ? "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 hover:border-danger-400"
                  : picked === "no"
                  ? (correct ? "border-success-500 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300" : "border-danger-500 bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300")
                  : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 opacity-50"
              }`}
            >
              ✗ Faux
            </button>
          </div>

          {picked && !correct && (
            <p className="text-[12px] text-center font-semibold text-danger-700 dark:text-danger-300">
              La vraie traduction de <span className="font-bold">{question.french}</span> est <span className="font-bold">{question.real}</span>.
            </p>
          )}
          {picked && correct && (
            <p className="text-[12px] text-center font-semibold text-success-700 dark:text-success-300">
              ✓ Bonne réponse !
            </p>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
