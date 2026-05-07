import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";

/**
 * Dispatcher for inline feature widgets — the agentic-mode bridge between
 * "give me X" and X actually rendering inside the conversation.
 *
 * Each widget is a small, self-contained card. Anything that can't fit
 * comfortably in a chat bubble (multi-step quiz flow, long-form article
 * reader) deep-links via a header CTA instead. Backend validates the
 * `widget` slug against ALLOWED_FEATURE_WIDGETS so we don't render
 * something the LLM made up.
 */

const REGISTRY = {
  news: NewsWidget,
  dictation: DictationWidget,
  flashcard: FlashcardWidget,
  minigame: MiniGameWidget,
};

export default function FeatureWidgetBlock({ block }) {
  const Widget = REGISTRY[block.widget];
  if (!Widget) return null;
  return <Widget config={block.config || {}} title={block.title} />;
}

// ── Shared shell ─────────────────────────────────────────────
function WidgetCard({ title, emoji, ctaTo, ctaLabel, children }) {
  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
      <div className="mode-grad-band h-1" />
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400">
          {emoji} {title}
        </p>
        {ctaTo && (
          <Link
            to={ctaTo}
            className="text-[12px] font-bold mode-accent-text hover:underline focus-ring rounded px-1"
          >
            {ctaLabel || "Ouvrir →"}
          </Link>
        )}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </div>
  );
}

// ── News ─────────────────────────────────────────────────────
function NewsWidget({ config, title }) {
  // Pulls one fresh news article from /api/news/. Optional config.topic
  // narrows by topic. The agent sets this when the user says "show me
  // news about politics" — it's a hint, not a hard filter.
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client
      .get("/news/", { params: { topic: config.topic || undefined, page: 1 } })
      .then((res) => {
        // /api/news/ ships the list inside a paginator wrapper:
        //   { count, next, previous, results: { articles: [...], topics: [...] } }
        // Be defensive in case the wrapper changes — fall back to flat shapes.
        const data = res.data || {};
        const list =
          data.results?.articles ||
          data.articles ||
          data.results ||
          [];
        setArticle(Array.isArray(list) ? list[0] || null : null);
      })
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [config.topic]);

  return (
    <WidgetCard
      title={title || "Actualité du jour"}
      emoji="📰"
      ctaTo="/news"
      ctaLabel="Toutes les news →"
    >
      {loading ? (
        <p className="text-[13px] text-surface-500 dark:text-surface-400 italic">
          Chargement…
        </p>
      ) : !article ? (
        <p className="text-[13px] text-surface-500 dark:text-surface-400">
          Aucune actualité pour l'instant.
        </p>
      ) : (
        <Link
          to={`/news/${article.id}`}
          className="block group hover:bg-surface-50 dark:hover:bg-surface-800/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
        >
          <h4 className="font-editorial text-[16px] leading-tight text-surface-900 dark:text-surface-50 group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {article.title}
          </h4>
          {article.summary && (
            <p className="text-[12.5px] text-surface-600 dark:text-surface-400 mt-1 line-clamp-2 leading-snug">
              {article.summary}
            </p>
          )}
          <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-surface-400 dark:text-surface-500 mt-1.5">
            {article.source_name || article.topic} · {article.read_minutes || 1} min
          </p>
        </Link>
      )}
    </WidgetCard>
  );
}

// ── Dictation ────────────────────────────────────────────────
function DictationWidget({ title }) {
  // The dictation flow itself is a multi-step page (audio → type → grade)
  // that doesn't fit well inline. Surface a card with audio preview +
  // deep-link instead — the agent gets credit for invoking, the user gets
  // dropped into the focused page.
  return (
    <WidgetCard title={title || "Dictée express"} emoji="🎧" ctaTo="/practice/dictation" ctaLabel="Lancer la dictée →">
      <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">
        Écoute une phrase en français et tape ce que tu entends. Tu reçois un score
        et une explication des erreurs.
      </p>
      <Link
        to="/practice/dictation"
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold mode-grad-bg text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
      >
        ▶ Démarrer
      </Link>
    </WidgetCard>
  );
}

// ── Flashcard ────────────────────────────────────────────────
function FlashcardWidget({ title }) {
  return (
    <WidgetCard title={title || "Révision flashcards"} emoji="🃏" ctaTo="/practice/srs" ctaLabel="Ouvrir la session →">
      <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">
        Reprends ta révision SRS. On te montre les cartes dues du jour, calibrées
        sur ton historique.
      </p>
      <Link
        to="/practice/srs"
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold mode-grad-bg text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
      >
        🃏 Réviser
      </Link>
    </WidgetCard>
  );
}

// ── MiniGame ─────────────────────────────────────────────────
function MiniGameWidget({ title }) {
  return (
    <WidgetCard title={title || "Mini-jeu"} emoji="🎮" ctaTo="/mini-games" ctaLabel="Voir tous les jeux →">
      <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">
        Pause ludique : pendu, anagrammes, association de mots. Choisis ton format.
      </p>
      <Link
        to="/mini-games"
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold mode-grad-bg text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
      >
        🎮 Choisir un jeu
      </Link>
    </WidgetCard>
  );
}
