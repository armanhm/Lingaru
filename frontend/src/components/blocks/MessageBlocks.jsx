import AudioBlock from "./AudioBlock";
import VocabCardBlock from "./VocabCardBlock";
import ExpressionBlock from "./ExpressionBlock";
import ConjugationTableBlock from "./ConjugationTableBlock";
import QuizBlockV2 from "./QuizBlockV2";
import ActionBlock from "./ActionBlock";
import FeatureWidgetBlock from "./FeatureWidgetBlock";

/**
 * Renderer registry for structured payloads attached to assistant replies.
 * Mirrors the schema in backend `apps.assistant.blocks`. Adding a new block
 * type means: add a renderer here AND a validator in the backend.
 *
 * Forward-compat: an unknown `type` returns null instead of throwing — older
 * clients should silently ignore newer block types rather than break the
 * whole chat. Locked down by `MessageBlocks.test.jsx`.
 */
const RENDERERS = {
  audio: AudioBlock,
  vocab_card: VocabCardBlock,
  expression: ExpressionBlock,
  conjugation_table: ConjugationTableBlock,
  quiz: QuizBlockV2,
  // Phase 3: agentic-mode in-chat invocation. `action` deep-links to a
  // route; `feature_widget` embeds a mini version of a feature in the
  // chat bubble.
  action: ActionBlock,
  feature_widget: FeatureWidgetBlock,
};

export default function MessageBlocks({ blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-2.5">
      {blocks.map((block, i) => {
        const Renderer = RENDERERS[block?.type];
        if (!Renderer) return null;
        return <Renderer key={i} block={block} />;
      })}
    </div>
  );
}

// Exposed for tests + future plugin points.
export { RENDERERS };
