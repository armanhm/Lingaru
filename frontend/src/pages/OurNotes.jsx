import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listNotes } from "../api/notes";
import { useAuth } from "../contexts/AuthContext";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, SkeletonCard, EmptyState } from "../components/ui";

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

export default function OurNotes() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isEn = user?.target_language === "en";
  const dateLocale = isEn ? "en-US" : "fr-FR";

  useEffect(() => {
    if (!isEn) {
      setLoading(false);
      return;
    }
    listNotes()
      .then((res) => setNotes(res.data.results || res.data || []))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load notes."))
      .finally(() => setLoading(false));
  }, [isEn]);

  if (!isEn) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          eyebrow="Our Notes"
          title={t("ourNotes.pageTitle")}
          icon="🗒️"
          gradient
        />
        <div className="card p-6">
          <EmptyState
            icon="🇫🇷"
            title={t("ourNotes.comingSoonForFrench")}
            subtitle={t("common.askAssistantInstead")}
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
      <div className="max-w-6xl mx-auto">
        <div className="space-y-2 mb-7">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-10 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-44" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState
          icon="⚠️"
          title="Couldn't load notes"
          subtitle={error}
          tone="warn"
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Our Notes"
        title={t("ourNotes.pageTitle")}
        subtitle={t("ourNotes.pageSubtitle")}
        icon="🗒️"
        gradient
      />

      {notes.length === 0 ? (
        <EmptyState icon="🗒️" title={t("ourNotes.empty")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note, i) => {
            const wordCount = note.word_count ?? note.vocabulary?.length ?? 0;
            const dateLabel = formatDate(note.date, dateLocale);
            const title = note.title || t("ourNotes.untitled");
            return (
              <Link
                key={note.id}
                to={`/our-notes/${note.id}`}
                className="group relative overflow-hidden card card-hover focus-ring p-0 animate-fade-in-up"
                style={staggerDelay(i, 40)}
              >
                <div className="h-1 bg-gradient-to-r from-primary-400 via-accent-400 to-success-400 opacity-60 group-hover:opacity-100 transition-opacity" />

                <div className="p-5">
                  <p className="eyebrow-primary mb-2">
                    {t("ourNotes.detail.noteHeader", { number: note.number ?? note.id })}
                  </p>

                  <h2 className="text-h4 text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                    {title}
                  </h2>

                  {dateLabel && (
                    <p className="text-caption text-surface-500 dark:text-surface-400 mt-1">
                      {dateLabel}
                    </p>
                  )}

                  <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800/50 flex items-center justify-between">
                    <span className="badge-info">
                      {t("ourNotes.wordCount", { count: wordCount })}
                    </span>
                    <span className="text-primary-500 group-hover:translate-x-1 transition-transform">
                      <svg className="w-4 h-4" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
