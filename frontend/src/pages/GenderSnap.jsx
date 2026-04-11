import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRandomVocabulary } from "../api/content";
import { submitMiniGameScore } from "../api/gamification";
import AudioPlayButton from "../components/AudioPlayButton";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";

const ROUNDS = 10;
const SWIPE_THRESHOLD = 60;
const FLY_DISTANCE = 500;
const FLY_DURATION = 350;
const RESULT_PAUSE = 1200; // ms to show correct/wrong before flying away

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ── Swipe overlays ───────────────────────────────────── */
function SwipeOverlay({ dx, threshold }) {
  const rx = clamp(dx / threshold, -1, 1);
  const leftOp = Math.max(0, -rx);   // la (feminine)
  const rightOp = Math.max(0, rx);    // le (masculine)

  return (
    <>
      {/* Right → Le (masculine) */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(59,130,246,${rightOp * 0.2})`, opacity: rightOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-black text-blue-600 dark:text-blue-400">Le</span>
          <span className="text-sm font-semibold text-blue-500">Masculine</span>
        </div>
      </div>
      {/* Left → La (feminine) */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(236,72,153,${leftOp * 0.2})`, opacity: leftOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-black text-pink-600 dark:text-pink-400">La</span>
          <span className="text-sm font-semibold text-pink-500">Feminine</span>
        </div>
      </div>
    </>
  );
}

/* ── Main game ────────────────────────────────────────── */
export default function GenderSnap() {
  const [phase, setPhase] = useState("loading"); // loading | playing | done
  const [words, setWords] = useState([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState(null);
  const [roundResults, setRoundResults] = useState([]);

  // Swipe state
  const [dragging, setDragging] = useState(false);
  const [dx, setDx] = useState(0);
  const [exiting, setExiting] = useState(null);
  const [resultFlash, setResultFlash] = useState(null); // "correct" | "wrong" | null
  const startRef = useRef(null);
  const submittingRef = useRef(false);

  const animatedScore = useCountUp(score, 400);
  const animatedXP = useCountUp(xpEarned, 400);

  // Load gendered vocabulary
  useEffect(() => {
    getRandomVocabulary(ROUNDS, { singleWord: true, gendered: true })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [res.data];
        if (data.length < 5) {
          setError("Not enough gendered vocabulary available.");
          return;
        }
        // Clean article for display
        const cleaned = data.map((w) => ({
          ...w,
          displayText: w.french.replace(/^(l'|le |la |les |un |une |des )/i, ""),
          isM: w.gender === "m",
        }));
        setWords(cleaned);
        setPhase("playing");
      })
      .catch(() => setError("Failed to load words."));
  }, []);

  const advance = useCallback(() => {
    setDx(0);
    setExiting(null);
    setDragging(false);
    setResultFlash(null);
    if (round + 1 < words.length) {
      setRound((r) => r + 1);
    } else {
      setPhase("done");
      submitMiniGameScore("gender_snap", score, words.length)
        .then((res) => setXpEarned(res.data.xp_earned))
        .catch(() => {});
    }
  }, [round, words.length, score]);

  const handleAnswer = useCallback((chosenMasculine, exitDir) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const word = words[round];
    const correct = chosenMasculine === word.isM;

    // Step 1: snap card back to center and show result
    setDx(0);
    setDragging(false);
    setResultFlash(correct ? "correct" : "wrong");

    if (correct) setScore((s) => s + 1);
    setRoundResults((prev) => [...prev, { word, correct, chose: chosenMasculine ? "le" : "la" }]);

    // Step 2: after pause, fly the card away
    setTimeout(() => {
      setExiting({ x: exitDir === "right" ? FLY_DISTANCE : -FLY_DISTANCE });

      // Step 3: after fly animation, advance to next
      setTimeout(() => {
        submittingRef.current = false;
        advance();
      }, FLY_DURATION + 100);
    }, RESULT_PAUSE);
  }, [words, round, advance]);

  // Pointer/touch handlers
  const onPointerDown = (e) => {
    if (exiting || resultFlash) return;
    startRef.current = { x: e.clientX };
    setDragging(true);
    setDx(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !startRef.current) return;
    setDx(e.clientX - startRef.current.x);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    startRef.current = null;

    if (dx > SWIPE_THRESHOLD) {
      handleAnswer(true, "right");  // Le
    } else if (dx < -SWIPE_THRESHOLD) {
      handleAnswer(false, "left");  // La
    } else {
      setDx(0); // snap back
    }
  };

  // Keyboard: left arrow = La, right arrow = Le
  useEffect(() => {
    if (phase !== "playing" || exiting) return;
    const handler = (e) => {
      if (e.key === "ArrowRight") handleAnswer(true, "right");
      else if (e.key === "ArrowLeft") handleAnswer(false, "left");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, exiting, handleAnswer]);

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

  /* ── Done screen ────────────────────────────────────── */
  if (phase === "done") {
    const pct = words.length > 0 ? Math.round((score / words.length) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {pct === 100 ? "🌟" : pct >= 60 ? "🎉" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 animate-fade-in-up">
          {pct === 100 ? "Gender Master!" : pct >= 60 ? "Well Done!" : "Keep Practicing!"}
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
                <div className="flex items-center gap-2">
                  <span>{r.correct ? "✅" : "❌"}</span>
                  <span className={`font-bold ${r.word.isM ? "text-blue-600 dark:text-blue-400" : "text-pink-600 dark:text-pink-400"}`}>
                    {r.word.isM ? "le" : "la"}
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{r.word.displayText}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{r.word.english}</span>
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
  const word = words[round];
  const tx = exiting ? exiting.x : dx;
  const rotate = tx * 0.05;
  const transition = dragging ? "none" : `transform ${FLY_DURATION}ms cubic-bezier(.4,.9,.3,1), opacity ${FLY_DURATION}ms ease`;

  return (
    <div className="max-w-md mx-auto py-8 space-y-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to="/mini-games" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Gender Snap</h1>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
          {round + 1}/{words.length}
        </span>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(round / words.length) * 100}%` }} />
      </div>

      {/* Direction labels */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-1.5 text-pink-500">
          <span className="text-lg">←</span>
          <span className="text-sm font-bold">La</span>
          <span className="text-xs text-pink-400">fém.</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-3 py-1 shadow-sm">
          <span className="text-xs text-gray-400">Score</span>
          <span className="text-sm font-bold text-primary-600">{score}/{round}</span>
        </div>
        <div className="flex items-center gap-1.5 text-blue-500">
          <span className="text-xs text-blue-400">masc.</span>
          <span className="text-sm font-bold">Le</span>
          <span className="text-lg">→</span>
        </div>
      </div>

      {/* Card */}
      <div className="relative" style={{ minHeight: 280 }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-gray-100 dark:border-gray-700 touch-none overflow-hidden"
          style={{
            transform: `translateX(${tx}px) rotate(${rotate}deg)`,
            transition,
            opacity: exiting ? 0 : 1,
            cursor: "grab",
          }}
        >
          {/* Swipe overlays (only while actively dragging, not during result) */}
          {dragging && !resultFlash && <SwipeOverlay dx={tx} threshold={SWIPE_THRESHOLD} />}

          {/* Result overlay — stays visible during pause */}
          {resultFlash && (
            <div className={`absolute inset-0 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none animate-fade-in ${
              resultFlash === "correct"
                ? "bg-emerald-500/15 dark:bg-emerald-500/20"
                : "bg-red-500/15 dark:bg-red-500/20"
            }`}>
              <span className="text-4xl animate-pop-in">{resultFlash === "correct" ? "✅" : "❌"}</span>
              <p className={`mt-2 text-sm font-bold animate-fade-in-up ${
                resultFlash === "correct"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}>
                {resultFlash === "correct" ? "Correct!" : "Incorrect"}
              </p>
              <p className="mt-1 text-base font-bold text-gray-800 dark:text-gray-200 animate-fade-in-up">
                <span className={word.isM ? "text-blue-600 dark:text-blue-400" : "text-pink-600 dark:text-pink-400"}>
                  {word.isM ? "le " : "la "}
                </span>
                {word.displayText}
              </p>
            </div>
          )}

          <div className="px-8 py-12 text-center space-y-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Le or La?
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{word.displayText}</span>
              <AudioPlayButton text={word.french} />
            </div>
            <p className="text-base text-gray-500 dark:text-gray-400">{word.english}</p>
            {word.part_of_speech && (
              <span className="inline-block text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full">
                {word.part_of_speech}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tap buttons (for non-swipe users) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleAnswer(false, "left")}
          disabled={!!exiting || !!resultFlash}
          className="py-3 rounded-xl text-sm font-bold bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-2 border-pink-200 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
        >
          La (fém.)
        </button>
        <button
          onClick={() => handleAnswer(true, "right")}
          disabled={!!exiting || !!resultFlash}
          className="py-3 rounded-xl text-sm font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
        >
          Le (masc.)
        </button>
      </div>

      {/* Hints */}
      <div className="flex justify-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>Swipe or tap</span>
        <span>·</span>
        <span>← La</span>
        <span>·</span>
        <span>Le →</span>
      </div>
    </div>
  );
}
