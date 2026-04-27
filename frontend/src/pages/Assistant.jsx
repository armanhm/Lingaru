import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  sendChatMessage,
  getConversations,
  getConversation,
  sendImageQuery,
  sendVoiceChat,
} from "../api/assistant";
import useVoiceRecorder from "../hooks/useVoiceRecorder";

/* ──────────────────────────────────────────────────────────────
 * Modes & Scenarios
 * ────────────────────────────────────────────────────────────── */
const MODE_OPTIONS = [
  { value: "conversation",        label: "Conversation",        emoji: "💬", description: "Pratique libre avec un tuteur" },
  { value: "grammar_correction",  label: "Correction",          emoji: "✍️", description: "Faites corriger un texte français" },
  { value: "grammar_explanation", label: "Explication grammaire", emoji: "📚", description: "Comprendre un point de grammaire" },
  { value: "roleplay",            label: "Roleplay",            emoji: "🎭", description: "Mise en situation guidée" },
];

const ROLEPLAY_SCENARIOS = [
  { value: "roleplay_market",       emoji: "🥖", label: "Au marché",        sub: "Acheter du fromage et des fruits", level: "B1",  minutes: 8  },
  { value: "roleplay_doctor",       emoji: "🩺", label: "Chez le médecin",  sub: "Décrire un symptôme",              level: "B1",  minutes: 10 },
  { value: "roleplay_hotel",        emoji: "🏨", label: "À l'hôtel",        sub: "Check-in, services",                level: "A2+", minutes: 6  },
  { value: "roleplay_restaurant",   emoji: "🍽️", label: "Au restaurant",    sub: "Commander un plat",                 level: "A2",  minutes: 6  },
  { value: "roleplay_train",        emoji: "🚆", label: "Gare SNCF",        sub: "Acheter un billet",                 level: "A2+", minutes: 5  },
  { value: "roleplay_pharmacy",     emoji: "💊", label: "Pharmacie",        sub: "Demander un médicament",            level: "A2+", minutes: 6  },
  { value: "roleplay_bank",         emoji: "🏦", label: "À la banque",      sub: "Ouvrir un compte",                  level: "B1",  minutes: 9  },
  { value: "roleplay_school",       emoji: "🏫", label: "À l'école",        sub: "Parler à un enseignant",            level: "B1",  minutes: 8  },
  { value: "roleplay_job_interview",emoji: "💼", label: "Entretien d'embauche", sub: "Stage / poste",                level: "B2",  minutes: 14 },
  { value: "roleplay_airport",      emoji: "✈️", label: "Aéroport",         sub: "Enregistrement / bagages",          level: "A2+", minutes: 7  },
];

const SCENARIOS_BY_VALUE = Object.fromEntries(ROLEPLAY_SCENARIOS.map((s) => [s.value, s]));

const PROMPT_TEMPLATES = {
  conversation: [
    "Comment dit-on « I would like to make a reservation » en français ?",
    "Corrige : « Je suis allé au magasin hier et j'ai acheter du pain. »",
    "Apprends-moi 5 expressions familières utilisées par les jeunes.",
    "Quelles sont les phrases utiles pour la vie quotidienne ?",
    "Raconte-moi quelque chose d'intéressant sur la culture française.",
  ],
  grammar_correction: [
    "Corrige : « Je mange beaucoup de les pommes chaque matin. »",
    "Hier, j'ai été au cinéma — est-ce correct ?",
    "Vérifie l'accord : « La voiture est beau et rapide. »",
    "Est-ce correct : « Il faut que tu viens avec moi » ?",
  ],
  grammar_explanation: [
    "Passé composé vs imparfait — donne-moi des exemples.",
    "Quand utilise-t-on le subjonctif en français ?",
    "Explique du, de la, des et de.",
    "Comment marchent les verbes pronominaux ?",
  ],
  roleplay: [
    "Bonjour, je voudrais commencer.",
    "Excusez-moi, pouvez-vous m'aider ?",
    "Je ne comprends pas, pouvez-vous répéter plus lentement ?",
    "Combien ça coûte ?",
  ],
};

const TUTOR = {
  name: "Claire",
  region: "Paris",
  style: "amicale",
  emoji: "👩‍🦰",
  desc: "Trentenaire parisienne. Tutoie, parle vite, taquine gentiment.",
};

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
                <p className="text-[11px] text-surface-500 dark:text-surface-400">{sc.sub} · {sc.level} · {sc.minutes} min</p>
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
 * CorrectedText — wraps `from` substrings with wavy underline + tooltip
 * ────────────────────────────────────────────────────────────── */
function CorrectedText({ text, issues }) {
  if (!issues || !issues.length) return <span>{text}</span>;
  const parts = [];
  let cursor = 0;
  let key = 0;
  issues.forEach((iss) => {
    const idx = text.indexOf(iss.from, cursor);
    if (idx === -1) return;
    if (idx > cursor) parts.push(<span key={key++}>{text.slice(cursor, idx)}</span>);
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
  if (cursor < text.length) parts.push(<span key={key++}>{text.slice(cursor)}</span>);
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

        <div className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-primary-600 to-purple-700 text-white rounded-br-sm"
            : "bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 text-surface-900 dark:text-surface-50 rounded-bl-sm"
        }`}>
          {isUser ? (
            <CorrectedText text={msg.content} issues={msg.issues} />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1
              prose-h3:text-base prose-h3:font-semibold
              prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
              prose-strong:font-semibold prose-em:italic
              prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs">
              <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
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
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

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

    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const resolvedMode = mode === "roleplay" ? scenario : mode;
      const res = await sendChatMessage(trimmed, resolvedMode, conversationId);
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

  const handleKeyDown = (e) => {
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
    : mode === "roleplay" ? "Dites quelque chose en français pour démarrer la scène…"
    : "Écrivez en français… Claire vous corrigera gentiment.";

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
              {mode === "roleplay" ? ` · ${sc.sub}` : ` · ${activeMode.description}`}
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
                {mode === "roleplay" ? "Mise en situation" : "Mode"}
              </p>
              <p className="font-editorial text-[18px] sm:text-[20px] text-surface-900 dark:text-surface-50 italic max-w-[60ch] mx-auto">
                {mode === "roleplay" ? sc.sub : activeMode.description}
              </p>
            </div>

            {/* Suggested prompts */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-3 text-center">
                Essayez l'une de ces phrases
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(PROMPT_TEMPLATES[mode] || PROMPT_TEMPLATES.conversation).map((t, i) => (
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
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-900 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900/40 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
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
            Entrée pour envoyer · Shift+Entrée pour une nouvelle ligne
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
