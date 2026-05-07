import { Link } from "react-router-dom";

/**
 * Inline navigation chip, the agent's way of saying "go here for that."
 *
 * Backend validator rejects non-internal routes, so we always render as a
 * react-router <Link> (no `<a target="_blank">`). The button styling reads
 * the active mode's gradient via CSS vars so the chrome matches the
 * surrounding chat bubble.
 */
export default function ActionBlock({ block }) {
  const { route, label, emoji } = block;
  if (!route || !label) return null;

  return (
    <div className="rounded-xl border border-surface-100 dark:border-surface-800 bg-white/60 dark:bg-surface-900/60 p-3 flex items-center justify-between gap-3">
      <p className="text-[12.5px] text-surface-700 dark:text-surface-300 leading-snug">
        Ouvrir cette section dans l'app.
      </p>
      <Link
        to={route}
        className="mode-grad-bg shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
      >
        {emoji && <span>{emoji}</span>}
        <span>{label}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
