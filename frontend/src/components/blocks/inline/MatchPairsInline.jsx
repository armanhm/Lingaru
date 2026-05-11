import { useState, useEffect, useCallback } from "react";
import { getRandomVocabulary } from "../../../api/content";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * Inline Match Pairs: 4 French/English pairs (8 cards total), shuffled
 * into a 2x4 grid. Click two cards to attempt a match. Smaller and
 * preview-free vs. the full game (which has 6 pairs and a memorize
 * phase).
 */

const PAIR_COUNT = 4;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchPairsInline() {
  const [cards, setCards] = useState([]);          // [{id, pairId, lang, text, matched}]
  const [selected, setSelected] = useState([]);    // ids of currently picked unmatched cards
  const [wrongFlash, setWrongFlash] = useState([]);
  const [loading, setLoading] = useState(true);
  const matchedCount = cards.filter((c) => c.matched).length;
  const done = cards.length > 0 && matchedCount === cards.length;

  const loadRound = useCallback(async () => {
    setLoading(true);
    setSelected([]);
    setWrongFlash([]);
    try {
      const { data } = await getRandomVocabulary(PAIR_COUNT, { singleWord: true });
      const list = Array.isArray(data) ? data : data?.results || [];
      if (list.length < PAIR_COUNT) {
        setCards([]);
        return;
      }
      const pairs = [];
      list.slice(0, PAIR_COUNT).forEach((v, i) => {
        pairs.push({ id: `fr-${i}`, pairId: i, lang: "fr", text: v.french, matched: false });
        pairs.push({ id: `en-${i}`, pairId: i, lang: "en", text: v.english, matched: false });
      });
      setCards(shuffle(pairs));
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  const onCardClick = (card) => {
    if (card.matched || selected.includes(card.id) || selected.length >= 2 || wrongFlash.length) return;
    const next = [...selected, card.id];
    setSelected(next);
    if (next.length !== 2) return;
    // Resolve match
    const [a, b] = next.map((id) => cards.find((c) => c.id === id));
    if (a.pairId === b.pairId) {
      setCards((cs) => cs.map((c) => (c.id === a.id || c.id === b.id ? { ...c, matched: true } : c)));
      setSelected([]);
    } else {
      setWrongFlash([a.id, b.id]);
      setTimeout(() => {
        setWrongFlash([]);
        setSelected([]);
      }, 700);
    }
  };

  return (
    <InlineRoundWidget
      title="Match Pairs"
      emoji="🧩"
      loading={loading}
      empty={cards.length === 0 && !loading}
      emptyMessage="Pas assez de vocabulaire pour faire des paires."
      score={done ? { correct: PAIR_COUNT, total: PAIR_COUNT } : null}
      onAgain={done ? loadRound : null}
      fullSessionTo="/mini-games/match-pairs"
    >
      {cards.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 text-center">
            Associe chaque mot français à sa traduction
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {cards.map((c) => {
              const isSel = selected.includes(c.id);
              const isWrong = wrongFlash.includes(c.id);
              let cls = "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-50 hover:border-[color:var(--mode-accent)]";
              if (c.matched) cls = "border-success-500 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300 opacity-70 cursor-default";
              else if (isWrong) cls = "border-danger-500 bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300";
              else if (isSel) cls = "border-[color:var(--mode-accent)] bg-[color:var(--mode-shell-tint)]";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onCardClick(c)}
                  disabled={c.matched || done}
                  className={`min-h-[44px] px-1.5 py-1.5 rounded-lg border-2 text-[11px] font-semibold leading-tight transition-all active:scale-95 ${cls}`}
                >
                  {c.text}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-center text-surface-500 dark:text-surface-400">
            {matchedCount}/{cards.length / 2} paires
          </p>
          {done && (
            <p className="text-[12px] text-center font-semibold text-success-700 dark:text-success-300">
              ✓ Toutes les paires trouvées !
            </p>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
