import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRandomVocabulary } from "../api/content";
import { submitMiniGameScore } from "../api/gamification";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { useAuth } from "../contexts/AuthContext";

const DEFAULT_QUESTIONS = 12;
const DEFAULT_TIMER = 45;
const WRONG_RATIO = 0.4; // 40% of questions show wrong translations

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Circular timer (reused pattern) ──────────────────── */
function CircleTimer({ timeLeft, total }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const pct = timeLeft / total;
  const offset = circumference * (1 - pct);
  const strokeColor = pct > 0.5 ? "stroke-emerald-500" : pct > 0.25 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="3.5" />
        <circle
          cx="24" cy="24" r={radius} fill="none"
          className={`${strokeColor} transition-all duration-1000 ease-linear`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}

/* ── Main game ────────────────────────────────────────── */
export default function SpeedRound() {
  const { user } = useAuth();
  const TOTAL_QUESTIONS = user?.preferences?.speed_round_questions ?? DEFAULT_QUESTIONS;
  const TIME_LIMIT = user?.preferences?.speed_round_timer ?? DEFAULT_TIMER;

  const [phase, setPhase] = useState("loading"); // loading | countdown | playing | done
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [startCountdown, setStartCountdown] = useState(3);

  // Feedback flash
  const [flash, setFlash] = useState(null); // "correct" | "wrong" | null
  const flashTimer = useRef(null);
  const timerRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const animatedScore = useCountUp(score, 300);
  const animatedXP = useCountUp(xpEarned, 400);

  // Build questions from vocabulary
  useEffect(() => {
    getRandomVocabulary(TOTAL_QUESTIONS * 2, { singleWord: true })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [res.data];
        if (data.length < TOTAL_QUESTIONS) {
          setError("Not enough vocabulary available.");
          return;
        }

        const pool = shuffle(data);
        const qs = [];
        for (let i = 0; i < TOTAL_QUESTIONS; i++) {
          const word = pool[i];
          const showWrong = Math.random() < WRONG_RATIO;
          let shownTranslation = word.english;

          if (showWrong) {
            // Pick a random wrong translation from a different word
            const others = pool.filter((_, j) => j !== i && pool[j].english !== word.english);
            if (others.length > 0) {
              shownTranslation = others[Math.floor(Math.random() * others.length)].english;
            }
          }

          qs.push({
            french: word.french,
            english: word.english,
            shownTranslation,
            isCorrect: !showWrong || shownTranslation === word.english,
            vocab: word,
          });
        }

        setQuestions(qs);
        setPhase("countdown");
      })
      .catch(() => setError("Failed to load words."));
  }, []);

  // 3-2-1 countdown before starting
  useEffect(() => {
    if (phase !== "countdown") return;
    if (startCountdown <= 0) {
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setStartCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, startCountdown]);

  // Game timer
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (phaseRef.current === "playing") {
            setPhase("done");
            submitMiniGameScore("speed_round", score, TOTAL_QUESTIONS)
              .then((res) => setXpEarned(res.data.xp_earned))
              .catch(() => {});
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleAnswer = useCallback((userSaidTrue) => {
    if (phase !== "playing" || flash) return;
    const q = questions[current];
    const correct = userSaidTrue === q.isCorrect;

    if (correct) setScore((s) => s + 1);
    setResults((prev) => [...prev, { ...q, correct, userSaidTrue }]);

    // Flash feedback
    setFlash(correct ? "correct" : "wrong");
    flashTimer.current = setTimeout(() => {
      setFlash(null);
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
      } else {
        clearInterval(timerRef.current);
        setPhase("done");
        const finalScore = correct ? score + 1 : score;
        submitMiniGameScore("speed_round", finalScore, TOTAL_QUESTIONS)
          .then((res) => setXpEarned(res.data.xp_earned))
          .catch(() => {});
      }
    }, 500);
  }, [phase, flash, questions, current, score]);

  // Keyboard: left = False, right = True, or F/T keys
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "t" || e.key === "T") handleAnswer(true);
      else if (e.key === "ArrowLeft" || e.key === "f" || e.key === "F") handleAnswer(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleAnswer]);

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

  /* ── 3-2-1 Countdown ────────────────────────────────── */
  if (phase === "countdown") {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Speed Round</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Is the translation correct? Answer as fast as you can!</p>
        <div className="text-8xl font-black text-primary-600 animate-bounce-in" key={startCountdown}>
          {startCountdown > 0 ? startCountdown : "GO!"}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{TOTAL_QUESTIONS} questions · {TIME_LIMIT} seconds</p>
      </div>
    );
  }

  /* ── Done screen ────────────────────────────────────── */
  if (phase === "done") {
    const answered = results.length;
    const pct = answered > 0 ? Math.round((score / answered) * 100) : 0;
    const speed = answered > 0 ? ((TIME_LIMIT - timeLeft) / answered).toFixed(1) : "—";
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {pct === 100 ? "⚡" : pct >= 70 ? "🎉" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-fade-in-up">
          {pct === 100 ? "Lightning Fast!" : pct >= 70 ? "Great Reflexes!" : "Keep Practicing!"}
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-4 animate-scale-in">
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">{animatedScore}/{answered}</p>
              <p className="text-xs text-gray-400">correct</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">{speed}s</p>
              <p className="text-xs text-gray-400">avg / question</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-500">+{animatedXP}</p>
              <p className="text-xs text-gray-400">XP earned</p>
            </div>
          </div>

          <div className="space-y-1.5 text-left max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                style={staggerDelay(i, 30)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm animate-fade-in-up ${
                  r.correct ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{r.correct ? "✅" : "❌"}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{r.french}</span>
                  <span className="text-xs text-gray-400">=</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.shownTranslation}</span>
                </div>
                <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                  r.isCorrect
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                    : "bg-red-100 dark:bg-red-900/30 text-red-600"
                }`}>
                  {r.isCorrect ? "TRUE" : "FALSE"}
                </span>
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

  /* ── Playing screen ─────────────────────────────────── */
  const q = questions[current];

  // Flash border color
  let cardBorder = "border-gray-100 dark:border-gray-700";
  if (flash === "correct") cardBorder = "border-emerald-400 dark:border-emerald-600";
  if (flash === "wrong") cardBorder = "border-red-400 dark:border-red-600";

  return (
    <div className="max-w-md mx-auto py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to="/mini-games" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Speed Round</h1>
        <CircleTimer timeLeft={timeLeft} total={TIME_LIMIT} />
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(current / questions.length) * 100}%` }} />
      </div>

      {/* Score + question counter */}
      <div className="flex justify-center">
        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-4 py-1.5 shadow-sm text-xs">
          <span className="text-gray-400">Score</span>
          <span className="font-bold text-primary-600">{score}</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-gray-400">Q</span>
          <span className="font-bold text-gray-600 dark:text-gray-300">{current + 1}/{questions.length}</span>
        </div>
      </div>

      {/* Question card */}
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 ${cardBorder} p-8 text-center space-y-5 transition-colors duration-300 animate-scale-in`}
        key={current}
      >
        {/* French word */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">French</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{q.french}</p>
        </div>

        {/* Equals sign */}
        <div className="flex justify-center">
          <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-lg font-bold">=</span>
        </div>

        {/* Shown translation */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">English</p>
          <p className="text-2xl font-semibold text-gray-700 dark:text-gray-200">{q.shownTranslation}</p>
        </div>

        {/* Flash feedback */}
        {flash && (
          <div className={`py-2 rounded-lg animate-fade-in ${
            flash === "correct"
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
          }`}>
            <span className="text-sm font-bold">
              {flash === "correct" ? "✅ Correct!" : `❌ It was ${q.isCorrect ? "TRUE" : "FALSE"}`}
            </span>
            {!q.isCorrect && flash === "wrong" && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Correct: {q.english}
              </p>
            )}
          </div>
        )}
      </div>

      {/* True / False buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleAnswer(false)}
          disabled={!!flash}
          className="py-4 rounded-xl text-base font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
        >
          ✕ False
        </button>
        <button
          onClick={() => handleAnswer(true)}
          disabled={!!flash}
          className="py-4 rounded-xl text-base font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
        >
          ✓ True
        </button>
      </div>

      {/* Hints */}
      <div className="flex justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>← or F = False</span>
        <span>·</span>
        <span>→ or T = True</span>
      </div>
    </div>
  );
}
