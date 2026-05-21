import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getNote } from "../api/notes";
import { useAuth } from "../contexts/AuthContext";
import AudioPlayButton from "../components/AudioPlayButton";
import NoteAssistant from "../components/notes/NoteAssistant";
import NoteActions from "../components/notes/NoteActions";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";

function formatDate(dateStr, locale) {
  if (!dateStr) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function VocabGrid({ items, t }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-lg">📝</span>
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
          {t("news.tabs.vocabulary")}
        </h2>
        <span className="text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, i) => {
          const headword = item.word || item.english || item.headword;
          const definition = item.definition || item.meaning;
          const example = item.example || item.example_sentence;
          return (
            <div
              key={item.id ?? `${headword}-${i}`}
              className="card p-4 card-hover animate-fade-in-up"
              style={staggerDelay(i, 30)}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-base font-bold text-surface-900 dark:text-surface-100">
                  {headword}
                </span>
                {headword && <AudioPlayButton text={headword} />}
              </div>
              {definition && (
                <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                  {definition}
                </p>
              )}
              {example && (
                <div className="flex items-start gap-1.5 border-t border-surface-100 dark:border-surface-700/50 pt-2 mt-2">
                  <p className="text-xs text-surface-500 dark:text-surface-400 italic flex-1 leading-relaxed">
                    {example}
                  </p>
                  <AudioPlayButton text={example} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OurNotesDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isEn = user?.target_language === "en";
  const dateLocale = isEn ? "en-US" : "fr-FR";

  useEffect(() => {
    if (!isEn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getNote(id)
      .then((res) => setNote(res.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("not_found");
        } else {
          setError(err.response?.data?.detail || "Failed to load note.");
        }
      })
      .finally(() => setLoading(false));
  }, [id, isEn]);

  if (!isEn) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          eyebrow="Our Notes"
          title={t("ourNotes.pageTitle")}
          icon="🗒️"
          backTo="/our-notes"
          backLabel={t("ourNotes.detail.backToList")}
          gradient
        />
        <div className="card p-6">
          <EmptyState
            icon="🇫🇷"
            title={t("ourNotes.comingSoonForFrench")}
            action={
              <Link to="/settings" className="btn-primary btn-lg">
                {t("nav.settings")}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="space-y-2 mb-7">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-10 w-64 rounded-lg" />
          <div className="skeleton h-4 w-40 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-28" />)}
        </div>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState
          icon="🔍"
          title={t("ourNotes.detail.notFound")}
          action={
            <Link to="/our-notes" className="btn-primary btn-lg">
              {t("ourNotes.detail.backToList")}
            </Link>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState icon="⚠️" title="Couldn't load note" subtitle={error} tone="warn" />
      </div>
    );
  }

  if (!note) return null;

  const dateLabel = formatDate(note.date, dateLocale);
  const number = note.number ?? note.id;
  const vocab = note.vocabulary || note.vocab || note.words || [];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Link
        to="/our-notes"
        className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 mb-3 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("ourNotes.detail.backToList")}
      </Link>

      <div className="mb-8 flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-2xl shadow-glow-primary">
          🗒️
        </div>
        <div className="min-w-0">
          <p className="eyebrow-primary mb-1">
            {t("ourNotes.detail.noteHeader", { number })}
          </p>
          <h1 className="text-h1 text-surface-900 dark:text-surface-100">
            {note.title || t("ourNotes.untitled")}
          </h1>
          {dateLabel && (
            <p className="text-body text-surface-500 dark:text-surface-400 mt-1">
              {dateLabel}
            </p>
          )}
        </div>
      </div>

      <VocabGrid items={vocab} t={t} />

      <div className="mt-8 space-y-6">
        <NoteActions noteId={note.id} />
        <NoteAssistant noteId={note.id} />
      </div>
    </div>
  );
}
