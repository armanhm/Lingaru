import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAgents } from "../api/agents";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";

function AgentCard({ agent, i }) {
  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="group relative rounded-2xl border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900/60 p-5 pt-6 flex flex-col gap-3 h-full overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 focus-ring animate-fade-in-up"
      style={staggerDelay(i, 60)}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${agent.tint}`} />

      <div className="flex items-center gap-3">
        <div className={`shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br ${agent.tint} text-white flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
          {agent.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500">@{agent.slug}</p>
          <h3 className="text-[15px] font-bold text-surface-900 dark:text-surface-50 truncate">{agent.name}</h3>
        </div>
      </div>

      {agent.tagline && (
        <p className="text-[13px] text-surface-600 dark:text-surface-400 leading-snug line-clamp-3">
          {agent.tagline}
        </p>
      )}

      {agent.best_for?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.best_for.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-1 flex items-center justify-between text-[11.5px]">
        <span className="font-mono uppercase tracking-[0.12em] text-surface-400 dark:text-surface-500">
          {agent.output_shape === "structured" ? "Sortie structurée" : "Conversation libre"}
        </span>
        <span className="flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 group-hover:gap-2 transition-all">
          Ouvrir
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAgents()
      .then((res) => setAgents(res.data || []))
      .catch(() => setError("Impossible de charger les agents."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Outils qui te concentrent"
        title="Agents"
        subtitle="Des assistants spécialisés pour chaque tâche : grammaire, correction, vocabulaire, prononciation. Choisis-en un pour commencer."
        icon="🤖"
        gradient
      />

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300 mb-5 animate-shake flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-44" />)}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="Aucun agent disponible"
          subtitle="L'administrateur peut en ajouter via le panneau Django."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a, i) => <AgentCard key={a.slug} agent={a} i={i} />)}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-dashed border-surface-200 dark:border-surface-700 bg-surface-50/40 dark:bg-surface-900/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 mb-1.5">
          Astuce
        </p>
        <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">
          Tu peux aussi appeler n'importe quel agent depuis l'<Link to="/assistant" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Assistant</Link>{" "}
          en tapant <kbd className="kbd">@</kbd> suivi du nom de l'agent (par exemple <code className="font-mono text-primary-600 dark:text-primary-400">@grammar</code>{" "}
          ou <code className="font-mono text-primary-600 dark:text-primary-400">@correct</code>).
        </p>
      </div>
    </div>
  );
}
