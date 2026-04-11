import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRandomVocabulary } from "../api/content";
import { submitMiniGameScore } from "../api/gamification";
import { useCountUp } from "../hooks/useAnimations";
import { useAuth } from "../contexts/AuthContext";

const DEFAULT_PAIR_COUNT = 6;
const DEFAULT_PREVIEW = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Single card ──────────────────────────────────────── */
function Card({ card, flipped, matched, onClick, preview }) {
  const isFr = card.lang === "fr";
  const showFace = flipped || matched || preview;

  return (
    <div className="perspective-500" style={{ perspective: "600px" }}>
      <button
        onClick={onClick}
        disabled={showFace}
        className={`relative w-full aspect-[3/4] rounded-xl cursor-pointer
          ${matched ? "" : flipped ? "scale-[1.03]" : "hover:scale-[1.03] hover:shadow-lg"}
        `}
        style={{
          transformStyle: "preserve-3d",
          transform: showFace ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1), scale 0.3s",
        }}
      >
        {/* Back (hidden state) */}
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-3xl text-white/80">?</span>
        </div>

        {/* Front (revealed state) */}
        <div
          className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center p-2 shadow-md border-2
            ${matched
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
              : isFr
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                : "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
            }`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
            matched
              ? "text-emerald-500 dark:text-emerald-400"
              : isFr
                ? "text-blue-400 dark:text-blue-500"
                : "text-amber-400 dark:text-amber-500"
          }`}>
            {isFr ? "FR" : "EN"}
          </span>
          <span className={`text-sm sm:text-base font-bold text-center leading-tight ${
            matched
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-surface-900 dark:text-surface-100"
          }`}>
            {card.text}
          </span>
          {matched && <span className="text-base mt-1 animate-pop-in">✓</span>}
        </div>
      </button>
    </div>
  );
}

/* ── Main game ────────────────────────────────────────── */
export default function MatchPairs() {
  const { user } = useAuth();
  const PAIR_COUNT = user?.preferences?.match_pairs_count ?? DEFAULT_PAIR_COUNT;
  const PREVIEW_SECONDS = user?.preferences?.match_pairs_preview ?? DEFAULT_PREVIEW;

  const [phase, setPhase] = useState("loading"); // loading | preview | playing | done
  const [cards, setCards] = useState([]);
  const [flippedIds, setFlippedIds] = useState([]); // currently flipped (max 2)
  const [matchedPairIds, setMatchedPairIds] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewCountdown, setPreviewCountdown] = useState(PREVIEW_SECONDS);
  const lockRef = useRef(false); // prevent clicking during mismatch delay
  const timerRef = useRef(null);

  const animatedMoves = useCountUp(moves, 300);
  const animatedXP = useCountUp(xpEarned, 400);

  // Load vocabulary and build card grid
  useEffect(() => {
    getRandomVocabulary(PAIR_COUNT, { singleWord: true })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [res.data];
        if (data.length < PAIR_COUNT) {
          setError("Not enough vocabulary words available.");
          return;
        }

        // Build pairs: each vocab becomes 2 cards (FR + EN)
        const pairs = [];
        data.slice(0, PAIR_COUNT).forEach((v, i) => {
          pairs.push({ id: `fr-${i}`, pairId: i, lang: "fr", text: v.french, vocab: v });
          pairs.push({ id: `en-${i}`, pairId: i, lang: "en", text: v.english, vocab: v });
        });

        setCards(shuffle(pairs));
        setPhase("preview");
      })
      .catch(() => setError("Failed to load words."));
  }, []);

  // Preview phase — show all cards for a few seconds, then flip them down
  useEffect(() => {
    if (phase !== "preview") return;
    setPreviewCountdown(PREVIEW_SECONDS);
    const interval = setInterval(() => {
      setPreviewCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase("playing");
          setStartTime(Date.now());
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, startTime]);

  // Handle card click
  const handleCardClick = useCallback((cardId) => {
    if (lockRef.current) return;
    if (flippedIds.includes(cardId) || matchedPairIds.has(cards.find((c) => c.id === cardId)?.pairId)) return;

    const newFlipped = [...flippedIds, cardId];
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [first, second] = newFlipped.map((id) => cards.find((c) => c.id === id));

      if (first.pairId === second.pairId) {
        // Match!
        setMatchedPairIds((prev) => new Set([...prev, first.pairId]));
        setMatchCount((c) => c + 1);
        setFlippedIds([]);
      } else {
        // No match — flip back after delay
        lockRef.current = true;
        setTimeout(() => {
          setFlippedIds([]);
          lockRef.current = false;
        }, 800);
      }
    }
  }, [flippedIds, matchedPairIds, cards]);

  // Check for game completion
  useEffect(() => {
    if (phase !== "playing" || matchCount < PAIR_COUNT) return;
    clearInterval(timerRef.current);
    setPhase("done");
    // Score: perfect = PAIR_COUNT moves, bonus for fewer moves
    const perfect = PAIR_COUNT;
    const bonusMoves = Math.max(0, perfect + 4 - moves); // up to 4 bonus
    const finalScore = PAIR_COUNT + bonusMoves;
    submitMiniGameScore("match_pairs", finalScore, PAIR_COUNT * 2)
      .then((res) => setXpEarned(res.data.xp_earned))
      .catch(() => {});
  }, [matchCount, phase, moves]);

  // Keyboard: Escape to go back
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") window.history.back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
    const stars = moves <= PAIR_COUNT + 2 ? 3 : moves <= PAIR_COUNT + 5 ? 2 : 1;
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {stars === 3 ? "🌟" : stars === 2 ? "🎉" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100 animate-fade-in-up">
          {stars === 3 ? "Perfect Memory!" : stars === 2 ? "Well Done!" : "Keep Practicing!"}
        </h2>

        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-lg p-6 animate-scale-in">
          <div className="flex justify-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">{animatedMoves}</p>
              <p className="text-xs text-surface-400">moves</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-surface-600 dark:text-surface-300">{formatTime(elapsed)}</p>
              <p className="text-xs text-surface-400">time</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-500">+{animatedXP}</p>
              <p className="text-xs text-surface-400">XP earned</p>
            </div>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3].map((s) => (
              <span key={s} className={`text-2xl transition-all duration-500 ${s <= stars ? "animate-pop-in" : "grayscale opacity-30"}`}
                style={{ animationDelay: `${s * 150}ms`, animationFillMode: "both" }}>⭐</span>
            ))}
          </div>

          {/* Word review */}
          <div className="space-y-1.5 text-left">
            {cards.filter((c) => c.lang === "fr").map((c, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-700/30 text-sm">
                <span className="font-semibold text-surface-800 dark:text-surface-200">{c.text}</span>
                <span className="text-xs text-surface-500 dark:text-surface-400">{c.vocab.english}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Link
            to="/mini-games"
            className="px-5 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
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

  /* ── Preview + Playing screen ─────────────────────────── */
  const isPreview = phase === "preview";

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to="/mini-games" className="text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-surface-900 dark:text-surface-100">Match Pairs</h1>
        <div className="flex items-center gap-3">
          {!isPreview && <span className="text-xs text-surface-400 dark:text-surface-500">{formatTime(elapsed)}</span>}
          <span className="text-sm font-medium text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 px-3 py-1 rounded-full">
            {matchCount}/{PAIR_COUNT}
          </span>
        </div>
      </div>

      {/* Preview banner */}
      {isPreview && (
        <div className="text-center py-2 animate-fade-in">
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
            Memorize the cards! Starting in {previewCountdown}…
          </p>
        </div>
      )}

      {/* Progress */}
      {!isPreview && (
        <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
          <div
            className="bg-primary-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(matchCount / PAIR_COUNT) * 100}%` }}
          />
        </div>
      )}

      {/* Stats pill */}
      {!isPreview && (
        <div className="flex justify-center">
          <div className="flex items-center gap-4 bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-full px-4 py-1.5 shadow-sm text-xs">
            <span className="text-surface-400">Moves</span>
            <span className="font-bold text-primary-600">{moves}</span>
            <span className="text-surface-300 dark:text-surface-600">|</span>
            <span className="text-surface-400">Pairs</span>
            <span className="font-bold text-emerald-600">{matchCount}/{PAIR_COUNT}</span>
          </div>
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            flipped={flippedIds.includes(card.id)}
            matched={matchedPairIds.has(card.pairId)}
            preview={isPreview}
            onClick={() => !isPreview && handleCardClick(card.id)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs text-surface-400 dark:text-surface-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-800" /> French
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800" /> English
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-800" /> Matched
        </span>
      </div>

      <p className="text-xs text-center text-surface-400 dark:text-surface-500">
        {isPreview ? "Study the positions carefully!" : `Find all ${PAIR_COUNT} French–English pairs`}
      </p>
    </div>
  );
}
