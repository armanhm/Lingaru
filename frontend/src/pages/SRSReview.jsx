import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getSRSDueCards, submitSRSReview } from "../api/progress";
import AudioPlayButton from "../components/AudioPlayButton";
import { useAuth } from "../contexts/AuthContext";
import { TriumphHero, EmptyState } from "../components/ui";
import { markActivity, clearActivity } from "../hooks/useResumeSession";

/* ── swipe config ─────────────────────────────────── */
const SWIPE_THRESHOLD = 80;         // px to commit
const FLY_DISTANCE    = 600;        // px off-screen
const FLY_DURATION    = 300;        // ms exit animation

const QUALITY_MAP = {
  right: { value: 5, label: "Easy",  emoji: "😎", color: "success" },
  left:  { value: 1, label: "Again", emoji: "🔄", color: "danger" },
  down:  { value: 3, label: "Hard",  emoji: "😤", color: "warn" },
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
          <span className="text-h4 font-extrabold text-success-600 dark:text-success-400">Easy</span>
        </div>
      </div>
      {/* Left → Again */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(244,63,94,${leftOp * 0.25})`, opacity: leftOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">🔄</span>
          <span className="text-h4 font-extrabold text-danger-600 dark:text-danger-400">Again</span>
        </div>
      </div>
      {/* Down → Hard */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-10"
        style={{ background: `rgba(245,158,11,${downOp * 0.25})`, opacity: downOp }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl">😤</span>
          <span className="text-h4 font-extrabold text-warn-600 dark:text-warn-400">Hard</span>
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
    markActivity("Flashcard review in progress", "/practice/srs");
    getSRSDueCards(flashcardLimit)
      .then((res) => {
        setCards(res.data.cards || []);
        if ((res.data.count ?? res.data.cards?.length ?? 0) === 0) setDone(true);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load cards."))
      .finally(() => setLoading(false));
  }, [flashcardLimit]);

  useEffect(() => {
    if (done) clearActivity();
  }, [done]);

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
        <div className="card border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-700/20 p-6 text-danger-600 dark:text-danger-400">
          {error}
        </div>
      </div>
    );
  }

  if (done) {
    if (reviewedCount === 0) {
      return (
        <EmptyState
          icon="✅"
          title="All caught up!"
          subtitle="No cards are due right now. Come back later to keep your streak going — or take a quiz to stay sharp."
          tone="success"
          action={
            <div className="flex gap-2">
              <Link to="/" className="btn-secondary btn-md">Back to Dashboard</Link>
              <Link to="/practice/quiz/random" className="btn-primary btn-md">Take a quiz</Link>
            </div>
          }
        />
      );
    }

    const subline =
      reviewedCount >= 20 ? "Deep work. Your memory is going to thank you tomorrow."
      : reviewedCount >= 10 ? "Solid session — consistency builds fluency."
      : reviewedCount >= 5 ? "Great pace. Every review strengthens the memory trace."
      : "Small wins compound. See you tomorrow.";

    return (
      <TriumphHero
        emoji="🎉"
        headline="Session complete!"
        subline={subline}
        tone="celebratory"
        celebrate={reviewedCount >= 5}
        stats={[
          { value: reviewedCount, label: "cards reviewed", color: "text-primary-600 dark:text-primary-400" },
        ]}
        actions={
          <>
            <Link to="/" className="btn-secondary btn-md">Dashboard</Link>
            <Link to="/practice/srs" reloadDocument className="btn-primary btn-md">Review more</Link>
          </>
        }
      />
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
    if (dx > 30)       borderColor = "border-success-400 dark:border-success-500";
    else if (dx < -30) borderColor = "border-danger-400 dark:border-danger-500";
    else if (dy > 30)  borderColor = "border-warn-400 dark:border-warn-500";
  }

  return (
    <div className="max-w-xl mx-auto select-none">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 animate-fade-in">
        <div className="min-w-0">
          <p className="eyebrow-primary mb-1">Spaced repetition</p>
          <h1 className="text-h1 text-gradient-primary">Flashcards</h1>
          <p className="text-caption text-surface-500 dark:text-surface-400 mt-1">{cards.length} cards due today</p>
        </div>
        <span className="stat-pill shrink-0">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2 mb-5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-purple-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Swipe hints */}
      {showAnswer && !exiting && (
        <div className="flex justify-between items-center text-xs font-semibold text-surface-500 dark:text-surface-400 px-2 mb-4 uppercase tracking-wider">
          <span className="flex items-center gap-1 text-danger-600 dark:text-danger-400">← Again</span>
          <span className="flex items-center gap-1 text-warn-600 dark:text-warn-400">↓ Hard</span>
          <span className="flex items-center gap-1 text-success-600 dark:text-success-400">Easy →</span>
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
          className={`relative bg-white dark:bg-surface-800 rounded-2xl shadow-card border-2 overflow-hidden touch-none
            ${borderColor || "border-surface-100 dark:border-surface-700"}`}
          style={{
            transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
            transition,
            opacity: exiting ? 0 : 1,
            cursor: showAnswer ? "grab" : "pointer",
          }}
        >
          {/* Top accent band */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500" />

          {/* Swipe overlays */}
          {dragging && showAnswer && (
            <SwipeOverlay dx={dx} dy={dy} threshold={SWIPE_THRESHOLD} />
          )}

          {/* Front — always visible */}
          <div className="px-8 pt-10 pb-8 text-center border-b border-surface-100 dark:border-surface-700">
            <p className="section-label mb-3">French</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-display font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">{card.french}</span>
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
                className="btn-primary btn-lg"
              >
                Tap to reveal
              </button>
              <p className="text-caption text-surface-400 dark:text-surface-500 mt-3">or press <kbd className="kbd">Space</kbd></p>
            </div>
          ) : (
            <div className="transition-all duration-300 opacity-100">
              <div className="px-8 py-6 text-center border-b border-surface-100 dark:border-surface-700">
                <p className="section-label mb-2">English</p>
                <p className="text-h2 font-extrabold text-surface-800 dark:text-surface-100">{card.english}</p>
                {card.example_sentence && (
                  <div className="mt-4 rounded-xl bg-primary-50/60 dark:bg-primary-900/20 border-l-4 border-primary-400 dark:border-primary-600 pl-4 pr-3 py-2.5 text-left">
                    <p className="section-label mb-0.5">Example</p>
                    <p className="text-sm text-surface-700 dark:text-surface-300 italic">"{card.example_sentence}"</p>
                  </div>
                )}
              </div>

              {/* Rating buttons */}
              <div className="px-6 py-5">
                <p className="text-xs text-center font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">Swipe or tap to rate</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRate(1, "left")}
                    className="bg-gradient-to-br from-danger-500 to-danger-600 hover:shadow-glow-danger text-white rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all active:scale-95 font-bold"
                  >
                    <span className="text-sm">Again</span>
                    <span className="text-xs opacity-90">←</span>
                  </button>
                  <button
                    onClick={() => handleRate(3, "down")}
                    className="bg-gradient-to-br from-warn-500 to-accent-500 hover:shadow-glow-accent text-white rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all active:scale-95 font-bold"
                  >
                    <span className="text-sm">Hard</span>
                    <span className="text-xs opacity-90">↓</span>
                  </button>
                  <button
                    onClick={() => handleRate(5, "right")}
                    className="bg-gradient-to-br from-success-500 to-info-500 hover:shadow-glow-success text-white rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all active:scale-95 font-bold"
                  >
                    <span className="text-sm">Easy</span>
                    <span className="text-xs opacity-90">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-center text-surface-400 dark:text-surface-500 mt-4">
        <kbd className="kbd">←</kbd> Again &nbsp;·&nbsp; <kbd className="kbd">↓</kbd> Hard &nbsp;·&nbsp; <kbd className="kbd">→</kbd> Easy &nbsp;·&nbsp; <kbd className="kbd">Space</kbd> reveal
      </p>
    </div>
  );
}
