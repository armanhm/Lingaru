import { isValidElement } from "react";

const TONES = {
  neutral: "text-fg-3",
  success: "text-ok",
  info: "text-accent",
  warn: "text-warn",
};

/** `icon` may be a string (emoji, kept for old callers), an element, or a component such as a lucide icon. */
function renderIcon(icon) {
  if (typeof icon === "string") return <span className="text-5xl leading-none">{icon}</span>;
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon aria-hidden="true" className="size-12" strokeWidth={1.5} />;
}

/**
 * Unified empty-state component for zero-data screens, success moments,
 * and "caught up" celebrations.
 */
export default function EmptyState({ icon = "✨", title, subtitle, action, tone = "neutral" }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-12 sm:py-16 animate-fade-in-up">
      {icon && (
        <div className={`mb-5 ${TONES[tone] || TONES.neutral}`} aria-hidden="true">
          {renderIcon(icon)}
        </div>
      )}
      {title && <h3 className="text-h3 text-fg mb-1.5 max-w-sm">{title}</h3>}
      {subtitle && <p className="text-body text-fg-2 max-w-md">{subtitle}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
