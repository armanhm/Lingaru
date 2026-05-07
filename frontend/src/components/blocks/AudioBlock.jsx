import AudioPlayButton from "../AudioPlayButton";

/**
 * Inline audio block — a single phrase the agent wants the user to hear.
 * Shows the French text alongside a play button; reuses the existing TTS
 * surface so the cache + provider plumbing stays the same.
 */
export default function AudioBlock({ block }) {
  const { text, lang = "fr" } = block;
  if (!text) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-info-100 dark:border-info-900/40 bg-info-50/40 dark:bg-info-900/15 px-3.5 py-2.5">
      <AudioPlayButton text={text} lang={lang} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-info-700 dark:text-info-300">
          Écouter
        </p>
        <p className="text-[14px] font-sans text-surface-900 dark:text-surface-50 leading-snug truncate">
          {text}
        </p>
      </div>
    </div>
  );
}
