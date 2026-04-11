import { useState, useEffect, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http") ? rawUrl : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

/**
 * Listen & Choose: plays audio, user picks the correct word from options.
 * Props: word (string to play), options=[string], correctAnswer (string), onAnswer(correct: bool)
 */
export default function ListenChooseQuestion({ word, options, correctAnswer, onAnswer, disabled, generateTTS }) {
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const audioRef = useRef(null);

  // Auto-play on mount
  useEffect(() => {
    playAudio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playAudio = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      const res = await generateTTS(word);
      const url = resolveAudioUrl(res.data.audio_url);
      if (url) {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => setPlaying(false);
        audio.play().catch(() => setPlaying(false));
        setPlayCount((c) => c + 1);
      } else {
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
    }
  };

  const handleSelect = (option) => {
    if (disabled || selected != null) return;
    setSelected(option);
    onAnswer(option === correctAnswer);
  };

  return (
    <div>
      <p className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
        What did you hear?
      </p>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
        Listen to the audio and pick the correct word
      </p>

      {/* Play button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={playAudio}
          disabled={playing}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
            playing
              ? "bg-primary-100 dark:bg-primary-900/30 scale-105 animate-pulse"
              : "bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:scale-105 active:scale-95"
          } border-2 border-primary-200 dark:border-primary-800`}
        >
          <svg className="w-7 h-7 text-primary-600 dark:text-primary-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((option, i) => {
          const isSelected = selected === option;
          const showResult = selected != null;
          let style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:border-primary-300 hover:scale-[1.02]";

          if (showResult) {
            if (option === correctAnswer) {
              style = "border-success-400 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300";
            } else if (isSelected && option !== correctAnswer) {
              style = "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 dark:text-danger-400 animate-shake";
            } else {
              style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-400 opacity-50";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              disabled={disabled || selected != null}
              className={`p-4 rounded-xl border-2 text-center font-semibold transition-all duration-200 ${style}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-surface-400 dark:text-surface-500 mt-3">
        {playCount === 0 ? "Audio will play automatically" : `Played ${playCount} time${playCount > 1 ? "s" : ""} — tap to replay`}
      </p>
    </div>
  );
}
