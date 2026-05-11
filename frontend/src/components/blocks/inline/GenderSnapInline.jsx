import { useState, useEffect, useCallback } from "react";
import { getRandomVocabulary } from "../../../api/content";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * One round of Gender Snap inline: a French noun, pick le/la. Tap = answer.
 * The full-page version uses swipe gestures; here we just use two big
 * buttons so it works one-handed on mobile and is keyboard-friendly.
 */
export default function GenderSnapInline() {
  const [word, setWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);     // 'm' | 'f' | null
  const correct = picked && word ? picked === word.gender : null;

  const loadRound = useCallback(async () => {
    setLoading(true);
    setPicked(null);
    try {
      const { data } = await getRandomVocabulary(1, { singleWord: true, gendered: true });
      const list = Array.isArray(data) ? data : data?.results || [];
      const vocab = list[0] || null;
      if (!vocab || !vocab.french || !vocab.gender) {
        setWord(null);
      } else {
        setWord({
          ...vocab,
          displayText: vocab.french.replace(/^(l'|le |la |les |un |une |des )/i, ""),
        });
      }
    } catch {
      setWord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  return (
    <InlineRoundWidget
      title="Gender Snap"
      emoji="⚧"
      loading={loading}
      empty={!word && !loading}
      emptyMessage="Pas de noms genrés disponibles."
      score={picked ? { correct: correct ? 1 : 0, total: 1 } : null}
      onAgain={picked ? loadRound : null}
      fullSessionTo="/mini-games/gender-snap"
    >
      {word && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400">
              Quel est le genre de :
            </p>
            <p className="text-[26px] font-extrabold text-surface-900 dark:text-surface-50 capitalize">
              {word.displayText}
            </p>
            {word.english && (
              <p className="text-[12px] italic text-surface-500 dark:text-surface-400">
                {word.english}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "f", label: "la", color: "rose" },
              { val: "m", label: "le", color: "info" },
            ].map((opt) => {
              const isPicked = picked === opt.val;
              const isCorrect = picked && opt.val === word.gender;
              let cls = "border-surface-200 dark:border-surface-700 hover:border-[color:var(--mode-accent)] bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50";
              if (picked) {
                if (isCorrect) {
                  cls = "border-success-500 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300";
                } else if (isPicked) {
                  cls = "border-danger-500 bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300";
                } else {
                  cls = "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 opacity-50";
                }
              }
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => !picked && setPicked(opt.val)}
                  disabled={!!picked}
                  className={`py-3 rounded-xl border-2 text-[18px] font-extrabold transition-all active:scale-95 focus-ring ${cls}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {picked && (
            <p className={`text-[12px] text-center font-semibold ${correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"}`}>
              {correct
                ? `✓ Bien joué ! C'est ${word.gender === "m" ? "le" : "la"} ${word.displayText}.`
                : `La réponse était ${word.gender === "m" ? "le" : "la"} ${word.displayText}.`}
            </p>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
