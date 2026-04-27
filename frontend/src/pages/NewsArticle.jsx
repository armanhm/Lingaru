import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getNewsArticle, interactWithNews } from "../api/news";
import { PageHeader } from "../components/ui";
import AudioPlayButton from "../components/AudioPlayButton";
import { staggerDelay } from "../hooks/useAnimations";

const TOPICS = {
  politics: { label: "Politique",     emoji: "🏛️", tint: "from-info-500 to-primary-600" },
  sports:   { label: "Sport",         emoji: "⚽", tint: "from-success-500 to-info-500" },
  culture:  { label: "Culture",       emoji: "🎭", tint: "from-accent-500 to-purple-500" },
  economy:  { label: "Économie",      emoji: "💶", tint: "from-warn-500 to-accent-500" },
  science:  { label: "Science",       emoji: "🔬", tint: "from-info-500 to-success-500" },
  tech:     { label: "Tech",          emoji: "💻", tint: "from-primary-500 to-info-500" },
  society:  { label: "Société",       emoji: "👥", tint: "from-purple-500 to-pink-500" },
  environ:  { label: "Environnement", emoji: "🌿", tint: "from-success-500 to-warn-500" },
  world:    { label: "Monde",         emoji: "🌍", tint: "from-info-500 to-purple-600" },
  misc:     { label: "Divers",        emoji: "🗞️", tint: "from-primary-500 to-purple-600" },
};

const LEVEL_TONE = {
  A1: "bg-success-50 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-300 dark:border-success-800",
  A2: "bg-success-50 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-300 dark:border-success-800",
  B1: "bg-info-50 text-info-700 border-info-200 dark:bg-info-900/30 dark:text-info-300 dark:border-info-800",
  B2: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800",
  C1: "bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:border-accent-800",
  C2: "bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/30 dark:text-danger-300 dark:border-danger-800",
};

const TABS = [
  { key: "vocabulary",     label: "Vocabulaire", emoji: "📚", tint: "from-primary-500 to-info-500" },
  { key: "expressions",    label: "Expressions", emoji: "💬", tint: "from-accent-500 to-purple-500" },
  { key: "grammar_points", label: "Grammaire",   emoji: "🧠", tint: "from-purple-500 to-primary-600" },
];

function VocabRow({ item, i }) {
  return (
    <div
      className="rounded-xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900/40 p-3.5 animate-fade-in-up"
      style={staggerDelay(i, 50)}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-editorial italic text-[20px] leading-none text-surface-900 dark:text-surface-50">{item.french}</span>
        <AudioPlayButton text={item.french} />
        {item.pos && (
          <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
            {item.pos}
          </span>
        )}
      </div>
      <p className="text-[13px] text-surface-700 dark:text-surface-300 mt-1.5 font-medium">{item.english}</p>
      {item.example_fr && (
        <p className="text-[12px] italic text-surface-500 dark:text-surface-400 mt-1.5 leading-snug">
          « {item.example_fr} »
        </p>
      )}
    </div>
  );
}

function ExpressionRow({ item, i }) {
  return (
    <div
      className="rounded-xl border border-accent-100 dark:border-accent-900/40 bg-gradient-to-br from-accent-50/60 to-white dark:from-accent-950/30 dark:to-surface-900/40 p-3.5 animate-fade-in-up"
      style={staggerDelay(i, 50)}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-editorial italic text-[18px] leading-none text-surface-900 dark:text-surface-50">{item.fr}</span>
        <AudioPlayButton text={item.fr} />
      </div>
      <p className="text-[13px] text-surface-700 dark:text-surface-300 mt-1.5 font-medium">{item.en}</p>
      {item.note && (
        <p className="text-[12px] text-accent-700 dark:text-accent-300 mt-1.5 leading-snug border-l-2 border-accent-300 dark:border-accent-700 pl-2.5">
          {item.note}
        </p>
      )}
    </div>
  );
}

function GrammarRow({ item, i }) {
  return (
    <div
      className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/30 dark:to-surface-900/40 p-4 animate-fade-in-up"
      style={staggerDelay(i, 60)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-primary-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
          {i + 1}
        </span>
        <h4 className="text-[14px] font-bold text-surface-900 dark:text-surface-50">{item.title}</h4>
      </div>
      {item.explanation && (
        <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">{item.explanation}</p>
      )}
      {item.example_fr && (
        <div className="mt-2 rounded-lg bg-white dark:bg-surface-900/60 border border-purple-100 dark:border-purple-900/40 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] font-semibold text-purple-600 dark:text-purple-400 shrink-0">EX</span>
          <span className="font-editorial italic text-[14px] text-surface-900 dark:text-surface-50">« {item.example_fr} »</span>
          <AudioPlayButton text={item.example_fr} />
        </div>
      )}
    </div>
  );
}

export default function NewsArticle() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [tab, setTab] = useState("vocabulary");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNewsArticle(id)
      .then((res) => setArticle(res.data))
      .catch(() => setError("Article introuvable."))
      .finally(() => setLoading(false));
  }, [id]);

  // Award XP on first read (fire and forget)
  useEffect(() => {
    if (article && !article.interacted) {
      interactWithNews(article.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="space-y-2 mb-6">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
        <div className="skeleton h-[400px] rounded-3xl" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Article introuvable" backTo="/news" backLabel="Retour aux actualités" />
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
          {error || "Cet article n'existe pas."}
        </div>
      </div>
    );
  }

  const topic = TOPICS[article.topic] || TOPICS.misc;
  const levelClass = LEVEL_TONE[article.level] || LEVEL_TONE.B1;

  const counts = {
    vocabulary:     article.vocabulary?.length || 0,
    expressions:    article.expressions?.length || 0,
    grammar_points: article.grammar_points?.length || 0,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow={`${topic.emoji} ${topic.label}`}
        title={article.title}
        backTo="/news"
        backLabel="Retour aux actualités"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT — article body */}
        <div className="lg:col-span-7">
          <article className="card relative overflow-hidden p-6 sm:p-7 animate-fade-in-up">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${topic.tint}`} />

            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-br ${topic.tint} text-white shadow-sm`}>
                <span>{topic.emoji}</span>
                {topic.label}
              </span>
              <div className="flex items-center gap-2">
                {article.level && (
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded border ${levelClass}`}>
                    {article.level}
                  </span>
                )}
                {article.read_minutes && (
                  <span className="text-[11px] text-surface-500 dark:text-surface-400 font-mono">
                    ⏱ {article.read_minutes} min
                  </span>
                )}
              </div>
            </div>

            <h1 className="font-editorial text-[28px] sm:text-[32px] leading-[1.15] text-surface-900 dark:text-surface-50 mb-3">
              {article.title}
            </h1>

            {article.summary && (
              <p className="text-[14px] text-surface-600 dark:text-surface-400 italic mb-5 pb-5 border-b border-surface-100 dark:border-surface-800">
                {article.summary}
              </p>
            )}

            <div className="flex items-center gap-2 mb-3">
              <AudioPlayButton text={article.article_fr} />
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400">Écouter l'article</span>
            </div>

            <p className="text-[15px] sm:text-[16px] leading-[1.7] text-surface-800 dark:text-surface-100 whitespace-pre-line">
              {article.article_fr}
            </p>

            {article.article_en && (
              <>
                <button
                  onClick={() => setShowTranslation((v) => !v)}
                  className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary-600 dark:text-primary-400 hover:gap-2 transition-all focus-ring rounded px-1 -mx-1"
                >
                  {showTranslation ? "Masquer la traduction" : "Voir la traduction →"}
                </button>
                {showTranslation && (
                  <div className="mt-3 rounded-xl bg-primary-50/40 dark:bg-primary-900/20 border-l-4 border-primary-300 dark:border-primary-700 p-4 animate-fade-in-up">
                    <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-relaxed italic whitespace-pre-line">
                      {article.article_en}
                    </p>
                  </div>
                )}
              </>
            )}
          </article>
        </div>

        {/* RIGHT — learning panel */}
        <aside className="lg:col-span-5 lg:sticky lg:top-6 self-start">
          <div className="card relative overflow-hidden p-5 animate-fade-in-up">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500" />

            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400 mb-3">
              Pratique guidée
            </p>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-4 p-1 bg-surface-50 dark:bg-surface-800/60 rounded-lg overflow-x-auto">
              {TABS.map((t) => {
                const active = tab === t.key;
                const count = counts[t.key];
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`relative flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap focus-ring ${
                      active
                        ? "text-white shadow-sm"
                        : "text-surface-600 dark:text-surface-300 hover:bg-white dark:hover:bg-surface-700"
                    }`}
                  >
                    {active && <span className={`absolute inset-0 rounded-md bg-gradient-to-br ${t.tint}`} />}
                    <span className="relative z-10">{t.emoji}</span>
                    <span className="relative z-10">{t.label}</span>
                    {count > 0 && (
                      <span className={`relative z-10 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full ${active ? "bg-white/25" : "bg-surface-200 dark:bg-surface-700"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="space-y-2.5">
              {tab === "vocabulary" && (
                article.vocabulary?.length ? (
                  article.vocabulary.map((v, i) => <VocabRow key={i} item={v} i={i} />)
                ) : (
                  <EmptyTabContent label="Aucun vocabulaire fourni pour cet article." />
                )
              )}
              {tab === "expressions" && (
                article.expressions?.length ? (
                  article.expressions.map((e, i) => <ExpressionRow key={i} item={e} i={i} />)
                ) : (
                  <EmptyTabContent label="Aucune expression mise en avant pour cet article." />
                )
              )}
              {tab === "grammar_points" && (
                article.grammar_points?.length ? (
                  article.grammar_points.map((g, i) => <GrammarRow key={i} item={g} i={i} />)
                ) : (
                  <EmptyTabContent label="Aucun point de grammaire pour cet article." />
                )
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyTabContent({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-200 dark:border-surface-700 px-4 py-8 text-center">
      <p className="text-[12px] text-surface-500 dark:text-surface-400">{label}</p>
    </div>
  );
}
