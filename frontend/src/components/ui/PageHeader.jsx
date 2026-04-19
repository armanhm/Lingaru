import { Link } from "react-router-dom";

/**
 * Consistent page header with optional eyebrow, back link, and right-side actions.
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  backTo,
  backLabel = "Back",
  actions,
  icon,
  gradient = false,
}) {
  const titleClass = gradient
    ? "text-h1 text-gradient-primary"
    : "text-h1 text-surface-900 dark:text-surface-100";

  return (
    <div className="mb-7 animate-fade-in">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 mb-3 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
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
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-xl shadow-glow-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className={titleClass}>{title}</h1>
            {subtitle && (
              <p className="text-body text-surface-500 dark:text-surface-400 mt-1">
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
