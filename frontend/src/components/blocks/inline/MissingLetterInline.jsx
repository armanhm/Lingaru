import { useState, useEffect, useCallback, useRef } from "react";
import { getRandomVocabulary } from "../../../api/content";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * Inline Missing Letter: a French word with ONE letter blanked out; the
 * user types it in. Simpler than the full game (which picks ~40% of
 * letters and chains rounds) — chat is meant to be quick.
 */

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function pickBlankIndex(word) {
  // Pick a single letter to blank, somewhere past the first character.
  if (word.length <= 2) return 1;
  return 1 + Math.floor(Math.random() * (word.length - 1));
}

export default function MissingLetterInline() {
  const [word, setWord] = useState(null);
  const [target, setTarget] = useState("");   // article-stripped form
  const [blankIdx, setBlankIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setGuess("");
    try {
      const { data } = await getRandomVocabulary(1, { singleWord: true });
      const list = Array.isArray(data) ? data : data?.results || [];
      const vocab = list[0] || null;
      if (!vocab || !vocab.french) {
        setWord(null);
      } else {
        const cleaned = vocab.french.replace(/^(l'|le |la |les |un |une |des )/i, "");
        setWord(vocab);
        setTarget(cleaned);
        setBlankIdx(pickBlankIndex(cleaned));
      }
    } catch {
      setWord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  useEffect(() => {
    if (!loading && word && !result) {
      // Auto-focus the input when a new round loads
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, word, result]);

  const submit = () => {
    if (!guess || result || !target) return;
    const expected = target[blankIdx] || "";
    const ok = stripAccents(guess.toLowerCase()) === stripAccents(expected.toLowerCase());
    setResult(ok ? "correct" : "wrong");
  };

  return (
    <InlineRoundWidget
      title="Missing Letter"
      emoji="🔡"
      loading={loading}
      empty={!word && !loading}
      emptyMessage="Pas de mots disponibles."
      score={result ? { correct: result === "correct" ? 1 : 0, total: 1 } : null}
      onAgain={result ? loadRound : null}
      fullSessionTo="/mini-games/missing-letter"
    >
      {word && target && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 text-center">
            Complète le mot ({word.english}) :
          </p>
          <div className="flex items-center justify-center gap-1 font-mono text-[22px] sm:text-[24px] font-extrabold text-surface-900 dark:text-surface-50">
            {target.split("").map((ch, i) => {
              if (i === blankIdx) {
                return (
                  <input
                    key={i}
                    ref={inputRef}
                    type="text"
                    maxLength={1}
                    value={result ? target[blankIdx] : guess}
                    onChange={(e) => !result && setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    disabled={!!result}
                    className={`w-10 h-12 text-center rounded-lg border-2 outline-none transition-all uppercase ${
                      result === "correct"
                        ? "border-success-500 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300"
                        : result === "wrong"
                        ? "border-danger-500 bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300"
                        : "border-[color:var(--mode-accent)] bg-white dark:bg-surface-800 focus:ring-2 focus:ring-[color:var(--mode-accent)]/30"
                    }`}
                  />
                );
              }
              return (
                <span key={i} className="px-0.5">{ch}</span>
              );
            })}
          </div>

          {!result && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={submit}
                disabled={!guess}
                className="px-4 py-1.5 rounded-lg text-[12px] font-bold mode-grad-bg text-white shadow-sm active:scale-95 transition-all disabled:opacity-40 focus-ring"
              >
                Valider
              </button>
            </div>
          )}

          {result === "correct" && (
            <p className="text-[12px] text-center font-semibold text-success-700 dark:text-success-300">
              ✓ Parfait, c'est bien <span className="font-bold">{target}</span> !
            </p>
          )}
          {result === "wrong" && (
            <p className="text-[12px] text-center font-semibold text-danger-700 dark:text-danger-300">
              La bonne lettre était <span className="font-bold uppercase">{target[blankIdx]}</span> → <span className="font-bold">{target}</span>
            </p>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
