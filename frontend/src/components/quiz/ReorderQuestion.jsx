import { useState, useCallback } from "react";

/**
 * Sentence Builder: scrambled words, tap to reorder into a correct sentence.
 * Props: words=[string], correctSentence (string), onAnswer(correct: bool)
 */
export default function ReorderQuestion({ words: initialWords, correctSentence, onAnswer, disabled }) {
  const [available, setAvailable] = useState(() => {
    // Shuffle
    const arr = initialWords.map((w, i) => ({ text: w, id: i }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [placed, setPlaced] = useState([]);

  const handleWordClick = useCallback((wordObj) => {
    if (disabled) return;
    setAvailable((a) => a.filter((w) => w.id !== wordObj.id));
    setPlaced((p) => [...p, wordObj]);
  }, [disabled]);

  const handlePlacedClick = useCallback((wordObj) => {
    if (disabled) return;
    setPlaced((p) => p.filter((w) => w.id !== wordObj.id));
    setAvailable((a) => [...a, wordObj]);
  }, [disabled]);

  const handleCheck = () => {
    const sentence = placed.map((w) => w.text).join(" ");
    // Normalize for comparison: lowercase, trim extra spaces
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.,!?;:]+$/, "");
    const correct = normalize(sentence) === normalize(correctSentence);
    onAnswer(correct ? sentence : null);
  };

  const handleClear = () => {
    setAvailable((a) => [...a, ...placed]);
    setPlaced([]);
  };

  const allPlaced = available.length === 0;

  return (
    <div>
      <p className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
        Build the sentence
      </p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
        Tap words in the correct order to form a French sentence
      </p>

      {/* Answer area */}
      <div className="min-h-[56px] bg-surface-50 dark:bg-surface-700/30 rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-600 p-3 mb-4 flex flex-wrap gap-2">
        {placed.length === 0 ? (
          <span className="text-sm text-surface-400 dark:text-surface-500 italic">Tap words below to build the sentence...</span>
        ) : (
          placed.map((w) => (
            <button
              key={w.id}
              onClick={() => handlePlacedClick(w)}
              disabled={disabled}
              className="px-3 py-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium border border-primary-200 dark:border-primary-700 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-all hover:scale-105 active:scale-95"
            >
              {w.text}
            </button>
          ))
        )}
      </div>

      {/* Available words */}
      <div className="flex flex-wrap gap-2 mb-5">
        {available.map((w) => (
          <button
            key={w.id}
            onClick={() => handleWordClick(w)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-600 text-surface-800 dark:text-surface-200 text-sm font-medium hover:border-primary-400 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            {w.text}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleClear}
          disabled={disabled || placed.length === 0}
          className="btn-secondary btn-sm flex-1 disabled:opacity-40"
        >
          Clear
        </button>
        <button
          onClick={handleCheck}
          disabled={disabled || !allPlaced}
          className="btn-primary btn-sm flex-1 disabled:opacity-40"
        >
          Check
        </button>
      </div>
    </div>
  );
}
