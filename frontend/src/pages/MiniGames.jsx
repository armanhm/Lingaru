import { Link } from "react-router-dom";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader } from "../components/ui";

const GAMES = [
  { id: "word-scramble",       name: "Word Scramble",       description: "Unscramble the letters to spell the French word",        emoji: "🔤", gradient: "from-violet-500 via-primary-500 to-primary-700",   to: "/mini-games/word-scramble",       ready: true, tag: "Vocabulary" },
  { id: "match-pairs",         name: "Match Pairs",         description: "Flip cards and match French with English",              emoji: "🃏", gradient: "from-info-400 via-info-500 to-primary-600",         to: "/mini-games/match-pairs",         ready: true, tag: "Memory" },
  { id: "gender-snap",         name: "Gender Snap",         description: "Swipe to choose le or la — test your gender instinct",  emoji: "⚡", gradient: "from-danger-400 via-danger-500 to-accent-500",      to: "/mini-games/gender-snap",         ready: true, tag: "Grammar" },
  { id: "speed-round",         name: "Speed Round",         description: "True or false? Race against the clock",                 emoji: "⏱️", gradient: "from-warn-400 via-accent-500 to-accent-600",        to: "/mini-games/speed-round",         ready: true, tag: "Speed" },
  { id: "missing-letter",      name: "Missing Letter",      description: "Fill in the blanks to complete the French word",        emoji: "✏️", gradient: "from-success-400 via-success-500 to-info-600",      to: "/mini-games/missing-letter",      ready: true, tag: "Spelling" },
  { id: "listening-challenge", name: "Listening Challenge", description: "Listen to the audio and type what you hear",            emoji: "🎧", gradient: "from-info-400 via-info-500 to-primary-500",         to: "/mini-games/listening-challenge", ready: true, tag: "Listening" },
];

export default function MiniGames() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Play & learn"
        title="Mini Games"
        subtitle="Six playful ways to sharpen your French. Quick rounds, real progress."
        icon="🎮"
        gradient
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((game, i) => (
          <Link
            key={game.id}
            to={game.to}
            className="group relative overflow-hidden card card-hover focus-ring animate-fade-in-up p-0"
            style={staggerDelay(i, 60)}
          >
            {/* Gradient top band */}
            <div className={`h-1.5 bg-gradient-to-r ${game.gradient}`} />

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-14 h-14 bg-gradient-to-br ${game.gradient} rounded-2xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  {game.emoji}
                </div>
                <span className="badge-neutral !text-[10px]">{game.tag}</span>
              </div>

              <h3 className="text-h4 text-surface-900 dark:text-surface-100 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {game.name}
              </h3>
              <p className="text-caption text-surface-500 dark:text-surface-400 leading-relaxed">
                {game.description}
              </p>

              <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800/50 flex items-center justify-between">
                <span className="text-caption font-semibold text-primary-600 dark:text-primary-400">
                  Play now
                </span>
                <span className="text-primary-500 group-hover:translate-x-1 transition-transform">
                  <svg className="w-4 h-4" fill="none" strokeWidth={2.5} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
