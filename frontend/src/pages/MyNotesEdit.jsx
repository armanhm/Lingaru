import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createMyNote,
  deleteMyNote,
  getMyNote,
  updateMyNote,
} from "../api/myNotes";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { EmptyState } from "../components/ui";

const KINDS = [
  { value: "grammar",    emoji: "📐" },
  { value: "dialog",     emoji: "💬" },
  { value: "vocabulary", emoji: "📝" },
  { value: "listening",  emoji: "🎧" },
  { value: "writing",    emoji: "✍️" },
  { value: "reading",    emoji: "📖" },
  { value: "freeform",   emoji: "✨" },
];

function formatRelative(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function normalizeTags(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const v = String(raw).trim().toLowerCase();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export default function MyNotesEdit() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [noteId, setNoteId] = useState(paramId || null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("freeform");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [language, setLanguage] = useState(user?.target_language || "fr");
  const [updatedAt, setUpdatedAt] = useState(null);

  const [loading, setLoading] = useState(!!paramId);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [mobilePreview, setMobilePreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const latestStateRef = useRef(null);
  const noteIdRef = useRef(noteId);
  useEffect(() => { noteIdRef.current = noteId; }, [noteId]);

  useEffect(() => {
    if (!paramId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    getMyNote(paramId)
      .then((res) => {
        const n = res.data;
        setNoteId(n.id);
        setTitle(n.title || "");
        setKind(n.kind || "freeform");
        setBody(n.body_markdown || "");
        setTags(n.tags || []);
        setIsFavorite(!!n.is_favorite);
        setIsPublic(!!n.is_public);
        if (n.language) setLanguage(n.language);
        setUpdatedAt(n.updated_at);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [paramId]);

  const hasContent = useMemo(
    () => Boolean(title.trim() || body.trim() || tags.length > 0),
    [title, body, tags],
  );

  const buildPayload = useCallback(() => ({
    title: title.trim(),
    kind,
    body_markdown: body,
    tags: normalizeTags(tags),
    language,
    is_favorite: isFavorite,
    is_public: isPublic,
  }), [title, kind, body, tags, language, isFavorite, isPublic]);

  const performSave = useCallback(async () => {
    if (inFlightRef.current) {
      latestStateRef.current = buildPayload();
      return;
    }
    const currentId = noteIdRef.current;
    if (!currentId && !hasContent) return;

    inFlightRef.current = true;
    setSaveState("saving");
    const payload = buildPayload();
    try {
      let res;
      if (currentId) {
        res = await updateMyNote(currentId, payload);
      } else {
        res = await createMyNote(payload);
        if (res.data?.id) {
          setNoteId(res.data.id);
          noteIdRef.current = res.data.id;
          window.history.replaceState(null, "", `/my-notes/${res.data.id}`);
        }
      }
      if (res.data?.updated_at) setUpdatedAt(res.data.updated_at);
      setSaveState("saved");
      dirtyRef.current = false;
    } catch {
      setSaveState("error");
    } finally {
      inFlightRef.current = false;
      if (latestStateRef.current) {
        latestStateRef.current = null;
        performSave();
      }
    }
  }, [buildPayload, hasContent]);

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      performSave();
    }, 3000);
  }, [performSave]);

  useEffect(() => {
    if (loading) return;
    scheduleAutosave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, kind, body, tags, isFavorite, isPublic, language]);

  const handleBlur = () => {
    if (dirtyRef.current) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      performSave();
    }
  };

  const handleManualSave = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await performSave();
    showToast(t("myNotes.saved"), "success");
  };

  const handleAddTag = (raw) => {
    const v = raw.trim().toLowerCase();
    if (!v) return;
    setTags((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setTagInput("");
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tg) => setTags((prev) => prev.filter((t) => t !== tg));

  const handleDelete = async () => {
    if (!noteId) return;
    try {
      await deleteMyNote(noteId);
      showToast(t("myNotes.saved"), "success");
      navigate("/my-notes");
    } catch {
      showToast(t("myNotes.loadError"), "error");
    }
  };

  const handleCopyShareLink = async () => {
    if (!noteId) return;
    const url = `${window.location.origin}/my-notes/public/${noteId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast(t("myNotes.loadError"), "error");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="space-y-2 mb-7">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-10 w-72 rounded-lg" />
          <div className="skeleton h-4 w-40 rounded" />
        </div>
        <div className="skeleton h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState
          icon="⚠️"
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

  const saveStatusLabel =
    saveState === "saving" ? t("myNotes.saving")
    : saveState === "saved" && updatedAt ? t("myNotes.savedRelative", { time: formatRelative(updatedAt) })
    : saveState === "saved" ? t("myNotes.saved")
    : saveState === "error" ? t("myNotes.loadError")
    : "";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-3">
        <Link
          to="/my-notes"
          className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("ourNotes.detail.backToList")}
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFavorite((v) => !v)}
            className={`p-2 rounded-xl text-lg transition-colors ${
              isFavorite
                ? "bg-warn-100 dark:bg-warn-700/30 text-warn-600 dark:text-warn-300"
                : "bg-surface-100 dark:bg-surface-800 text-surface-400 hover:text-warn-500"
            }`}
            aria-pressed={isFavorite}
            aria-label="Favorite"
          >
            {isFavorite ? "⭐" : "☆"}
          </button>

          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              isPublic
                ? "bg-info-100 dark:bg-info-700/30 text-info-700 dark:text-info-300 border-info-200 dark:border-info-700/60"
                : "bg-white dark:bg-surface-800/70 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 hover:bg-surface-50"
            }`}
            aria-pressed={isPublic}
          >
            <span aria-hidden>🌐</span>
            {t("myNotes.publicToggle")}
          </button>

          {noteId && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-danger btn-md"
            >
              {t("myNotes.delete")}
            </button>
          )}

          <button
            type="button"
            onClick={handleManualSave}
            disabled={saveState === "saving"}
            className="btn-primary btn-md"
          >
            {saveState === "saving" ? t("myNotes.saving") : t("myNotes.save")}
          </button>
        </div>
      </div>

      {isPublic && noteId && (
        <div className="mb-4 rounded-xl border border-info-200 dark:border-info-900/40 bg-info-50/60 dark:bg-info-900/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-info-700 dark:text-info-300">{t("myNotes.publicHint")}</p>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="btn-secondary btn-sm"
          >
            {copied ? t("myNotes.copied") : t("myNotes.copyShareLink")}
          </button>
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        placeholder={t("myNotes.untitled")}
        className="w-full bg-transparent border-0 outline-none focus:ring-0 px-0 text-h2 font-bold text-surface-900 dark:text-surface-100 placeholder:text-surface-300 dark:placeholder:text-surface-600 mb-3"
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          onBlur={handleBlur}
          className="input w-auto pr-9"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.emoji} {t(`myNotes.kinds.${k.value}`)}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[200px]">
          {tags.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300"
            >
              #{tg}
              <button
                type="button"
                onClick={() => removeTag(tg)}
                className="text-surface-400 hover:text-danger-500"
                aria-label={`Remove ${tg}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={(e) => {
              handleAddTag(e.target.value);
              handleBlur();
            }}
            placeholder={t("myNotes.addTag")}
            className="bg-transparent border-0 outline-none text-sm py-1 px-1 min-w-[120px] flex-1 placeholder:text-surface-400"
          />
        </div>
      </div>

      <div className="md:hidden flex items-center gap-1 mb-2 p-1 rounded-xl bg-surface-100 dark:bg-surface-800 w-fit">
        <button
          type="button"
          onClick={() => setMobilePreview(false)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            !mobilePreview
              ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm"
              : "text-surface-500 dark:text-surface-400"
          }`}
        >
          {t("myNotes.editor")}
        </button>
        <button
          type="button"
          onClick={() => setMobilePreview(true)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            mobilePreview
              ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm"
              : "text-surface-500 dark:text-surface-400"
          }`}
        >
          {t("myNotes.preview")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[440px]">
        <div className={`${mobilePreview ? "hidden md:block" : "block"}`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleBlur}
            placeholder={t("myNotes.bodyPlaceholder")}
            spellCheck="false"
            className="w-full h-full min-h-[420px] resize-y px-4 py-3 bg-white dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700 rounded-2xl text-sm font-mono leading-relaxed text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
        </div>

        <div className={`${mobilePreview ? "block" : "hidden md:block"} rounded-2xl border border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900/40 p-4 overflow-auto`}>
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1
            prose-h3:text-base prose-h3:font-semibold
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-strong:font-semibold prose-em:italic
            prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs">
            {body.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            ) : (
              <p className="text-surface-400 italic text-sm not-prose">{t("myNotes.bodyPlaceholder")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end text-xs text-surface-400 dark:text-surface-500 min-h-[1.25rem]">
        {saveStatusLabel}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card p-6 max-w-sm w-full animate-fade-in-up">
            <h3 className="text-h4 mb-4 text-surface-900 dark:text-surface-100">
              {t("myNotes.deleteConfirm")}
            </h3>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-ghost btn-md"
              >
                {t("myNotes.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger btn-md"
              >
                {t("myNotes.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
