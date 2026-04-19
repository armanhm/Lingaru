/**
 * Unified empty-state component for zero-data screens, success moments,
 * and "caught up" celebrations.
 */
export default function EmptyState({ icon = "✨", title, subtitle, action, tone = "neutral" }) {
  const toneClass = {
    neutral: "text-surface-400 dark:text-surface-500",
    success: "text-success-500 dark:text-success-400",
    info:    "text-info-500 dark:text-info-400",
    warn:    "text-warn-500 dark:text-warn-400",
  }[tone] || "text-surface-400";

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-12 sm:py-16 animate-fade-in-up">
      <div className={`text-6xl mb-5 ${toneClass} animate-float`}>
        {icon}
      </div>
      {title && (
        <h3 className="text-h3 text-surface-900 dark:text-surface-100 mb-1.5 max-w-sm">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-body text-surface-500 dark:text-surface-400 max-w-md">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
