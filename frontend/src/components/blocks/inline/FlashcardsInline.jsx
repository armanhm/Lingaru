import { useState, useEffect, useCallback } from "react";
import { getSRSDueCards, submitSRSReview } from "../../../api/progress";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * Inline SRS flashcard. Show the French word; tap to reveal the
 * English meaning + example. Pick a difficulty rating (Again / Hard /
 * Good / Easy) which writes back via submitSRSReview, then load the
 * next due card. Same backend as /practice/srs.
 *
 * Quality scale (SM-2 ish): 1=again, 2=hard, 3=good, 4=easy.
 */

const RATINGS = [
  { quality: 1, label: "Encore", color: "border-danger-500 text-danger-700 dark:text-danger-300 hover:bg-danger-50 dark:hover:bg-danger-900/20" },
  { quality: 2, label: "Dur",    color: "border-warn-500 text-warn-700 dark:text-warn-300 hover:bg-warn-50 dark:hover:bg-warn-900/20" },
  { quality: 3, label: "Bon",    color: "border-info-500 text-info-700 dark:text-info-300 hover:bg-info-50 dark:hover:bg-info-900/20" },
  { quality: 4, label: "Facile", color: "border-success-500 text-success-700 dark:text-success-300 hover:bg-success-50 dark:hover:bg-success-900/20" },
];

export default function FlashcardsInline() {
  const [card, setCard] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(false);
  const [error, setError] = useState(null);

  const loadCard = useCallback(async () => {
    setLoading(true);
    setRevealed(false);
    setError(null);
    try {
      const { data } = await getSRSDueCards(1);
      const list = Array.isArray(data) ? data : data?.results || [];
      setCard(list[0] || null);
    } catch {
      setCard(null);
      setError("Impossible de charger les cartes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCard(); }, [loadCard]);

  const rate = async (quality) => {
    if (!card || rating) return;
    setRating(true);
    try {
      await submitSRSReview(card.id, quality);
    } catch {
      // Swallow; we still advance so the user isn't stuck on one card.
    } finally {
      setRating(false);
      loadCard();
    }
  };

  return (
    <InlineRoundWidget
      title="Flashcards SRS"
      emoji="🃏"
      loading={loading}
      empty={!card && !loading}
      emptyMessage={error || "Aucune carte à réviser pour le moment."}
      emptyEmoji={error ? "⚠️" : "✨"}
      emptyHint={error ? undefined : "Tes prochaines révisions arriveront bientôt."}
      // No score on flashcards (it's a review loop, not a quiz)
      onAgain={null}
      fullSessionTo="/practice/srs"
    >
      {card && (
        <div className="space-y-3">
          <div className="text-center space-y-1">
            <p className="text-[24px] font-extrabold text-surface-900 dark:text-surface-50">
              {card.french}
            </p>
            {card.pronunciation && (
              <p className="text-[12px] font-mono text-surface-500 dark:text-surface-400">
                /{card.pronunciation}/
              </p>
            )}
          </div>

          {!revealed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold mode-grad-bg text-white shadow-sm active:scale-95 transition-all focus-ring"
              >
                Révéler
              </button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900/40 py-3 px-3">
                <p className="text-[16px] font-bold text-surface-900 dark:text-surface-50">
                  {card.english}
                </p>
                {card.example_sentence && (
                  <p className="text-[12px] italic text-surface-600 dark:text-surface-400">
                    "{card.example_sentence}"
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {RATINGS.map((r) => (
                  <button
                    key={r.quality}
                    type="button"
                    onClick={() => rate(r.quality)}
                    disabled={rating}
                    className={`py-2 rounded-lg border-2 text-[11px] font-bold bg-white dark:bg-surface-800 transition-all active:scale-95 disabled:opacity-50 focus-ring ${r.color}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
