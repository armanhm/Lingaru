import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listMyNotes } from "../api/myNotes";
import { useAuth } from "../contexts/AuthContext";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard, EmptyState } from "../components/ui";

const KINDS = [
  { value: "grammar",    emoji: "📐", tint: "bg-info-100 dark:bg-info-700/30 text-info-700 dark:text-info-300" },
  { value: "dialog",     emoji: "💬", tint: "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300" },
  { value: "vocabulary", emoji: "📝", tint: "bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300" },
  { value: "listening",  emoji: "🎧", tint: "bg-success-100 dark:bg-success-700/30 text-success-700 dark:text-success-300" },
  { value: "writing",    emoji: "✍️", tint: "bg-warn-100 dark:bg-warn-700/30 text-warn-700 dark:text-warn-300" },
  { value: "reading",    emoji: "📖", tint: "bg-danger-100 dark:bg-danger-700/30 text-danger-700 dark:text-danger-300" },
  { value: "freeform",   emoji: "✨", tint: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400" },
];

function kindMeta(value) {
  return KINDS.find((k) => k.value === value) || KINDS[KINDS.length - 1];
}

function formatRelative(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const LANGUAGE_OPTIONS = [
  { value: "fr", label: "🇫🇷" },
  { value: "en", label: "🇬🇧" },
  { value: "all", label: "All" },
];

export default function MyNotes() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const defaultLanguage = user?.target_language === "en" ? "en" : "fr";

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [language, setLanguage] = useState(defaultLanguage);
  const [kind, setKind] = useState(null);
  const [tag, setTag] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (favoritesOnly) params.favorite = 1;
    if (language) params.language = language;
    if (kind) params.kind = kind;
    if (tag) params.tag = tag;
    listMyNotes(params)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setNotes(list);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load notes."))
      .finally(() => setLoading(false));
  }, [debouncedSearch, favoritesOnly, language, kind, tag]);

  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((tg) => set.add(tg)));
    return Array.from(set).sort();
  }, [notes]);

  const newSessionBtn = (
    <Link to="/my-notes/new" className="btn-primary btn-md">
      {t("myNotes.newSession")}
    </Link>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t("myNotes.pageTitle")}
        subtitle={t("myNotes.pageSubtitle")}
        icon="📝"
        gradient
        actions={newSessionBtn}
      />

      <div className="card p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("myNotes.searchPlaceholder")}
              className="input pl-9"
            />
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              favoritesOnly
                ? "bg-warn-100 dark:bg-warn-700/30 text-warn-700 dark:text-warn-300 border-warn-200 dark:border-warn-700/60"
                : "bg-white dark:bg-surface-800/70 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700"
            }`}
            aria-pressed={favoritesOnly}
          >
            <span aria-hidden>{favoritesOnly ? "⭐" : "☆"}</span>
            {t("myNotes.favoritesOnly")}
          </button>

          <div className="inline-flex items-center rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden bg-white dark:bg-surface-800/70">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.value;
              const label = opt.value === "all" ? t("myNotes.languageAll") : opt.label;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                      : "text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700"
                  }`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setKind(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !kind
                ? "bg-primary-500 text-white"
                : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
            }`}
          >
            {t("myNotes.kindAll")}
          </button>
          {KINDS.map((k) => {
            const active = kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(active ? null : k.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary-500 text-white"
                    : `${k.tint} hover:opacity-80`
                }`}
              >
                <span className="mr-1" aria-hidden>{k.emoji}</span>
                {t(`myNotes.kinds.${k.value}`)}
              </button>
            );
          })}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-surface-100 dark:border-surface-800/60">
            {allTags.map((tg) => {
              const active = tag === tg;
              return (
                <button
                  key={tg}
                  type="button"
                  onClick={() => setTag(active ? null : tg)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-accent-500 text-white"
                      : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
                  }`}
                >
                  #{tg}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-44" />)}
        </div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Couldn't load notes" subtitle={error} tone="warn" />
      ) : notes.length === 0 ? (
        <EmptyState
          icon="📝"
          title={t("myNotes.emptyTitle")}
          subtitle={t("myNotes.emptySubtitle")}
          action={
            <Link to="/my-notes/new" className="btn-primary btn-lg">
              {t("myNotes.newSession")}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note, i) => {
            const meta = kindMeta(note.kind);
            const tags = note.tags || [];
            const visibleTags = tags.slice(0, 4);
            const extraTags = tags.length - visibleTags.length;
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => navigate(`/my-notes/${note.id}`)}
                className="group text-left card card-hover focus-ring p-5 animate-fade-in-up flex flex-col"
                style={staggerDelay(i, 40)}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.tint}`}>
                    <span aria-hidden>{meta.emoji}</span>
                    {t(`myNotes.kinds.${note.kind}`)}
                  </span>
                  {note.is_favorite && (
                    <span className="text-warn-500 text-sm" aria-hidden>⭐</span>
                  )}
                </div>

                <h2 className="text-base font-bold text-surface-900 dark:text-surface-100 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {note.title || t("myNotes.untitled")}
                </h2>

                {note.body_preview ? (
                  <p className="mt-2 text-sm text-surface-500 dark:text-surface-400 line-clamp-3">
                    {note.body_preview}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-surface-400 dark:text-surface-500 line-clamp-3">
                    {t("myNotes.emptySubtitle")}
                  </p>
                )}

                {visibleTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {visibleTags.map((tg) => (
                      <span key={tg} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
                        #{tg}
                      </span>
                    ))}
                    {extraTags > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
                        +{extraTags}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 flex items-center justify-between text-xs text-surface-400 dark:text-surface-500 border-t border-surface-100 dark:border-surface-800/60">
                  {note.is_public ? (
                    <span className="badge-info">🌐 {t("myNotes.sharedBadge")}</span>
                  ) : <span />}
                  <span>{formatRelative(note.updated_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
