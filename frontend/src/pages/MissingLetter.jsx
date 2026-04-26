import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRandomVocabulary } from "../api/content";
import { submitMiniGameScore } from "../api/gamification";
import AudioPlayButton from "../components/AudioPlayButton";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { useAuth } from "../contexts/AuthContext";

const DEFAULT_ROUNDS = 8;

/** Strip accents for comparison */
function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Given a word, pick random indices to blank out.
 * Blanks ~40% of letters, minimum 1, keeping first letter visible as a hint.
 */
function pickBlanks(word) {
  if (word.length <= 2) return [1];
  const indices = [];
  for (let i = 1; i < word.length; i++) indices.push(i); // skip first letter
  // shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const count = Math.max(1, Math.min(Math.floor(word.length * 0.4), word.length - 1));
  return indices.slice(0, count).sort((a, b) => a - b);
}

/* ── Letter input slot ────────────────────────────────── */
function LetterSlot({ char, isBlank, userChar, focused, correct, wrong, onClick }) {
  if (!isBlank) {
    return (
      <span className="w-9 h-11 sm:w-11 sm:h-13 flex items-center justify-center text-lg sm:text-xl font-bold text-surface-700 dark:text-surface-300">
        {char}
      </span>
    );
  }

  let borderColor = "border-surface-300 dark:border-surface-600";
  let bgColor = "bg-white dark:bg-surface-800";
  if (correct) { borderColor = "border-success-400 dark:border-success-500"; bgColor = "bg-success-50 dark:bg-success-900/20"; }
  if (wrong)   { borderColor = "border-danger-400 dark:border-danger-500"; bgColor = "bg-danger-50 dark:bg-danger-900/20"; }
  if (focused && !correct && !wrong) { borderColor = "border-primary-500 dark:border-primary-400"; bgColor = "bg-primary-50 dark:bg-primary-900/10"; }

  return (
    <button
      onClick={onClick}
      className={`w-9 h-11 sm:w-11 sm:h-13 rounded-lg border-2 ${borderColor} ${bgColor}
        flex items-center justify-center text-lg sm:text-xl font-bold
        transition-all duration-200 cursor-pointer
        ${!correct && !wrong ? "hover:border-primary-400 hover:scale-105" : ""}`}
    >
      {userChar ? (
        <span className={correct ? "text-success-600 dark:text-success-400" : wrong ? "text-danger-600 dark:text-danger-400" : "text-surface-900 dark:text-surface-100"}>
          {userChar}
        </span>
      ) : (
        <span className="text-surface-300 dark:text-surface-600">_</span>
      )}
    </button>
  );
}

/* ── Lives display ────────────────────────────────────── */
function Lives({ lives, max }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-base transition-all duration-300 ${i < lives ? "" : "grayscale opacity-30"}`}>
          ❤️
        </span>
      ))}
    </div>
  );
}

/* ── Main game ────────────────────────────────────────── */
export default function MissingLetter() {
  const { user } = useAuth();
  const ROUNDS = user?.preferences?.missing_letter_rounds ?? DEFAULT_ROUNDS;
  const MAX_LIVES = 3;

  const [phase, setPhase] = useState("loading"); // loading | playing | done
  const [words, setWords] = useState([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState(null);
  const [roundResults, setRoundResults] = useState([]);

  // Current round state
  const [blanks, setBlanks] = useState([]);         // indices that are blanked
  const [userLetters, setUserLetters] = useState({}); // { blankIndex: letter }
  const [focusIdx, setFocusIdx] = useState(0);       // which blank is focused (index into blanks array)
  const [lives, setLives] = useState(MAX_LIVES);
  const [resultState, setResultState] = useState(null); // null | "correct" | "wrong"
  const [correctMap, setCorrectMap] = useState({});     // { blankIndex: true/false }

  const submittingRef = useRef(false);

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

  // Setup round
  const setupRound = useCallback((idx) => {
    const word = words[idx];
    if (!word) return;
    const b = pickBlanks(word.targetWord);
    setBlanks(b);
    setUserLetters({});
    setFocusIdx(0);
    setResultState(null);
    setCorrectMap({});
  }, [words]);

  useEffect(() => {
    if (phase === "playing" && words.length > 0) {
      setupRound(round);
    }
  }, [phase, round, words, setupRound]);

  // Advance
  const advance = useCallback(() => {
    if (round + 1 < words.length && lives > 0) {
      setRound((r) => r + 1);
    } else {
      setPhase("done");
      submitMiniGameScore("missing_letter", score, words.length)
        .then((res) => setXpEarned(res.data.xp_earned))
        .catch(() => {});
    }
  }, [round, words.length, lives, score]);

  // Type a letter into the focused blank
  const handleType = useCallback((key) => {
    if (resultState || blanks.length === 0) return;
    const blankIdx = blanks[focusIdx];
    if (blankIdx == null) return;

    setUserLetters((prev) => ({ ...prev, [blankIdx]: key }));

    // Move focus to next empty blank
    const nextEmpty = blanks.findIndex((b, i) => i > focusIdx && !userLetters[b] && b !== blankIdx);
    if (nextEmpty !== -1) {
      setFocusIdx(nextEmpty);
    }
  }, [resultState, blanks, focusIdx, userLetters]);

  // Backspace — clear current blank and move focus back
  const handleBackspace = useCallback(() => {
    if (resultState) return;
    const blankIdx = blanks[focusIdx];
    if (userLetters[blankIdx]) {
      // Clear current
      setUserLetters((prev) => { const n = { ...prev }; delete n[blankIdx]; return n; });
    } else if (focusIdx > 0) {
      // Move back and clear previous
      const prevBlankIdx = blanks[focusIdx - 1];
      setFocusIdx(focusIdx - 1);
      setUserLetters((prev) => { const n = { ...prev }; delete n[prevBlankIdx]; return n; });
    }
  }, [resultState, blanks, focusIdx, userLetters]);

  // Check answer when all blanks filled
  useEffect(() => {
    if (resultState || blanks.length === 0) return;
    const allFilled = blanks.every((b) => userLetters[b]);
    if (!allFilled) return;

    const word = words[round];
    const target = word.targetWord;
    const cMap = {};
    let allCorrect = true;

    blanks.forEach((b) => {
      const expected = target[b];
      const typed = userLetters[b];
      const match = stripAccents(typed.toLowerCase()) === stripAccents(expected.toLowerCase());
      cMap[b] = match;
      if (!match) allCorrect = false;
    });

    setCorrectMap(cMap);

    if (allCorrect) {
      setResultState("correct");
      setScore((s) => s + 1);
      setRoundResults((prev) => [...prev, { word, correct: true }]);
    } else {
      setResultState("wrong");
      setLives((l) => l - 1);
      setRoundResults((prev) => [...prev, { word, correct: false }]);
    }
  }, [userLetters, blanks, resultState, words, round]);

  // Handle next (Enter/Space after result)
  const handleNext = useCallback(() => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setTimeout(() => {
      submittingRef.current = false;
      advance();
    }, 50);
  }, [advance]);

  // Click on a blank to focus it
  const handleSlotClick = (blankArrayIdx) => {
    if (resultState) return;
    setFocusIdx(blankArrayIdx);
  };

  // Keyboard handler
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if ((e.key === "Enter" || e.key === " ") && resultState) {
        e.preventDefault();
        handleNext();
      } else if (e.key.length === 1 && /^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
        e.preventDefault();
        handleType(e.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleBackspace, handleNext, handleType, resultState]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-danger-700 dark:text-danger-400">{error}</div>
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
    const ranOut = lives <= 0;
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {pct === 100 ? "🌟" : pct >= 60 ? "🎉" : ranOut ? "💔" : "💪"}
        </div>
        <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100 animate-fade-in-up">
          {ranOut ? "Out of Lives!" : pct === 100 ? "Perfect Spelling!" : pct >= 60 ? "Well Done!" : "Keep Practicing!"}
        </h2>

        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-lg p-6 space-y-4 animate-scale-in">
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">{animatedScore}/{roundResults.length}</p>
              <p className="text-xs text-surface-400">correct</p>
            </div>
            <div className="text-center">
              <Lives lives={lives} max={MAX_LIVES} />
              <p className="text-xs text-surface-400 mt-1">lives left</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-warn-500">+{animatedXP}</p>
              <p className="text-xs text-surface-400">XP earned</p>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            {roundResults.map((r, i) => (
              <div
                key={i}
                style={staggerDelay(i, 40)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm animate-fade-in-up ${
                  r.correct ? "bg-success-50 dark:bg-success-900/20" : "bg-danger-50 dark:bg-danger-900/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{r.correct ? "✅" : "❌"}</span>
                  <span className="font-semibold text-surface-800 dark:text-surface-200">{r.word.french}</span>
                </div>
                <span className="text-xs text-surface-500 dark:text-surface-400">{r.word.english}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Link to="/mini-games" className="px-5 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors">
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
  const target = word.targetWord;

  return (
    <div className="max-w-xl mx-auto py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to="/mini-games" className="text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-surface-900 dark:text-surface-100">Missing Letter</h1>
        <span className="text-sm font-medium text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 px-3 py-1 rounded-full">
          {round + 1}/{words.length}
        </span>
      </div>

      {/* Progress */}
      <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(round / words.length) * 100}%` }} />
      </div>

      {/* Score + lives */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-full px-4 py-1.5 shadow-sm">
          <span className="text-xs text-surface-400">Score</span>
          <span className="text-sm font-bold text-primary-600">{score}/{round + (resultState ? 1 : 0)}</span>
        </div>
        <Lives lives={lives} max={MAX_LIVES} />
      </div>

      {/* Game card */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sm border border-surface-100 dark:border-surface-700 overflow-hidden animate-scale-in" key={round}>
        <div className="px-6 pt-6 pb-4 space-y-4">
          {/* Hint */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
              Fill in the missing letters
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-xl font-bold text-surface-900 dark:text-surface-100">{word.english}</p>
            </div>
            {word.part_of_speech && (
              <span className="inline-block text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-full">
                {word.part_of_speech}
              </span>
            )}
            {word.french !== word.targetWord && (
              <span className="inline-block text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full ml-1">
                {word.french.slice(0, word.french.length - word.targetWord.length)}…
              </span>
            )}
          </div>

          {/* Word with blanks */}
          <div className="flex justify-center gap-1 flex-wrap py-2">
            {target.split("").map((char, i) => {
              const blankArrayIdx = blanks.indexOf(i);
              const isBlank = blankArrayIdx !== -1;
              return (
                <LetterSlot
                  key={i}
                  char={char}
                  isBlank={isBlank}
                  userChar={isBlank ? userLetters[i] || "" : null}
                  focused={isBlank && blankArrayIdx === focusIdx && !resultState}
                  correct={correctMap[i] === true}
                  wrong={correctMap[i] === false}
                  onClick={() => isBlank && handleSlotClick(blankArrayIdx)}
                />
              );
            })}
          </div>
        </div>

        {/* Result feedback */}
        {resultState && (
          <div className={`mx-4 mb-4 px-4 py-3 rounded-xl text-center animate-fade-in-up ${
            resultState === "correct"
              ? "bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800"
              : "bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800"
          }`}>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl animate-pop-in">{resultState === "correct" ? "✅" : "❌"}</span>
              <span className={`text-sm font-bold ${
                resultState === "correct" ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"
              }`}>
                {resultState === "correct" ? "Correct!" : "Wrong!"}
              </span>
              {resultState === "correct" && <AudioPlayButton text={word.french} />}
            </div>
            {resultState === "wrong" && (
              <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
                Answer: <strong className="text-surface-900 dark:text-surface-100">{word.french}</strong>
              </p>
            )}
            {resultState === "correct" && (
              <span className="text-xs text-success-600 dark:text-success-400 font-medium">+2 XP</span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-4">
          {resultState ? (
            <button
              onClick={handleNext}
              tabIndex={-1}
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              {round + 1 < words.length && lives > 0 ? "Next Word →" : "See Results"}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Give up on this word
                  setResultState("wrong");
                  setLives((l) => l - 1);
                  setRoundResults((prev) => [...prev, { word, correct: false }]);
                  // Show all correct letters
                  const cMap = {};
                  blanks.forEach((b) => { cMap[b] = false; });
                  setCorrectMap(cMap);
                }}
                tabIndex={-1}
                className="flex-1 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
              >
                Skip (−❤️)
              </button>
              <button
                onClick={() => {
                  setUserLetters({});
                  setFocusIdx(0);
                  setCorrectMap({});
                }}
                tabIndex={-1}
                disabled={Object.keys(userLetters).length === 0}
                className="flex-1 py-2.5 border border-surface-300 dark:border-surface-600 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-40 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hints */}
      <div className="flex justify-center gap-3 text-xs text-surface-400 dark:text-surface-500">
        <span>Type letters to fill blanks</span>
        <span>·</span>
        <span>Backspace to undo</span>
        <span>·</span>
        <span>Enter / Space for next</span>
      </div>
    </div>
  );
}
