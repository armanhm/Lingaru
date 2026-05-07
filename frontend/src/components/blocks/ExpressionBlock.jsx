import AudioPlayButton from "../AudioPlayButton";

/**
 * Idiomatic expression with translation and an optional cultural note.
 */
export default function ExpressionBlock({ block }) {
  const { fr, en, note } = block;
  if (!fr || !en) return null;

  return (
    <div className="rounded-xl border border-accent-100 dark:border-accent-900/40 bg-gradient-to-br from-accent-50/60 to-white dark:from-accent-950/30 dark:to-surface-900/40 p-3.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-sans font-bold text-[16px] leading-tight text-surface-900 dark:text-surface-50">
          {fr}
        </span>
        <AudioPlayButton text={fr} size="xs" />
      </div>
      <p className="text-[13px] text-surface-700 dark:text-surface-300 mt-1.5 font-medium">
        {en}
      </p>
      {note && (
        <p className="text-[12px] text-accent-700 dark:text-accent-300 mt-1.5 leading-snug border-l-2 border-accent-300 dark:border-accent-700 pl-2.5">
          {note}
        </p>
      )}
    </div>
  );
}
