import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPublicMyNote } from "../api/myNotes";
import { useAuth } from "../contexts/AuthContext";
import { EmptyState } from "../components/ui";

const KIND_EMOJI = {
  grammar: "📐",
  dialog: "💬",
  vocabulary: "📝",
  listening: "🎧",
  writing: "✍️",
  reading: "📖",
  freeform: "✨",
};

export default function MyNotesPublic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getPublicMyNote(id)
      .then((res) => setNote(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="skeleton h-4 w-24 rounded mb-3" />
        <div className="skeleton h-10 w-72 rounded-lg mb-3" />
        <div className="skeleton h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState
          icon="🔍"
          title={t("myNotes.loadError")}
          tone="warn"
          action={
            <Link to="/my-notes" className="btn-primary btn-lg">
              {t("ourNotes.detail.backToList")}
            </Link>
          }
        />
      </div>
    );
  }

  const kindEmoji = KIND_EMOJI[note.kind] || "✨";
  const tags = note.tags || [];

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/my-notes");
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5 mb-4"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("common.back")}
      </button>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
            <span aria-hidden>{kindEmoji}</span>
            {t(`myNotes.kinds.${note.kind}`)}
          </span>
          <span className="badge-info">🌐 {t("myNotes.sharedBadge")}</span>
        </div>
        <h1 className="text-h1 text-surface-900 dark:text-surface-100">
          {note.title || t("myNotes.untitled")}
        </h1>
        {note.owner_username && (
          <p className="text-body text-surface-500 dark:text-surface-400 mt-1">
            Shared by @{note.owner_username}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tg) => (
              <span
                key={tg}
                className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
              >
                #{tg}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="prose dark:prose-invert max-w-none
          prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2
          prose-strong:font-semibold prose-em:italic
          prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {note.body_markdown || ""}
          </ReactMarkdown>
        </div>
      </div>

      {!user && (
        <div className="mt-6 text-center text-sm text-surface-500 dark:text-surface-400">
          <Link to="/register" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
            ✨ See more practice sessions like this — sign up for Lingaru
          </Link>
        </div>
      )}
    </div>
  );
}
