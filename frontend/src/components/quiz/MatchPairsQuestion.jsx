import { useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Match Pairs question: connect target-language words to native translations.
 * Props: pairs=[{french, english}], onAnswer(allCorrect: bool)
 */
export default function MatchPairsQuestion({ pairs, onAnswer, disabled }) {
  const { user } = useAuth();
  const isEn = user?.target_language === "en";
  const leftLabel = isEn ? "English" : "French";
  const rightLabel = isEn ? "Translation" : "English";
  const subtitle = isEn
    ? "Tap an English word, then tap its translation"
    : "Tap a French word, then tap its English translation";
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matched, setMatched] = useState({}); // { leftIdx: rightIdx }
  const [wrongFlash, setWrongFlash] = useState(null); // { left, right }

  // Shuffle the right side once
  const [rightOrder] = useState(() => {
    const indices = pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });

  const handleLeftClick = (idx) => {
    if (disabled || matched[idx] != null) return;
    setSelectedLeft(idx);
  };

  const handleRightClick = useCallback((rightIdx) => {
    if (disabled || selectedLeft == null) return;
    const actualRightPairIdx = rightOrder[rightIdx];

    if (selectedLeft === actualRightPairIdx) {
      // Correct match
      const newMatched = { ...matched, [selectedLeft]: rightIdx };
      setMatched(newMatched);
      setSelectedLeft(null);

      // Check if all matched
      if (Object.keys(newMatched).length === pairs.length) {
        setTimeout(() => onAnswer(true), 400);
      }
    } else {
      // Wrong match, flash red briefly
      setWrongFlash({ left: selectedLeft, right: rightIdx });
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedLeft(null);
      }, 600);
    }
  }, [disabled, selectedLeft, rightOrder, matched, pairs.length, onAnswer]);

  const isRightMatched = (rightIdx) =>
    Object.values(matched).includes(rightIdx);

  return (
    <div>
      <p className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
        Match the pairs
      </p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
        {subtitle}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Left column, French */}
        <div className="space-y-2">
          <p className="section-label mb-1">{leftLabel}</p>
          {pairs.map((pair, i) => {
            const isMatched = matched[i] != null;
            const isSelected = selectedLeft === i;
            const isWrong = wrongFlash?.left === i;

            return (
              <button
                key={i}
                onClick={() => handleLeftClick(i)}
                disabled={disabled || isMatched}
                className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all duration-200 ${
                  isMatched
                    ? "border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300"
                    : isWrong
                      ? "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 animate-shake"
                      : isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 scale-[1.02] shadow-sm"
                        : "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:border-primary-300"
                }`}
              >
                {isEn ? pair.english : pair.french}
                {isMatched && <span className="float-right">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Right column: native/translation (shuffled) */}
        <div className="space-y-2">
          <p className="section-label mb-1">{rightLabel}</p>
          {rightOrder.map((pairIdx, rightIdx) => {
            const isMatched = isRightMatched(rightIdx);
            const isWrong = wrongFlash?.right === rightIdx;

            return (
              <button
                key={rightIdx}
                onClick={() => handleRightClick(rightIdx)}
                disabled={disabled || isMatched || selectedLeft == null}
                className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all duration-200 ${
                  isMatched
                    ? "border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300"
                    : isWrong
                      ? "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 animate-shake"
                      : selectedLeft != null
                        ? "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:border-primary-300 hover:scale-[1.01]"
                        : "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400"
                }`}
              >
                {isEn ? pairs[pairIdx].french : pairs[pairIdx].english}
                {isMatched && <span className="float-right">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
