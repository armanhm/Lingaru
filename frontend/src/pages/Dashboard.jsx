import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getStats, getTrendReport } from "../api/gamification";
import { getSRSDueCards } from "../api/progress";
import { getRandomVocabulary } from "../api/content";
import { useCountUp } from "../hooks/useAnimations";
import { useLastActivity } from "../hooks/useResumeSession";
import { Confetti } from "../components/ui";
import AudioPlayButton from "../components/AudioPlayButton";

function localeForLanguage(targetLanguage) {
  return targetLanguage === "en" ? "en-US" : "fr-FR";
}

function localizedDate(d = new Date(), targetLanguage = "fr") {
  try {
    return new Intl.DateTimeFormat(localeForLanguage(targetLanguage), {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

function clockHM(d = new Date()) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function localizedGreeting(targetLanguage = "fr", d = new Date()) {
  const h = d.getHours();
  if (targetLanguage === "en") {
    if (h < 5)  return "Good night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
  if (h < 5)  return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const DAILY_QUOTES_FR = [
  { text: "La vie est belle.", translation: "Life is beautiful.", authorKey: "frenchProverb", type: "proverb" },
  { text: "Chaque jour est une nouvelle chance de changer ta vie.", translation: "Every day is a new chance to change your life.", authorKey: "popularWisdom", type: "inspiration" },
  { text: "Il n'y a pas de chemin vers le bonheur, le bonheur est le chemin.", translation: "There is no path to happiness; happiness is the path.", authorKey: "frenchProverb", type: "proverb" },
  { text: "Sous le pont Mirabeau coule la Seine\nEt nos amours\nFaut-il qu'il m'en souvienne\nLa joie venait toujours après la peine.", translation: "Under the Mirabeau Bridge flows the Seine\nAnd our loves\nMust I be reminded\nJoy always came after sorrow.", author: "Guillaume Apollinaire", type: "poem" },
  { text: "L'imagination est plus importante que la connaissance.", translation: "Imagination is more important than knowledge.", author: "Albert Einstein", type: "inspiration" },
  { text: "Il faut toujours viser la lune, car même en cas d'échec, on atterrit dans les étoiles.", translation: "Always aim for the moon, even if you miss, you'll land among the stars.", author: "Oscar Wilde", type: "inspiration" },
  { text: "Mon âme a son secret, ma vie a son mystère.", translation: "My soul has its secret, my life has its mystery.", author: "Félix Arvers", type: "poem" },
  { text: "Le bonheur est la seule chose qui se double si on le partage.", translation: "Happiness is the only thing that doubles when shared.", author: "Albert Schweitzer", type: "inspiration" },
  { text: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.", translation: "One sees clearly only with the heart. What is essential is invisible to the eye.", author: "Antoine de Saint-Exupéry", type: "literature" },
  { text: "La liberté commence où l'ignorance finit.", translation: "Freedom begins where ignorance ends.", author: "Victor Hugo", type: "inspiration" },
  { text: "Je pense, donc je suis.", translation: "I think, therefore I am.", author: "René Descartes", type: "philosophy" },
  { text: "Un sourire coûte moins cher que l'électricité, mais donne autant de lumière.", translation: "A smile costs less than electricity, but gives just as much light.", author: "Abbé Pierre", type: "inspiration" },
  { text: "Être ou ne pas être, telle est la question.", translation: "To be or not to be, that is the question.", author: "Shakespeare", type: "literature" },
];

const DAILY_QUOTES_EN = [
  { text: "To be, or not to be, that is the question.", translation: null, author: "William Shakespeare", type: "literature" },
  { text: "The two most important days in your life are the day you are born and the day you find out why.", translation: null, author: "Mark Twain", type: "inspiration" },
  { text: "You will face many defeats in life, but never let yourself be defeated.", translation: null, author: "Maya Angelou", type: "inspiration" },
  { text: "I think, therefore I am.", translation: null, author: "René Descartes", type: "philosophy" },
  { text: "The only way to do great work is to love what you do.", translation: null, author: "Steve Jobs", type: "inspiration" },
  { text: "Not all those who wander are lost.", translation: null, author: "J.R.R. Tolkien", type: "literature" },
];

const SKILLS = [
  { key: "vocab",   value: 78, target: 90, delta: 4, to: "/dictionary" },
  { key: "grammar", value: 64, target: 85, delta: 2, to: "/grammar" },
  { key: "listen",  value: 71, target: 85, delta: 5, to: "/practice/dictation" },
  { key: "speak",   value: 52, target: 80, delta: 8, to: "/assistant" },
  { key: "read",    value: 81, target: 90, delta: 1, to: "/discover" },
  { key: "write",   value: 58, target: 75, delta: 3, to: "/practice/dictation" },
];

const TODAY_PLAN = [
  { id: "warm",  labelKey: "warm",  minutes: 6,  icon: "cards", status: "ready",       to: "/practice/srs" },
  { id: "focus", labelKey: "focus", minutes: 12, icon: "brain", status: "in-progress", to: "/grammar/topics/subjunctive-present" },
  { id: "talk",  labelKey: "talk",  minutes: 8,  icon: "mic",   status: "ready",       to: "/assistant" },
];

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

function CompassDial({ skills, hovered, onHover, onSelect, level = "B1" }) {
  const { t } = useTranslation();
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
          {t("dashboard.compass.towards")}
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
                {t(`dashboard.skills.${s.key}`)}
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

function HybridHeader({ user, stats, animatedXP }) {
  const { t } = useTranslation();
  const targetLanguage = user?.target_language || "fr";
  const numberLocale = localeForLanguage(targetLanguage);

  return (
    <div className="flex items-end justify-between gap-6 flex-wrap animate-fade-in">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 num mb-1.5">
          {localizedDate(new Date(), targetLanguage)} · {clockHM()}
        </p>
        <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight text-surface-900 dark:text-surface-50 leading-[1.05]">
          {localizedGreeting(targetLanguage)},{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--mode-grad-from), var(--mode-grad-to))",
            }}
          >
            {user?.username || t("dashboard.youFallback")}
          </span>
          .
        </h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {user?.mode && (
          <span className="mode-chip">
            {user.mode === "general" ? t("dashboard.modeChip.general")
              : user.mode === "exam" ? t("dashboard.modeChip.exam")
              : user.mode === "agentic" ? t("dashboard.modeChip.agentic")
              : ""}
          </span>
        )}
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 shadow-sm">
        <span className="animate-flame inline-block origin-bottom">🔥</span>
        <span className="text-[13px] font-bold text-surface-900 dark:text-surface-50 num">{stats?.current_streak ?? 0}</span>
        <span className="text-[12px] text-surface-500 dark:text-surface-400">{t("dashboard.streakLabel")}</span>
        <span className="w-px h-4 bg-surface-200 dark:bg-surface-700 mx-1" />
        <Ic.bolt className="w-3.5 h-3.5 text-primary-500" />
        <span className="text-[13px] font-bold text-surface-900 dark:text-surface-50 num">{Number(animatedXP).toLocaleString(numberLocale)}</span>
        <span className="text-[12px] text-surface-500 dark:text-surface-400">{t("dashboard.xpLabel")}</span>
      </div>
      </div>
    </div>
  );
}

function HybridHero({ srsDue }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState("grammar");
  const focus = SKILLS.find((s) => s.key === hovered) || SKILLS[1];
  const focusLabel = t(`dashboard.skills.${focus.key}`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-primary-900 dark:from-ink-900 dark:via-primary-950 dark:to-ink-900 text-white p-4 sm:p-5 flex flex-col animate-fade-in-up">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-primary-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-8 w-56 h-56 bg-accent-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col h-full">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-primary-200">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
            {t("dashboard.hero.recommendedEyebrow", { axis: focusLabel })}
          </div>
          <h2 className="mt-2 font-editorial text-[28px] sm:text-[34px] leading-[1.05]">
            {t("dashboard.hero.title")}
            <span className="block italic text-primary-200 text-[20px] sm:text-[24px] mt-1">{t("dashboard.hero.subtitle")}</span>
          </h2>
          <p className="mt-2.5 text-[14px] text-primary-100/85 max-w-[52ch] leading-snug">
            <Trans
              i18nKey="dashboard.hero.description"
              components={{
                1: <em />,
                2: <span className="text-accent-300 font-semibold" />,
              }}
            />
          </p>

          <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
            <Link
              to="/grammar/topics/subjunctive-present"
              className="flex items-center gap-1.5 bg-white text-ink-900 px-4 py-2 rounded-lg font-semibold text-[14px] hover:bg-accent-100 transition-colors shadow-lg focus-ring"
            >
              <Ic.play className="w-3.5 h-3.5" /> {t("dashboard.hero.startCta")}
            </Link>
            <Link
              to="/grammar/library"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-white/90 hover:bg-white/10 transition-colors border border-white/20 focus-ring"
            >
              {t("dashboard.hero.pickAnother")}
            </Link>
            <span className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] text-primary-200/70 hidden sm:block">
              {t("dashboard.hero.objectiveLabel", { value: focus.value, target: focus.target })}
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
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-semibold">{t(`dashboard.plan.${p.labelKey}`)}</p>
                    <p className="text-[12.5px] font-semibold truncate">{minutes} {t("dashboard.plan.minutes")}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 rounded-3xl p-4 sm:p-5 animate-fade-in-up">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">{t("dashboard.compass.eyebrow")}</p>
            <h3 className="text-[13px] font-bold text-surface-900 dark:text-surface-50">{t("dashboard.compass.title")}</h3>
          </div>
          <span className="hidden sm:block text-[9px] font-mono uppercase tracking-[0.14em] text-surface-400 dark:text-surface-500">
            {t("dashboard.compass.clickHint")}
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

function QuoteCard({ quotes, quoteIndex, onShuffle, targetLanguage }) {
  const { t } = useTranslation();
  const [showTranslation, setShowTranslation] = useState(false);
  const quote = quotes[quoteIndex];
  const lines = quote.text.split("\n");
  const translationLines = (quote.translation || "").split("\n");
  const speechLang = targetLanguage === "en" ? "en-US" : "fr-FR";
  const author = quote.author || (quote.authorKey ? t(`dashboard.quote.authors.${quote.authorKey}`) : "");

  const handleShuffle = () => {
    setShowTranslation(false);
    onShuffle();
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 sm:p-6 h-full flex flex-col animate-fade-in-up">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-500" />

      <div className="relative flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400">{t("dashboard.quote.eyebrow")}</p>
        <button
          onClick={handleShuffle}
          aria-label={t("dashboard.quote.next")}
          className="p-1.5 rounded-lg text-surface-300 dark:text-surface-600 hover:text-primary-500 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-all hover:rotate-180 duration-500 focus-ring"
        >
          <Ic.refresh className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col">
        <div className="flex gap-2 items-start mb-3">
          <p className="flex-1 font-editorial text-[20px] sm:text-[22px] leading-[1.35] text-surface-900 dark:text-surface-50 italic">
            {lines.map((line, i) => (
              <span key={i}>{line}{i < lines.length - 1 && <br />}</span>
            ))}
          </p>
          <AudioPlayButton text={quote.text.replace(/\n/g, " ")} lang={speechLang} />
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
            {t(`dashboard.quote.types.${quote.type}`, { defaultValue: quote.type })}
          </span>
          <span className="text-[12px] text-surface-500 dark:text-surface-400 truncate">{author}</span>
        </div>

        {quote.translation && (
          <>
            <button
              onClick={() => setShowTranslation((v) => !v)}
              className="self-start text-[12px] font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 focus-ring rounded px-1 -mx-1 transition-colors mt-auto pt-1"
            >
              {showTranslation ? t("dashboard.quote.hideTranslation") : t("dashboard.quote.showTranslation")}
            </button>
            {showTranslation && (
              <p className="text-[12px] text-surface-600 dark:text-surface-400 italic border-l-2 border-primary-300 dark:border-primary-700 pl-3 mt-2 leading-relaxed animate-fade-in-up">
                {translationLines.map((line, i) => (
                  <span key={i}>{line}{i < translationLines.length - 1 && <br />}</span>
                ))}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ExamCountdown({ examDate, daysLeft }) {
  const { t } = useTranslation();
  const totalDays = 90;
  const days = daysLeft ?? 47;
  const pct = Math.max(0, Math.min(1, 1 - days / totalDays));

  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-accent-600 dark:text-accent-400">{t("dashboard.exam.eyebrow")}</p>
          <h3 className="text-[15px] font-bold text-surface-900 dark:text-surface-50">{examDate}</h3>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-surface-400">{t("dashboard.exam.scoreTarget")}</span>
      </div>
      <div className="flex items-end gap-3">
        <p className="font-editorial text-[56px] leading-none font-bold text-surface-900 dark:text-surface-50 num">{days}</p>
        <p className="text-[12px] text-surface-500 dark:text-surface-400 mb-2">
          {t("dashboard.exam.daysRemainingLine1")}<br />{t("dashboard.exam.daysRemainingLine2")}
        </p>
        <div className="flex-1 mb-1">
          <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono num text-surface-400 dark:text-surface-500 mt-1">
            <span>{t("dashboard.exam.registration")}</span>
            <span>{t("dashboard.exam.today", { days })}</span>
            <span>{t("dashboard.exam.exam")}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-surface-100 dark:divide-surface-800 -mx-1 text-center">
        <div className="px-2"><p className="text-[9px] uppercase tracking-[0.14em] text-surface-400">{t("dashboard.exam.listening")}</p><p className="text-[14px] font-bold text-surface-900 dark:text-surface-50 num">412</p></div>
        <div className="px-2"><p className="text-[9px] uppercase tracking-[0.14em] text-surface-400">{t("dashboard.exam.reading")}</p><p className="text-[14px] font-bold text-surface-900 dark:text-surface-50 num">438</p></div>
        <div className="px-2"><p className="text-[9px] uppercase tracking-[0.14em] text-surface-400">{t("dashboard.exam.lexGrammar")}</p><p className="text-[14px] font-bold text-surface-900 dark:text-surface-50 num">386</p></div>
      </div>
    </div>
  );
}

function WordCard({ word, loading, onShuffle, targetLanguage }) {
  const { t } = useTranslation();
  const pronunciation = word?.pronunciation || word?.ipa || "";
  const example = word?.example_sentence || word?.example || "";
  // The API still returns { french, english } shape; treat `french` as the target-language headword.
  const headword = word?.french || word?.term || "";
  const speechLang = targetLanguage === "en" ? "en-US" : "fr-FR";

  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 h-full animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 dark:text-primary-400">{t("dashboard.word.eyebrow")}</p>
        <button
          onClick={onShuffle}
          className="text-surface-300 dark:text-surface-600 hover:text-primary-500 transition-all focus-ring rounded p-1 disabled:opacity-50 hover:rotate-180 duration-500"
          aria-label={t("dashboard.word.newWord")}
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
            <h3 className="font-editorial italic text-[32px] leading-none text-surface-900 dark:text-surface-50">{headword}</h3>
            <AudioPlayButton text={headword} lang={speechLang} />
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
            to={`/dictionary?word=${encodeURIComponent(headword)}`}
            className="inline-flex items-center gap-1 mt-3 text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:gap-2 transition-all focus-ring rounded"
          >
            {t("dashboard.word.fullDefinition")}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </>
      )}
    </div>
  );
}

function QuickRail({ srsDue }) {
  const { t } = useTranslation();
  const items = [
    { label: t("dashboard.rail.flashcards"), icon: "cards",     to: "/practice/srs",       count: srsDue ? t("dashboard.rail.due", { count: srsDue }) : t("dashboard.rail.upToDate") },
    { label: t("dashboard.rail.roleplay"),   icon: "chat",      to: "/assistant",          count: t("dashboard.rail.ai") },
    { label: t("dashboard.rail.dictation"),  icon: "dictation", to: "/practice/dictation", count: t("dashboard.rail.source") },
    { label: t("dashboard.rail.miniGames"),  icon: "game",      to: "/mini-games",         count: t("dashboard.rail.games") },
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

function useTimeAgo() {
  const { t, i18n } = useTranslation();
  return (iso) => {
    if (!iso) return t("dashboard.timeAgo.recently");
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)      return t("dashboard.timeAgo.now");
    if (diff < 3600)    return t("dashboard.timeAgo.minutes", { count: Math.floor(diff / 60) });
    if (diff < 86400)   return t("dashboard.timeAgo.hours", { count: Math.floor(diff / 3600) });
    if (diff < 86400*2) return t("dashboard.timeAgo.yesterday");
    if (diff < 86400*7) return t("dashboard.timeAgo.days", { count: Math.floor(diff / 86400) });
    return d.toLocaleDateString(i18n.language || "en-US", { day: "numeric", month: "short" });
  };
}

function RecentActivity({ trend }) {
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();
  const events = [];

  if (trend?.top_activities?.length) {
    trend.top_activities.slice(0, 2).forEach((a) => {
      events.push({
        t: t("dashboard.activity.perWeek", { count: a.count || 0 }),
        txt: t(`dashboard.activity.types.${a.activity_type}`, { defaultValue: a.activity_type }),
        score: `+${a.total_xp ?? a.xp ?? 0} XP`,
        tone: "primary",
      });
    });
  }

  if (trend?.sample_mistakes?.length) {
    trend.sample_mistakes.slice(0, 2).forEach((m) => {
      events.push({
        t: timeAgo(m.created_at || m.timestamp),
        txt: m.user_text
          ? t("dashboard.activity.errorText", { text: m.user_text })
          : (m.context || t("dashboard.activity.recentError")),
        score: m.correct_text ? `→ ${m.correct_text}` : t("dashboard.activity.toReview"),
        tone: "danger",
      });
    });
  }

  if (trend?.streak >= 3) {
    events.push({
      t: t("dashboard.activity.today"),
      txt: t("dashboard.activity.streakDays", { count: trend.streak }),
      score: "🔥",
      tone: "success",
    });
  }

  const display = events.length > 0 ? events : [
    { t: "·", txt: t("dashboard.activity.noneYet"), score: "", tone: "primary" },
  ];

  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900/60 border border-surface-100 dark:border-surface-800 p-5 animate-fade-in-up">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">{t("dashboard.activity.eyebrow")}</p>
        <Link to="/progress" className="text-[11px] text-surface-400 hover:text-primary-500 transition-colors focus-ring rounded px-1">
          {t("dashboard.activity.viewAll")}
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

function ResumeBanner({ activity, onDismiss }) {
  const { t } = useTranslation();
  if (!activity) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800/50 px-4 py-3 animate-slide-in-down">
      <span className="shrink-0 w-9 h-9 rounded-xl bg-info-100 dark:bg-info-800/40 text-info-600 dark:text-info-300 flex items-center justify-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7z" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-info-700 dark:text-info-300">{t("dashboard.resume.eyebrow")}</p>
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{activity.label}</p>
      </div>
      <Link to={activity.url} className="btn-primary btn-sm shrink-0">{t("dashboard.resume.continue")}</Link>
      <button
        onClick={onDismiss}
        className="shrink-0 w-7 h-7 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-white/60 dark:hover:bg-surface-800/60 transition-colors flex items-center justify-center"
        aria-label={t("dashboard.resume.dismiss")}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const targetLanguage = user?.target_language || "fr";
  const [stats, setStats]     = useState(null);
  const [trend, setTrend]     = useState(null);
  const [srsDue, setSrsDue]   = useState(0);
  const [word, setWord]       = useState(null);
  const [wordLoading, setWordLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [lastActivity, dismissActivity] = useLastActivity();
  const animatedXP = useCountUp(stats?.total_xp ?? 0);

  const quotes = targetLanguage === "en" ? DAILY_QUOTES_EN : DAILY_QUOTES_FR;

  const initialQuoteIndex = useMemo(
    () => Math.floor(Date.now() / 86_400_000) % quotes.length,
    [quotes.length]
  );
  const [quoteIndex, setQuoteIndex] = useState(initialQuoteIndex);
  useEffect(() => {
    setQuoteIndex((q) => q % quotes.length);
  }, [quotes.length]);
  const shuffleQuote = () => setQuoteIndex((q) => (q + 1) % quotes.length);

  const examDaysLeft = user?.preferences?.exam_days_left
    ?? user?.preferences?.examDaysLeft
    ?? 47;
  const examDate = user?.preferences?.exam_date
    ?? user?.preferences?.examDate
    ?? t("dashboard.exam.defaultDate");

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

  const loadWord = () => {
    setWordLoading(true);
    getRandomVocabulary(1)
      .then((res) => {
        const data = res.data;
        const item = Array.isArray(data) ? data[0] : (data.results?.[0] ?? data);
        if (item) setWord(item);
      })
      .catch(() => {
        if (targetLanguage === "en") {
          setWord({
            french: "stroll",
            english: "to walk leisurely without purpose",
            pronunciation: "stroʊl",
            example: "We strolled along the river at sunset.",
          });
        } else {
          setWord({
            french: "flâner",
            english: "to stroll, to wander leisurely",
            pronunciation: "flɑ.ne",
            example: "J'aime flâner le long de la Seine au coucher du soleil.",
          });
        }
      })
      .finally(() => setWordLoading(false));
  };
  useEffect(() => { loadWord(); }, [targetLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5">
            <ExamCountdown examDate={examDate} daysLeft={examDaysLeft} />
          </div>
          <div className="lg:col-span-4">
            <WordCard word={word} loading={wordLoading} onShuffle={loadWord} targetLanguage={targetLanguage} />
          </div>
          <div className="lg:col-span-3">
            <QuickRail srsDue={srsDue} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <QuoteCard
            quotes={quotes}
            quoteIndex={quoteIndex}
            onShuffle={shuffleQuote}
            targetLanguage={targetLanguage}
          />
          <RecentActivity trend={trend} />
        </div>
      </div>
    </div>
  );
}
