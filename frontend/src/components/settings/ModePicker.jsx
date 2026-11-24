import { useTranslation } from "react-i18next";

// One Paper card for every mode; modes differ by icon and copy only.
export const MODE_CARDS = [
  { key: "general", icon: "📚" },
  { key: "exam", icon: "🎯" },
  { key: "agentic", icon: "💬" },
];

export default function ModePicker({ mode, onSelect }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {MODE_CARDS.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(m.key)}
            className={`relative text-left rounded-2xl border bg-card px-5 py-5 transition-colors duration-150 ease-out focus-ring ${
              active ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong"
            }`}
          >
            {active && (
              <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-accent text-on-accent flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            <span
              aria-hidden="true"
              className="inline-flex w-11 h-11 rounded-xl border border-line-soft bg-canvas items-center justify-center text-xl"
            >
              {m.icon}
            </span>
            <h3 className="mt-3 text-h3 text-fg">{t(`modes.${m.key}.title`)}</h3>
            <p className="text-small font-medium text-accent mt-1">{t(`modes.${m.key}.tagline`)}</p>
            <p className="text-small text-fg-2 mt-2">{t(`modes.${m.key}.description`)}</p>
          </button>
        );
      })}
    </div>
  );
}
