import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getStats, getTrendReport } from "../api/gamification";
import { getSRSDueCards } from "../api/progress";
import AudioPlayButton from "../components/AudioPlayButton";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { SkeletonCard, SkeletonGrid, Confetti } from "../components/ui";

// Curated daily quotes — poems and inspirational phrases in French
const DAILY_QUOTES = [
  { french: "La vie est belle.", english: "Life is beautiful.", author: "French proverb", type: "proverb" },
  { french: "Chaque jour est une nouvelle chance de changer ta vie.", english: "Every day is a new chance to change your life.", author: "French saying", type: "inspiration" },
  { french: "Il n'y a pas de chemin vers le bonheur, le bonheur est le chemin.", english: "There is no path to happiness; happiness is the path.", author: "Proverbe français", type: "proverb" },
  { french: "Sous le pont Mirabeau coule la Seine\nEt nos amours\nFaut-il qu'il m'en souvienne\nLa joie venait toujours après la peine.", english: "Under the Mirabeau Bridge flows the Seine\nAnd our loves\nMust I be reminded\nJoy always came after sorrow.", author: "Guillaume Apollinaire", type: "poem" },
  { french: "Être ou ne pas être, telle est la question.", english: "To be or not to be, that is the question.", author: "Shakespeare (traduit)", type: "literature" },
  { french: "L'imagination est plus importante que la connaissance.", english: "Imagination is more important than knowledge.", author: "Albert Einstein", type: "inspiration" },
  { french: "Il faut toujours viser la lune, car même en cas d'échec, on atterrit dans les étoiles.", english: "Always aim for the moon; even if you miss, you'll land among the stars.", author: "Oscar Wilde", type: "inspiration" },
  { french: "Mon âme a son secret, ma vie a son mystère.", english: "My soul has its secret, my life has its mystery.", author: "Félix Arvers", type: "poem" },
  { french: "Le bonheur est la seule chose qui se double si on le partage.", english: "Happiness is the only thing that doubles when shared.", author: "Albert Schweitzer", type: "inspiration" },
  { french: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.", english: "One sees clearly only with the heart. What is essential is invisible to the eye.", author: "Saint-Exupéry", type: "literature" },
  { french: "La liberté commence où l'ignorance finit.", english: "Freedom begins where ignorance ends.", author: "Victor Hugo", type: "inspiration" },
  { french: "Je pense, donc je suis.", english: "I think, therefore I am.", author: "René Descartes", type: "philosophy" },
  { french: "Un sourire coûte moins cher que l'électricité, mais donne autant de lumière.", english: "A smile costs less than electricity, but gives just as much light.", author: "Abbé Pierre", type: "inspiration" },
];

const FRENCH_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FRENCH_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function frenchDate() {
  const d = new Date();
  return `${FRENCH_DAYS[d.getDay()]} ${d.getDate()} ${FRENCH_MONTHS[d.getMonth()]}`;
}

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/* Quick actions — unified primary gradient, differentiated by icon tint only */
const QUICK_ACTIONS = [
  { label: "Quiz",         to: "/practice/quiz/random",  tint: "from-primary-500 to-primary-700",  emoji: "📝", desc: "Test your knowledge" },
  { label: "Dictation",    to: "/practice/dictation",    tint: "from-info-500 to-info-700",        emoji: "🎧", desc: "Listen and write" },
  { label: "Conjugation",  to: "/practice/conjugation",  tint: "from-accent-500 to-accent-700",    emoji: "✏️", desc: "Drill verbs" },
  { label: "AI Chat",      to: "/assistant",             tint: "from-purple-500 to-primary-700",   emoji: "💬", desc: "Roleplay & talk" },
  { label: "Dictionary",   to: "/dictionary",            tint: "from-info-500 to-primary-600",     emoji: "📖", desc: "Look up words" },
  { label: "Mini Games",   to: "/mini-games",            tint: "from-pink-500 to-accent-600",      emoji: "🎮", desc: "Learn by playing" },
];

const ALL_SUGGESTIONS = [
  { label: "Order pasta in Paris",   sub: "Roleplay",    to: "/assistant?mode=roleplay&scenario=roleplay_restaurant&prompt=Bonjour, je voudrais commander des pâtes s'il vous plaît.", emoji: "🍝" },
  { label: "Check into a hotel",     sub: "Roleplay",    to: "/assistant?mode=roleplay&scenario=roleplay_hotel&prompt=Bonjour, j'ai une réservation au nom de…", emoji: "🏨" },
  { label: "Buy bread at the market",sub: "Roleplay",    to: "/assistant?mode=roleplay&scenario=roleplay_market&prompt=Bonjour, je voudrais une baguette s'il vous plaît.", emoji: "🥖" },
  { label: "See a doctor in French", sub: "Roleplay",    to: "/assistant?mode=roleplay&scenario=roleplay_doctor&prompt=Bonjour docteur, j'ai mal à la tête depuis deux jours.", emoji: "🏥" },
  { label: "Buy a train ticket",     sub: "Roleplay",    to: "/assistant?mode=roleplay&scenario=roleplay_train&prompt=Bonjour, un aller-retour pour Lyon s'il vous plaît.", emoji: "🚆" },
  { label: "Job interview practice", sub: "Roleplay",    to: "/assistant?mode=roleplay&scenario=roleplay_job_interview&prompt=Bonjour, je suis candidat pour le poste de…", emoji: "💼" },
  { label: "Practice verb « venir »",sub: "Conjugation", to: "/practice/conjugation?verb=venir", emoji: "✏️" },
  { label: "Practice verb « aller »",sub: "Conjugation", to: "/practice/conjugation?verb=aller", emoji: "✏️" },
  { label: "Practice verb « faire »",sub: "Conjugation", to: "/practice/conjugation?verb=faire", emoji: "✏️" },
  { label: "French cuisine recipes", sub: "Topic",       to: "/topics/20", emoji: "👨‍🍳" },
  { label: "Travel phrases & tips",  sub: "Topic",       to: "/topics/4",  emoji: "✈️" },
  { label: "Arts & culture",         sub: "Topic",       to: "/topics/18", emoji: "🎨" },
  { label: "Look up « bonheur »",    sub: "Dictionary",  to: "/dictionary?word=bonheur", emoji: "📖" },
  { label: "Conjugate « être »",     sub: "Dictionary",  to: "/dictionary?tab=conjugator&verb=être", emoji: "📖" },
  { label: "Passé composé explained",sub: "Grammar",     to: "/assistant?mode=grammar_explanation&prompt=Explain passé composé vs imparfait with examples", emoji: "📚" },
  { label: "When to use subjunctive",sub: "Grammar",     to: "/assistant?mode=grammar_explanation&prompt=When do I use the subjunctive in French?", emoji: "📚" },
];

function pickDailySuggestions(count = 4) {
  const seed = Math.floor(Date.now() / 86400000);
  const arr = [...ALL_SUGGESTIONS];
  let s = seed;
  const next = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

const TYPE_BADGE = {
  poem:        "badge bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
  inspiration: "badge-accent",
  proverb:     "badge-success",
  literature:  "badge-danger",
  philosophy:  "badge-info",
};

const INSIGHT_STYLES = {
  great: { bg: "bg-success-50 dark:bg-success-900/20", border: "border-success-200 dark:border-success-800/50", icon: "✅", text: "text-success-800 dark:text-success-200" },
  ok:    { bg: "bg-info-50 dark:bg-info-900/20",       border: "border-info-200 dark:border-info-800/50",        icon: "📊", text: "text-info-800 dark:text-info-200" },
  warn:  { bg: "bg-warn-50 dark:bg-warn-900/20",       border: "border-warn-200 dark:border-warn-800/50",        icon: "⚠️", text: "text-warn-800 dark:text-warn-200" },
  tip:   { bg: "bg-primary-50 dark:bg-primary-900/20", border: "border-primary-200 dark:border-primary-800/50",  icon: "💡", text: "text-primary-800 dark:text-primary-200" },
};

/* ─────────────────────────────────────────────────────────
 * QUOTE CARD — premium glass with gradient mesh background
 * ───────────────────────────────────────────────────────── */
function QuoteCard({ quoteIndex, setQuoteIndex }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const quote = DAILY_QUOTES[quoteIndex];
  const frenchLines = quote.french.split("\n");
  const englishLines = quote.english.split("\n");

  const shuffle = () => {
    setShowTranslation(false);
    setQuoteIndex((prev) => (prev + 1) % DAILY_QUOTES.length);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary-100 dark:border-primary-800/40 bg-gradient-to-br from-primary-50 via-white to-accent-50/30 dark:from-primary-950/60 dark:via-surface-900 dark:to-accent-950/20 shadow-card card-hover p-5">
      {/* Decorative quote mark */}
      <span className="absolute -top-4 -right-2 text-[9rem] leading-none font-serif text-primary-200/40 dark:text-primary-800/30 select-none pointer-events-none">"</span>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3">
        <span className="eyebrow-primary">Citation du jour</span>
        <button
          onClick={shuffle}
          aria-label="Next quote"
          className="p-1.5 rounded-lg text-primary-400 hover:text-primary-600 hover:bg-primary-100/60 dark:hover:bg-primary-900/40 transition-all hover:rotate-180 duration-500 focus-ring"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* French quote */}
      <div className="relative flex gap-2 items-start mb-3">
        <p className="flex-1 text-body-lg font-medium text-primary-900 dark:text-primary-100 italic leading-relaxed">
          {frenchLines.map((line, i) => (
            <span key={i}>{line}{i < frenchLines.length - 1 && <br />}</span>
          ))}
        </p>
        <AudioPlayButton text={quote.french.replace(/\n/g, " ")} />
      </div>

      {/* Meta */}
      <div className="relative flex items-center gap-2 flex-wrap mb-2">
        <span className={TYPE_BADGE[quote.type] || "badge-accent"}>{quote.type}</span>
        <span className="text-caption text-surface-500 dark:text-surface-400 truncate">— {quote.author}</span>
      </div>

      {/* Translation toggle */}
      <button
        onClick={() => setShowTranslation((v) => !v)}
        className="relative text-caption font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 focus-ring rounded px-1 -mx-1 transition-colors"
      >
        {showTranslation ? "Hide translation" : "Show translation →"}
      </button>
      {showTranslation && (
        <p className="relative text-caption text-surface-600 dark:text-surface-400 italic border-l-2 border-primary-300 dark:border-primary-700 pl-3 mt-2 leading-relaxed animate-fade-in-up">
          {englishLines.map((line, i) => (
            <span key={i}>{line}{i < englishLines.length - 1 && <br />}</span>
          ))}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * TREND REPORT — elegant stat grid + insights
 * ───────────────────────────────────────────────────────── */
function TrendReport({ trend }) {
  if (!trend) {
    return (
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
        </div>
        <div className="skeleton h-10 rounded-xl" />
      </div>
    );
  }

  const { week, srs, insights } = trend;
  const topInsights = insights.slice(0, 2);

  return (
    <div className="card card-hover p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="section-label">Trend Report</span>
        <span className="badge-neutral !text-[10px]">last 7 days</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={week.total_xp} label="XP" color="text-primary-600 dark:text-primary-400" />
        <StatTile value={week.lessons_completed} label="lessons" color="text-success-600 dark:text-success-400" />
        <StatTile value={week.mistakes} label="mistakes" color="text-danger-500 dark:text-danger-400" />
      </div>

      {topInsights.length > 0 && (
        <div className="space-y-2">
          {topInsights.map((ins, i) => {
            const s = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.ok;
            return (
              <div key={i} className={`flex gap-2.5 items-start px-3 py-2 rounded-xl border text-caption ${s.bg} ${s.border} animate-fade-in-up`} style={staggerDelay(i, 60)}>
                <span className="shrink-0 text-base">{s.icon}</span>
                <p className={`${s.text} leading-snug`}>{ins.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {srs.due > 0 && (
        <Link
          to="/practice/srs"
          className="group flex items-center justify-between text-caption font-semibold text-white bg-gradient-to-r from-success-500 to-success-600 hover:shadow-glow-success hover:-translate-y-0.5 rounded-xl px-4 py-2.5 transition-all focus-ring"
        >
          <span className="flex items-center gap-2">
            <span>🃏</span>
            Review {srs.due} flashcard{srs.due !== 1 ? "s" : ""}
          </span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      )}
    </div>
  );
}

function StatTile({ value, label, color }) {
  return (
    <div className="flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-800/50 rounded-xl py-3 hover:scale-105 hover:shadow-sm transition-all duration-200 cursor-default border border-surface-100 dark:border-surface-800/50">
      <p className={`text-lg font-extrabold tracking-tight ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-surface-400 dark:text-surface-500 font-semibold mt-0.5">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * HERO STAT — XP + Streak side by side
 * ───────────────────────────────────────────────────────── */
function HeroStats({ stats, srsDue, animatedXP }) {
  return (
    <div className="flex flex-wrap gap-2">
      <HeroPill icon="⚡" value={animatedXP} label="XP" gradient="from-primary-500/10 to-primary-600/10" accent="text-primary-600 dark:text-primary-400" delay={0} />
      <HeroPill icon="🔥" value={stats?.current_streak ?? 0} label="day streak" gradient="from-accent-500/10 to-accent-600/10" accent="text-accent-600 dark:text-accent-400" delay={1} />
      <HeroPill icon="🏆" value={`#${stats?.rank ?? "—"}`} label="rank" gradient="from-purple-500/10 to-primary-500/10" accent="text-purple-600 dark:text-purple-400" delay={2} />
      {srsDue > 0 && (
        <Link
          to="/practice/srs"
          className="stat-pill bg-gradient-to-br from-success-500/10 to-success-600/10 border-success-200/60 dark:border-success-800/40 hover:shadow-glow-success hover:scale-105 hover:-translate-y-0.5 transition-all duration-200 focus-ring animate-fade-in-up"
          style={staggerDelay(3)}
        >
          <span>🃏</span>
          <span className="text-sm font-bold text-success-600 dark:text-success-400">{srsDue}</span>
          <span className="text-caption text-success-700 dark:text-success-300">due</span>
        </Link>
      )}
    </div>
  );
}

function HeroPill({ icon, value, label, gradient, accent, delay }) {
  return (
    <div
      className={`stat-pill bg-gradient-to-br ${gradient} hover:shadow-card-hover hover:scale-105 hover:-translate-y-0.5 transition-all duration-200 cursor-default animate-fade-in-up`}
      style={staggerDelay(delay)}
    >
      <span>{icon}</span>
      <span className={`text-sm font-bold ${accent}`}>{value}</span>
      <span className="text-caption text-surface-500 dark:text-surface-400">{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * QUICK ACTION TILE
 * ───────────────────────────────────────────────────────── */
function QuickActionTile({ action, srsDue, i }) {
  return (
    <Link
      to={action.to}
      className="group relative flex flex-col items-center gap-2 card card-hover py-5 px-3 animate-fade-in-up focus-ring"
      style={staggerDelay(i, 50)}
    >
      <div className={`w-11 h-11 bg-gradient-to-br ${action.tint} rounded-2xl flex items-center justify-center text-xl shadow-sm group-hover:shadow-glow-primary group-hover:scale-110 transition-all duration-300`}>
        {action.emoji}
      </div>
      <span className="text-caption font-semibold text-surface-700 dark:text-surface-200 text-center leading-tight">{action.label}</span>
      <span className="text-[10px] text-surface-400 dark:text-surface-500 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute bottom-1.5 left-0 right-0">
        {action.desc}
      </span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────
 * SUGGESTION CARD
 * ───────────────────────────────────────────────────────── */
function SuggestionCard({ s, i }) {
  return (
    <Link
      to={s.to}
      className="group flex items-center gap-3 card card-hover px-4 py-3.5 animate-fade-in-up focus-ring"
      style={staggerDelay(i, 70)}
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-700 flex items-center justify-center text-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
        {s.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
          {s.label}
        </p>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-surface-400 dark:text-surface-500 mt-0.5">{s.sub}</p>
      </div>
      <svg className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all shrink-0" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════
 * MAIN
 * ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [srsDue, setSrsDue] = useState(0);
  const [trend, setTrend] = useState(null);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Date.now() / 86400000) % DAILY_QUOTES.length);
  const animatedXP = useCountUp(stats?.total_xp ?? 0);
  const [suggestions] = useState(() => pickDailySuggestions(4));
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    Promise.allSettled([getStats(), getSRSDueCards(1), getTrendReport()])
      .then(([statsRes, srsRes, trendRes]) => {
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (srsRes.status === "fulfilled") {
          const data = srsRes.value.data;
          setSrsDue(data.count ?? data.results?.length ?? 0);
        }
        if (trendRes.status === "fulfilled") setTrend(trendRes.value.data);
        setLoading(false);
      });
  }, []);

  // Fire confetti on streak milestone (every 7 days)
  useEffect(() => {
    if (stats && stats.current_streak > 0 && stats.current_streak % 7 === 0) {
      const key = `celebrated-streak-${stats.current_streak}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setCelebrate(true);
      }
    }
  }, [stats]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="skeleton h-9 w-64 rounded-lg" />
            <div className="skeleton h-4 w-40 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-8 w-20 rounded-full" />
            <div className="skeleton h-8 w-28 rounded-full" />
            <div className="skeleton h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard height="h-44" className="rounded-3xl" />
          <SkeletonCard height="h-44" className="rounded-2xl" />
        </div>
        <SkeletonGrid count={6} height="h-28" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-7 relative">
      {celebrate && <Confetti count={60} duration={2000} />}

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 flex-wrap animate-fade-in">
        <div>
          <p className="eyebrow-primary mb-1">{frenchDate()}</p>
          <h1 className="text-h1 text-surface-900 dark:text-surface-100">
            {greetingByHour()}, <span className="text-gradient-primary">{user?.username}</span>
          </h1>
          {stats?.current_streak > 0 && (
            <p className="text-caption text-surface-500 dark:text-surface-400 mt-1 flex items-center gap-1">
              <span className="animate-float inline-block">🔥</span>
              {stats.current_streak}-day streak — keep it going!
            </p>
          )}
        </div>
        <HeroStats stats={stats} srsDue={srsDue} animatedXP={animatedXP} />
      </header>

      {/* ── Quote + Trend Report ────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuoteCard quoteIndex={quoteIndex} setQuoteIndex={setQuoteIndex} />
        <TrendReport trend={trend} />
      </section>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-h4 text-surface-900 dark:text-surface-100">Quick Actions</h2>
          <span className="text-caption text-surface-400 dark:text-surface-500">Start practicing</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action, i) => (
            <QuickActionTile key={action.to} action={action} srsDue={srsDue} i={i} />
          ))}
        </div>
      </section>

      {/* ── Try Today ──────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-h4 text-surface-900 dark:text-surface-100">Try Today</h2>
          <span className="badge-neutral !text-[10px]">Refreshes daily</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((s, i) => (
            <SuggestionCard key={s.to} s={s} i={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
