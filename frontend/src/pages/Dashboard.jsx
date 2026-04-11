import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getStats, getTrendReport } from "../api/gamification";
import { getSRSDueCards } from "../api/progress";
import AudioPlayButton from "../components/AudioPlayButton";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";

// Curated daily quotes — poems and inspirational phrases in French
const DAILY_QUOTES = [
  { french: "La vie est belle.", english: "Life is beautiful.", author: "French proverb", type: "proverb" },
  { french: "Chaque jour est une nouvelle chance de changer ta vie.", english: "Every day is a new chance to change your life.", author: "French saying", type: "inspiration" },
  { french: "Il n'y a pas de chemin vers le bonheur, le bonheur est le chemin.", english: "There is no path to happiness; happiness is the path.", author: "Proverbe français", type: "proverb" },
  { french: "Sous le pont Mirabeau coule la Seine\nEt nos amours\nFaut-il qu'il m'en souvienne\nLa joie venait toujours après la peine.", english: "Under the Mirabeau Bridge flows the Seine\nAnd our loves\nMust I be reminded\nJoy always came after sorrow.", author: "Guillaume Apollinaire", type: "poem" },
  { french: "Être ou ne pas être, telle est la question.", english: "To be or not to be, that is the question.", author: "Shakespeare (traduit en français)", type: "literature" },
  { french: "L'imagination est plus importante que la connaissance.", english: "Imagination is more important than knowledge.", author: "Albert Einstein", type: "inspiration" },
  { french: "Il faut toujours viser la lune, car même en cas d'échec, on atterrit dans les étoiles.", english: "Always aim for the moon; even if you miss, you'll land among the stars.", author: "Oscar Wilde (adaptation)", type: "inspiration" },
  { french: "Mon âme a son secret, ma vie a son mystère.", english: "My soul has its secret, my life has its mystery.", author: "Félix Arvers", type: "poem" },
  { french: "Le bonheur est la seule chose qui se double si on le partage.", english: "Happiness is the only thing that doubles when shared.", author: "Albert Schweitzer", type: "inspiration" },
  { french: "Demain dès l'aube, à l'heure où blanchit la campagne,\nJe partirai.", english: "Tomorrow at dawn, when the countryside grows light,\nI will set out.", author: "Victor Hugo", type: "poem" },
  { french: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.", english: "One sees clearly only with the heart. What is essential is invisible to the eye.", author: "Antoine de Saint-Exupéry", type: "literature" },
  { french: "La liberté commence où l'ignorance finit.", english: "Freedom begins where ignorance ends.", author: "Victor Hugo", type: "inspiration" },
  { french: "Heureux qui, comme Ulysse, a fait un beau voyage.", english: "Happy he who, like Ulysses, has made a great journey.", author: "Joachim du Bellay", type: "poem" },
  { french: "Le temps perdu ne se rattrape jamais.", english: "Lost time is never found again.", author: "Proverbe français", type: "proverb" },
  { french: "Un sourire coûte moins cher que l'électricité, mais donne autant de lumière.", english: "A smile costs less than electricity, but gives just as much light.", author: "Abbé Pierre", type: "inspiration" },
  { french: "Je pense, donc je suis.", english: "I think, therefore I am.", author: "René Descartes", type: "philosophy" },
  { french: "La connaissance s'acquiert par l'expérience, tout le reste n'est que de l'information.", english: "Knowledge is acquired through experience; everything else is just information.", author: "Albert Einstein", type: "inspiration" },
  { french: "Vivre sans philosophie, c'est naviguer sans boussole.", english: "To live without philosophy is to sail without a compass.", author: "Proverbe français", type: "proverb" },
  { french: "Les grandes âmes ont de la volonté ; les faibles n'ont que des désirs.", english: "Great souls have will; the weak have only wishes.", author: "Proverbe", type: "proverb" },
  { french: "Chaque moment de ta vie est une peinture que tu crées.", english: "Every moment of your life is a painting you create.", author: "Keith Haring (adapté)", type: "inspiration" },
];

const FRENCH_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FRENCH_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function frenchDate() {
  const d = new Date();
  return `${FRENCH_DAYS[d.getDay()]} ${d.getDate()} ${FRENCH_MONTHS[d.getMonth()]}`;
}

const QUICK_ACTIONS = [
  { label: "Quiz",         to: "/topics",               color: "bg-indigo-500",  emoji: "📝" },
  { label: "Flashcards",   to: "/practice/srs",         color: "bg-emerald-500", emoji: "🃏", badgeKey: "srsDue" },
  { label: "Dictation",    to: "/practice/dictation",   color: "bg-amber-500",   emoji: "🎧" },
  { label: "Conjugation",  to: "/practice/conjugation", color: "bg-rose-500",    emoji: "✏️" },
  { label: "AI Chat",      to: "/assistant",             color: "bg-violet-500",  emoji: "💬" },
  { label: "Dictionary",   to: "/dictionary",            color: "bg-cyan-500",    emoji: "📖" },
  { label: "Mini Games",  to: "/mini-games",            color: "bg-pink-500",    emoji: "🎮" },
];

/* ── Suggestion pool — each item has a label, subtitle, link, and accent ── */
const ALL_SUGGESTIONS = [
  // Roleplay scenarios
  { label: "Order pasta in Paris",     sub: "Roleplay",     to: "/assistant?mode=roleplay&scenario=roleplay_restaurant&prompt=Bonjour, je voudrais commander des pâtes s'il vous plaît.", accent: "bg-rose-500", emoji: "🍝" },
  { label: "Check into a hotel",       sub: "Roleplay",     to: "/assistant?mode=roleplay&scenario=roleplay_hotel&prompt=Bonjour, j'ai une réservation au nom de…",                      accent: "bg-amber-500", emoji: "🏨" },
  { label: "Buy bread at the market",  sub: "Roleplay",     to: "/assistant?mode=roleplay&scenario=roleplay_market&prompt=Bonjour, je voudrais une baguette s'il vous plaît.",            accent: "bg-orange-500", emoji: "🥖" },
  { label: "See a doctor in French",   sub: "Roleplay",     to: "/assistant?mode=roleplay&scenario=roleplay_doctor&prompt=Bonjour docteur, j'ai mal à la tête depuis deux jours.",        accent: "bg-cyan-500", emoji: "🏥" },
  { label: "Buy a train ticket",       sub: "Roleplay",     to: "/assistant?mode=roleplay&scenario=roleplay_train&prompt=Bonjour, un aller-retour pour Lyon s'il vous plaît.",            accent: "bg-blue-500", emoji: "🚆" },
  { label: "Job interview practice",   sub: "Roleplay",     to: "/assistant?mode=roleplay&scenario=roleplay_job_interview&prompt=Bonjour, je suis candidat pour le poste de…",            accent: "bg-indigo-500", emoji: "💼" },
  // Verb conjugation
  { label: "Practice verb « venir »",  sub: "Conjugation",  to: "/practice/conjugation?verb=venir",  accent: "bg-violet-500", emoji: "✏️" },
  { label: "Practice verb « aller »",  sub: "Conjugation",  to: "/practice/conjugation?verb=aller",  accent: "bg-violet-500", emoji: "✏️" },
  { label: "Practice verb « faire »",  sub: "Conjugation",  to: "/practice/conjugation?verb=faire",  accent: "bg-violet-500", emoji: "✏️" },
  { label: "Practice verb « pouvoir »",sub: "Conjugation",  to: "/practice/conjugation?verb=pouvoir",accent: "bg-violet-500", emoji: "✏️" },
  { label: "Practice verb « prendre »",sub: "Conjugation",  to: "/practice/conjugation?verb=prendre",accent: "bg-violet-500", emoji: "✏️" },
  // Topics
  { label: "Learn about French food",  sub: "Topic",        to: "/topics/2",  accent: "bg-emerald-500", emoji: "🍽️" },
  { label: "Explore health vocabulary", sub: "Topic",        to: "/topics/6",  accent: "bg-teal-500", emoji: "🏥" },
  { label: "Travel phrases & tips",    sub: "Topic",        to: "/topics/4",  accent: "bg-sky-500", emoji: "✈️" },
  { label: "Family & relationships",   sub: "Topic",        to: "/topics/10", accent: "bg-pink-500", emoji: "👨‍👩‍👧" },
  { label: "French arts & culture",    sub: "Topic",        to: "/topics/18", accent: "bg-purple-500", emoji: "🎨" },
  { label: "Weather & seasons",        sub: "Topic",        to: "/topics/16", accent: "bg-yellow-500", emoji: "☀️" },
  { label: "French cuisine recipes",   sub: "Topic",        to: "/topics/20", accent: "bg-red-500", emoji: "👨‍🍳" },
  // Dictionary lookups
  { label: "Look up « bonheur »",      sub: "Dictionary",   to: "/dictionary?word=bonheur",   accent: "bg-cyan-500", emoji: "📖" },
  { label: "Look up « éphémère »",     sub: "Dictionary",   to: "/dictionary?word=éphémère",  accent: "bg-cyan-500", emoji: "📖" },
  { label: "Conjugate « être »",       sub: "Dictionary",   to: "/dictionary?tab=conjugator&verb=être", accent: "bg-cyan-500", emoji: "📖" },
  // Grammar
  { label: "Passé composé explained",  sub: "Grammar",      to: "/assistant?mode=grammar_explanation&prompt=Explain passé composé vs imparfait with examples", accent: "bg-indigo-500", emoji: "📚" },
  { label: "When to use subjunctive",  sub: "Grammar",      to: "/assistant?mode=grammar_explanation&prompt=When do I use the subjunctive in French?",         accent: "bg-indigo-500", emoji: "📚" },
];

/**
 * Pick `count` random items from the pool, deterministic per day
 * so the user sees the same set within a session but it refreshes daily.
 */
function pickDailySuggestions(count = 4) {
  const seed = Math.floor(Date.now() / 86400000);
  // Simple seeded shuffle (Fisher-Yates with LCG)
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
  poem:        { label: "Poem",        color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  inspiration: { label: "Inspiration", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  proverb:     { label: "Proverb",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  literature:  { label: "Literature",  color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  philosophy:  { label: "Philosophy",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

const INSIGHT_STYLES = {
  great: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", icon: "✅", text: "text-emerald-800 dark:text-emerald-200" },
  ok:    { bg: "bg-blue-50 dark:bg-blue-900/20",       border: "border-blue-200 dark:border-blue-800",       icon: "📊", text: "text-blue-800 dark:text-blue-200" },
  warn:  { bg: "bg-amber-50 dark:bg-amber-900/20",     border: "border-amber-200 dark:border-amber-800",     icon: "⚠️", text: "text-amber-800 dark:text-amber-200" },
  tip:   { bg: "bg-violet-50 dark:bg-violet-900/20",   border: "border-violet-200 dark:border-violet-800",   icon: "💡", text: "text-violet-800 dark:text-violet-200" },
};

function QuoteCard({ quoteIndex, setQuoteIndex }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const quote = DAILY_QUOTES[quoteIndex];
  const badge = TYPE_BADGE[quote.type] ?? TYPE_BADGE.inspiration;
  const frenchLines = quote.french.split("\n");
  const englishLines = quote.english.split("\n");

  const shuffle = () => {
    setShowTranslation(false);
    setQuoteIndex((prev) => (prev + 1) % DAILY_QUOTES.length);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30 p-4 flex flex-col gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wide">Citation du jour</span>
        <button onClick={shuffle} className="p-1 rounded-lg text-indigo-300 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors" title="Next quote">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 items-start">
        <p className="flex-1 text-sm font-medium text-indigo-800 dark:text-indigo-200 italic leading-relaxed">
          {frenchLines.map((line, i) => (
            <span key={i}>{line}{i < frenchLines.length - 1 && <br />}</span>
          ))}
        </p>
        <AudioPlayButton text={quote.french.replace(/\n/g, " ")} />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate">— {quote.author}</span>
      </div>

      <button
        onClick={() => setShowTranslation((v) => !v)}
        className="self-start text-xs text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors"
      >
        {showTranslation ? "Hide translation" : "Show translation"}
      </button>
      {showTranslation && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-indigo-200 dark:border-indigo-700 pl-2 leading-relaxed animate-fade-in-up">
          {englishLines.map((line, i) => (
            <span key={i}>{line}{i < englishLines.length - 1 && <br />}</span>
          ))}
        </p>
      )}
    </div>
  );
}

function TrendReport({ trend }) {
  if (!trend) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 animate-pulse space-y-3">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  const { week, srs, insights } = trend;
  // Show at most 2 insights to keep it compact
  const topInsights = insights.slice(0, 2);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Trend Report</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">last 7 days</span>
      </div>

      {/* Stat pills */}
      <div className="flex gap-2">
        <div className="flex-1 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2 hover:scale-105 hover:shadow-sm transition-all duration-200 cursor-default">
          <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{week.total_xp}</p>
          <p className="text-xs text-gray-400">XP</p>
        </div>
        <div className="flex-1 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2 hover:scale-105 hover:shadow-sm transition-all duration-200 cursor-default">
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{week.lessons_completed}</p>
          <p className="text-xs text-gray-400">lessons</p>
        </div>
        <div className="flex-1 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2 hover:scale-105 hover:shadow-sm transition-all duration-200 cursor-default">
          <p className="text-base font-bold text-rose-500 dark:text-rose-400">{week.mistakes}</p>
          <p className="text-xs text-gray-400">mistakes</p>
        </div>
      </div>

      {/* Top insights */}
      <div className="space-y-1.5">
        {topInsights.map((ins, i) => {
          const s = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.ok;
          return (
            <div key={i} className={`flex gap-2 items-start px-2.5 py-1.5 rounded-lg border text-xs hover:scale-[1.02] hover:shadow-sm transition-all duration-200 ${s.bg} ${s.border}`}>
              <span className="shrink-0">{s.icon}</span>
              <p className={s.text}>{ins.text}</p>
            </div>
          );
        })}
      </div>

      {srs.due > 0 && (
        <Link to="/practice/srs" className="text-center text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 hover:shadow-md hover:-translate-y-0.5 rounded-lg py-1.5 transition-all duration-200">
          Review {srs.due} flashcard{srs.due !== 1 ? "s" : ""} →
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [srsDue, setSrsDue] = useState(0);
  const [trend, setTrend] = useState(null);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Date.now() / 86400000) % DAILY_QUOTES.length);
  const animatedXP = useCountUp(stats?.total_xp ?? 0);
  const [suggestions] = useState(() => pickDailySuggestions(4));

  useEffect(() => {
    Promise.allSettled([
      getStats(),
      getSRSDueCards(1),
      getTrendReport(),
    ]).then(([statsRes, srsRes, trendRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (srsRes.status === "fulfilled") {
        const data = srsRes.value.data;
        setSrsDue(data.count ?? data.results?.length ?? 0);
      }
      if (trendRes.status === "fulfilled") setTrend(trendRes.value.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pt-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Bonjour, {user?.username}!
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 capitalize">{frenchDate()}</p>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-3 py-1 shadow-sm animate-fade-in-up hover:shadow-md hover:scale-105 transition-all duration-200 cursor-default" style={staggerDelay(0)}>
            <span className="text-xs text-gray-500 dark:text-gray-400">XP</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{animatedXP}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-3 py-1 shadow-sm animate-fade-in-up hover:shadow-md hover:scale-105 transition-all duration-200 cursor-default" style={staggerDelay(1)}>
            <span className="text-base leading-none">🔥</span>
            <span className="text-sm font-bold text-orange-500">{stats?.current_streak ?? 0}</span>
            <span className="text-xs text-gray-400">day streak</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-3 py-1 shadow-sm animate-fade-in-up hover:shadow-md hover:scale-105 transition-all duration-200 cursor-default" style={staggerDelay(2)}>
            <span className="text-xs text-gray-500 dark:text-gray-400">Rank</span>
            <span className="text-sm font-bold text-violet-600 dark:text-violet-400">#{stats?.rank ?? "—"}</span>
          </div>
          {srsDue > 0 && (
            <Link to="/practice/srs" className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1 shadow-sm hover:bg-emerald-100 transition-colors animate-fade-in-up" style={staggerDelay(3)}>
              <span className="text-base leading-none">🃏</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{srsDue}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">due</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Quote + Trend Report ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
        <QuoteCard quoteIndex={quoteIndex} setQuoteIndex={setQuoteIndex} />
        <TrendReport trend={trend} />
      </div>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action, i) => (
            <Link
              key={action.to}
              to={action.to}
              className="relative flex flex-col items-center gap-1.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 py-4 px-2 hover:shadow-md hover:-translate-y-1 hover:scale-[1.03] transition-all animate-fade-in-up"
              style={staggerDelay(i, 50)}
            >
              <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center text-xl`}>
                {action.emoji}
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-center leading-tight">{action.label}</span>
              {action.badgeKey === "srsDue" && srsDue > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce-in">
                  {srsDue > 9 ? "9+" : srsDue}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Suggestions / Try Today ─────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Try Today</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((s, i) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-200 animate-fade-in-up"
              style={staggerDelay(i, 70)}
            >
              <div className={`shrink-0 w-10 h-10 ${s.accent} rounded-lg flex items-center justify-center text-lg group-hover:scale-110 transition-transform duration-200`}>
                {s.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                  {s.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{s.sub}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
