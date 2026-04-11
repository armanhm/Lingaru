import { useState } from "react";

/**
 * Odd One Out: 4 words shown, one doesn't belong.
 * Props: words=[{text, isOdd}], category (hint), onAnswer(correct: bool)
 */
export default function OddOneOutQuestion({ words, category, onAnswer, disabled }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (idx) => {
    if (disabled || selected != null) return;
    setSelected(idx);
    onAnswer(words[idx].isOdd);
  };

  return (
    <div>
      <p className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
        Which word doesn't belong?
      </p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
        {category ? `Three words share something in common. Find the odd one out.` : "Find the word that doesn't fit with the others."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {words.map((w, i) => {
          const isSelected = selected === i;
          const showResult = selected != null;
          let style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:border-primary-300 hover:scale-[1.02]";

          if (showResult) {
            if (w.isOdd && isSelected) {
              style = "border-success-400 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300 scale-[1.02]";
            } else if (w.isOdd && !isSelected) {
              style = "border-warn-400 bg-warn-50 dark:bg-warn-700/20 text-warn-700 dark:text-warn-300";
            } else if (!w.isOdd && isSelected) {
              style = "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 dark:text-danger-400 animate-shake";
            } else {
              style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-500 opacity-60";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={disabled || selected != null}
              className={`p-4 rounded-xl border-2 text-center font-medium transition-all duration-200 ${style}`}
            >
              <span className="text-lg block mb-1">{w.text}</span>
              {showResult && w.isOdd && (
                <span className="text-xs block mt-1 animate-fade-in">
                  {isSelected ? "✅ Correct!" : "⬅ This was the odd one"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected != null && category && (
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-3 text-center animate-fade-in-up">
          The other three are: <span className="font-medium text-surface-700 dark:text-surface-300">{category}</span>
        </p>
      )}
    </div>
  );
}
