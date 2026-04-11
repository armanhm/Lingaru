import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { startDictation, checkDictation } from "../api/media";
import { useCountUp } from "../hooks/useAnimations";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http")
    ? rawUrl
    : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

export default function Dictation() {
  const [phase, setPhase] = useState("idle"); // idle | listening | answered
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clip, setClip] = useState(null);
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState(null);
  const [totalXP, setTotalXP] = useState(0);
  const audioRef = useRef(null);
  const animatedXP = useCountUp(totalXP, 500);

  const handleStart = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setUserText("");
    try {
      const res = await startDictation();
      // Backend returns { sentence_id, audio_clip: { id, audio_url, ... } }
      const clipData = {
        audio_clip_id: res.data.audio_clip.id,
        audio_url: res.data.audio_clip.audio_url,
      };
      setClip(clipData);
      setPhase("listening");

      // Auto-play the audio
      const url = resolveAudioUrl(clipData.audio_url);
      if (url) {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start dictation.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReplay = useCallback(() => {
    if (!clip) return;
    const url = resolveAudioUrl(clip.audio_url);
    if (url) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }
  }, [clip]);

  const handleCheck = useCallback(async () => {
    if (!clip || !userText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await checkDictation(clip.audio_clip_id, userText.trim());
      setResult(res.data);
      setPhase("answered");
      if (res.data.xp_earned) {
        setTotalXP((prev) => prev + res.data.xp_earned);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to check answer.");
    } finally {
      setLoading(false);
    }
  }, [clip, userText]);

  const handleNext = useCallback(() => {
    setPhase("idle");
    setClip(null);
    setResult(null);
    setUserText("");
    handleStart();
  }, [handleStart]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        to="/"
        className="text-sm text-primary-600 hover:text-primary-800 mb-6 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dictation Practice</h1>
        <p className="text-gray-600">
          Listen to a French sentence and type what you hear.
        </p>
      </div>

      {totalXP > 0 && (
        <div className="mb-6 inline-flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg px-4 py-2 text-sm font-medium animate-pop-in">
          <span>XP earned this session:</span>
          <span className="font-bold">{animatedXP}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {phase === "idle" && (
        <div className="text-center py-12 animate-fade-in-up">
          <div className="text-6xl mb-6 animate-bounce-in">
            <svg className="w-16 h-16 mx-auto text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <button
            onClick={handleStart}
            disabled={loading}
            className="px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 animate-pulse-glow"
          >
            {loading ? "Loading..." : "Start Dictation"}
          </button>
        </div>
      )}

      {phase === "listening" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 animate-scale-in">
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-6 py-3 bg-primary-100 text-primary-700 font-medium rounded-xl hover:bg-primary-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
              Replay Audio
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCheck();
            }}
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type what you heard:
            </label>
            <input
              type="text"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Type the French sentence..."
              autoFocus
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !userText.trim()}
              className="mt-4 w-full px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Checking..." : "Check"}
            </button>
          </form>
        </div>
      )}

      {phase === "answered" && result && (
        <div className="space-y-6">
          <div
            className={`p-6 rounded-xl border-2 ${
              result.correct
                ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 animate-fade-in-up"
                : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 animate-shake"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{result.correct ? "\u2705" : "\u274c"}</span>
              <span
                className={`text-xl font-bold ${
                  result.correct ? "text-green-800" : "text-red-800"
                }`}
              >
                {result.correct ? "Correct!" : "Not quite"}
              </span>
              {result.accuracy != null && (
                <span className="ml-auto text-sm font-medium text-gray-600">
                  Accuracy: {Math.round(result.accuracy * 100)}%
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Expected: </span>
                <span className="text-gray-900">{result.expected ?? result.expected_text}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">You typed: </span>
                <span className="text-gray-900">{result.user_text}</span>
              </div>
            </div>

            {result.xp_earned > 0 && (
              <div className="mt-4 inline-flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg px-3 py-1 text-sm font-bold animate-pop-in">
                +{result.xp_earned} XP
              </div>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={loading}
            className="w-full px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Next Sentence"}
          </button>
        </div>
      )}
    </div>
  );
}
