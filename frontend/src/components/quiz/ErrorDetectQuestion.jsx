import { useState } from "react";

/**
 * Spot the Error: a sentence with one wrong word. Tap the error.
 * Props: words=[{text, isError}], correctWord (string), onAnswer(correct: bool)
 */
export default function ErrorDetectQuestion({ words, correctWord, onAnswer, disabled }) {
  const [selected, setSelected] = useState(null);

  const handleClick = (idx) => {
    if (disabled || selected != null) return;
    setSelected(idx);
    onAnswer(words[idx].isError);
  };

  return (
    <div>
      <p className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
        Spot the error
      </p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
        Tap the word that contains a mistake
      </p>

      <div className="flex flex-wrap gap-2 justify-center py-4">
        {words.map((w, i) => {
          const isSelected = selected === i;
          const showResult = selected != null;
          let style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:scale-105";

          if (showResult) {
            if (w.isError && isSelected) {
              style = "border-success-400 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300 scale-105";
            } else if (w.isError && !isSelected) {
              style = "border-warn-400 bg-warn-50 dark:bg-warn-700/20 text-warn-700 dark:text-warn-300 underline decoration-wavy decoration-warn-500";
            } else if (!w.isError && isSelected) {
              style = "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 dark:text-danger-400 animate-shake";
            } else {
              style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-500 dark:text-surface-400 opacity-60";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={disabled || selected != null}
              className={`px-3.5 py-2 rounded-xl border-2 text-base font-medium transition-all duration-200 active:scale-95 ${style}`}
            >
              {w.text}
            </button>
          );
        })}
      </div>

      {selected != null && (
        <div className="text-center mt-3 animate-fade-in-up">
          {words[selected]?.isError ? (
            <p className="text-sm text-success-600 dark:text-success-400">
              Correct! The word should be: <strong>{correctWord}</strong>
            </p>
          ) : (
            <p className="text-sm text-danger-600 dark:text-danger-400">
              The error was: <strong className="underline decoration-wavy">{words.find((w) => w.isError)?.text}</strong> → <strong>{correctWord}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
