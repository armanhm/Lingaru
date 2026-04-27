import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getStats, getTrendReport } from "../api/gamification";
import { getSRSDueCards } from "../api/progress";
import { getRandomVocabulary } from "../api/content";
import { useCountUp } from "../hooks/useAnimations";
import { useLastActivity } from "../hooks/useResumeSession";
import { Confetti } from "../components/ui";
import AudioPlayButton from "../components/AudioPlayButton";

/* ─────────────────────────────────────────────────────────
 * Locale helpers — French dashboard
 * ───────────────────────────────────────────────────────── */
const FRENCH_DAYS   = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const FRENCH_MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function frenchDate(d = new Date()) {
  return `${FRENCH_DAYS[d.getDay()]} ${d.getDate()} ${FRENCH_MONTHS[d.getMonth()]}`;
}
function clockHM(d = new Date()) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function frenchGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5)  return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/* ─────────────────────────────────────────────────────────
 * Curated daily quotes (French + English) — rotated daily
 * ───────────────────────────────────────────────────────── */
const DAILY_QUOTES = [
  { french: "La vie est belle.", english: "Life is beautiful.", author: "Proverbe français", type: "proverb" },
  { french: "Chaque jour est une nouvelle chance de changer ta vie.", english: "Every day is a new chance to change your life.", author: "Sagesse populaire", type: "inspiration" },
  { french: "Il n'y a pas de chemin vers le bonheur — le bonheur est le chemin.", english: "There is no path to happiness; happiness is the path.", author: "Proverbe français", type: "proverb" },
  { french: "Sous le pont Mirabeau coule la Seine\nEt nos amours\nFaut-il qu'il m'en souvienne\nLa joie venait toujours après la peine.", english: "Under the Mirabeau Bridge flows the Seine\nAnd our loves\nMust I be reminded\nJoy always came after sorrow.", author: "Guillaume Apollinaire", type: "poem" },
  { french: "L'imagination est plus importante que la connaissance.", english: "Imagination is more important than knowledge.", author: "Albert Einstein", type: "inspiration" },
  { french: "Il faut toujours viser la lune, car même en cas d'échec, on atterrit dans les étoiles.", english: "Always aim for the moon — even if you miss, you'll land among the stars.", author: "Oscar Wilde", type: "inspiration" },
  { french: "Mon âme a son secret, ma vie a son mystère.", english: "My soul has its secret, my life has its mystery.", author: "Félix Arvers", type: "poem" },
  { french: "Le bonheur est la seule chose qui se double si on le partage.", english: "Happiness is the only thing that doubles when shared.", author: "Albert Schweitzer", type: "inspiration" },
  { french: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.", english: "One sees clearly only with the heart. What is essential is invisible to the eye.", author: "Antoine de Saint-Exupéry", type: "literature" },
  { french: "La liberté commence où l'ignorance finit.", english: "Freedom begins where ignorance ends.", author: "Victor Hugo", type: "inspiration" },
  { french: "Je pense, donc je suis.", english: "I think, therefore I am.", author: "René Descartes", type: "philosophy" },
  { french: "Un sourire coûte moins cher que l'électricité, mais donne autant de lumière.", english: "A smile costs less than electricity, but gives just as much light.", author: "Abbé Pierre", type: "inspiration" },
  { french: "Être ou ne pas être, telle est la question.", english: "To be or not to be, that is the question.", author: "Shakespeare (traduit)", type: "literature" },
];

const QUOTE_TYPE_LABEL = {
  proverb:     "Proverbe",
  inspiration: "Inspiration",
  poem:        "Poésie",
  literature:  "Littérature",
  philosophy:  "Philosophie",
};

/* Mock skill axes for the compass — TODO: wire to /skills/snapshot when shipped */
const SKILLS = [
  { key: "vocab",   label: "Vocabulaire",   value: 78, target: 90, delta: 4, hint: "+82 mots cette semaine",   to: "/dictionary" },
  { key: "grammar", label: "Grammaire",     value: 64, target: 85, delta: 2, hint: "Subjonctif à revoir",       to: "/grammar" },
  { key: "listen",  label: "Compréhension", value: 71, target: 85, delta: 5, hint: "Dictée · 4 sessions",       to: "/practice/dictation" },
  { key: "speak",   label: "Expression",    value: 52, target: 80, delta: 8, hint: "3 roleplays cette semaine", to: "/assistant" },
  { key: "read",    label: "Lecture",       value: 81, target: 90, delta: 1, hint: "Discover · article B1",     to: "/discover" },
  { key: "write",   label: "Rédaction",     value: 58, target: 75, delta: 3, hint: "1 dictée corrigée",         to: "/practice/dictation" },
];

const TODAY_PLAN = [
  { id: "warm",  label: "Échauffement", minutes: 6,  icon: "cards", status: "ready",       to: "/practice/srs" },
  { id: "focus", label: "Séance ciblée", minutes: 12, icon: "brain", status: "in-progress", to: "/grammar/topics/subjunctive-present" },
  { id: "talk",  label: "Parler",       minutes: 8,  icon: "mic",   status: "ready",       to: "/assistant" },
];

/* ─────────────────────────────────────────────────────────
 * Inline icon set
 * ───────────────────────────────────────────────────────── */
const Ic = {
  bolt:    (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h6l-1 7 9-11h-6l1-7z" /></svg>),
  play:    (p) => (<svg {...p} fill="currentColor" viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 001.55.83l11-7.5a1 1 0 000-1.66l-11-7.5A1 1 0 007 4.5z" /></svg>),
  check:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>),
  refresh: (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0112-3l3 3M19 15a7 7 0 01-12 3l-3-3" /></svg>),
  cards:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="3" y="6" width="14" height="12" rx="2" /><path strokeLinecap="round" d="M7 3h12a2 2 0 012 2v12" /></svg>),
  brain:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3 2 2 0 002-2V6a2 2 0 00-2-2zM15 4a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3 2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>),
  mic:     (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" /><path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" /></svg>),
  game:    (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4M8 10v4M15 12h.01M17 14h.01" /><rect x="2" y="7" width="20" height="11" rx="4" /></svg>),
  chat:    (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a2 2 0 012 2v9a2 2 0 01-2 2h-7l-5 4v-4H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>),
  dictation:(p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M12 9.5l-3 3 3 3m-3-3h7" /><circle cx="12" cy="12" r="9" /></svg>),
  arrow:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" /></svg>),
};

/* ─────────────────────────────────────────────────────────
 * CompassDial — radar SVG
 * ───────────────────────────────────────────────────────── */
function CompassDial({ skills, hovered, onHover, onSelect, level = "B1" }) {
  const size = 360, cx = size / 2, cy = size / 2;
  const N = skills.length;
  const rings = [25, 50, 75, 100];

  const polar = (angleDeg, r) => {
    const a = (angleDeg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const valuePoints  = skills.map((s, i) => polar(i * 360 / N, (s.value  / 100) * 130));
  const targetPoints = skills.map((s, i) => polar(i * 360 / N, (s.target / 100) * 130));
  const path = (pts) => pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + " Z";

  return (
    <div className="relative w-full max-w-[440px] mx-auto aspect-square">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        <defs>
          <radialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#6366f1" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="valFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f07d1e" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        <circle cx={cx} cy={cy} r="155" fill="url(#dialGlow)" />

        {rings.map((p, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={(p / 100) * 130}
            fill="none"
            className="stroke-surface-200 dark:stroke-surface-800"
            strokeDasharray={i < rings.length - 1 ? "2 4" : "0"}
          />
        ))}

        {skills.map((s, i) => {
          const [x, y] = polar(i * 360 / N, 130);
          return (
            <line key={s.key} x1={cx} y1={cy} x2={x} y2={y}
              className="stroke-surface-200 dark:stroke-surface-800" />
          );
        })}

        <path d={path(targetPoints)} fill="none" stroke="#f07d1e" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
        <path d={path(valuePoints)} fill="url(#valFill)" stroke="#6366f1" strokeWidth="1.8" />

        {valuePoints.map(([x, y], i) => (
          <g key={i}
            onMouseEnter={() => onHover(skills[i].key)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect && onSelect(skills[i])}
            style={{ cursor: "pointer" }}>
            <circle
              cx={x} cy={y}
              r={hovered === skills[i].key ? 7 : 4.5}
              className="fill-white dark:fill-surface-950 stroke-primary-600 dark:stroke-primary-400"
              strokeWidth="2"
            />
          </g>
        ))}

        <circle cx={cx} cy={cy} r="34"
          className="fill-white dark:fill-surface-900 stroke-surface-200 dark:stroke-surface-800" />
        <text x={cx} y={cy - 2} textAnchor="middle"
          className="fill-surface-900 dark:fill-surface-50"
          style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>{level}</text>
        <text x={cx} y={cy + 12} textAnchor="middle"
          className="fill-surface-400 dark:fill-surface-500"
          style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
          vers B2
        </text>

        {skills.map((s, i) => {
          const [x, y] = polar(i * 360 / N, 158);
          const isHover = hovered === s.key;
          return (
            <g key={s.key}
              onMouseEnter={() => onHover(s.key)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect && onSelect(s)}
              style={{ cursor: "pointer" }}>
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                className={isHover ? "fill-primary-700 dark:fill-primary-300" : "fill-surface-700 dark:fill-surface-200"}
                style={{ fontSize: 11, fontWeight: isHover ? 800 : 600, letterSpacing: "-0.01em" }}>
                {s.label}
              </text>
              <text x={x} y={y + 12} textAnchor="middle" dominantBaseline="middle"
                className="fill-surface-400 dark:fill-surface-500 num"
                style={{ fontSize: 9, fontWeight: 500 }}>
                {s.value}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 animate-spin-slow opacity-30 pointer-events-none">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          <circle cx={cx} cy={cy} r="148" fill="none" stroke="#6366f1" strokeDasharray="2 8" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────── */
function HybridHeader({ user, stats, animatedXP }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap animate-fade-in">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 num mb-1.5">
          {frenchDate()} · {clockHM()}
        </p>
        <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight text-surface-900 dark:text-surface-50 leading-[1.05]">
          {frenchGreeting()},{" "}
          <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500 bg-clip-text text-transparent">
            {user?.username || "vous"}
          </span>
          .
        </h1>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 shadow-sm">
        <span className="animate-flame inline-block origin-bottom">🔥</span>
        <span className="text-[13px] font-bold text-surface-900 dark:text-surface-50 num">{stats?.current_streak ?? 0}</span>
        <span className="text-[12px] text-surface-500 dark:text-surface-400">jours d'affilée</span>
        <span className="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-1" />
        <Ic.bolt className="w-3.5 h-3.5 text-primary-500" />
        <span className="text-[13px] font-bold text-surface-900 dark:text-surface-50 num">{Number(animatedXP).toLocaleString("fr-FR")}</span>
        <span className="text-[12px] text-surface-500 dark:text-surface-400">XP</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * HybridHero — compass + dark CTA panel
 * ───────────────────────────────────────────────────────── */
function HybridHero({ srsDue }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState("grammar");
  const focus = SKILLS.find((s) => s.key === hovered) || SKILLS[1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT — recommended next session */}
      <div className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-primary-900 dark:from-ink-900 dark:via-primary-950 dark:to-ink-900 text-white p-4 sm:p-5 flex flex-col animate-fade-in-up">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-primary-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-8 w-56 h-56 bg-accent-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col h-full">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-primary-200">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
            Recommandé · axe sélectionné · {focus.label}
          </div>
          <h2 className="mt-2 font-editorial text-[28px] sm:text-[34px] leading-[1.05]">
            Le subjonctif présent
            <span className="block italic text-primary-200 text-[20px] sm:text-[24px] mt-1">— il faut que je comprenne</span>
          </h2>
          <p className="mt-2.5 text-[14px] text-primary-100/85 max-w-[52ch] leading-snug">
            12 minutes · 9 questions ciblées sur les verbes irréguliers (<em>aller, faire, savoir</em>).
            Vous avez fait <span className="text-accent-300 font-semibold">3 erreurs</span> sur ce point cette semaine.
          </p>

          <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
            <Link
              to="/grammar/topics/subjunctive-present"
              className="flex items-center gap-1.5 bg-white text-ink-900 px-4 py-2 rounded-lg font-semibold text-[14px] hover:bg-accent-100 transition-colors shadow-lg focus-ring"
            >
              <Ic.play className="w-3.5 h-3.5" /> Commencer · 12 min
            </Link>
            <Link
              to="/grammar/library"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-white/90 hover:bg-white/10 transition-colors border border-white/20 focus-ring"
            >
              Choisir autre chose
            </Link>
            <span className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] text-primary-200/70 hidden sm:block">
              {focus.value}/100 · objectif {focus.target}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-px bg-white/10 rounded-lg overflow-hidden">
            {TODAY_PLAN.map((p) => {
              const I = Ic[p.icon] || Ic.brain;
              const done = p.status === "done";
              const live = p.status === "in-progress";
              const minutes = p.id === "warm" && srsDue > 0
                ? Math.max(p.minutes, Math.min(srsDue, 30))
                : p.minutes;
              return (
                <Link
                  key={p.id}
                  to={p.to}
                  className={`px-3 py-2.5 ${live ? "bg-white/15" : "bg-white/5"} flex items-center gap-2 hover:bg-white/20 transition-colors focus-ring`}
                >
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${done ? "bg-success-500" : live ? "bg-primary-400" : "bg-white/15"}`}>
                    {done ? <Ic.check className="w-3.5 h-3.5 text-white" /> : <I className="w-3.5 h-3.5 text-white" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-semibold">{p.label}</p>
                    <p className="text-[12.5px] font-semibold truncate">{minutes} min</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT — compass */}
      <div className="lg:col-span-5 bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 rounded-3xl p-4 sm:p-5 animate-fade-in-up">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">La boussole</p>
            <h3 className="text-[13px] font-bold text-surface-900 dark:text-surface-50">Compétences · B1 vers B2</h3>
          </div>
          <span className="hidden sm:block text-[9px] font-mono uppercase tracking-[0.14em] text-surface-400 dark:text-surface-500">
            cliquez un axe
          </span>
        </div>
        <div className="max-w-[330px] mx-auto">
          <CompassDial
            skills={SKILLS}
            hovered={hovered}
            onHover={(k) => setHovered(k || "grammar")}
            onSelect={(s) => navigate?.(s.to)}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * QuoteCard — daily inspiration phrase (rotates daily)
 * ───────────────────────────────────────────────────────── */
function QuoteCard({ quoteIndex, onShuffle }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const quote = DAILY_QUOTES[quoteIndex];
  const frenchLines = quote.french.split("\n");
  const englishLines = quote.english.split("\n");

  const handleShuffle = () => {
    setShowTranslation(false);
    onShuffle();
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 sm:p-6 h-full flex flex-col animate-fade-in-up">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-500" />
      <span className="absolute -top-6 -right-2 text-[8rem] leading-none font-editorial text-primary-100 dark:text-primary-900/40 select-none pointer-events-none">"</span>

      <div className="relative flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400">Citation du jour</p>
        <button
          onClick={handleShuffle}
          aria-label="Citation suivante"
          className="p-1.5 rounded-lg text-surface-300 dark:text-surface-600 hover:text-primary-500 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-all hover:rotate-180 duration-500 focus-ring"
        >
          <Ic.refresh className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col">
        <div className="flex gap-2 items-start mb-3">
          <p className="flex-1 font-editorial text-[20px] sm:text-[22px] leading-[1.35] text-surface-900 dark:text-surface-50 italic">
            {frenchLines.map((line, i) => (
              <span key={i}>{line}{i < frenchLines.length - 1 && <br />}</span>
            ))}
          </p>
          <AudioPlayButton text={quote.french.replace(/\n/g, " ")} />
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
            {QUOTE_TYPE_LABEL[quote.type] || quote.type}
          </span>
          <span className="text-[12px] text-surface-500 dark:text-surface-400 truncate">— {quote.author}</span>
        </div>

        <button
          onClick={() => setShowTranslation((v) => !v)}
          className="self-start text-[12px] font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 focus-ring rounded px-1 -mx-1 transition-colors mt-auto pt-1"
        >
          {showTranslation ? "Masquer la traduction" : "Voir la traduction →"}
        </button>
        {showTranslation && (
          <p className="text-[12px] text-surface-600 dark:text-surface-400 italic border-l-2 border-primary-300 dark:border-primary-700 pl-3 mt-2 leading-relaxed animate-fade-in-up">
            {englishLines.map((line, i) => (
              <span key={i}>{line}{i < englishLines.length - 1 && <br />}</span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * ExamCountdown
 * ───────────────────────────────────────────────────────── */
function ExamCountdown({ examDate, daysLeft }) {
  const totalDays = 90;
  const days = daysLeft ?? 47;
  const pct = Math.max(0, Math.min(1, 1 - days / totalDays));

  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-accent-600 dark:text-accent-400">Compte à rebours TCF</p>
          <h3 className="text-[15px] font-bold text-surface-900 dark:text-surface-50">{examDate}</h3>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-surface-400">Score cible · 500</span>
      </div>
      <div className="flex items-end gap-3">
        <p className="font-editorial text-[56px] leading-none font-bold text-surface-900 dark:text-surface-50 num">{days}</p>
        <p className="text-[12px] text-surface-500 dark:text-surface-400 mb-2">jours<br />restants</p>
        <div className="flex-1 mb-1">
          <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono num text-surface-400 dark:text-surface-500 mt-1">
            <span>inscription</span>
            <span>aujourd'hui · J−{days}</span>
            <span>examen</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-surface-100 dark:divide-surface-800 -mx-1 text-center">
        <div className="px-2"><p className="text-[9px] uppercase tracking-[0.14em] text-surface-400">Compr. orale</p><p className="text-[14px] font-bold text-surface-900 dark:text-surface-50 num">412</p></div>
        <div className="px-2"><p className="text-[9px] uppercase tracking-[0.14em] text-surface-400">Compr. écrite</p><p className="text-[14px] font-bold text-surface-900 dark:text-surface-50 num">438</p></div>
        <div className="px-2"><p className="text-[9px] uppercase tracking-[0.14em] text-surface-400">Lex. & gram.</p><p className="text-[14px] font-bold text-surface-900 dark:text-surface-50 num">386</p></div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * WordCard — Mot du jour (real vocab API)
 * ───────────────────────────────────────────────────────── */
function WordCard({ word, loading, onShuffle }) {
  // Extract IPA-like pronunciation hint if backend provides it; else fallback.
  const pronunciation = word?.pronunciation || word?.ipa || "";
  const example = word?.example_sentence || word?.example || "";

  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 h-full animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400">Mot du jour</p>
        <button
          onClick={onShuffle}
          className="text-surface-300 dark:text-surface-600 hover:text-primary-500 transition-all focus-ring rounded p-1 disabled:opacity-50 hover:rotate-180 duration-500"
          aria-label="Nouveau mot"
          disabled={loading}
        >
          <Ic.refresh className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading || !word ? (
        <div className="space-y-2 mt-2">
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-full rounded mt-3" />
          <div className="skeleton h-3 w-3/4 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="font-editorial italic text-[32px] leading-none text-surface-900 dark:text-surface-50">{word.french}</h3>
            <AudioPlayButton text={word.french} />
          </div>
          {pronunciation && (
            <p className="text-[11px] font-mono text-surface-500 dark:text-surface-400 mt-1">
              {pronunciation.startsWith("/") ? pronunciation : `/${pronunciation}/`}
            </p>
          )}
          {word.english && (
            <p className="text-[12px] text-surface-700 dark:text-surface-200 mt-1.5 font-medium">{word.english}</p>
          )}
          {example && (
            <p className="text-[12px] italic text-surface-600 dark:text-surface-300 mt-2 leading-snug">"{example}"</p>
          )}
          <Link
            to={`/dictionary?word=${encodeURIComponent(word.french)}`}
            className="inline-flex items-center gap-1 mt-3 text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:gap-2 transition-all focus-ring rounded"
          >
            Définition complète
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * QuickRail
 * ───────────────────────────────────────────────────────── */
function QuickRail({ srsDue }) {
  const items = [
    { label: "Flashcards", icon: "cards",     to: "/practice/srs",       count: srsDue ? `${srsDue} dues` : "à jour" },
    { label: "Roleplay",   icon: "chat",      to: "/assistant",          count: "AI" },
    { label: "Dictée",     icon: "dictation", to: "/practice/dictation", count: "RFI" },
    { label: "Mini-jeux",  icon: "game",      to: "/mini-games",         count: "6 jeux" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 h-full">
      {items.map((it) => {
        const I = Ic[it.icon];
        return (
          <Link
            key={it.label}
            to={it.to}
            className="rounded-2xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-3 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-sm transition-all focus-ring animate-fade-in-up"
          >
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
              <span className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <I className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-2 text-[12px] font-bold text-surface-900 dark:text-surface-50 leading-tight">{it.label}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-surface-400 dark:text-surface-500">{it.count}</p>
          </Link>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * RecentActivity — pulled from trend report when available
 * ───────────────────────────────────────────────────────── */
function timeAgoFr(iso) {
  if (!iso) return "récemment";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000; // seconds
  if (diff < 60)       return "à l'instant";
  if (diff < 3600)     return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)    return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400*2)  return "hier";
  if (diff < 86400*7)  return `il y a ${Math.floor(diff / 86400)} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const ACTIVITY_TYPE_LABEL = {
  quiz: "Quiz",
  flashcard_review: "Flashcards",
  conjugation_drill: "Conjugaison",
  pronunciation: "Prononciation",
  dictation: "Dictée",
  mini_game: "Mini-jeu",
  roleplay: "Roleplay",
  grammar: "Grammaire",
  lesson_complete: "Leçon",
};

function RecentActivity({ trend }) {
  // Build event list from real backend data
  const events = [];

  if (trend?.top_activities?.length) {
    trend.top_activities.slice(0, 2).forEach((a) => {
      events.push({
        t: `${a.count || 0} cette semaine`,
        txt: ACTIVITY_TYPE_LABEL[a.activity_type] || a.activity_type,
        score: `+${a.total_xp ?? a.xp ?? 0} XP`,
        tone: "primary",
      });
    });
  }

  if (trend?.sample_mistakes?.length) {
    trend.sample_mistakes.slice(0, 2).forEach((m) => {
      events.push({
        t: timeAgoFr(m.created_at || m.timestamp),
        txt: m.user_text ? `Erreur — « ${m.user_text} »` : (m.context || "Erreur récente"),
        score: m.correct_text ? `→ ${m.correct_text}` : "à revoir",
        tone: "danger",
      });
    });
  }

  // Streak success line
  if (trend?.streak >= 3) {
    events.push({
      t: "aujourd'hui",
      txt: `Série de ${trend.streak} jours`,
      score: "🔥",
      tone: "success",
    });
  }

  // Fallback if backend returned nothing yet
  const display = events.length > 0 ? events : [
    { t: "—", txt: "Aucune activité récente", score: "", tone: "primary" },
  ];

  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">Journal récent</p>
        <Link to="/progress" className="text-[11px] text-surface-400 hover:text-primary-500 transition-colors focus-ring rounded px-1">
          tout voir →
        </Link>
      </div>
      <ul className="space-y-2.5">
        {display.slice(0, 5).map((e, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
              e.tone === "success" ? "bg-success-500" :
              e.tone === "primary" ? "bg-primary-500" :
                                     "bg-danger-500"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-surface-800 dark:text-surface-100 truncate">{e.txt}</p>
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-surface-400 dark:text-surface-500">{e.t}</p>
            </div>
            <span className={`text-[11px] font-mono num font-semibold shrink-0 ${
              e.tone === "success" ? "text-success-600 dark:text-success-400" :
              e.tone === "primary" ? "text-primary-600 dark:text-primary-400" :
                                     "text-danger-600 dark:text-danger-400"
            }`}>{e.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * ResumeBanner
 * ───────────────────────────────────────────────────────── */
function ResumeBanner({ activity, onDismiss }) {
  if (!activity) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800/50 px-4 py-3 animate-slide-in-down">
      <span className="shrink-0 w-9 h-9 rounded-xl bg-info-100 dark:bg-info-800/40 text-info-600 dark:text-info-300 flex items-center justify-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7z" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-info-700 dark:text-info-300">Reprendre où vous étiez</p>
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{activity.label}</p>
      </div>
      <Link to={activity.url} className="btn-primary btn-sm shrink-0">Continuer</Link>
      <button
        onClick={onDismiss}
        className="shrink-0 w-7 h-7 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-white/60 dark:hover:bg-surface-800/60 transition-colors flex items-center justify-center"
        aria-label="Ignorer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * MAIN — Dashboard
 * ───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]     = useState(null);
  const [trend, setTrend]     = useState(null);
  const [srsDue, setSrsDue]   = useState(0);
  const [word, setWord]       = useState(null);
  const [wordLoading, setWordLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [lastActivity, dismissActivity] = useLastActivity();
  const animatedXP = useCountUp(stats?.total_xp ?? 0);

  // Daily quote — rotates each calendar day, shuffleable in-session
  const initialQuoteIndex = useMemo(
    () => Math.floor(Date.now() / 86_400_000) % DAILY_QUOTES.length,
    []
  );
  const [quoteIndex, setQuoteIndex] = useState(initialQuoteIndex);
  const shuffleQuote = () => setQuoteIndex((q) => (q + 1) % DAILY_QUOTES.length);

  const examDaysLeft = user?.preferences?.exam_days_left
    ?? user?.preferences?.examDaysLeft
    ?? 47;
  const examDate = user?.preferences?.exam_date
    ?? user?.preferences?.examDate
    ?? "12 juin 2026";

  // Load core dashboard data
  useEffect(() => {
    Promise.allSettled([getStats(), getSRSDueCards(1), getTrendReport()])
      .then(([statsRes, srsRes, trendRes]) => {
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (srsRes.status === "fulfilled") {
          const d = srsRes.value.data;
          setSrsDue(d.count ?? d.results?.length ?? 0);
        }
        if (trendRes.status === "fulfilled") setTrend(trendRes.value.data);
        setLoading(false);
      });
  }, []);

  // Word of the day — fetch a real random vocab word
  const loadWord = () => {
    setWordLoading(true);
    getRandomVocabulary(1)
      .then((res) => {
        const data = res.data;
        const item = Array.isArray(data) ? data[0] : (data.results?.[0] ?? data);
        if (item) setWord(item);
      })
      .catch(() => {
        // Fallback word if API unavailable
        setWord({
          french: "flâner",
          english: "to stroll, to wander leisurely",
          pronunciation: "flɑ.ne",
          example: "J'aime flâner le long de la Seine au coucher du soleil.",
        });
      })
      .finally(() => setWordLoading(false));
  };
  useEffect(() => { loadWord(); }, []);

  // Confetti on a 7-day streak milestone
  useEffect(() => {
    if (stats?.current_streak > 0 && stats.current_streak % 7 === 0) {
      const key = `celebrated-streak-${stats.current_streak}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setCelebrate(true);
      }
    }
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="space-y-2">
            <div className="skeleton h-3 w-32 rounded" />
            <div className="skeleton h-10 w-72 rounded-lg" />
            <div className="skeleton h-3 w-96 rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 skeleton h-[420px] rounded-3xl" />
            <div className="lg:col-span-7 skeleton h-[420px] rounded-3xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 skeleton h-44 rounded-3xl" />
            <div className="lg:col-span-4 skeleton h-44 rounded-3xl" />
            <div className="lg:col-span-3 skeleton h-44 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="skeleton h-44 rounded-3xl" />
            <div className="skeleton h-44 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {celebrate && <Confetti count={60} duration={2000} />}

      <div className="max-w-7xl mx-auto space-y-5">
        <HybridHeader
          user={user}
          stats={stats}
          animatedXP={animatedXP}
        />

        <ResumeBanner activity={lastActivity} onDismiss={dismissActivity} />

        <HybridHero srsDue={srsDue} />

        {/* Bottom row: countdown + word + quick rail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5">
            <ExamCountdown examDate={examDate} daysLeft={examDaysLeft} />
          </div>
          <div className="lg:col-span-4">
            <WordCard word={word} loading={wordLoading} onShuffle={loadWord} />
          </div>
          <div className="lg:col-span-3">
            <QuickRail srsDue={srsDue} />
          </div>
        </div>

        {/* Quote + Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <QuoteCard quoteIndex={quoteIndex} onShuffle={shuffleQuote} />
          <RecentActivity trend={trend} />
        </div>
      </div>
    </div>
  );
}
