import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ACTION_META = {
  summarize: { emoji: "📝" },
  enhance_format: { emoji: "✨" },
  fix_grammar: { emoji: "✏️" },
  more_examples: { emoji: "➕" },
  ice_breakers: { emoji: "🧊" },
  practice_questions: { emoji: "🎯" },
};

export default function AIResultModal({
  action,
  originalText,
  aiText,
  onReplace,
  onInsertBelow,
  onDiscard,
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDiscard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDiscard]);

  const meta = ACTION_META[action] || { emoji: "✨" };
  const title = t(`myNotes.ai.actions.${action}`);

  const proseClasses =
    "prose prose-sm dark:prose-invert max-w-none " +
    "prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1 " +
    "prose-h3:text-base prose-h3:font-semibold " +
    "prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 " +
    "prose-strong:font-semibold prose-em:italic " +
    "prose-code:bg-surface-100 prose-code:dark:bg-surface-700 " +
    "prose-code:px-1 prose-code:rounded prose-code:text-xs";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDiscard();
      }}
    >
      <div className="card p-0 w-full max-w-4xl max-h-[85vh] flex flex-col animate-fade-in-up overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100 dark:border-surface-800">
          <h3 className="text-h4 text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <span aria-hidden>{meta.emoji}</span>
            {title}
          </h3>
          <button
            type="button"
            onClick={onDiscard}
            className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 text-xl leading-none px-2 py-1"
            aria-label={t("myNotes.ai.discard")}
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 overflow-y-auto flex-1">
          <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900/40 p-4 overflow-auto">
            <p className="text-caption uppercase tracking-wide font-semibold text-surface-500 dark:text-surface-400 mb-2">
              {t("myNotes.ai.original")}
            </p>
            <div className={proseClasses}>
              {originalText?.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{originalText}</ReactMarkdown>
              ) : (
                <p className="text-surface-400 italic text-sm not-prose">—</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-primary-200 dark:border-primary-900/40 bg-primary-50/60 dark:bg-primary-900/10 p-4 overflow-auto">
            <p className="text-caption uppercase tracking-wide font-semibold text-primary-700 dark:text-primary-300 mb-2">
              {t("myNotes.ai.aiResult")}
            </p>
            <div className={proseClasses}>
              {aiText?.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
              ) : (
                <p className="text-surface-400 italic text-sm not-prose">—</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-100 dark:border-surface-800">
          <button type="button" onClick={onDiscard} className="btn-ghost btn-md">
            {t("myNotes.ai.discard")}
          </button>
          <button type="button" onClick={onInsertBelow} className="btn-secondary btn-md">
            {t("myNotes.ai.insertBelow")}
          </button>
          <button type="button" onClick={onReplace} className="btn-primary btn-md">
            {t("myNotes.ai.replace")}
          </button>
        </div>
      </div>
    </div>
  );
}
