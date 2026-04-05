import { useState } from "react";
import { interactWithCard } from "../api/discover";

const TYPE_STYLES = {
  word: {
    border: "border-blue-300",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    icon: "Aa",
    label: "Word of the Day",
  },
  grammar: {
    border: "border-purple-300",
    bg: "bg-purple-50",
    badge: "bg-purple-100 text-purple-700",
    icon: "Gr",
    label: "Grammar Tip",
  },
  trivia: {
    border: "border-amber-300",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    icon: "?!",
    label: "Trivia",
  },
  news: {
    border: "border-green-300",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
    icon: "N",
    label: "News",
  },
};

function WordContent({ content }) {
  return (
    <div className="space-y-2">
      <p className="text-2xl font-bold text-gray-900">{content.french}</p>
      <p className="text-lg text-gray-600">{content.english}</p>
      {content.pronunciation && (
        <p className="text-sm text-gray-400 font-mono">{content.pronunciation}</p>
      )}
      {content.example && (
        <p className="text-sm text-gray-500 italic mt-2">{content.example}</p>
      )}
      {content.part_of_speech && (
        <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {content.part_of_speech}
        </span>
      )}
    </div>
  );
}

function GrammarContent({ content }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">{content.explanation}</p>
      {content.formula && (
        <p className="text-sm font-mono bg-purple-100 text-purple-800 px-2 py-1 rounded">
          {content.formula}
        </p>
      )}
      {content.examples && content.examples.length > 0 && (
        <ul className="text-sm text-gray-600 list-disc list-inside">
          {content.examples.slice(0, 3).map((ex, i) => (
            <li key={i}>{ex}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TriviaContent({ content }) {
  return (
    <div className="space-y-2">
      {content.fact_fr && (
        <p className="text-sm text-gray-800 font-medium">{content.fact_fr}</p>
      )}
      {content.fact_en && (
        <p className="text-sm text-gray-500">{content.fact_en}</p>
      )}
    </div>
  );
}

function NewsContent({ content }) {
  return (
    <div className="space-y-3">
      {content.article_fr && (
        <p className="text-sm text-gray-800 leading-relaxed">
          {content.article_fr.length > 200
            ? content.article_fr.slice(0, 200) + "..."
            : content.article_fr}
        </p>
      )}
      {content.key_vocabulary && content.key_vocabulary.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {content.key_vocabulary.map((v, i) => (
            <span
              key={i}
              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
              title={v.english}
            >
              {v.french}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const CONTENT_RENDERERS = {
  word: WordContent,
  grammar: GrammarContent,
  trivia: TriviaContent,
  news: NewsContent,
};

export default function DiscoverCard({ card, onInteracted }) {
  const [interacted, setInteracted] = useState(card.interacted);
  const [loading, setLoading] = useState(false);

  const style = TYPE_STYLES[card.type] || TYPE_STYLES.trivia;
  const ContentRenderer = CONTENT_RENDERERS[card.type];

  const handleInteract = async () => {
    if (interacted || loading) return;
    setLoading(true);
    try {
      const resp = await interactWithCard(card.id);
      setInteracted(true);
      if (onInteracted) onInteracted(card.id, resp.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border-2 ${style.border} ${style.bg} p-5 flex flex-col gap-3 transition-shadow hover:shadow-md`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${style.badge}`}
        >
          {style.icon} {style.label}
        </span>
        {card.seen && (
          <span className="text-xs text-gray-400">Seen</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900">{card.title}</h3>

      {/* Summary */}
      {card.summary && !ContentRenderer && (
        <p className="text-sm text-gray-600">{card.summary}</p>
      )}

      {/* Type-specific content */}
      {ContentRenderer && <ContentRenderer content={card.content_json} />}

      {/* Interact button */}
      <div className="mt-auto pt-2">
        <button
          onClick={handleInteract}
          disabled={interacted || loading}
          className={`w-full text-sm py-1.5 px-3 rounded-lg font-medium transition-colors ${
            interacted
              ? "bg-gray-200 text-gray-400 cursor-default"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {interacted ? "+3 XP Earned" : loading ? "..." : "Mark as Reviewed (+3 XP)"}
        </button>
      </div>
    </div>
  );
}
