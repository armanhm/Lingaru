import { useState, useEffect, useCallback } from "react";
import { getRandomVocabulary } from "../../../api/content";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * One round of Word Scramble inline. Mirrors the simplest form of the
 * full-page version (`pages/WordScramble.jsx`): single word, shuffled
 * letter tiles, click to fill the answer slots, success when the answer
 * matches the target (accent-insensitive).
 *
 * No timer, no streak — those belong to the full session. We're just
 * giving the user a taste in the chat so they can decide whether to
 * jump into the focused page.
 */

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WordScrambleInline() {
  const [word, setWord] = useState(null);          // { french, english, ... } from /content/vocabulary/random/
  const [tiles, setTiles] = useState([]);          // [{ letter, used }]
  const [slots, setSlots] = useState([]);          // tile indices in placement order
  const [phase, setPhase] = useState("loading");   // loading | playing | correct | wrong
  const [loading, setLoading] = useState(true);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setPhase("loading");
    setSlots([]);
    try {
      const { data } = await getRandomVocabulary(1, { singleWord: true });
      // The endpoint returns a bare vocab object when count=1, an array
      // when count>1, and is sometimes wrapped in {results: [...]}.
      // Cover all three shapes defensively.
      const vocab =
        data && data.french
          ? data
          : Array.isArray(data)
            ? data[0]
            : data?.results?.[0] || null;
      if (!vocab || !vocab.french) {
        setWord(null);
      } else {
        setWord(vocab);
        const letters = vocab.french.replace(/\s+/g, "").split("");
        setTiles(shuffle(letters).map((letter) => ({ letter, used: false })));
        setPhase("playing");
      }
    } catch {
      setWord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  const placeTile = (i) => {
    if (phase !== "playing" || tiles[i].used) return;
    const next = [...tiles];
    next[i] = { ...next[i], used: true };
    setTiles(next);
    setSlots([...slots, i]);
  };

  const removeSlot = (j) => {
    if (phase !== "playing") return;
    const tileIdx = slots[j];
    const next = [...tiles];
    next[tileIdx] = { ...next[tileIdx], used: false };
    setTiles(next);
    setSlots(slots.filter((_, k) => k !== j));
  };

  // Check the answer when slots fill up
  useEffect(() => {
    if (phase !== "playing" || !word) return;
    const target = word.french.replace(/\s+/g, "");
    if (slots.length !== target.length) return;
    const guess = slots.map((i) => tiles[i].letter).join("");
    const correct = stripAccents(guess.toLowerCase()) === stripAccents(target.toLowerCase());
    setPhase(correct ? "correct" : "wrong");
  // We intentionally don't depend on `tiles` so a single click → place → check
  // doesn't double-fire. slots.length transitions trigger this.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, word, phase]);

  const wordLen = word ? word.french.replace(/\s+/g, "").length : 0;

  return (
    <InlineRoundWidget
      title="Word Scramble"
      emoji="🔤"
      loading={loading}
      empty={!word && !loading}
      emptyMessage="Pas de mot à mélanger pour le moment."
      emptyHint="Complète une leçon ou ajoute du vocabulaire pour débloquer ce jeu."
      emptyCtaTo="/topics"
      emptyCtaLabel="Voir les sujets →"
      score={phase === "correct" || phase === "wrong" ? { correct: phase === "correct" ? 1 : 0, total: 1 } : null}
      onAgain={phase === "correct" || phase === "wrong" ? loadRound : null}
      fullSessionTo="/mini-games/word-scramble"
    >
      {word && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 text-center">
            Reconstitue le mot français pour :
          </p>
          <p className="text-[18px] font-bold text-center text-surface-900 dark:text-surface-50">
            {word.english}
          </p>

          {/* Answer slots */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: wordLen }).map((_, j) => {
              const tileIdx = slots[j];
              const letter = tileIdx != null ? tiles[tileIdx].letter : "";
              const filled = !!letter;
              const colorClass =
                phase === "correct" && filled
                  ? "border-success-500 bg-success-50 dark:bg-success-900/30"
                  : phase === "wrong" && filled
                  ? "border-danger-500 bg-danger-50 dark:bg-danger-900/30"
                  : filled
                  ? "border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
                  : "border-dashed border-surface-300 dark:border-surface-600 bg-transparent";
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => removeSlot(j)}
                  disabled={!filled || phase !== "playing"}
                  className={`w-8 h-9 rounded-lg border-2 text-base font-bold flex items-center justify-center transition-all ${colorClass}`}
                >
                  {letter ? letter.toUpperCase() : ""}
                </button>
              );
            })}
          </div>

          {/* Letter tiles */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {tiles.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => placeTile(i)}
                disabled={t.used || phase !== "playing"}
                className={`w-8 h-9 rounded-lg text-base font-bold flex items-center justify-center transition-all ${
                  t.used
                    ? "bg-surface-100 dark:bg-surface-800 text-surface-300 dark:text-surface-600"
                    : "bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 border-2 border-surface-200 dark:border-surface-600 hover:border-[color:var(--mode-accent)] active:scale-95"
                }`}
              >
                {t.letter.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Result message */}
          {phase === "correct" && (
            <p className="text-[12px] text-center font-semibold text-success-700 dark:text-success-300">
              ✓ Bravo ! C'est bien <span className="font-bold">{word.french}</span>.
            </p>
          )}
          {phase === "wrong" && (
            <p className="text-[12px] text-center font-semibold text-danger-700 dark:text-danger-300">
              Pas tout à fait. La réponse était <span className="font-bold">{word.french}</span>.
            </p>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
