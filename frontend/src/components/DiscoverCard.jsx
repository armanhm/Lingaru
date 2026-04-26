import { useState, useEffect, useRef } from "react";
import { interactWithCard } from "../api/discover";
import AudioPlayButton from "./AudioPlayButton";

const TYPE_STYLES = {
  word: {
    border: "border-info-200 dark:border-info-800",
    bg: "bg-info-50 dark:bg-info-900/20",
    badge: "bg-info-100 dark:bg-info-900/40 text-info-700 dark:text-info-300",
    icon: "📝",
    label: "Word",
    accent: "text-info-600 dark:text-info-400",
    gradient: "from-info-500 to-primary-600",
  },
  grammar: {
    border: "border-purple-200 dark:border-purple-800",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    icon: "📚",
    label: "Grammar",
    accent: "text-purple-600 dark:text-purple-400",
    gradient: "from-primary-500 to-purple-600",
  },
  trivia: {
    border: "border-warn-200 dark:border-warn-800",
    bg: "bg-warn-50 dark:bg-warn-900/20",
    badge: "bg-warn-100 dark:bg-warn-900/40 text-warn-700 dark:text-warn-300",
    icon: "🧠",
    label: "Trivia",
    accent: "text-warn-600 dark:text-warn-400",
    gradient: "from-warn-500 to-accent-500",
  },
  news: {
    border: "border-success-200 dark:border-success-800",
    bg: "bg-success-50 dark:bg-success-900/20",
    badge: "bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300",
    icon: "📰",
    label: "News",
    accent: "text-success-600 dark:text-success-400",
    gradient: "from-success-500 to-info-500",
  },
};

/* ── Expanded detail content ─────────────────────────── */
function DetailContent({ card }) {
  const content = card.content_json || {};

  if (card.type === "word") {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-info-50 to-primary-50 dark:from-info-900/20 dark:to-primary-900/20 rounded-xl p-5 border border-info-100 dark:border-info-800/40 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-h1 font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">{content.french}</span>
            <AudioPlayButton text={content.french} />
            {content.part_of_speech && (
              <span className="text-xs bg-white/70 dark:bg-surface-700/70 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-full font-medium">{content.part_of_speech}</span>
            )}
          </div>
          <p className="text-body-lg text-surface-600 dark:text-surface-300">{content.english}</p>
          {content.pronunciation && (
            <p className="text-sm text-surface-400 dark:text-surface-500 font-mono">/{content.pronunciation}/</p>
          )}
        </div>
        {content.example && (
          <div className="rounded-xl bg-info-50/60 dark:bg-info-900/20 border-l-4 border-info-400 dark:border-info-600 pl-4 pr-3 py-2.5">
            <p className="section-label mb-1">Example</p>
            <p className="text-sm italic text-surface-700 dark:text-surface-300">{content.example}</p>
          </div>
        )}
        {(content.synonyms?.length > 0 || content.related_words?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {content.synonyms?.length > 0 && (
              <div>
                <p className="section-label mb-2">Synonyms</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.synonyms.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {content.related_words?.length > 0 && (
              <div>
                <p className="section-label mb-2">Related</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.related_words.map((w, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {content.usage_note && (
          <div className="bg-warn-50 dark:bg-warn-900/20 border border-warn-200 dark:border-warn-800 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-warn-600 dark:text-warn-400 mb-1 flex items-center gap-1.5"><span>💡</span> Usage note</p>
            <p className="text-sm text-warn-800 dark:text-warn-200">{content.usage_note}</p>
          </div>
        )}
      </div>
    );
  }

  if (card.type === "grammar") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{content.explanation || card.summary}</p>
        {content.formula && (
          <div className="bg-gradient-to-r from-purple-50 to-primary-50 dark:from-purple-900/30 dark:to-primary-900/30 rounded-xl px-4 py-3 border border-purple-200 dark:border-purple-800/40">
            <p className="text-xs font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Formula</p>
            <p className="text-sm font-mono text-purple-800 dark:text-purple-200">{content.formula}</p>
          </div>
        )}
        {content.examples?.length > 0 && (
          <div>
            <p className="section-label mb-2">Examples</p>
            <div className="space-y-2">
              {content.examples.map((ex, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-surface-50 dark:bg-surface-700/40 rounded-lg px-3 py-2.5">
                  <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 text-white text-xs flex items-center justify-center font-bold shadow-sm">{i + 1}</span>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{ex}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {content.exceptions && (
          <div className="bg-warn-50 dark:bg-warn-900/20 border border-warn-200 dark:border-warn-800 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-warn-600 dark:text-warn-400 mb-1 flex items-center gap-1.5"><span>⚠️</span> Exceptions</p>
            <p className="text-sm text-warn-800 dark:text-warn-200">{content.exceptions}</p>
          </div>
        )}
      </div>
    );
  }

  if (card.type === "trivia") {
    return (
      <div className="space-y-4">
        {content.fact_fr && (
          <div className="bg-gradient-to-br from-warn-50 to-accent-50 dark:from-warn-900/20 dark:to-accent-900/20 rounded-xl p-4 border border-warn-100 dark:border-warn-800/40">
            <div className="flex items-start gap-2">
              <p className="text-body font-medium text-surface-800 dark:text-surface-200 flex-1">{content.fact_fr}</p>
              <AudioPlayButton text={content.fact_fr} />
            </div>
          </div>
        )}
        {content.fact_en && (
          <div className="rounded-xl bg-warn-50/40 dark:bg-warn-900/10 border-l-4 border-warn-400 dark:border-warn-600 pl-4 pr-3 py-2.5">
            <p className="section-label mb-1">Translation</p>
            <p className="text-sm text-surface-600 dark:text-surface-400 italic">{content.fact_en}</p>
          </div>
        )}
        {card.summary && card.summary !== content.fact_en && (
          <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{card.summary}</p>
        )}
      </div>
    );
  }

  if (card.type === "news") {
    return (
      <div className="space-y-4">
        {content.article_fr && (
          <div className="bg-surface-50 dark:bg-surface-700/30 rounded-xl p-4 border border-surface-100 dark:border-surface-700">
            <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">{content.article_fr}</p>
          </div>
        )}
        {content.article_en && (
          <div className="rounded-xl bg-success-50/60 dark:bg-success-900/20 border-l-4 border-success-400 dark:border-success-600 pl-4 pr-3 py-2.5">
            <p className="section-label mb-1">Translation</p>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{content.article_en}</p>
          </div>
        )}
        {content.key_vocabulary?.length > 0 && (
          <div>
            <p className="section-label mb-2">Key vocabulary</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {content.key_vocabulary.map((v, i) => (
                <div key={i} className="flex items-center justify-between bg-success-50 dark:bg-success-900/20 rounded-lg px-3 py-2 border border-success-100 dark:border-success-800/40">
                  <span className="text-sm font-semibold text-success-800 dark:text-success-200">{v.french}</span>
                  <span className="text-xs text-success-600 dark:text-success-400">{v.english}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {card.source_url && (
          <a href={card.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline font-semibold">
            Read full article ↗
          </a>
        )}
      </div>
    );
  }

  return null;
}

/* ── Compact card (grid item) ────────────────────────── */
export function CompactCard({ card, onOpen }) {
  const style = TYPE_STYLES[card.type] || TYPE_STYLES.trivia;
  const content = card.content_json || {};

  let preview = "";
  if (card.type === "word") preview = content.english || "";
  else if (card.type === "grammar") {
    const expl = content.explanation || card.summary || "";
    preview = expl.length > 80 ? expl.slice(0, 80) + "…" : expl;
  } else if (card.type === "trivia") {
    const text = content.fact_en || content.fact_fr || "";
    preview = text.length > 80 ? text.slice(0, 80) + "…" : text;
  } else if (card.type === "news") {
    const art = content.article_fr || card.summary || "";
    preview = art.length > 80 ? art.slice(0, 80) + "…" : art;
  }

  return (
    <div
      className={`group relative rounded-2xl border ${style.border} bg-white dark:bg-surface-800 p-4 pt-5 flex flex-col gap-2.5 h-full overflow-hidden
        hover:shadow-card-hover hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 cursor-pointer active:scale-[0.99]`}
      onClick={onOpen}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.gradient}`} />
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.badge} flex items-center gap-1`}>
          {style.icon} {style.label}
        </span>
        {card.interacted && (
          <span className="badge-success text-[10px] px-1.5 py-0.5">✓ Seen</span>
        )}
      </div>
      <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 line-clamp-2 leading-snug">{card.title}</h3>
      {card.type === "word" && content.french && (
        <div className="flex items-center gap-2">
          <span className={`text-h4 font-extrabold ${style.accent}`}>{content.french}</span>
          {content.part_of_speech && (
            <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-1.5 py-0.5 rounded font-medium">{content.part_of_speech}</span>
          )}
        </div>
      )}
      {preview && (
        <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed line-clamp-2">{preview}</p>
      )}
      <div className="mt-auto pt-1">
        <span className={`text-xs font-semibold ${style.accent} flex items-center gap-1 group-hover:gap-2 transition-all`}>
          More details
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/* ── Expanded card (full-width inline, animated) ─────── */
export function ExpandedCard({ card, onClose, onInteracted }) {
  const style = TYPE_STYLES[card.type] || TYPE_STYLES.trivia;
  const [interacted, setInteracted] = useState(card.interacted);
  const [visible, setVisible] = useState(false);
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  // Measure real height, then animate open
  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
    // Trigger CSS transition on next frame
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  // Auto-interact on mount
  useEffect(() => {
    if (!card.interacted) {
      interactWithCard(card.id)
        .then(() => { setInteracted(true); onInteracted?.(card.id); })
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setVisible(false);
    // Wait for collapse animation before unmounting
    setTimeout(onClose, 350);
  };

  return (
    <div
      ref={contentRef}
      className="overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        maxHeight: visible ? `${height + 100}px` : "0px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
      }}
    >
      <div className={`relative mt-2 mb-2 rounded-2xl border-2 ${style.border} bg-white dark:bg-surface-800 shadow-card-elevated overflow-hidden`}>
        <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${style.gradient}`} />
        {/* Header */}
        <div className={`${style.bg} px-6 pt-5 pb-4 flex items-center justify-between border-b ${style.border}`}>
          <div className="flex items-center gap-3">
            <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} text-white flex items-center justify-center text-lg shadow-glow-primary`}>
              {style.icon}
            </div>
            <div>
              <span className={`text-sm font-bold ${style.accent}`}>{style.label}</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">{new Date(card.generated_at).toLocaleDateString()}</p>
            </div>
            {interacted && (
              <span className="badge-success animate-pop-in ml-2">+3 XP</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/60 dark:hover:bg-surface-700/60 transition-all active:scale-95"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <h2 className="text-h3 font-extrabold text-surface-900 dark:text-surface-100">{card.title}</h2>
          <DetailContent card={card} />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-xs font-semibold text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-700 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors active:scale-95"
          >
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}

// Default export for backwards compat — not used by new Discover page
export default CompactCard;
