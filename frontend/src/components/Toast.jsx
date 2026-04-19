import { useState, useEffect } from "react";

const TYPE_STYLES = {
  success: {
    bg: "bg-white dark:bg-surface-900",
    border: "border-l-4 border-success-500",
    ring: "ring-success-200/60 dark:ring-success-800/40",
    icon: "text-success-500",
    iconBg: "bg-success-100 dark:bg-success-900/40",
  },
  error: {
    bg: "bg-white dark:bg-surface-900",
    border: "border-l-4 border-danger-500",
    ring: "ring-danger-200/60 dark:ring-danger-800/40",
    icon: "text-danger-500",
    iconBg: "bg-danger-100 dark:bg-danger-900/40",
  },
  warn: {
    bg: "bg-white dark:bg-surface-900",
    border: "border-l-4 border-warn-500",
    ring: "ring-warn-200/60 dark:ring-warn-800/40",
    icon: "text-warn-500",
    iconBg: "bg-warn-100 dark:bg-warn-900/40",
  },
  info: {
    bg: "bg-white dark:bg-surface-900",
    border: "border-l-4 border-info-500",
    ring: "ring-info-200/60 dark:ring-info-800/40",
    icon: "text-info-500",
    iconBg: "bg-info-100 dark:bg-info-900/40",
  },
};

const TYPE_ICONS = {
  success: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warn: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 4a8 8 0 100 16 8 8 0 000-16z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
};

export default function Toast({ message, type = "success", onDismiss }) {
  const [visible, setVisible] = useState(false);
  const style = TYPE_STYLES[type] || TYPE_STYLES.info;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 pl-3 pr-3 py-3 rounded-xl shadow-card-hover ring-1 ${style.ring} ${style.bg} ${style.border}
        min-w-[280px] max-w-md
        transition-all duration-300 ease-out
        ${visible ? "translate-x-0 opacity-100 scale-100" : "translate-x-6 opacity-0 scale-95"}`}
      role="alert"
    >
      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${style.iconBg} ${style.icon} ${type === "success" ? "animate-pop-in" : type === "error" ? "animate-shake" : ""}`}>
        {TYPE_ICONS[type]}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-surface-800 dark:text-surface-100 leading-snug">{message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 w-6 h-6 rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex items-center justify-center"
        aria-label="Dismiss notification"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
