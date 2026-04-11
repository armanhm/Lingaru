import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRandomVocabulary } from "../api/content";
import { submitMiniGameScore } from "../api/gamification";
import AudioPlayButton from "../components/AudioPlayButton";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";

const ROUNDS = 8;
const TIME_PER_ROUND = 30; // seconds

/** Strip accents for comparison: é→e, ç→c, etc. */
function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Letter tile ──────────────────────────────────────── */
function LetterTile({ letter, index, selected, onClick, disabled }) {
  return (
    <button
      onClick={() => onClick(index)}
      disabled={disabled || selected}
      tabIndex={-1}
      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-lg sm:text-xl font-bold flex items-center justify-center
        transition-all duration-200
        ${selected
          ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 scale-90"
          : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-600 shadow-sm hover:border-primary-400 hover:shadow-md hover:-translate-y-0.5 hover:scale-105 active:scale-95"
        }
        ${disabled ? "cursor-default" : "cursor-pointer"}
      `}
    >
      {letter.toUpperCase()}
    </button>
  );
}

/* ── Answer slot ──────────────────────────────────────── */
function AnswerSlot({ letter, index, onClick, correct, wrong }) {
  let colorClass = "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800";
  if (correct) colorClass = "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
  if (wrong) colorClass = "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20";

  return (
    <button
      onClick={() => letter && onClick(index)}
      tabIndex={-1}
      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-lg sm:text-xl font-bold flex items-center justify-center
        border-2 ${colorClass} transition-all duration-200
        ${letter ? "hover:border-red-300 hover:scale-105 cursor-pointer" : "cursor-default border-dashed"}`}
    >
      {letter ? letter.toUpperCase() : ""}
    </button>
  );
}

/* ── Circular countdown timer ─────────────────────────── */
function CircleTimer({ timeLeft, total }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = timeLeft / total;
  const offset = circumference * (1 - pct);
  const color = pct > 0.5 ? "text-emerald-500" : pct > 0.25 ? "text-amber-500" : "text-red-500";
  const strokeColor = pct > 0.5 ? "stroke-emerald-500" : pct > 0.25 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={radius} fill="none"
          className={`${strokeColor} transition-all duration-1000 ease-linear`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}

/* ── Main game component ──────────────────────────────── */
export default function WordScramble() {
  const [phase, setPhase] = useState("loading"); // loading | playing | done
  const [words, setWords] = useState([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState(null);

  // Current round state
  const [scrambledLetters, setScrambledLetters] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]); // indices into scrambledLetters that are placed
  const [answerLetters, setAnswerLetters] = useState([]); // {letter, sourceIndex} in answer slots
  const [resultState, setResultState] = useState(null); // null | "correct" | "wrong"
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const timerRef = useRef(null);
  const [roundResults, setRoundResults] = useState([]);

  // Refs for keyboard handler (avoids stale closures)
  const scrambledRef = useRef([]);
  const selectedRef = useRef([]);
  const answerRef = useRef([]);
  const resultRef = useRef(null);

  scrambledRef.current = scrambledLetters;
  selectedRef.current = selectedIndices;
  answerRef.current = answerLetters;
  resultRef.current = resultState;

  const animatedScore = useCountUp(score, 400);
  const animatedXP = useCountUp(xpEarned, 400);

  // Load words
  useEffect(() => {
    getRandomVocabulary(ROUNDS, { singleWord: true })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [res.data];
        const cleaned = data.map((w) => ({
          ...w,
          scrambleText: w.french.replace(/^(l'|le |la |les |un |une |des )/i, ""),
        }));
        if (cleaned.length < 3) {
          setError("Not enough vocabulary words available.");
          return;
        }
        setWords(cleaned);
        setPhase("playing");
      })
      .catch(() => setError("Failed to load words."));
  }, []);

  // Setup a round
  const setupRound = useCallback((idx) => {
    const word = words[idx];
    if (!word) return;
    const target = word.scrambleText || word.french;
    const letters = target.split("");
    let scrambled = shuffle(letters);
    let attempts = 0;
    while (scrambled.join("") === letters.join("") && attempts < 10) {
      scrambled = shuffle(letters);
      attempts++;
    }
    setScrambledLetters(scrambled);
    setSelectedIndices([]);
    setAnswerLetters([]);
    setResultState(null);
    setTimeLeft(TIME_PER_ROUND);
  }, [words]);

  useEffect(() => {
    if (phase === "playing" && words.length > 0) {
      setupRound(round);
    }
  }, [phase, round, words, setupRound]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "playing" || resultState) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, resultState, round]);

  const handleTimeUp = () => {
    clearInterval(timerRef.current);
    setResultState("wrong");
    setRoundResults((prev) => [...prev, { word: words[round], correct: false, timedOut: true }]);
  };

  // Place a letter from scramble to answer
  const handleLetterClick = (scrambleIndex) => {
    if (resultState || selectedIndices.includes(scrambleIndex)) return;
    const letter = scrambledLetters[scrambleIndex];
    setSelectedIndices((prev) => [...prev, scrambleIndex]);
    setAnswerLetters((prev) => [...prev, { letter, sourceIndex: scrambleIndex }]);
  };

  // Remove last letter from answer (for Backspace)
  const handleRemoveLast = useCallback(() => {
    if (resultRef.current || answerRef.current.length === 0) return;
    const last = answerRef.current[answerRef.current.length - 1];
    setSelectedIndices((prev) => prev.filter((i) => i !== last.sourceIndex));
    setAnswerLetters((prev) => prev.slice(0, -1));
  }, []);

  // Remove a specific letter from answer (click on slot)
  const handleAnswerClick = (answerIndex) => {
    if (resultState) return;
    const removed = answerLetters[answerIndex];
    if (!removed) return;
    setSelectedIndices((prev) => prev.filter((i) => i !== removed.sourceIndex));
    setAnswerLetters((prev) => prev.filter((_, i) => i !== answerIndex));
  };

  // Type a letter from keyboard — accent-insensitive matching
  // Typing 'e' will match é, è, ê, ë tiles (picks accented first for better UX)
  const handleTypeLetter = useCallback((key) => {
    if (resultRef.current) return;
    const baseKey = stripAccents(key.toLowerCase());
    // First try exact match, then accent-insensitive
    let idx = scrambledRef.current.findIndex(
      (letter, i) => letter.toLowerCase() === key.toLowerCase() && !selectedRef.current.includes(i)
    );
    if (idx === -1) {
      idx = scrambledRef.current.findIndex(
        (letter, i) => stripAccents(letter.toLowerCase()) === baseKey && !selectedRef.current.includes(i)
      );
    }
    if (idx !== -1) {
      handleLetterClick(idx);
    }
  }, [handleLetterClick]);

  // Check answer when all letters placed
  useEffect(() => {
    if (phase !== "playing" || !words[round] || resultState) return;
    const target = words[round].scrambleText || words[round].french;
    if (answerLetters.length !== target.length) return;

    clearInterval(timerRef.current);
    const guess = answerLetters.map((a) => a.letter).join("");
    // Accent-insensitive comparison: déménager == demenager
    if (stripAccents(guess.toLowerCase()) === stripAccents(target.toLowerCase())) {
      setResultState("correct");
      setScore((s) => s + 1);
      setRoundResults((prev) => [...prev, { word: words[round], correct: true }]);
    } else {
      setResultState("wrong");
      setRoundResults((prev) => [...prev, { word: words[round], correct: false }]);
    }
  }, [answerLetters, phase, round, words, resultState]);

  // Advance to next round
  const handleNext = useCallback(() => {
    if (round + 1 < words.length) {
      setRound((r) => r + 1);
    } else {
      setPhase("done");
      submitMiniGameScore("word_scramble", score, words.length)
        .then((res) => setXpEarned(res.data.xp_earned))
        .catch(() => {});
    }
  }, [round, words.length, score]);

  // Skip word
  const handleSkip = () => {
    clearInterval(timerRef.current);
    setResultState("wrong");
    setRoundResults((prev) => [...prev, { word: words[round], correct: false, skipped: true }]);
  };

  /* ── Keyboard handler ───────────────────────────────── */
  useEffect(() => {
    if (phase !== "playing") return;

    const handler = (e) => {
      // Ignore if focused on an input/textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "Backspace") {
        e.preventDefault();
        handleRemoveLast();
      } else if ((e.key === "Enter" || e.key === " ") && resultRef.current) {
        e.preventDefault();
        handleNext();
      } else if (e.key.length === 1 && /^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
        e.preventDefault();
        handleTypeLetter(e.key);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleRemoveLast, handleNext, handleTypeLetter]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
          {error}
        </div>
        <Link to="/mini-games" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
          ← Back to Mini Games
        </Link>
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

  /* ── Done screen ────────────────────────────────────── */
  if (phase === "done") {
    const pct = words.length > 0 ? Math.round((score / words.length) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {pct === 100 ? "🌟" : pct >= 60 ? "🎉" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-fade-in-up">
          {pct === 100 ? "Perfect!" : pct >= 60 ? "Great job!" : "Keep practicing!"}
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

          {/* Round review */}
          <div className="space-y-1.5 text-left">
            {roundResults.map((r, i) => (
              <div
                key={i}
                style={staggerDelay(i, 40)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm animate-fade-in-up ${
                  r.correct
                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                    : "bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{r.correct ? "✅" : "❌"}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{r.word.french}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{r.word.english}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Link
            to="/mini-games"
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ← Mini Games
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  /* ── Playing screen ─────────────────────────────────── */
  const word = words[round];

  return (
    <div className="max-w-xl mx-auto py-8 space-y-5">
      {/* Header with back, title, round counter, and circular timer */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to="/mini-games" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Word Scramble</h1>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
          {round + 1}/{words.length}
        </span>
      </div>

      {/* Progress bar only */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-primary-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(round / words.length) * 100}%` }}
        />
      </div>

      {/* Game card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-scale-in" key={round}>
        {/* Top row: score + timer */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">Score</span>
            <span className="text-sm font-bold text-primary-600">{score}/{round + (resultState ? 1 : 0)}</span>
          </div>
          <CircleTimer timeLeft={timeLeft} total={TIME_PER_ROUND} />
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Hint */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Unscramble the French word for
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{word.english}</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {word.part_of_speech && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {word.part_of_speech}
                </span>
              )}
              {word.french !== word.scrambleText && (
                <span className="text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full">
                  hint: {word.french.slice(0, word.french.length - word.scrambleText.length)}…
                </span>
              )}
            </div>
          </div>

          {/* Answer slots */}
          <div className="flex justify-center gap-1.5 flex-wrap min-h-[48px]">
            {(word.scrambleText || word.french).split("").map((_, i) => (
              <AnswerSlot
                key={i}
                letter={answerLetters[i]?.letter || ""}
                index={i}
                onClick={handleAnswerClick}
                correct={resultState === "correct"}
                wrong={resultState === "wrong"}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Scrambled letters */}
          <div className="flex justify-center gap-1.5 flex-wrap">
            {scrambledLetters.map((letter, i) => (
              <LetterTile
                key={i}
                letter={letter}
                index={i}
                selected={selectedIndices.includes(i)}
                onClick={handleLetterClick}
                disabled={!!resultState}
              />
            ))}
          </div>

          {/* Result feedback */}
          {resultState && (
            <div className={`text-center py-3 rounded-xl animate-fade-in-up ${
              resultState === "correct"
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : "bg-red-50 dark:bg-red-900/20"
            }`}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-2xl">{resultState === "correct" ? "✅" : "❌"}</span>
                <span className={`text-lg font-bold ${
                  resultState === "correct"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }`}>
                  {resultState === "correct" ? "Correct!" : "Not quite!"}
                </span>
              </div>
              {resultState === "wrong" && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The answer was <strong className="text-gray-900 dark:text-gray-100">{word.french}</strong>
                </p>
              )}
              {resultState === "correct" && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <AudioPlayButton text={word.french} />
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">+2 XP</span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!resultState ? (
              <>
                <button
                  onClick={handleSkip}
                  tabIndex={-1}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    setSelectedIndices([]);
                    setAnswerLetters([]);
                  }}
                  tabIndex={-1}
                  disabled={answerLetters.length === 0}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  Clear
                </button>
              </>
            ) : (
              <button
                onClick={handleNext}
                tabIndex={-1}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                {round + 1 < words.length ? "Next Word →" : "See Results"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>Type to fill</span>
        <span>·</span>
        <span>Backspace to undo</span>
        <span>·</span>
        <span>Enter / Space for next</span>
      </div>
    </div>
  );
}
