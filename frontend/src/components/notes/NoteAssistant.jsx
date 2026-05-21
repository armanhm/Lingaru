import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askNote } from "../../api/notes";

export default function NoteAssistant({ noteId }) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await askNote(noteId, q);
      setAnswer(res.data?.answer || "");
      setQuestion("");
      textareaRef.current?.focus();
    } catch {
      setError(t("ourNotes.assistant.errorToast"));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-lg" aria-hidden>🤖</span>
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
          {t("ourNotes.assistant.title")}
        </h2>
      </div>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
        {t("ourNotes.assistant.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={t("ourNotes.assistant.placeholder")}
          disabled={loading}
          className="input resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-surface-400 dark:text-surface-500">
            {t("ourNotes.assistant.kbdHint")}
          </span>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary btn-md"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {t("ourNotes.assistant.thinking")}
              </>
            ) : (
              t("ourNotes.assistant.askButton")
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-danger-200 dark:border-danger-900/40 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 text-sm px-4 py-2.5">
          {error}
        </div>
      )}

      {answer && !error && (
        <div className="mt-5 rounded-2xl border border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900/40 p-4 animate-fade-in-up">
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1
            prose-h3:text-base prose-h3:font-semibold
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-strong:font-semibold prose-em:italic
            prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
