import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRandomVocabulary } from "../api/content";
import { submitMiniGameScore } from "../api/gamification";
import { generateTTS } from "../api/media";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { useAuth } from "../contexts/AuthContext";

const DEFAULT_ROUNDS = 8;
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http") ? rawUrl : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

/* ── Sound wave animation ─────────────────────────────── */
function SoundWave({ playing }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            playing ? "bg-primary-500 dark:bg-primary-400" : "bg-gray-300 dark:bg-gray-600"
          }`}
          style={{
            height: playing ? `${12 + Math.sin((Date.now() / 200) + i * 1.2) * 10}px` : "6px",
            animation: playing ? `soundbar 0.8s ease-in-out ${i * 0.1}s infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes soundbar {
          0% { height: 6px; }
          100% { height: 28px; }
        }
      `}</style>
    </div>
  );
}

/* ── Hint reveal (progressive) ────────────────────────── */
function HintDisplay({ word, hintsUsed }) {
  if (hintsUsed === 0) return null;
  const target = word.targetWord;
  let hint = "";
  if (hintsUsed === 1) {
    // First letter + length
    hint = `${target[0]}${"_".repeat(target.length - 1)} (${target.length} letters)`;
  } else if (hintsUsed >= 2) {
    // First + last letter
    hint = `${target[0]}${"_".repeat(target.length - 2)}${target[target.length - 1]} (${target.length} letters)`;
  }
  return (
    <p className="text-sm text-amber-600 dark:text-amber-400 font-mono animate-fade-in">
      💡 {hint}
    </p>
  );
}

/* ── Main game ────────────────────────────────────────── */
export default function ListeningChallenge() {
  const { user } = useAuth();
  const ROUNDS = user?.preferences?.listening_challenge_rounds ?? DEFAULT_ROUNDS;

  const [phase, setPhase] = useState("loading"); // loading | playing | done
  const [words, setWords] = useState([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState(null);
  const [roundResults, setRoundResults] = useState([]);

  // Current round
  const [input, setInput] = useState("");
  const [resultState, setResultState] = useState(null); // null | "correct" | "wrong"
  const [playing, setPlaying] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const animatedScore = useCountUp(score, 400);
  const animatedXP = useCountUp(xpEarned, 400);

  // Load words
  useEffect(() => {
    getRandomVocabulary(ROUNDS, { singleWord: true })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [res.data];
        const cleaned = data.map((w) => ({
          ...w,
          targetWord: w.french.replace(/^(l'|le |la |les |un |une |des )/i, ""),
        }));
        if (cleaned.length < 3) {
          setError("Not enough vocabulary available.");
          return;
        }
        setWords(cleaned);
        setPhase("playing");
      })
      .catch(() => setError("Failed to load words."));
  }, [ROUNDS]);

  // Auto-play audio when a new round starts
  useEffect(() => {
    if (phase === "playing" && words[round]) {
      playAudio();
    }
  }, [phase, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input after audio plays
  useEffect(() => {
    if (phase === "playing" && !playing && !resultState) {
      inputRef.current?.focus();
    }
  }, [playing, phase, resultState]);

  const playAudio = useCallback(async () => {
    if (playing) return;
    const word = words[round];
    if (!word) return;
    setPlaying(true);
    try {
      const res = await generateTTS(word.french);
      const url = resolveAudioUrl(res.data.audio_url);
      if (url) {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => setPlaying(false);
        audio.play().catch(() => setPlaying(false));
        setPlayCount((c) => c + 1);
      } else {
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
    }
  }, [playing, words, round]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (resultState || !input.trim()) return;

    const word = words[round];
    const target = word.targetWord;
    const guess = input.trim();

    // Accent-insensitive comparison
    const correct = stripAccents(guess.toLowerCase()) === stripAccents(target.toLowerCase());

    setResultState(correct ? "correct" : "wrong");
    if (correct) setScore((s) => s + 1);
    setRoundResults((prev) => [...prev, { word, correct, guess, hintsUsed }]);
  }, [resultState, input, words, round, hintsUsed]);

  const handleNext = useCallback(() => {
    setInput("");
    setResultState(null);
    setHintsUsed(0);
    setPlayCount(0);
    if (round + 1 < words.length) {
      setRound((r) => r + 1);
    } else {
      setPhase("done");
      submitMiniGameScore("listening_challenge", score, words.length)
        .then((res) => setXpEarned(res.data.xp_earned))
        .catch(() => {});
    }
  }, [round, words.length, score]);

  const handleHint = () => {
    if (hintsUsed < 2) setHintsUsed((h) => h + 1);
  };

  // Keyboard: Enter to submit or advance
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (resultState) handleNext();
      else handleSubmit();
    }
  };

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">{error}</div>
        <Link to="/mini-games" className="mt-4 inline-block text-sm text-primary-600 hover:underline">← Back to Mini Games</Link>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  /* ── Done ────────────────────────────────────────────── */
  if (phase === "done") {
    const pct = words.length > 0 ? Math.round((score / words.length) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {pct === 100 ? "🎧" : pct >= 60 ? "🎉" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-fade-in-up">
          {pct === 100 ? "Perfect Ears!" : pct >= 60 ? "Great Listening!" : "Keep Practicing!"}
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-4 animate-scale-in">
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">{animatedScore}/{words.length}</p>
              <p className="text-xs text-gray-400">correct</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-500">+{animatedXP}</p>
              <p className="text-xs text-gray-400">XP earned</p>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            {roundResults.map((r, i) => (
              <div
                key={i}
                style={staggerDelay(i, 40)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm animate-fade-in-up ${
                  r.correct ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{r.correct ? "✅" : "❌"}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{r.word.french}</span>
                  {!r.correct && (
                    <span className="text-xs text-red-400 truncate">"{r.guess}"</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.hintsUsed > 0 && <span className="text-xs text-amber-400">💡×{r.hintsUsed}</span>}
                  <span className="text-xs text-gray-500 dark:text-gray-400">{r.word.english}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Link to="/mini-games" className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            ← Mini Games
          </Link>
          <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  /* ── Playing ─────────────────────────────────────────── */
  const word = words[round];

  return (
    <div className="max-w-md mx-auto py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to="/mini-games" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Listening Challenge</h1>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
          {round + 1}/{words.length}
        </span>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(round / words.length) * 100}%` }} />
      </div>

      {/* Score */}
      <div className="flex justify-center">
        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-4 py-1.5 shadow-sm text-xs">
          <span className="text-gray-400">Score</span>
          <span className="font-bold text-primary-600">{score}/{round + (resultState ? 1 : 0)}</span>
        </div>
      </div>

      {/* Game card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-scale-in" key={round}>
        <div className="px-6 pt-8 pb-4 space-y-5">
          {/* Play button */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Listen and type the French word
            </p>

            <button
              onClick={playAudio}
              disabled={playing}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                playing
                  ? "bg-primary-100 dark:bg-primary-900/30 scale-105"
                  : "bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:scale-105 active:scale-95"
              } border-2 border-primary-200 dark:border-primary-800`}
            >
              {playing ? (
                <SoundWave playing={true} />
              ) : (
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-500">
              {playCount === 0 ? "Tap to listen" : `Played ${playCount} time${playCount > 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Hints */}
          <div className="text-center">
            <HintDisplay word={word} hintsUsed={hintsUsed} />
            {hintsUsed < 2 && !resultState && (
              <button
                onClick={handleHint}
                className="mt-1 text-xs text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              >
                💡 Use hint ({2 - hintsUsed} left)
              </button>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type what you heard…"
              disabled={!!resultState}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full px-4 py-3 border-2 rounded-xl text-center text-lg font-medium
                focus:outline-none transition-colors
                ${resultState === "correct"
                  ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                  : resultState === "wrong"
                    ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-primary-500"
                }
                disabled:cursor-default`}
            />
            {!resultState && (
              <button
                type="submit"
                disabled={!input.trim()}
                className="mt-3 w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-40"
              >
                Check
              </button>
            )}
          </form>
        </div>

        {/* Result feedback */}
        {resultState && (
          <div className={`mx-4 mb-4 px-4 py-3 rounded-xl text-center animate-fade-in-up ${
            resultState === "correct"
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          }`}>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl animate-pop-in">{resultState === "correct" ? "✅" : "❌"}</span>
              <span className={`text-sm font-bold ${
                resultState === "correct" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
              }`}>
                {resultState === "correct" ? "Correct!" : "Not quite!"}
              </span>
            </div>
            <p className="mt-1 text-base font-bold text-gray-800 dark:text-gray-200">
              {word.french}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">— {word.english}</span>
            </p>
            {resultState === "correct" && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">+2 XP</span>
            )}
          </div>
        )}

        {/* Next button */}
        {resultState && (
          <div className="px-4 pb-4">
            <button
              onClick={handleNext}
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              {round + 1 < words.length ? "Next Word →" : "See Results"}
            </button>
          </div>
        )}
      </div>

      {/* Hints */}
      <div className="flex justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>Listen, then type</span>
        <span>·</span>
        <span>Enter to check / next</span>
        <span>·</span>
        <span>Replay as many times as you want</span>
      </div>
    </div>
  );
}
