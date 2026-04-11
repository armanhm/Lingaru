import { Link } from "react-router-dom";
import { staggerDelay } from "../hooks/useAnimations";

const GAMES = [
  {
    id: "word-scramble",
    name: "Word Scramble",
    description: "Unscramble the letters to spell the French word",
    emoji: "🔤",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-200 dark:border-violet-800/50",
    to: "/mini-games/word-scramble",
    ready: true,
  },
  {
    id: "match-pairs",
    name: "Match Pairs",
    description: "Flip cards and match French words with their English translations",
    emoji: "🃏",
    gradient: "from-info-500 to-blue-600",
    bg: "bg-info-50 dark:bg-info-700/20",
    border: "border-info-200 dark:border-info-800/50",
    to: "/mini-games/match-pairs",
    ready: true,
  },
  {
    id: "gender-snap",
    name: "Gender Snap",
    description: "Is it le or la? Swipe to choose the correct gender",
    emoji: "⚡",
    gradient: "from-danger-500 to-rose-600",
    bg: "bg-danger-50 dark:bg-danger-700/20",
    border: "border-danger-200 dark:border-danger-800/50",
    to: "/mini-games/gender-snap",
    ready: true,
  },
  {
    id: "speed-round",
    name: "Speed Round",
    description: "True or false? Race against the clock to verify translations",
    emoji: "⏱️",
    gradient: "from-warn-500 to-amber-600",
    bg: "bg-warn-50 dark:bg-warn-700/20",
    border: "border-warn-200 dark:border-warn-800/50",
    to: "/mini-games/speed-round",
    ready: true,
  },
  {
    id: "missing-letter",
    name: "Missing Letter",
    description: "Fill in the blanks to complete the French word",
    emoji: "✏️",
    gradient: "from-success-500 to-emerald-600",
    bg: "bg-success-50 dark:bg-success-700/20",
    border: "border-success-200 dark:border-success-800/50",
    to: "/mini-games/missing-letter",
    ready: true,
  },
  {
    id: "listening-challenge",
    name: "Listening Challenge",
    description: "Listen to the audio and type what you hear",
    emoji: "🎧",
    gradient: "from-cyan-500 to-teal-600",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    border: "border-cyan-200 dark:border-cyan-800/50",
    to: "/mini-games/listening-challenge",
    ready: true,
  },
];

export default function MiniGames() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100">Mini Games</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">Learn French while having fun</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((game, i) => (
          <div key={game.id} className="animate-fade-in-up" style={staggerDelay(i, 60)}>
            {game.ready ? (
              <Link
                to={game.to}
                className={`block rounded-2xl border ${game.border} ${game.bg} p-5 h-full
                  hover:shadow-card-hover hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300`}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${game.gradient} rounded-xl flex items-center justify-center text-2xl mb-3 shadow-sm`}>
                  {game.emoji}
                </div>
                <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 mb-1">{game.name}</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{game.description}</p>
              </Link>
            ) : (
              <div className={`rounded-2xl border ${game.border} ${game.bg} p-5 h-full opacity-40 cursor-default`}>
                <div className={`w-12 h-12 bg-gradient-to-br ${game.gradient} rounded-xl flex items-center justify-center text-2xl mb-3 grayscale`}>
                  {game.emoji}
                </div>
                <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 mb-1">{game.name}</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{game.description}</p>
                <span className="inline-block mt-2 text-xs font-medium text-surface-400 dark:text-surface-500 bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
