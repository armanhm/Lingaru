import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getSRSDueCards, submitSRSReview } from "../api/progress";
import AudioPlayButton from "../components/AudioPlayButton";
import { useAuth } from "../contexts/AuthContext";

/* ── swipe config ─────────────────────────────────── */
const SWIPE_THRESHOLD = 80;         // px to commit
const FLY_DISTANCE    = 600;        // px off-screen
const FLY_DURATION    = 300;        // ms exit animation

const QUALITY_MAP = {
  right: { value: 5, label: "Easy",  emoji: "😎", color: "emerald" },
  left:  { value: 1, label: "Again", emoji: "🔄", color: "red" },
  down:  { value: 3, label: "Hard",  emoji: "😤", color: "orange" },
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ── swipe indicator overlays ─────────────────────── */
function SwipeOverlay({ dx, dy, threshold }) {
  const rx = clamp(dx / threshold, -1, 1);
  const ry = clamp(dy / threshold, 0, 1);

  const rightOp = Math.max(0, rx);
  const leftOp  = Math.max(0, -rx);
  const downOp  = ry > 0.3 ? ry : 0;

  return (
    <>
      {/* Right → Easy */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(16,185,129,${rightOp * 0.25})`, opacity: rightOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">😎</span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Easy</span>
        </div>
      </div>
      {/* Left → Again */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(239,68,68,${leftOp * 0.25})`, opacity: leftOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">🔄</span>
          <span className="text-lg font-bold text-red-600 dark:text-red-400">Again</span>
        </div>
      </div>
      {/* Down → Hard */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(251,146,60,${downOp * 0.25})`, opacity: downOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">😤</span>
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">Hard</span>
        </div>
      </div>
    </>
  );
}

/* ── main component ───────────────────────────────── */
export default function SRSReview() {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [done, setDone] = useState(false);

  /* drag state */
  const [dragging, setDragging] = useState(false);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [exiting, setExiting] = useState(null);   // {x,y} target when flying off
  const startRef = useRef(null);
  const submittingRef = useRef(false);
  const cardRef = useRef(null);

  const flashcardLimit = user?.preferences?.flashcard_count ?? 20;

  useEffect(() => {
    getSRSDueCards(flashcardLimit)
      .then((res) => {
        setCards(res.data.cards || []);
        if ((res.data.count ?? res.data.cards?.length ?? 0) === 0) setDone(true);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load cards."))
      .finally(() => setLoading(false));
  }, [flashcardLimit]);

  /* ── advance to next card ───────────────────── */
  const advance = useCallback(() => {
    setShowAnswer(false);
    setDx(0);
    setDy(0);
    setExiting(null);
    setDragging(false);
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setDone(true);
    }
  }, [currentIndex, cards.length]);

  /* ── submit rating ──────────────────────────── */
  const handleRate = useCallback(async (quality, exitDir) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const card = cards[currentIndex];

    // Fly the card off-screen
    const targets = {
      right: { x: FLY_DISTANCE, y: 0 },
      left:  { x: -FLY_DISTANCE, y: 0 },
      down:  { x: 0, y: FLY_DISTANCE },
    };
    setExiting(targets[exitDir] || targets.right);

    try {
      await submitSRSReview(card.id, quality);
      setReviewedCount((prev) => prev + 1);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit review.");
    }

    setTimeout(() => {
      submittingRef.current = false;
      advance();
    }, FLY_DURATION);
  }, [cards, currentIndex, advance]);

  /* ── pointer / touch handlers ───────────────── */
  const onPointerDown = (e) => {
    if (!showAnswer || exiting) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    setDx(0);
    setDy(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !startRef.current) return;
    setDx(e.clientX - startRef.current.x);
    setDy(Math.max(0, e.clientY - startRef.current.y)); // only allow drag down, not up
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    startRef.current = null;

    // Determine if threshold met
    if (dx > SWIPE_THRESHOLD) {
      handleRate(QUALITY_MAP.right.value, "right");
    } else if (dx < -SWIPE_THRESHOLD) {
      handleRate(QUALITY_MAP.left.value, "left");
    } else if (dy > SWIPE_THRESHOLD) {
      handleRate(QUALITY_MAP.down.value, "down");
    } else {
      // Snap back
      setDx(0);
      setDy(0);
    }
  };

  const handleReveal = () => {
    if (dragging) return;
    setShowAnswer(true);
  };

  /* ── keyboard shortcuts ─────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (!showAnswer || exiting) return;
      if (e.key === "ArrowRight") handleRate(5, "right");
      else if (e.key === "ArrowLeft") handleRate(1, "left");
      else if (e.key === "ArrowDown") handleRate(3, "down");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAnswer, exiting, handleRate]);

  // Space / Enter to reveal
  useEffect(() => {
    const handler = (e) => {
      if (showAnswer || exiting || done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setShowAnswer(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAnswer, exiting, done]);

  /* ── renders ────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="text-6xl mb-2">{reviewedCount > 0 ? "🎉" : "✅"}</div>
        <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          {reviewedCount > 0 ? "Session complete!" : "All caught up!"}
        </h2>
        <p className="text-surface-500 dark:text-surface-400">
          {reviewedCount > 0
            ? `You reviewed ${reviewedCount} card${reviewedCount !== 1 ? "s" : ""}. Great work!`
            : "No cards are due right now. Come back later!"}
        </p>
        <Link
          to="/"
          className="inline-block mt-4 px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = (reviewedCount / cards.length) * 100;

  // Card transform
  const tx = exiting ? exiting.x : dx;
  const ty = exiting ? exiting.y : dy;
  const rotate = tx * 0.06;  // slight tilt
  const scale = exiting ? 0.95 : (dragging ? 1.02 : 1);
  const transition = dragging ? "none" : `transform ${FLY_DURATION}ms cubic-bezier(.4,.9,.3,1), opacity ${FLY_DURATION}ms ease`;

  // Border glow
  let borderColor = "";
  if (showAnswer && !exiting) {
    if (dx > 30)       borderColor = "border-emerald-400 dark:border-emerald-500";
    else if (dx < -30) borderColor = "border-red-400 dark:border-red-500";
    else if (dy > 30)  borderColor = "border-orange-400 dark:border-orange-500";
  }

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Flashcards</h1>
          <p className="text-sm text-surface-400 dark:text-surface-500 mt-0.5">{cards.length} cards due today</p>
        </div>
        <span className="text-sm font-medium text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 px-3 py-1 rounded-full">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
        <div
          className="bg-primary-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Swipe hints */}
      {showAnswer && !exiting && (
        <div className="flex justify-between items-center text-xs text-surface-400 dark:text-surface-500 px-2">
          <span className="flex items-center gap-1">← Again</span>
          <span className="flex items-center gap-1">↓ Hard</span>
          <span className="flex items-center gap-1">Easy →</span>
        </div>
      )}

      {/* Card wrapper — allows overflow for flying off */}
      <div className="relative overflow-visible" style={{ minHeight: 320 }}>
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative bg-white dark:bg-surface-800 rounded-2xl shadow-sm border-2 overflow-hidden touch-none
            ${borderColor || "border-surface-100 dark:border-surface-700"}`}
          style={{
            transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
            transition,
            opacity: exiting ? 0 : 1,
            cursor: showAnswer ? "grab" : "pointer",
          }}
        >
          {/* Swipe overlays */}
          {dragging && showAnswer && (
            <SwipeOverlay dx={dx} dy={dy} threshold={SWIPE_THRESHOLD} />
          )}

          {/* Front — always visible */}
          <div className="px-8 py-10 text-center border-b border-surface-100 dark:border-surface-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3">French</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-bold text-surface-900 dark:text-surface-100">{card.french}</span>
              <AudioPlayButton text={card.french} />
            </div>
            {card.pronunciation && (
              <p className="text-sm text-surface-400 dark:text-surface-500 font-mono mt-2">/{card.pronunciation}/</p>
            )}
          </div>

          {/* Back — tap to reveal */}
          {!showAnswer ? (
            <div className="px-8 py-8 text-center">
              <button
                onClick={handleReveal}
                className="px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
              >
                Tap to reveal
              </button>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">or press Space</p>
            </div>
          ) : (
            <div className="transition-all duration-300 opacity-100">
              <div className="px-8 py-6 text-center border-b border-surface-100 dark:border-surface-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-2">English</p>
                <p className="text-2xl font-semibold text-surface-800 dark:text-surface-100">{card.english}</p>
                {card.example_sentence && (
                  <p className="text-sm text-surface-500 dark:text-surface-400 italic mt-3 border-l-2 border-primary-200 dark:border-primary-800 pl-3 text-left">
                    "{card.example_sentence}"
                  </p>
                )}
              </div>

              {/* Rating buttons — fallback for non-swipe users */}
              <div className="px-6 py-4">
                <p className="text-xs text-center text-surface-400 dark:text-surface-500 mb-3">Swipe or tap to rate</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRate(1, "left")}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 flex flex-col items-center gap-0.5 transition-colors"
                  >
                    <span className="text-sm font-semibold">Again</span>
                    <span className="text-xs opacity-80">←</span>
                  </button>
                  <button
                    onClick={() => handleRate(3, "down")}
                    className="bg-orange-400 hover:bg-orange-500 text-white rounded-xl py-2.5 flex flex-col items-center gap-0.5 transition-colors"
                  >
                    <span className="text-sm font-semibold">Hard</span>
                    <span className="text-xs opacity-80">↓</span>
                  </button>
                  <button
                    onClick={() => handleRate(5, "right")}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 flex flex-col items-center gap-0.5 transition-colors"
                  >
                    <span className="text-sm font-semibold">Easy</span>
                    <span className="text-xs opacity-80">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-center text-surface-400 dark:text-surface-500">
        Keyboard: ← Again &nbsp;·&nbsp; ↓ Hard &nbsp;·&nbsp; → Easy &nbsp;·&nbsp; Space reveal
      </p>
    </div>
  );
}
