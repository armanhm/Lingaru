import { Link } from "react-router-dom";

/**
 * Shared shell for all inline practice widgets in the agentic chat.
 *
 * Each round happens entirely in this card — load → answer → result →
 * (optionally) next round → ... With Option A semantics: the next round
 * mutates this card in place rather than stacking new ones below.
 *
 * Children render the body of the current state. The shell handles:
 *  - the consistent header (emoji + title + score chip if scored)
 *  - the consistent footer ("Encore" + "Ouvrir session complète →")
 *  - the loading + empty-state skeletons
 *
 * Score is optional. Pass score={{correct, total}} only on result-phase.
 */
export default function InlineRoundWidget({
  title,
  emoji,
  loading = false,
  empty = false,
  emptyMessage = "Aucune donnée disponible pour l'instant.",
  emptyEmoji = "🌱",
  emptyHint,                     // optional second-line nudge (e.g. "Try Topics")
  emptyCtaTo,                    // optional deep-link for the empty state CTA
  emptyCtaLabel,
  score = null,                  // { correct, total } when showing a result
  fullSessionTo,                 // deep-link route (e.g. "/mini-games/word-scramble")
  fullSessionLabel = "Ouvrir session complète →",
  onAgain,                       // () => void, shows "Encore" button when provided
  againLabel = "Encore",
  children,
}) {
  return (
    <div className="card relative overflow-hidden border-2 border-surface-100 dark:border-surface-700/60">
      {/* Mode-tinted accent bar so the card visually belongs to the active persona */}
      <div className="absolute inset-x-0 top-0 h-1 mode-grad-band" />

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-surface-100 dark:border-surface-700/50">
        {emoji && (
          <span className="w-9 h-9 rounded-xl mode-grad-bg text-white flex items-center justify-center text-lg shadow-sm shrink-0">
            {emoji}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-surface-500 dark:text-surface-400">
            {title}
          </p>
        </div>
        {score && (
          <span className="text-[12px] font-mono font-bold mode-accent-text shrink-0">
            {score.correct}/{score.total}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-surface-500 dark:text-surface-400">
            <span className="w-2 h-2 rounded-full mode-grad-bg animate-pulse" />
            Chargement…
          </div>
        ) : empty ? (
          <div className="py-3 flex flex-col items-center text-center gap-2">
            <span className="text-2xl" aria-hidden>{emptyEmoji}</span>
            <p className="text-[13px] text-surface-700 dark:text-surface-200 font-medium">
              {emptyMessage}
            </p>
            {emptyHint && (
              <p className="text-[12px] text-surface-500 dark:text-surface-400 max-w-xs">
                {emptyHint}
              </p>
            )}
            {emptyCtaTo && emptyCtaLabel && (
              <Link
                to={emptyCtaTo}
                className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold mode-accent-text hover:underline focus-ring rounded px-2 py-1"
              >
                {emptyCtaLabel}
              </Link>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer (only when not loading/empty) */}
      {!loading && !empty && (onAgain || fullSessionTo) && (
        <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700/50 flex items-center justify-between gap-3 flex-wrap bg-surface-50/60 dark:bg-surface-900/40">
          {onAgain ? (
            <button
              type="button"
              onClick={onAgain}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold mode-grad-bg text-white shadow-sm hover:shadow-md active:scale-95 transition-all focus-ring"
            >
              {againLabel}
            </button>
          ) : <span />}
          {fullSessionTo && (
            <Link
              to={fullSessionTo}
              className="text-[12px] font-bold mode-accent-text hover:underline focus-ring rounded px-1"
            >
              {fullSessionLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
