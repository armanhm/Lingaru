import { Link } from "react-router-dom";
import { staggerDelay } from "../hooks/useAnimations";

const GAMES = [
  {
    id: "word-scramble",
    name: "Word Scramble",
    description: "Unscramble the letters to spell the French word",
    emoji: "🔤",
    color: "bg-violet-500",
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    to: "/mini-games/word-scramble",
    ready: true,
  },
  {
    id: "match-pairs",
    name: "Match Pairs",
    description: "Flip cards and match French words with their English translations",
    emoji: "🃏",
    color: "bg-blue-500",
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    to: "/mini-games/match-pairs",
    ready: true,
  },
  {
    id: "gender-snap",
    name: "Gender Snap",
    description: "Is it le or la? Swipe to choose the correct gender",
    emoji: "⚡",
    color: "bg-rose-500",
    border: "border-rose-200 dark:border-rose-800",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    to: "/mini-games/gender-snap",
    ready: true,
  },
  {
    id: "speed-round",
    name: "Speed Round",
    description: "True or false? Race against the clock to verify translations",
    emoji: "⏱️",
    color: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    to: "/mini-games/speed-round",
    ready: true,
  },
  {
    id: "missing-letter",
    name: "Missing Letter",
    description: "Fill in the blanks to complete the French word",
    emoji: "✏️",
    color: "bg-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    to: "/mini-games/missing-letter",
    ready: false,
  },
  {
    id: "listening-challenge",
    name: "Listening Challenge",
    description: "Listen to the audio and type what you hear",
    emoji: "🎧",
    color: "bg-cyan-500",
    border: "border-cyan-200 dark:border-cyan-800",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    to: "/mini-games/listening-challenge",
    ready: false,
  },
];

export default function MiniGames() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mini Games</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Learn French while having fun</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((game, i) => (
          <div key={game.id} className="animate-fade-in-up" style={staggerDelay(i, 60)}>
            {game.ready ? (
              <Link
                to={game.to}
                className={`block rounded-xl border ${game.border} ${game.bg} p-5 h-full
                  hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300`}
              >
                <div className={`w-12 h-12 ${game.color} rounded-xl flex items-center justify-center text-2xl mb-3`}>
                  {game.emoji}
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">{game.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{game.description}</p>
              </Link>
            ) : (
              <div
                className={`rounded-xl border ${game.border} ${game.bg} p-5 h-full opacity-50 cursor-default`}
              >
                <div className={`w-12 h-12 ${game.color} rounded-xl flex items-center justify-center text-2xl mb-3 grayscale`}>
                  {game.emoji}
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">{game.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{game.description}</p>
                <span className="inline-block mt-2 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
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
