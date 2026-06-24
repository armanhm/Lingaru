import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  createMyNote,
  deleteMyNote,
  getMyNote,
  runMyNoteAIAction,
  updateMyNote,
} from "../api/myNotes";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { EmptyState } from "../components/ui";
import AIResultModal from "../components/notes/AIResultModal";

const AI_ACTIONS = {
  transform: [
    { key: "summarize", emoji: "📝" },
    { key: "enhance_format", emoji: "✨" },
    { key: "fix_grammar", emoji: "✏️" },
  ],
  generate: [
    { key: "more_examples", emoji: "➕" },
    { key: "ice_breakers", emoji: "🧊" },
    { key: "practice_questions", emoji: "🎯" },
    { key: "suggest_tags", emoji: "🏷️" },
  ],
};

const ACTION_DESCRIPTION_KEY = {
  summarize: "summarizeDescription",
  enhance_format: "enhanceFormatDescription",
  fix_grammar: "fixGrammarDescription",
  more_examples: "moreExamplesDescription",
  ice_breakers: "iceBreakersDescription",
  practice_questions: "practiceQuestionsDescription",
  suggest_tags: "suggestTagsDescription",
};

function MarkdownToolbar({ textareaRef, value, setValue, noteId, onAIResult, onAIError }) {
  const { t } = useTranslation();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoadingAction, setAiLoadingAction] = useState(null);
  const aiButtonRef = useRef(null);
  const aiMenuRef = useRef(null);

  useEffect(() => {
    if (!aiOpen) return undefined;
    const onDocDown = (e) => {
      if (
        aiMenuRef.current &&
        !aiMenuRef.current.contains(e.target) &&
        aiButtonRef.current &&
        !aiButtonRef.current.contains(e.target)
      ) {
        setAiOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setAiOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [aiOpen]);

  const aiDisabled = !noteId;

  const runAction = async (actionKey) => {
    if (aiDisabled || aiLoadingAction) return;
    setAiLoadingAction(actionKey);
    try {
      const res = await runMyNoteAIAction(noteId, actionKey);
      onAIResult?.(actionKey, res.data || {});
      setAiOpen(false);
    } catch {
      onAIError?.();
    } finally {
      setAiLoadingAction(null);
    }
  };

  const apply = (transform) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const { text, selStart, selEnd } = transform(selected, before, after);
    setValue(before + text + after);
    // Restore selection on the next frame after React renders.
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(before.length + selStart, before.length + selEnd);
    });
  };

  const wrap = (marker, placeholder) => () =>
    apply((sel) => {
      const body = sel || placeholder;
      const text = `${marker}${body}${marker}`;
      return {
        text,
        selStart: marker.length,
        selEnd: marker.length + body.length,
      };
    });

  const heading = (level) => () =>
    apply((sel, before) => {
      const prefix = "#".repeat(level) + " ";
      const needsNewline = before && !before.endsWith("\n");
      const body = sel || `Heading ${level}`;
      const text = (needsNewline ? "\n" : "") + prefix + body;
      return {
        text,
        selStart: text.length - body.length,
        selEnd: text.length,
      };
    });

  const list = (ordered) => () =>
    apply((sel, before) => {
      const lines = (sel || "Item").split("\n");
      const prefixed = lines
        .map((l, i) => (ordered ? `${i + 1}. ${l}` : `- ${l}`))
        .join("\n");
      const needsNewline = before && !before.endsWith("\n");
      const text = (needsNewline ? "\n" : "") + prefixed;
      return { text, selStart: text.length - prefixed.length, selEnd: text.length };
    });

  const link = () =>
    apply((sel) => {
      const label = sel || "link";
      const text = `[${label}](url)`;
      return { text, selStart: text.length - 4, selEnd: text.length - 1 };
    });

  const quote = () =>
    apply((sel, before) => {
      const lines = (sel || "Quote").split("\n");
      const prefixed = lines.map((l) => `> ${l}`).join("\n");
      const needsNewline = before && !before.endsWith("\n");
      const text = (needsNewline ? "\n" : "") + prefixed;
      return { text, selStart: text.length - prefixed.length, selEnd: text.length };
    });

  const Btn = ({ onClick, title, children }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-8 h-8 flex items-center justify-center rounded-md text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 active:scale-95 transition-all text-sm font-bold"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-surface-50 dark:bg-surface-800 border border-b-0 border-surface-200 dark:border-surface-700 rounded-t-2xl">
      <Btn onClick={wrap("**", "bold")} title="Bold (⌘B)"><span className="font-extrabold">B</span></Btn>
      <Btn onClick={wrap("*", "italic")} title="Italic (⌘I)"><em className="font-serif">I</em></Btn>
      <Btn onClick={wrap("~~", "strike")} title="Strikethrough"><span className="line-through">S</span></Btn>
      <span className="w-px h-5 bg-surface-300 dark:bg-surface-600 mx-1" />
      <Btn onClick={heading(1)} title="Heading 1"><span className="text-xs">H1</span></Btn>
      <Btn onClick={heading(2)} title="Heading 2"><span className="text-xs">H2</span></Btn>
      <Btn onClick={heading(3)} title="Heading 3"><span className="text-xs">H3</span></Btn>
      <span className="w-px h-5 bg-surface-300 dark:bg-surface-600 mx-1" />
      <Btn onClick={list(false)} title="Bullet list">•</Btn>
      <Btn onClick={list(true)} title="Numbered list"><span className="text-xs">1.</span></Btn>
      <Btn onClick={quote} title="Quote">❝</Btn>
      <Btn onClick={link} title="Link"><span className="text-xs">🔗</span></Btn>

      <div className="relative ml-auto">
        <button
          ref={aiButtonRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAiOpen((v) => !v)}
          disabled={aiDisabled}
          title={aiDisabled ? t("myNotes.ai.aiActionRequiresSave") : t("myNotes.ai.aiButton")}
          aria-label={t("myNotes.ai.aiButton")}
          aria-expanded={aiOpen}
          aria-haspopup="menu"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden>✨</span>
          {t("myNotes.ai.aiButton")}
          <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {aiOpen && !aiDisabled && (
          <div
            ref={aiMenuRef}
            role="menu"
            className="absolute right-0 top-full mt-1 z-30 w-72 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-xl py-2 animate-fade-in"
          >
            {(["transform", "generate"]).map((category, ci) => (
              <div key={category} className={ci > 0 ? "mt-1 pt-1 border-t border-surface-100 dark:border-surface-700" : ""}>
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-surface-400 dark:text-surface-500">
                  {t(`myNotes.ai.category${category[0].toUpperCase()}${category.slice(1)}`)}
                </p>
                {AI_ACTIONS[category].map((item) => {
                  const isLoading = aiLoadingAction === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => runAction(item.key)}
                      disabled={!!aiLoadingAction}
                      className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-100 dark:hover:bg-surface-700/60 disabled:opacity-60 disabled:cursor-wait transition-colors"
                    >
                      <span className="text-base leading-5 mt-0.5" aria-hidden>{item.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-surface-900 dark:text-surface-100">
                          {t(`myNotes.ai.actions.${item.key}`)}
                        </span>
                        <span className="block text-xs text-surface-500 dark:text-surface-400">
                          {t(`myNotes.ai.${ACTION_DESCRIPTION_KEY[item.key]}`)}
                        </span>
                      </span>
                      {isLoading && (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-300 border-t-primary-600 animate-spin mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

  // Resizable split between editor and preview (desktop only).
  // Persists to localStorage so it sticks across reloads.
  const [splitPct, setSplitPct] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem("myNotes:splitPct") || "");
      return Number.isFinite(saved) && saved >= 25 && saved <= 75 ? saved : 50;
    } catch {
      return 50;
    }
  });
  const splitContainerRef = useRef(null);
  const draggingSplitRef = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingSplitRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(25, Math.min(75, pct));
      setSplitPct(clamped);
    };
    const onUp = () => {
      if (!draggingSplitRef.current) return;
      draggingSplitRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("myNotes:splitPct", String(splitPct));
    } catch {
      // Storage may be unavailable (Safari private mode, quota, blocked).
    }
  }, [splitPct]);

  const onSplitGrabberDown = (e) => {
    e.preventDefault();
    draggingSplitRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const [aiModalState, setAIModalState] = useState(null);
  const [suggestedTags, setSuggestedTags] = useState([]);

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const latestStateRef = useRef(null);
  const noteIdRef = useRef(noteId);
  const bodyRef = useRef(null);
  const isMountedRef = useRef(true);
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
    // The backend requires a non-empty title. If the user hasn't filled
    // one in yet, fall back to a placeholder so autosave can still
    // persist their body / tags. They can edit it later.
    title: title.trim() || t("myNotes.untitled"),
    kind,
    body_markdown: body,
    tags: normalizeTags(tags),
    language,
    is_favorite: isFavorite,
    is_public: isPublic,
  }), [title, kind, body, tags, language, isFavorite, isPublic, t]);

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
      if (res.data?.updated_at && isMountedRef.current) setUpdatedAt(res.data.updated_at);
      if (isMountedRef.current) setSaveState("saved");
      dirtyRef.current = false;
    } catch (err) {
      if (isMountedRef.current) setSaveState("error");
      // DRF returns either a single `detail` string or per-field error
      // arrays (e.g. {title: ["This field is required."]}). Indexing a
      // string with [0] returns its first character — guard with
      // Array.isArray so we surface the full error message.
      const firstOf = (e) => (Array.isArray(e) ? e[0] : e);
      const detail =
        err.response?.data?.detail ||
        firstOf(err.response?.data?.title) ||
        firstOf(err.response?.data?.tags) ||
        firstOf(err.response?.data?.body_markdown) ||
        err.message ||
        "Save failed.";
      if (isMountedRef.current) showToast(detail, "error");
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
    }, 1200);
  }, [performSave]);

  // Best-effort flush on unmount. If the user navigates away while a
  // pending debounce is queued, fire the save now so typing doesn't
  // silently vanish. Refs avoid stale closures.
  const performSaveRef = useRef(performSave);
  useEffect(() => { performSaveRef.current = performSave; }, [performSave]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (dirtyRef.current && !inFlightRef.current) {
        performSaveRef.current();
      }
    };
  }, []);

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

  const handleAIResult = useCallback((action, payload) => {
    if (action === "suggest_tags") {
      const incoming = Array.isArray(payload?.tags) ? payload.tags : [];
      setSuggestedTags((prev) => {
        const seen = new Set([...prev, ...tags]);
        const merged = [...prev];
        for (const tg of incoming) {
          if (!seen.has(tg)) {
            seen.add(tg);
            merged.push(tg);
          }
        }
        return merged;
      });
      return;
    }
    setAIModalState({ action, original: body, result: payload?.result || "" });
  }, [body, tags]);

  const handleAIError = useCallback(() => {
    showToast(t("myNotes.ai.errors.aiFailed"), "error");
  }, [showToast, t]);

  const acceptSuggestedTag = (tg) => {
    setSuggestedTags((prev) => prev.filter((x) => x !== tg));
    setTags((prev) => (prev.includes(tg) ? prev : [...prev, tg]));
  };

  const dismissAllSuggestedTags = () => setSuggestedTags([]);

  const closeAIModal = () => setAIModalState(null);

  const handleAIReplace = () => {
    if (!aiModalState) return;
    setBody(aiModalState.result);
    setAIModalState(null);
  };

  const handleAIInsertBelow = () => {
    if (!aiModalState) return;
    setBody((prev) => (prev ? `${prev}\n\n${aiModalState.result}` : aiModalState.result));
    setAIModalState(null);
  };

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
        <button
          type="button"
          onClick={async () => {
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }
            if (dirtyRef.current) {
              await performSave();
            }
            navigate("/my-notes");
          }}
          className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("ourNotes.detail.backToList")}
        </button>

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

      {suggestedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mr-1">
            {t("myNotes.ai.suggestedTagsLabel")}
          </span>
          {suggestedTags.map((tg) => (
            <button
              key={tg}
              type="button"
              onClick={() => acceptSuggestedTag(tg)}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
            >
              <span aria-hidden>+</span>#{tg}
            </button>
          ))}
          <button
            type="button"
            onClick={dismissAllSuggestedTags}
            className="ml-1 text-xs text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 underline-offset-2 hover:underline"
          >
            {t("myNotes.ai.dismissAll")}
          </button>
        </div>
      )}

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

      <div
        ref={splitContainerRef}
        className="flex flex-col md:flex-row gap-3 md:gap-0 min-h-[440px]"
        style={{ "--split-pct": `${splitPct}%` }}
      >
        <div className={`${mobilePreview ? "hidden md:flex" : "flex"} flex-col w-full md:w-[var(--split-pct)] md:min-w-0`}>
          <MarkdownToolbar
            textareaRef={bodyRef}
            value={body}
            setValue={setBody}
            noteId={noteId}
            onAIResult={handleAIResult}
            onAIError={handleAIError}
          />
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              const meta = e.metaKey || e.ctrlKey;
              if (!meta) return;
              const ta = bodyRef.current;
              if (!ta) return;
              const wrap = (marker) => {
                e.preventDefault();
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const sel = body.slice(start, end) || (marker === "**" ? "bold" : "italic");
                const next = body.slice(0, start) + marker + sel + marker + body.slice(end);
                setBody(next);
                requestAnimationFrame(() => {
                  ta.focus();
                  ta.setSelectionRange(start + marker.length, start + marker.length + sel.length);
                });
              };
              if (e.key === "b" || e.key === "B") wrap("**");
              else if (e.key === "i" || e.key === "I") wrap("*");
            }}
            placeholder={t("myNotes.bodyPlaceholder")}
            spellCheck="false"
            className="w-full flex-1 min-h-[400px] resize-y px-4 py-3 bg-white dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700 border-t-0 rounded-b-2xl text-sm leading-relaxed text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
        </div>

        {/* Draggable split handle — desktop only. Min/max clamped to 25%-75% in the move handler. */}
        <div
          onPointerDown={onSplitGrabberDown}
          className="hidden md:flex shrink-0 w-3 mx-0.5 items-center justify-center cursor-col-resize group"
          role="separator"
          aria-orientation="vertical"
        >
          <div className="w-1 h-12 rounded-full bg-surface-200 dark:bg-surface-700 group-hover:bg-primary-400 dark:group-hover:bg-primary-500 transition-colors" />
        </div>

        <div className={`${mobilePreview ? "block" : "hidden md:block"} flex-1 md:min-w-0 rounded-2xl border border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900/40 p-4 overflow-auto`}>
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

      {aiModalState && (
        <AIResultModal
          action={aiModalState.action}
          originalText={aiModalState.original}
          aiText={aiModalState.result}
          onReplace={handleAIReplace}
          onInsertBelow={handleAIInsertBelow}
          onDiscard={closeAIModal}
        />
      )}
    </div>
  );
}
