import AudioPlayButton from "../AudioPlayButton";

/**
 * Conjugation table, verb + tense + pronoun/form pairs. Each form is
 * playable so the user can hear how it's pronounced.
 */
export default function ConjugationTableBlock({ block }) {
  const { verb, tense, rows } = block;
  if (!verb || !tense || !Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/40 to-white dark:from-purple-950/25 dark:to-surface-900/40 p-3.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2.5 pb-2 border-b border-purple-100 dark:border-purple-900/40">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-purple-600 dark:text-purple-400">
            Conjugaison · {tense}
          </p>
          <h4 className="font-editorial text-[18px] text-surface-900 dark:text-surface-50">
            {verb}
          </h4>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[14px]"
          >
            <span className="font-mono text-surface-500 dark:text-surface-400 min-w-[3.5rem] text-right">
              {row.pronoun}
            </span>
            <span className="font-sans font-semibold text-surface-900 dark:text-surface-50 flex-1">
              {row.form}
            </span>
            <AudioPlayButton text={`${row.pronoun} ${row.form}`} size="xs" />
          </div>
        ))}
      </div>
    </div>
  );
}
