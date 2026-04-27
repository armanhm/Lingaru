import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getNews, generateNews } from "../api/news";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";
import { useToast } from "../contexts/ToastContext";

const TOPICS = [
  { key: "",         label: "Tous",        emoji: "🗞️", tint: "from-primary-500 to-purple-600" },
  { key: "politics", label: "Politique",   emoji: "🏛️", tint: "from-info-500 to-primary-600" },
  { key: "sports",   label: "Sport",       emoji: "⚽", tint: "from-success-500 to-info-500" },
  { key: "culture",  label: "Culture",     emoji: "🎭", tint: "from-accent-500 to-purple-500" },
  { key: "economy",  label: "Économie",    emoji: "💶", tint: "from-warn-500 to-accent-500" },
  { key: "science",  label: "Science",     emoji: "🔬", tint: "from-info-500 to-success-500" },
  { key: "tech",     label: "Tech",        emoji: "💻", tint: "from-primary-500 to-info-500" },
  { key: "society",  label: "Société",     emoji: "👥", tint: "from-purple-500 to-pink-500" },
  { key: "environ",  label: "Environnement", emoji: "🌿", tint: "from-success-500 to-warn-500" },
  { key: "world",    label: "Monde",       emoji: "🌍", tint: "from-info-500 to-purple-600" },
];

const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map((t) => [t.key, t]));

const LEVEL_TONE = {
  A1: "bg-success-50 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-300 dark:border-success-800",
  A2: "bg-success-50 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-300 dark:border-success-800",
  B1: "bg-info-50 text-info-700 border-info-200 dark:bg-info-900/30 dark:text-info-300 dark:border-info-800",
  B2: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800",
  C1: "bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:border-accent-800",
  C2: "bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/30 dark:text-danger-300 dark:border-danger-800",
};

function timeAgoFr(iso) {
  if (!iso) return "récemment";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)      return "à l'instant";
  if (diff < 3600)    return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)   return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400*2) return "hier";
  if (diff < 86400*7) return `il y a ${Math.floor(diff / 86400)} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function NewsCard({ article, i }) {
  const topic = TOPIC_BY_KEY[article.topic] || TOPIC_BY_KEY[""];
  const levelClass = LEVEL_TONE[article.level] || LEVEL_TONE.B1;

  return (
    <Link
      to={`/news/${article.id}`}
      className="group relative rounded-2xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900/60 p-5 pt-6 flex flex-col gap-3 h-full overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 focus-ring animate-fade-in-up"
      style={staggerDelay(i, 60)}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${topic.tint}`} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-br ${topic.tint} text-white shadow-sm`}>
          <span>{topic.emoji}</span>
          {topic.label}
        </span>
        {article.level && (
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded border ${levelClass}`}>
            {article.level}
          </span>
        )}
      </div>

      <h3 className="font-editorial text-[20px] sm:text-[22px] leading-[1.2] text-surface-900 dark:text-surface-50 line-clamp-3">
        {article.title}
      </h3>

      {article.summary && (
        <p className="text-[13px] text-surface-600 dark:text-surface-400 leading-snug line-clamp-3">
          {article.summary}
        </p>
      )}

      <div className="mt-auto pt-1 flex items-center justify-between text-[11px] text-surface-500 dark:text-surface-500">
        <span className="font-mono uppercase tracking-[0.12em]">{timeAgoFr(article.generated_at)}</span>
        <span className="flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 group-hover:gap-2 transition-all">
          {article.read_minutes ? `${article.read_minutes} min` : "Lire"}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      {article.interacted && (
        <span className="absolute top-3 right-3 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300">
          ✓ Lu
        </span>
      )}
    </Link>
  );
}

export default function News() {
  const { showToast } = useToast();
  const [activeTopic, setActiveTopic] = useState("");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const load = (topic) => {
    setLoading(true);
    setError(null);
    getNews({ topic })
      .then((res) => {
        const payload = res.data?.results ?? res.data ?? {};
        // /api/news/ wraps the page in { articles, topics }
        const list = payload.articles ?? payload.results ?? [];
        setArticles(Array.isArray(list) ? list : []);
      })
      .catch(() => setError("Impossible de charger les actualités."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(activeTopic); }, [activeTopic]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateNews(activeTopic || undefined);
      showToast("Nouvel article généré !", "success");
      load(activeTopic);
    } catch {
      showToast("Échec — réessayez plus tard.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const generateButton = (
    <button
      onClick={handleGenerate}
      disabled={generating}
      className="btn-primary btn-md"
    >
      {generating ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Génération…
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouvel article
        </span>
      )}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Actualités · pratique guidée"
        title="News"
        subtitle="Lisez l'actualité française avec vocabulaire, expressions et grammaire expliqués."
        icon="🗞️"
        gradient
        actions={generateButton}
      />

      {/* Topic filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TOPICS.map((t) => {
          const active = activeTopic === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTopic(t.key)}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all focus-ring ${
                active
                  ? "text-white shadow-sm"
                  : "bg-white dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-primary-300 dark:hover:border-primary-700"
              }`}
            >
              {active && <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${t.tint}`} />}
              <span className="relative z-10">{t.emoji}</span>
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300 mb-5 animate-shake flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-56" />)}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon="🗞️"
          title="Aucun article pour ce thème"
          subtitle="Générez un nouvel article pour ce sujet ou choisissez un autre thème."
          action={generateButton}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a, i) => <NewsCard key={a.id} article={a} i={i} />)}
        </div>
      )}
    </div>
  );
}
