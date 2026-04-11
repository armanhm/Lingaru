import { useState, useEffect, useRef } from "react";
import { interactWithCard } from "../api/discover";
import AudioPlayButton from "./AudioPlayButton";

const TYPE_STYLES = {
  word: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    icon: "📝",
    label: "Word",
    accent: "text-blue-600 dark:text-blue-400",
  },
  grammar: {
    border: "border-purple-200 dark:border-purple-800",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
    icon: "📚",
    label: "Grammar",
    accent: "text-purple-600 dark:text-purple-400",
  },
  trivia: {
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    icon: "🧠",
    label: "Trivia",
    accent: "text-amber-600 dark:text-amber-400",
  },
  news: {
    border: "border-green-200 dark:border-green-800",
    bg: "bg-green-50 dark:bg-green-900/20",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    icon: "📰",
    label: "News",
    accent: "text-green-600 dark:text-green-400",
  },
};

/* ── Expanded detail content ─────────────────────────── */
function DetailContent({ card }) {
  const content = card.content_json || {};

  if (card.type === "word") {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-800/40 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-surface-900 dark:text-surface-100">{content.french}</span>
            <AudioPlayButton text={content.french} />
            {content.part_of_speech && (
              <span className="text-xs bg-white/70 dark:bg-surface-700/70 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-full">{content.part_of_speech}</span>
            )}
          </div>
          <p className="text-lg text-surface-600 dark:text-surface-300">{content.english}</p>
          {content.pronunciation && (
            <p className="text-sm text-surface-400 dark:text-surface-500 font-mono">/{content.pronunciation}/</p>
          )}
        </div>
        {content.example && (
          <div className="border-l-2 border-blue-300 dark:border-blue-700 pl-3 py-1">
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-1">Example</p>
            <p className="text-sm italic text-surface-700 dark:text-surface-300">{content.example}</p>
          </div>
        )}
        {(content.synonyms?.length > 0 || content.related_words?.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {content.synonyms?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">Synonyms</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.synonyms.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {content.related_words?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">Related</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.related_words.map((w, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {content.usage_note && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">💡 Usage Note</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{content.usage_note}</p>
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
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 rounded-xl px-4 py-3 border border-purple-200 dark:border-purple-800/40">
            <p className="text-xs font-semibold text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1">Formula</p>
            <p className="text-sm font-mono text-purple-800 dark:text-purple-200">{content.formula}</p>
          </div>
        )}
        {content.examples?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">Examples</p>
            <div className="space-y-2">
              {content.examples.map((ex, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-surface-50 dark:bg-surface-700/40 rounded-lg px-3 py-2">
                  <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{ex}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {content.exceptions && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">⚠️ Exceptions</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{content.exceptions}</p>
          </div>
        )}
      </div>
    );
  }

  if (card.type === "trivia") {
    return (
      <div className="space-y-4">
        {content.fact_fr && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/40">
            <div className="flex items-start gap-2">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200 flex-1">{content.fact_fr}</p>
              <AudioPlayButton text={content.fact_fr} />
            </div>
          </div>
        )}
        {content.fact_en && (
          <div className="border-l-2 border-amber-300 dark:border-amber-700 pl-3">
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-1">Translation</p>
            <p className="text-sm text-surface-500 dark:text-surface-400 italic">{content.fact_en}</p>
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
          <div className="bg-surface-50 dark:bg-surface-700/30 rounded-xl p-4">
            <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">{content.article_fr}</p>
          </div>
        )}
        {content.article_en && (
          <div className="border-l-2 border-green-300 dark:border-green-700 pl-3">
            <p className="text-xs text-surface-400 dark:text-surface-500 uppercase tracking-wider font-semibold mb-1">Translation</p>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{content.article_en}</p>
          </div>
        )}
        {content.key_vocabulary?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">Key Vocabulary</p>
            <div className="grid grid-cols-2 gap-1.5">
              {content.key_vocabulary.map((v, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">{v.french}</span>
                  <span className="text-xs text-green-600 dark:text-green-400">{v.english}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {card.source_url && (
          <a href={card.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
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
      className={`rounded-xl border ${style.border} ${style.bg} p-4 flex flex-col gap-2.5 h-full
        hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 cursor-pointer`}
      onClick={onOpen}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge} flex items-center gap-1`}>
          {style.icon} {style.label}
        </span>
        {card.interacted && (
          <span className="text-xs text-surface-400 dark:text-surface-500">✓</span>
        )}
      </div>
      <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 line-clamp-2 leading-snug">{card.title}</h3>
      {card.type === "word" && content.french && (
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${style.accent}`}>{content.french}</span>
          {content.part_of_speech && (
            <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-1.5 py-0.5 rounded">{content.part_of_speech}</span>
          )}
        </div>
      )}
      {preview && (
        <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed line-clamp-2">{preview}</p>
      )}
      <div className="mt-auto pt-1">
        <span className={`text-xs font-medium ${style.accent} flex items-center gap-1`}>
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
      <div className={`mt-2 mb-2 rounded-2xl border-2 ${style.border} bg-white dark:bg-surface-800 shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className={`${style.bg} px-6 py-4 flex items-center justify-between border-b ${style.border}`}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{style.icon}</span>
            <span className={`text-sm font-semibold ${style.accent}`}>{style.label}</span>
            {interacted && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full animate-pop-in">+3 XP</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-200/50 dark:hover:bg-surface-700/50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">{card.title}</h2>
          <DetailContent card={card} />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-700 flex items-center justify-between">
          <span className="text-xs text-surface-400 dark:text-surface-500">
            {new Date(card.generated_at).toLocaleDateString()}
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-700 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
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
