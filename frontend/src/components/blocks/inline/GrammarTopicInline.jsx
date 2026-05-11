import { useState, useEffect } from "react";
import { getGrammarTopic } from "../../../api/grammar";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * Inline grammar topic card: read-only summary of a grammar concept the
 * agent references (e.g. "le subjonctif présent"). Agent passes
 * config.slug; we fetch the topic and surface title + overview + first
 * couple of examples. Tap "Faire l'exercice →" to start the actual drill.
 *
 * No agent slug → display a hint that the agent needs to be explicit.
 */
export default function GrammarTopicInline({ config = {} }) {
  const slug = config.slug || null;
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    getGrammarTopic(slug)
      .then((res) => alive && setTopic(res.data))
      .catch(() => alive && setError("Sujet introuvable."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [slug]);

  const empty = !topic && !loading;
  const examples = topic?.examples?.slice(0, 2) || [];

  return (
    <InlineRoundWidget
      title="Grammaire"
      emoji="📐"
      loading={loading}
      empty={empty}
      emptyMessage={error || "Pose une question plus précise pour que je trouve le bon sujet."}
      // Read-only: no "Encore" loop, just a deep-link to the drill
      fullSessionTo={topic ? `/grammar/topics/${topic.slug}` : "/grammar"}
      fullSessionLabel={topic ? "Faire l'exercice →" : "Ouvrir la grammaire →"}
    >
      {topic && (
        <div className="space-y-2">
          <h3 className="text-[16px] font-extrabold text-surface-900 dark:text-surface-50 leading-tight">
            {topic.title}
          </h3>
          {topic.level && (
            <span className="inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
              {topic.level}
            </span>
          )}
          {topic.overview && (
            <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">
              {topic.overview}
            </p>
          )}
          {examples.length > 0 && (
            <ul className="text-[12.5px] text-surface-600 dark:text-surface-400 space-y-0.5 pl-3 list-disc">
              {examples.map((ex, i) => (
                <li key={i}>
                  <span className="italic text-surface-900 dark:text-surface-100">{ex.french || ex.text || ex}</span>
                  {ex.english && <span> — {ex.english}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
