import { Link } from "react-router-dom";

/**
 * Consistent page header with optional eyebrow, back link, and right-side actions.
 * The title is the Paper serif heading (`text-h1`). Callers may still pass the
 * legacy `gradient` prop; Paper has no gradient titles, so it is ignored and
 * renders the same as `gradient={false}`.
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  backTo,
  backLabel = "Back",
  actions,
  icon,
}) {
  return (
    <div className="mb-7 animate-fade-in">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-caption font-medium text-fg-3 hover:text-accent mb-3 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>
      )}

      {eyebrow && <p className="eyebrow-primary mb-1.5">{eyebrow}</p>}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="shrink-0 w-11 h-11 rounded-xl bg-card border border-line flex items-center justify-center text-xl">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-h1 text-fg">{title}</h1>
            {subtitle && (
              <p className="text-body text-fg-2 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
