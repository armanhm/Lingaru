import AudioPlayButton from "../AudioPlayButton";

/**
 * Single-word/short-phrase vocab card. Mirrors the styling used by the
 * News article's vocabulary tiles so users feel at home.
 */
export default function VocabCardBlock({ block }) {
  const { french, english, pos, example_fr } = block;
  if (!french || !english) return null;

  return (
    <div className="rounded-xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900/40 p-3.5 shadow-sm">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-sans font-bold text-[18px] leading-tight text-surface-900 dark:text-surface-50">
          {french}
        </span>
        <AudioPlayButton text={french} size="xs" />
        {pos && (
          <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
            {pos}
          </span>
        )}
      </div>
      <p className="text-[13px] text-surface-700 dark:text-surface-300 mt-1.5 font-medium">
        {english}
      </p>
      {example_fr && (
        <p className="text-[12px] italic text-surface-500 dark:text-surface-400 mt-1.5 leading-snug">
          « {example_fr} »
        </p>
      )}
    </div>
  );
}
