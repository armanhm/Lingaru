import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  sendChatMessage,
  getConversations,
  getConversation,
  sendImageQuery,
  sendVoiceChat,
} from "../api/assistant";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import AudioPlayButton from "../components/AudioPlayButton";

/** Strip markdown formatting so TTS reads clean text, not "asterisk asterisk". */
function plainText(s) {
  if (!s) return "";
  return s
    .replace(/```[\s\S]*?```/g, " ")        // fenced code blocks
    .replace(/`([^`]*)`/g, "$1")             // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1")      // bold
    .replace(/\*([^*]+)\*/g, "$1")           // italic *…*
    .replace(/_([^_]+)_/g, "$1")             // italic _…_
    .replace(/~~([^~]+)~~/g, "$1")          // strikethrough
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")     // headings
    .replace(/^\s*[-*+]\s+/gm, "")          // bullets
    .replace(/^\s*\d+\.\s+/gm, "")           // numbered lists
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
    .replace(/\s+/g, " ")
    .trim();
}

/* ──────────────────────────────────────────────────────────────
 * Modes & Scenarios
 * ────────────────────────────────────────────────────────────── */
const MODE_OPTIONS = [
  {
    value: "conversation", label: "Conversation", emoji: "💬",
    description: "Pratique libre avec un tuteur",
    tagline: "Discutez librement en français — Claire vous corrigera au fil de la conversation.",
  },
  {
    value: "grammar_correction", label: "Correction", emoji: "✍️",
    description: "Faites corriger un texte français",
    tagline: "Collez un texte français — Claire le corrigera et vous expliquera chaque erreur.",
  },
  {
    value: "grammar_explanation", label: "Explication grammaire", emoji: "📚",
    description: "Comprendre un point de grammaire",
    tagline: "Posez une question de grammaire — Claire vous l'explique avec des exemples concrets.",
  },
  {
    value: "roleplay", label: "Roleplay", emoji: "🎭",
    description: "Mise en situation guidée",
    tagline: "Choisissez une scène et jouez-la avec Claire dans la peau d'un personnage.",
  },
];

const ROLEPLAY_SCENARIOS = [
  {
    value: "roleplay_market", emoji: "🥖", label: "Au marché",
    sub: "Vous êtes au marché des Enfants Rouges, à Paris. Vous voulez acheter un fromage et des fruits pour ce soir.",
    blurb: "Acheter du fromage et des fruits",
    level: "B1", minutes: 8,
    placeholder: "Bonjour ! Je voudrais un fromage pour ce soir…",
    starters: [
      "Bonjour, je cherche un fromage pour ce soir.",
      "Vous avez du Comté affiné ?",
      "C'est combien le kilo de pommes ?",
      "Je vais prendre 200 grammes, s'il vous plaît.",
    ],
  },
  {
    value: "roleplay_doctor", emoji: "🩺", label: "Chez le médecin",
    sub: "Vous consultez votre médecin généraliste. Vous avez mal à la tête depuis trois jours.",
    blurb: "Décrire un symptôme",
    level: "B1", minutes: 10,
    placeholder: "Bonjour docteur. J'ai mal à la tête depuis…",
    starters: [
      "Bonjour docteur, j'ai mal à la tête depuis trois jours.",
      "Je dors mal et je suis très fatigué(e).",
      "Est-ce que je peux avoir une ordonnance ?",
      "Je suis allergique aux antibiotiques.",
    ],
  },
  {
    value: "roleplay_hotel", emoji: "🏨", label: "À l'hôtel",
    sub: "Vous arrivez à votre hôtel à Lyon. Vous avez réservé une chambre pour deux nuits.",
    blurb: "Check-in et services de l'hôtel",
    level: "A2+", minutes: 6,
    placeholder: "Bonjour, j'ai une réservation au nom de…",
    starters: [
      "Bonjour, j'ai une réservation au nom de Martin.",
      "À quelle heure est le petit-déjeuner ?",
      "Est-ce que le Wi-Fi est gratuit ?",
      "Pouvez-vous m'appeler un taxi pour 8 heures ?",
    ],
  },
  {
    value: "roleplay_restaurant", emoji: "🍽️", label: "Au restaurant",
    sub: "Vous êtes en terrasse d'un bistrot parisien. Vous regardez la carte et vous voulez commander.",
    blurb: "Commander un plat et un dessert",
    level: "A2", minutes: 6,
    placeholder: "Bonjour, je voudrais voir la carte s'il vous plaît…",
    starters: [
      "Bonjour, je voudrais voir la carte s'il vous plaît.",
      "Quel est le plat du jour ?",
      "Je vais prendre le steak frites, à point.",
      "L'addition, s'il vous plaît !",
    ],
  },
  {
    value: "roleplay_train", emoji: "🚆", label: "À la gare",
    sub: "Vous êtes à la gare de Lyon. Vous voulez acheter un billet de TGV pour Marseille.",
    blurb: "Acheter un billet de train",
    level: "A2+", minutes: 5,
    placeholder: "Bonjour, je voudrais un billet pour Marseille…",
    starters: [
      "Bonjour, un aller-retour pour Marseille s'il vous plaît.",
      "Il y a un TGV vers 9 heures ?",
      "Combien coûte le billet en seconde classe ?",
      "De quel quai part le train ?",
    ],
  },
  {
    value: "roleplay_pharmacy", emoji: "💊", label: "À la pharmacie",
    sub: "Vous entrez dans une pharmacie. Vous avez mal à la gorge et vous cherchez un médicament.",
    blurb: "Demander un médicament sans ordonnance",
    level: "A2+", minutes: 6,
    placeholder: "Bonjour, j'ai mal à la gorge depuis…",
    starters: [
      "Bonjour, j'ai mal à la gorge depuis hier.",
      "Avez-vous quelque chose contre le rhume ?",
      "Est-ce que c'est sans ordonnance ?",
      "Je peux le prendre combien de fois par jour ?",
    ],
  },
  {
    value: "roleplay_bank", emoji: "🏦", label: "À la banque",
    sub: "Vous voulez ouvrir un compte bancaire pour étudiants à la BNP Paribas.",
    blurb: "Ouvrir un compte étudiant",
    level: "B1", minutes: 9,
    placeholder: "Bonjour, je voudrais ouvrir un compte étudiant…",
    starters: [
      "Bonjour, je voudrais ouvrir un compte étudiant.",
      "Quels documents dois-je apporter ?",
      "Y a-t-il des frais de tenue de compte ?",
      "Comment je peux faire un virement international ?",
    ],
  },
  {
    value: "roleplay_school", emoji: "🏫", label: "À l'école",
    sub: "Vous parlez avec un professeur après un cours de français. Vous avez des questions sur le devoir.",
    blurb: "Parler à un enseignant après le cours",
    level: "B1", minutes: 8,
    placeholder: "Bonjour Madame, j'ai une question sur le devoir…",
    starters: [
      "Bonjour Madame, j'ai une question sur le devoir.",
      "Pouvez-vous m'expliquer cette règle de grammaire ?",
      "Quand est-ce que nous devons rendre la dissertation ?",
      "Est-ce que je peux avoir un peu plus de temps ?",
    ],
  },
  {
    value: "roleplay_job_interview", emoji: "💼", label: "Entretien d'embauche",
    sub: "Vous passez un entretien pour un stage de design à Paris. La recruteuse vous pose des questions.",
    blurb: "Stage / poste · entretien professionnel",
    level: "B2", minutes: 14,
    placeholder: "Bonjour, je suis candidat(e) pour le poste de…",
    starters: [
      "Bonjour, je suis candidat(e) pour le poste de stagiaire en design.",
      "Voici un peu mon parcours…",
      "Mes qualités principales sont la créativité et la rigueur.",
      "Je souhaite rejoindre votre équipe parce que…",
    ],
  },
  {
    value: "roleplay_airport", emoji: "✈️", label: "À l'aéroport",
    sub: "Vous êtes au comptoir d'enregistrement à Roissy CDG. Vous partez pour Montréal.",
    blurb: "Enregistrement et bagages",
    level: "A2+", minutes: 7,
    placeholder: "Bonjour, je vais à Montréal, vol Air France…",
    starters: [
      "Bonjour, je vais à Montréal, vol Air France 348.",
      "Voici mon passeport et ma carte d'embarquement.",
      "Je n'ai qu'un bagage à main, c'est bon ?",
      "À quelle heure commence l'embarquement ?",
    ],
  },
];

const SCENARIOS_BY_VALUE = Object.fromEntries(ROLEPLAY_SCENARIOS.map((s) => [s.value, s]));

const PROMPT_TEMPLATES = {
  conversation: [
    "Comment dit-on « I would like to make a reservation » en français ?",
    "Corrige : « Je suis allé au magasin hier et j'ai acheter du pain. »",
    "Apprends-moi 5 expressions familières utilisées par les jeunes.",
    "Quelles sont les phrases utiles pour la vie quotidienne en France ?",
    "Raconte-moi quelque chose d'intéressant sur la culture française.",
  ],
  grammar_correction: [
    "Corrige : « Je mange beaucoup de les pommes chaque matin. »",
    "Hier, j'ai été au cinéma — est-ce correct ?",
    "Vérifie l'accord : « La voiture est beau et rapide. »",
    "Est-ce correct : « Il faut que tu viens avec moi » ?",
  ],
  grammar_explanation: [
    "Quelle est la différence entre passé composé et imparfait ?",
    "Quand utilise-t-on le subjonctif en français ?",
    "Explique du, de la, des, et de — avec des exemples.",
    "Comment marchent les verbes pronominaux ?",
    "Quand utilise-t-on « y » et « en » ?",
  ],
  // Roleplay starters are scenario-specific — see ROLEPLAY_SCENARIOS[*].starters
};

const TUTOR = {
  name: "Claire",
  region: "Paris",
  style: "amicale",
  emoji: "👩‍🦰",
  desc: "Trentenaire parisienne. Tutoie, parle vite, taquine gentiment.",
};

/* ──────────────────────────────────────────────────────────────
 * @-mention agents
 * Type "@" in the composer to summon a specific behaviour for the
 * current message. Each agent can override the assistant mode for
 * that single turn and prepends a directive to the message body.
 * ────────────────────────────────────────────────────────────── */
const AGENTS = [
  { key: "grammar",   emoji: "🧠", label: "Grammar",      hint: "Explique un point de grammaire", mode: "grammar_explanation",
    directive: "Explique le point de grammaire suivant en français, avec des exemples concrets B1-B2." },
  { key: "correct",   emoji: "✍️", label: "Correct",      hint: "Corrige un texte français",       mode: "grammar_correction",
    directive: "Corrige ce texte en français et explique chaque erreur." },
  { key: "vocab",     emoji: "📚", label: "Vocab",        hint: "Définition d'un mot",              mode: "conversation",
    directive: "Donne la définition, le genre, la prononciation IPA et 2 exemples du mot suivant." },
  { key: "conjugate", emoji: "✏️", label: "Conjugate",    hint: "Conjugue un verbe",                 mode: "conversation",
    directive: "Conjugue le verbe suivant aux 8 temps principaux (présent, imparfait, passé composé, futur simple, conditionnel présent, subjonctif présent, impératif, plus-que-parfait)." },
  { key: "translate", emoji: "🌐", label: "Translate",    hint: "Traduit FR ↔ EN",                  mode: "conversation",
    directive: "Traduis ce texte. Détecte la langue source et donne la traduction dans l'autre langue, avec une note sur les choix difficiles." },
  { key: "idiom",     emoji: "💬", label: "Idiom",        hint: "Explique une expression française", mode: "conversation",
    directive: "Explique cette expression idiomatique française : sens littéral, sens réel, registre, et un exemple d'usage." },
  { key: "culture",   emoji: "🇫🇷", label: "Culture",      hint: "Note culturelle sur la France",    mode: "conversation",
    directive: "Donne une note culturelle française liée au sujet suivant : contexte, anecdote, mots-clés." },
  { key: "pron",      emoji: "🔊", label: "Pronunciation", hint: "Prononciation + IPA",              mode: "conversation",
    directive: "Donne la prononciation phonétique (IPA) et un conseil concret pour bien prononcer ce mot/phrase." },
];
const AGENTS_BY_KEY = Object.fromEntries(AGENTS.map((a) => [a.key, a]));

/** Returns { start, end, query } if the caret sits inside an @-mention being typed, else null. */
function findActiveMention(text, caret) {
  if (caret == null) return null;
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      if (i === 0 || /\s/.test(text[i - 1])) {
        const slice = text.slice(i + 1, caret);
        if (!/\s/.test(slice)) {
          return { start: i, end: caret, query: slice };
        }
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

/** Returns the array of complete @agent tokens currently in the text (only valid ones). */
function parseMentions(text) {
  const out = [];
  const re = /(^|\s)@([a-zA-Z]+)\b/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const key = match[2].toLowerCase();
    if (AGENTS_BY_KEY[key]) out.push({ key, index: match.index + match[1].length });
  }
  return out;
}

/** Strip @agent tokens from text — used when sending to keep the conversation clean. */
function stripMentions(text) {
  return text.replace(/(^|\s)@([a-zA-Z]+)\b/g, (full, lead, name) => {
    return AGENTS_BY_KEY[name.toLowerCase()] ? lead : full;
  }).trim();
}

/* ──────────────────────────────────────────────────────────────
 * Inline icons
 * ────────────────────────────────────────────────────────────── */
const Ic = {
  menu:    (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>),
  sparkle: (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2zM5 16l.5 1.5L7 18l-1.5.5L5 20l-.5-1.5L3 18l1.5-.5L5 16z" /></svg>),
  search:  (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" /></svg>),
  close:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>),
  flag:    (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 21V4M4 4h13l-2 4 2 4H4" /></svg>),
  mic:     (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" /><path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" /></svg>),
  image:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" /></svg>),
  arrowUp: (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>),
  chevDown:(p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M5 9l7 7 7-7" /></svg>),
  globe:   (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>),
};

/* ──────────────────────────────────────────────────────────────
 * Drawer / Popover scaffolding
 * ────────────────────────────────────────────────────────────── */
function Drawer({ open, onClose, side = "left", title, children }) {
  if (!open) return null;
  const slideClass = side === "left" ? "left-0 animate-slide-in-left" : "right-0 animate-slide-in-right";
  const borderClass = side === "left" ? "border-r" : "border-l";

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 bottom-0 w-[340px] max-w-[90vw] bg-white dark:bg-surface-900 ${borderClass} border-surface-100 dark:border-surface-800 shadow-card-elevated flex flex-col ${slideClass}`}
      >
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-surface-900 dark:text-surface-50 flex-1">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 focus-ring"
            aria-label="Fermer"
          >
            <Ic.close className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * History Drawer (left) — modes + scenarios + conversations
 * ────────────────────────────────────────────────────────────── */
function HistoryDrawer({
  open, onClose, mode, onModeChange, scenario, onScenarioChange,
  conversations, activeId, onPickConversation, onNewChat,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [conversations, search]);

  return (
    <Drawer open={open} onClose={onClose} side="left" title="Conversations">
      <div className="p-3 border-b border-surface-100 dark:border-surface-800 space-y-3">
        <button
          onClick={() => { onNewChat(); onClose(); }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-primary-600 to-purple-700 text-white px-3 py-2.5 rounded-xl font-semibold text-[13px] shadow-glow-primary hover:scale-[1.02] active:scale-95 transition-all focus-ring"
        >
          <Ic.sparkle className="w-3.5 h-3.5" /> Nouvelle conversation
        </button>
        <div className="relative">
          <Ic.search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-2 text-[12.5px] rounded-lg bg-surface-50 dark:bg-surface-800/60 border border-surface-100 dark:border-surface-700 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/40 focus:border-primary-400"
          />
        </div>
      </div>

      <div className="px-3 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">Mode</p>
      </div>
      <div className="px-3 grid grid-cols-2 gap-1.5 mb-3">
        {MODE_OPTIONS.map((m) => {
          const active = m.value === mode;
          return (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={`text-left p-2 rounded-lg border transition-all ${
                active
                  ? "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20"
                  : "border-surface-100 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700"
              }`}
              title={m.description}
            >
              <span className="text-[14px] leading-none">{m.emoji}</span>
              <p className="text-[11.5px] font-semibold text-surface-900 dark:text-surface-50 truncate mt-1">{m.label}</p>
            </button>
          );
        })}
      </div>

      {mode === "roleplay" && (
        <>
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">Scénarios</p>
          </div>
          <div className="px-3 grid grid-cols-2 gap-1.5 mb-3">
            {ROLEPLAY_SCENARIOS.map((s) => {
              const active = s.value === scenario;
              return (
                <button
                  key={s.value}
                  onClick={() => onScenarioChange(s.value)}
                  className={`text-left p-2 rounded-lg border transition-all ${
                    active
                      ? "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20"
                      : "border-surface-100 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700"
                  }`}
                >
                  <span className="text-[14px] leading-none">{s.emoji}</span>
                  <p className="text-[11.5px] font-semibold text-surface-900 dark:text-surface-50 truncate mt-1">{s.label}</p>
                  <p className="text-[10px] text-surface-400 dark:text-surface-500 num">{s.level} · {s.minutes} min</p>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="px-3 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">Historique</p>
      </div>
      <div className="px-2 pb-3 space-y-0.5">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-surface-500 dark:text-surface-400 text-center">
            Aucune conversation pour l'instant.
          </p>
        )}
        {filtered.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => { onPickConversation(c.id); onClose(); }}
              className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 transition-colors ${
                active
                  ? "bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800"
                  : "hover:bg-surface-50 dark:hover:bg-surface-800/40"
              }`}
            >
              <span className="text-[13px] leading-none mt-0.5 shrink-0">💬</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-semibold text-surface-900 dark:text-surface-50 truncate">{c.title || "Sans titre"}</span>
                <span className="block text-[10.5px] text-surface-400 dark:text-surface-500 truncate">
                  {c.message_count ?? 0} messages
                </span>
              </span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0 animate-pulse" />}
            </button>
          );
        })}
      </div>
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Tuteur Drawer (right) — persona + active mode/scenario
 * ────────────────────────────────────────────────────────────── */
function TuteurDrawer({ open, onClose, mode, onModeChange, scenario, onScenarioChange }) {
  const sc = SCENARIOS_BY_VALUE[scenario] || ROLEPLAY_SCENARIOS[0];
  return (
    <Drawer open={open} onClose={onClose} side="right" title="Tuteur · session">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[26px] shadow-glow-primary shrink-0">{TUTOR.emoji}</span>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-surface-900 dark:text-surface-50">{TUTOR.name}</p>
            <p className="text-[12px] text-surface-500 dark:text-surface-400">{TUTOR.region} · {TUTOR.style}</p>
          </div>
        </div>
        <p className="text-[13px] text-surface-600 dark:text-surface-300 leading-snug italic">"{TUTOR.desc}"</p>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-2">Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map((m) => {
              const active = m.value === mode;
              return (
                <button
                  key={m.value}
                  onClick={() => onModeChange(m.value)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${
                    active
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700"
                  }`}
                >
                  <span className="text-[20px]">{m.emoji}</span>
                  <div className="text-left min-w-0">
                    <p className="text-[12.5px] font-bold text-surface-900 dark:text-surface-50 truncate">{m.label}</p>
                    <p className="text-[10px] text-surface-500 truncate">{m.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {mode === "roleplay" && (
          <div className="border-t border-surface-100 dark:border-surface-800 pt-4">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-primary-600 mb-2">Scénario actif</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[28px]">{sc.emoji}</span>
              <div>
                <p className="text-[14px] font-bold text-surface-900 dark:text-surface-50">{sc.label}</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">{sc.blurb || sc.sub} · {sc.level} · {sc.minutes} min</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLEPLAY_SCENARIOS.map((s) => {
                const active = s.value === scenario;
                return (
                  <button
                    key={s.value}
                    onClick={() => onScenarioChange(s.value)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left text-[11.5px] font-semibold transition-all ${
                      active
                        ? "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        : "border-surface-100 dark:border-surface-800 text-surface-600 dark:text-surface-300 hover:border-primary-300 dark:hover:border-primary-700"
                    }`}
                  >
                    <span className="text-[14px]">{s.emoji}</span>
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Erreurs Drawer (right) — inline mistakes from the session
 * ────────────────────────────────────────────────────────────── */
function ErreursDrawer({ open, onClose, mistakes }) {
  return (
    <Drawer open={open} onClose={onClose} side="right" title="Corrections · cette session">
      <div className="p-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-danger-600">Erreurs</p>
          <span className="text-[20px] font-bold num text-danger-600">{mistakes.length}</span>
        </div>
        {mistakes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-200 dark:border-surface-700 px-4 py-8 text-center">
            <p className="text-[12px] text-surface-500 dark:text-surface-400">
              Pas d'erreur détectée pour l'instant. Continuez à écrire — vos corrections apparaîtront ici.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {mistakes.map((iss, i) => (
              <li key={i} className="text-[12px] leading-snug border-l-2 border-danger-200 dark:border-danger-900/40 pl-3">
                <p className="text-danger-600 dark:text-danger-400 line-through font-semibold text-[13px]">{iss.from}</p>
                <p className="text-success-700 dark:text-success-400 font-semibold text-[13px]">→ {iss.to}</p>
                {iss.note && <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">{iss.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────────
 * CorrectedText — wraps `from` substrings with wavy underline + tooltip,
 * and renders @mentions as gradient pills.
 * ────────────────────────────────────────────────────────────── */
function CorrectedText({ text, issues, tone = "default" }) {
  if (!issues || !issues.length) return <MentionedText text={text} tone={tone} />;
  const parts = [];
  let cursor = 0;
  let key = 0;
  issues.forEach((iss) => {
    const idx = text.indexOf(iss.from, cursor);
    if (idx === -1) return;
    if (idx > cursor) parts.push(<MentionedText key={key++} text={text.slice(cursor, idx)} tone={tone} />);
    parts.push(
      <span key={key++} className="relative group/iss inline-block">
        <span className="underline-wavy cursor-help">{iss.from}</span>
        <span className="absolute z-20 left-0 top-full mt-1 w-72 p-3 bg-ink-900 text-white text-[12px] rounded-xl shadow-card-elevated opacity-0 group-hover/iss:opacity-100 transition-opacity pointer-events-none">
          <span className="block text-danger-300 line-through font-semibold text-[13px]">{iss.from}</span>
          <span className="block text-success-300 font-semibold text-[13px] mb-1">→ {iss.to}</span>
          {iss.note && <span className="block text-surface-200 text-[11.5px] leading-snug">{iss.note}</span>}
        </span>
      </span>
    );
    cursor = idx + iss.from.length;
  });
  if (cursor < text.length) parts.push(<MentionedText key={key++} text={text.slice(cursor)} tone={tone} />);
  return <>{parts}</>;
}

/* ──────────────────────────────────────────────────────────────
 * ChatBubble
 * ────────────────────────────────────────────────────────────── */
function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fade-in-up`}>
      <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[16px] shadow-sm ${
        isUser
          ? "bg-gradient-to-br from-accent-500 to-warn-500 text-white"
          : "bg-gradient-to-br from-primary-500 to-purple-600 text-white"
      }`}>{isUser ? "🧑" : TUTOR.emoji}</span>
      <div className={`max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-1">
          <span>{isUser ? "Vous" : TUTOR.name}</span>
        </div>

        {msg.imagePreview && (
          <img src={msg.imagePreview} alt="Uploaded" className="max-w-[280px] max-h-48 rounded-2xl mb-1.5 shadow-sm" />
        )}

        <div className={`relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-primary-600 to-purple-700 text-white rounded-br-sm"
            : "bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 text-surface-900 dark:text-surface-50 rounded-bl-sm"
        }`}>
          {isUser ? (
            <CorrectedText text={msg.content} issues={msg.issues} tone="on-dark" />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1
              prose-h3:text-base prose-h3:font-semibold
              prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
              prose-strong:font-semibold prose-em:italic
              prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs
              prose-table:my-2 prose-table:text-[12.5px] prose-table:border-collapse
              prose-th:bg-surface-50 dark:prose-th:bg-surface-800 prose-th:px-2 prose-th:py-1.5 prose-th:font-semibold prose-th:text-left prose-th:border prose-th:border-surface-200 dark:prose-th:border-surface-700
              prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-surface-200 dark:prose-td:border-surface-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ""}</ReactMarkdown>
            </div>
          )}
          {/* TTS button — appears on hover, sits in the corner opposite the bubble tail */}
          {plainText(msg.content) && (
            <div className={`absolute -bottom-2 ${isUser ? "left-1" : "right-1"} opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
              <div className={`rounded-full ${isUser ? "bg-primary-700/90" : "bg-white dark:bg-surface-800 shadow-card border border-surface-100 dark:border-surface-700"}`}>
                <AudioPlayButton text={plainText(msg.content)} size="xs" tone={isUser ? "on-dark" : "default"} />
              </div>
            </div>
          )}
        </div>

        {!isUser && msg.audioUrl && (
          <audio controls className="mt-2 w-full max-w-[280px]" src={msg.audioUrl}>
            Your browser does not support audio.
          </audio>
        )}
        {!isUser && msg.ragUsed && (
          <p className="text-[10.5px] text-info-600 dark:text-info-400 mt-1.5 flex items-center gap-1 font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Avec vos documents
          </p>
        )}
        {isUser && msg.issues?.length > 0 && (
          <p className="mt-1 text-[10.5px] text-danger-600 dark:text-danger-400 font-mono">
            {msg.issues.length} {msg.issues.length === 1 ? "correction" : "corrections"} · survolez les mots soulignés
          </p>
        )}
        {!isUser && msg.provider && (
          <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1.5 uppercase tracking-wider font-medium">{msg.provider}</p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * TypingIndicator
 * ────────────────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <span className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 text-white flex items-center justify-center text-[16px] shadow-sm">{TUTOR.emoji}</span>
      <div className="bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Image preview banner
 * ────────────────────────────────────────────────────────────── */
function ImagePreviewBanner({ file, onRemove }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!preview) return null;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-y border-info-200 dark:border-info-800 bg-info-50 dark:bg-info-900/20 animate-slide-in-down">
      <img src={preview} alt="Preview" className="h-12 w-12 object-cover rounded-lg shadow-sm" />
      <span className="text-sm font-medium text-info-700 dark:text-info-300 flex-1 truncate">{file.name}</span>
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-full flex items-center justify-center text-info-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-all active:scale-95 focus-ring"
        title="Retirer l'image"
      >
        <Ic.close className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * MentionPopover — palette of agents shown above the textarea
 * ────────────────────────────────────────────────────────────── */
function MentionPopover({ open, query, onPick, onClose, activeIndex, setActiveIndex, matches }) {
  if (!open || matches.length === 0) return null;
  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-card-elevated overflow-hidden animate-fade-in-up z-30"
      role="listbox"
      aria-label="Agents disponibles"
    >
      <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400">
          Agents · @{query || "…"}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-surface-400 dark:text-surface-500">
          <span><kbd className="kbd">↑↓</kbd> naviguer</span>
          <span><kbd className="kbd">Tab</kbd> compléter</span>
          <span><kbd className="kbd">Esc</kbd> fermer</span>
        </div>
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {matches.map((a, i) => {
          const active = i === activeIndex;
          return (
            <li key={a.key}>
              <button
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onPick(a)}
                role="option"
                aria-selected={active}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  active
                    ? "bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/40 dark:to-purple-900/30"
                    : "hover:bg-surface-50 dark:hover:bg-surface-800/40"
                }`}
              >
                <span className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 text-white flex items-center justify-center text-base shadow-sm">
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-surface-900 dark:text-surface-50 flex items-center gap-1.5">
                    @{a.key}
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-surface-400 dark:text-surface-500 font-semibold">{a.label}</span>
                  </p>
                  <p className="text-[11.5px] text-surface-500 dark:text-surface-400 leading-tight truncate">{a.hint}</p>
                </div>
                {active && (
                  <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.12em] text-primary-600 dark:text-primary-400 font-semibold">
                    Tab ↵
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * MentionedText — renders text with @agent tokens as gradient pills
 * Used in chat bubbles and the composer's echo strip.
 * ────────────────────────────────────────────────────────────── */
function MentionedText({ text, tone = "default" }) {
  // "default" = light pill on white/surface bubbles
  // "on-dark" = high-contrast white pill for user (gradient) bubbles
  const pillClass = tone === "on-dark"
    ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/25 text-white ring-1 ring-white/40 font-semibold whitespace-nowrap"
    : "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-100 ring-1 ring-primary-300/60 dark:ring-primary-700/60 font-semibold whitespace-nowrap";

  const parts = [];
  const re = /(^|\s)(@[a-zA-Z]+)/g;
  let last = 0;
  let key = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tagStart = m.index + m[1].length;
    const tag = m[2];
    const agentKey = tag.slice(1).toLowerCase();
    const agent = AGENTS_BY_KEY[agentKey];
    if (!agent) continue;
    if (tagStart > last) parts.push(<span key={key++}>{text.slice(last, tagStart)}</span>);
    parts.push(
      <span
        key={key++}
        className={pillClass}
        title={agent.hint}
      >
        <span className="text-[11px]">{agent.emoji}</span>
        {tag}
      </span>
    );
    last = tagStart + tag.length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts.length ? <>{parts}</> : <>{text}</>;
}

/* ──────────────────────────────────────────────────────────────
 * MAIN — Assistant
 * ────────────────────────────────────────────────────────────── */
export default function Assistant() {
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState(() => {
    const m = searchParams.get("mode");
    return ["conversation", "grammar_correction", "grammar_explanation", "roleplay"].includes(m) ? m : "conversation";
  });
  const [scenario, setScenario] = useState(() => {
    const s = searchParams.get("scenario");
    return s && s.startsWith("roleplay_") ? s : "roleplay_market";
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => searchParams.get("prompt") || "");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [tuteurOpen, setTuteurOpen] = useState(false);
  const [erreursOpen, setErreursOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  // @-mention state
  const [mention, setMention] = useState(null); // { start, end, query } when active
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    if (!q) return AGENTS;
    return AGENTS.filter((a) =>
      a.key.startsWith(q) || a.label.toLowerCase().startsWith(q)
    );
  }, [mention]);
  useEffect(() => {
    if (mentionIndex >= mentionMatches.length) setMentionIndex(0);
  }, [mentionMatches.length, mentionIndex]);

  // Mistakes are derived per-message — not yet provided by the backend.
  // We keep the UI for future wiring.
  const mistakes = useMemo(
    () => messages.flatMap((m) => (m.role === "user" && m.issues) ? m.issues : []),
    [messages]
  );

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    getConversations()
      .then((res) => setConversations(res.data.results || []))
      .catch(() => {});
  }, [conversationId]);

  const loadConversation = useCallback(async (id) => {
    try {
      const res = await getConversation(id);
      setMessages(res.data.messages || []);
      setConversationId(id);
      setError(null);
    } catch {
      setError("Impossible de charger cette conversation.");
    }
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setImageFile(null);
  }, []);

  // Image upload
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };
  const removeImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (loading) return;
    if (!trimmed && !imageFile) return;
    setError(null);
    setLoading(true);

    if (imageFile) {
      const imagePreview = URL.createObjectURL(imageFile);
      const userMessage = {
        role: "user",
        content: trimmed || "[Image envoyée pour analyse]",
        imagePreview,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      try {
        const res = await sendImageQuery(imageFile, trimmed, conversationId);
        const assistantMessage = {
          role: "assistant",
          content: res.data.ai_response,
          provider: res.data.provider,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationId(res.data.conversation_id);
      } catch (err) {
        setError(err.response?.data?.detail || "Échec de l'analyse de l'image.");
      } finally {
        setLoading(false);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }

    // The user's bubble shows the original (with @-mentions visible).
    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // If the message has agent mentions, the LAST one wins for routing
    // — its mode overrides the session mode for this turn, and its
    // directive is prepended to the message body sent to the LLM.
    const mentions = parseMentions(trimmed);
    const lastAgent = mentions.length ? AGENTS_BY_KEY[mentions[mentions.length - 1].key] : null;

    let outgoingText = trimmed;
    let outgoingMode = mode === "roleplay" ? scenario : mode;
    if (lastAgent) {
      outgoingMode = lastAgent.mode;
      const cleaned = stripMentions(trimmed);
      outgoingText = cleaned ? `${lastAgent.directive}\n\n${cleaned}` : lastAgent.directive;
    }

    try {
      const res = await sendChatMessage(outgoingText, outgoingMode, conversationId);
      const assistantMessage = {
        role: "assistant",
        content: res.data.reply,
        provider: res.data.provider,
        ragUsed: res.data.rag_used || false,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(res.data.conversation_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Échec de l'envoi du message.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, scenario, conversationId, imageFile]);

  // Voice
  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;
      setLoading(true);
      setError(null);
      const userMessage = { role: "user", content: "[Enregistrement vocal…]" };
      setMessages((prev) => [...prev, userMessage]);
      try {
        const res = await sendVoiceChat(blob, conversationId);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "user", content: res.data.transcription };
          return updated;
        });
        const assistantMessage = {
          role: "assistant",
          content: res.data.ai_response_text,
          provider: res.data.provider,
          audioUrl: res.data.ai_response_audio_url,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationId(res.data.conversation_id);
      } catch (err) {
        setError(err.response?.data?.detail || "Échec de l'envoi vocal.");
      } finally {
        setLoading(false);
      }
    } else {
      try { await startRecording(); }
      catch { setError("Microphone refusé. Autorisez l'accès pour parler."); }
    }
  }, [isRecording, startRecording, stopRecording, conversationId]);

  const handleTemplate = useCallback((text) => setInput(text), []);

  // Update mention state from current textarea selection
  const updateMentionFromCaret = useCallback((nextValue, caret) => {
    const m = findActiveMention(nextValue, caret);
    setMention(m);
    setMentionIndex(0);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    updateMentionFromCaret(value, e.target.selectionStart);
  };

  const handleSelectionChange = (e) => {
    updateMentionFromCaret(e.target.value, e.target.selectionStart);
  };

  /** Insert the agent in place of the active @-fragment, append a space. */
  const insertAgent = useCallback((agent) => {
    if (!mention) return;
    const before = input.slice(0, mention.start);
    const after  = input.slice(mention.end);
    const inserted = `@${agent.key}`;
    const next = `${before}${inserted}${after.startsWith(" ") ? "" : " "}${after}`;
    setInput(next);
    setMention(null);
    // Move caret just after the inserted token + space
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = before.length + inserted.length + 1;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    });
  }, [input, mention]);

  const handleKeyDown = (e) => {
    // Mention popover is open and we have results — intercept nav keys
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        insertAgent(mentionMatches[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sc = SCENARIOS_BY_VALUE[scenario] || ROLEPLAY_SCENARIOS[0];
  const activeMode = MODE_OPTIONS.find((m) => m.value === mode) || MODE_OPTIONS[0];
  const placeholder =
    imageFile ? "Posez une question sur l'image (optionnel)…"
    : mode === "grammar_correction" ? "Collez un texte français à corriger…"
    : mode === "grammar_explanation" ? "Posez une question de grammaire…"
    : mode === "roleplay" ? (sc.placeholder || "Dites quelque chose en français pour démarrer la scène…")
    : "Écrivez en français… Claire vous corrigera gentiment.";

  // Suggested starters: scenario-specific in roleplay, mode-specific otherwise.
  const starters = mode === "roleplay"
    ? (sc.starters || [])
    : (PROMPT_TEMPLATES[mode] || PROMPT_TEMPLATES.conversation);

  return (
    <div className="h-full flex flex-col bg-surface-50 dark:bg-surface-950 overflow-hidden">
      {/* ═══ Sticky session header ═══════════════════════════════ */}
      <div className="px-3 sm:px-5 py-2.5 bg-white/85 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-100 dark:border-surface-800 shrink-0">
        <div className="flex items-center gap-2 max-w-5xl mx-auto">
          {/* History toggle */}
          <button
            onClick={() => setHistoryOpen(true)}
            title="Conversations"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-surface-500 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 focus-ring"
          >
            <Ic.menu className="w-[18px] h-[18px]" />
          </button>

          {/* Nouvelle conversation as primary action button */}
          <button
            onClick={startNewChat}
            title="Nouvelle conversation"
            className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold text-[12.5px] hover:bg-primary-100 dark:hover:bg-primary-900/50 focus-ring"
          >
            <Ic.sparkle className="w-3.5 h-3.5" /> Nouvelle
          </button>

          <div className="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-1 hidden sm:block" />

          {/* Active mode/scenario chip */}
          <span className="text-[22px] shrink-0">{mode === "roleplay" ? sc.emoji : activeMode.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-editorial text-[20px] leading-none text-surface-900 dark:text-surface-50">
                {mode === "roleplay" ? sc.label : activeMode.label}
              </h2>
              {mode === "roleplay" && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-[0.14em] bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                  {sc.level}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-surface-500 dark:text-surface-400 mt-0.5 truncate">
              avec <span className="font-semibold text-surface-700 dark:text-surface-200">{TUTOR.name}</span>
              {mode === "roleplay" ? ` · ${sc.blurb || sc.sub}` : ` · ${activeMode.description}`}
            </p>
          </div>

          {/* Tuteur button */}
          <button
            onClick={() => setTuteurOpen(true)}
            title="Tuteur"
            className="flex items-center gap-2 h-9 pl-1.5 pr-2 sm:pr-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-surface-900 transition-colors focus-ring"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-[14px] shadow-sm">{TUTOR.emoji}</span>
            <span className="hidden sm:inline text-[12px] font-semibold text-surface-700 dark:text-surface-200">{TUTOR.name}</span>
            <Ic.chevDown className="w-3 h-3 text-surface-400 hidden sm:inline" />
          </button>

          {/* Erreurs button */}
          <button
            onClick={() => setErreursOpen(true)}
            title="Corrections"
            className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:border-danger-300 dark:hover:border-danger-700 bg-white dark:bg-surface-900 focus-ring"
          >
            <Ic.flag className="w-3.5 h-3.5 text-danger-500" />
            <span className="text-[12px] font-semibold num text-surface-700 dark:text-surface-200">{mistakes.length}</span>
          </button>
        </div>
      </div>

      {/* ═══ Image preview banner ═══════════════════════════════ */}
      <ImagePreviewBanner file={imageFile} onRemove={removeImage} />

      {/* ═══ Messages area ══════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6">
        {messages.length === 0 && !loading ? (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
            {/* Mise en situation card */}
            <div className="rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 bg-white/60 dark:bg-surface-900/40 p-5 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 text-white flex items-center justify-center text-2xl shadow-glow-primary">
                {mode === "roleplay" ? sc.emoji : activeMode.emoji}
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-1">
                {mode === "roleplay" ? "Mise en situation" : activeMode.label}
              </p>
              <p className="font-editorial text-[18px] sm:text-[20px] text-surface-900 dark:text-surface-50 italic max-w-[60ch] mx-auto">
                {mode === "roleplay" ? sc.sub : activeMode.tagline}
              </p>
            </div>

            {/* Suggested prompts */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-3 text-center">
                {mode === "roleplay" ? "Pour commencer la scène, essayez :" : "Essayez l'une de ces phrases"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {starters.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => handleTemplate(t)}
                    className="text-left px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:-translate-y-0.5 hover:shadow-sm transition-all animate-fade-in-up focus-ring"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <p className="text-[13px] text-surface-800 dark:text-surface-100 leading-snug">
                      <span className="text-primary-500 mr-1.5">↗</span>
                      {t}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m, i) => (
              <ChatBubble key={i} msg={m} />
            ))}
            {loading && <TypingIndicator />}

            {error && (
              <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300 animate-shake flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ═══ Composer ═══════════════════════════════════════════ */}
      <div className="border-t border-surface-100 dark:border-surface-800 p-3 sm:p-4 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {/* @-mention popover */}
          <MentionPopover
            open={!!mention}
            query={mention?.query || ""}
            matches={mentionMatches}
            activeIndex={mentionIndex}
            setActiveIndex={setMentionIndex}
            onPick={insertAgent}
            onClose={() => setMention(null)}
          />

          {/* Echo strip — shows the typed message with @mentions colored, only when at least one mention is present */}
          {parseMentions(input).length > 0 && (
            <div className="mb-1.5 px-3 py-1.5 rounded-lg bg-primary-50/40 dark:bg-primary-900/15 border border-primary-100 dark:border-primary-900/40 text-[12.5px] leading-snug text-surface-700 dark:text-surface-200 break-words">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-600 dark:text-primary-400 font-semibold mr-2">Aperçu</span>
              <MentionedText text={input} />
            </div>
          )}

          <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900/40 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelectionChange}
              onClick={handleSelectionChange}
              placeholder={placeholder}
              rows={2}
              disabled={loading}
              className="w-full px-4 py-3 bg-transparent text-[14px] resize-none focus:outline-none text-surface-900 dark:text-surface-50 placeholder:text-surface-400 dark:placeholder:text-surface-500 disabled:opacity-60"
            />
            <div className="flex items-center gap-1 px-2 pb-2 pt-1">
              {/* Image upload */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Image"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 active:scale-95 transition-all disabled:opacity-50 focus-ring"
              >
                <Ic.image className="w-4 h-4" />
              </button>

              {/* Voice */}
              <button
                onClick={handleVoiceToggle}
                disabled={loading && !isRecording}
                title={isRecording ? "Arrêter l'enregistrement" : "Voix"}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 focus-ring ${
                  isRecording
                    ? "bg-danger-100 dark:bg-danger-900/40 text-danger-600 dark:text-danger-400 animate-recording-pulse"
                    : "text-surface-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                } disabled:opacity-50`}
              >
                <Ic.mic className="w-4 h-4" />
              </button>

              <button title="Traduire" className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all focus-ring">
                <Ic.globe className="w-4 h-4" />
              </button>

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={loading || (!input.trim() && !imageFile)}
                className="ml-auto bg-gradient-to-br from-primary-600 to-purple-700 disabled:from-surface-300 disabled:to-surface-400 dark:disabled:from-surface-700 dark:disabled:to-surface-600 text-white px-4 py-2 rounded-lg text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
              >
                Envoyer <Ic.arrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isRecording && (
            <p className="text-xs text-danger-600 dark:text-danger-400 mt-2 text-center font-semibold flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 bg-danger-500 rounded-full animate-pulse" />
              Enregistrement… cliquez le micro pour arrêter.
            </p>
          )}

          <p className="text-[10px] font-mono text-surface-400 dark:text-surface-500 text-center mt-2">
            Entrée pour envoyer · Shift+Entrée pour une nouvelle ligne · tapez <kbd className="kbd">@</kbd> pour invoquer un agent ·{" "}
            <Link to="/agents" className="text-primary-500 dark:text-primary-400 hover:underline">galerie d'agents →</Link>
          </p>
        </div>
      </div>

      {/* ═══ Drawers / Popovers ═════════════════════════════════ */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        mode={mode}
        onModeChange={setMode}
        scenario={scenario}
        onScenarioChange={setScenario}
        conversations={conversations}
        activeId={conversationId}
        onPickConversation={loadConversation}
        onNewChat={startNewChat}
      />
      <TuteurDrawer
        open={tuteurOpen}
        onClose={() => setTuteurOpen(false)}
        mode={mode}
        onModeChange={setMode}
        scenario={scenario}
        onScenarioChange={setScenario}
      />
      <ErreursDrawer
        open={erreursOpen}
        onClose={() => setErreursOpen(false)}
        mistakes={mistakes}
      />
    </div>
  );
}
