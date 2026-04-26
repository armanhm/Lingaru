import { useState, useRef, useCallback } from "react";
import { startDictation, checkDictation } from "../api/media";
import { useCountUp } from "../hooks/useAnimations";
import { PageHeader } from "../components/ui";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http")
    ? rawUrl
    : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

export default function Dictation() {
  const [phase, setPhase] = useState("idle");
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
      const clipData = {
        audio_clip_id: res.data.audio_clip.id,
        audio_url: res.data.audio_clip.audio_url,
      };
      setClip(clipData);
      setPhase("listening");

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
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow="Listen carefully"
        title="Dictation"
        subtitle="Listen to a French sentence and type what you hear, accents and all."
        icon="🎧"
        backTo="/"
        backLabel="Back to dashboard"
        gradient
      />

      {totalXP > 0 && (
        <div className="mb-5 inline-flex items-center gap-2 bg-gradient-to-br from-warn-50 to-accent-50 dark:from-warn-900/30 dark:to-accent-900/30 border border-warn-200 dark:border-warn-800 text-warn-800 dark:text-warn-200 rounded-xl px-4 py-2 text-sm font-bold animate-pop-in shadow-sm">
          <span>⚡</span>
          <span>XP this session</span>
          <span className="text-warn-700 dark:text-warn-300">{animatedXP}</span>
        </div>
      )}

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300 mb-5 flex items-start gap-2 animate-shake">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
          <span>{error}</span>
        </div>
      )}

      {phase === "idle" && (
        <div className="card relative overflow-hidden p-12 text-center animate-fade-in-up">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-info-500 via-primary-500 to-purple-500" />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-info-200/30 dark:bg-info-700/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative inline-block mb-6 animate-bounce-in">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-info-500 to-primary-600 text-white flex items-center justify-center text-4xl shadow-glow-primary animate-float">
              🎧
            </div>
          </div>
          <p className="eyebrow-primary mb-2">Ready when you are</p>
          <h2 className="text-h2 text-surface-900 dark:text-surface-100 mb-2">Tune your ear</h2>
          <p className="text-body text-surface-500 dark:text-surface-400 mb-6 max-w-sm mx-auto">
            We'll play a French sentence — your job is to type it back exactly.
          </p>
          <button
            onClick={handleStart}
            disabled={loading}
            className="btn-primary btn-xl"
          >
            {loading ? "Loading…" : "Start dictation"}
          </button>
        </div>
      )}

      {phase === "listening" && (
        <div className="card relative overflow-hidden p-8 animate-scale-in">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-info-500 to-primary-500" />

          <div className="flex items-center justify-center mb-6">
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-6 py-3 bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-300 font-semibold rounded-xl border border-info-200 dark:border-info-700 hover:bg-info-100 dark:hover:bg-info-900/50 hover:scale-105 active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
              Replay audio
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCheck();
            }}
          >
            <label className="block section-label mb-2">Type what you heard</label>
            <input
              type="text"
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Type the French sentence…"
              autoFocus
              className="w-full px-4 py-3 border-2 border-surface-200 dark:border-surface-600 rounded-xl text-base bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading || !userText.trim()}
              className="btn-primary btn-lg w-full mt-4"
            >
              {loading ? "Checking…" : "Check answer"}
            </button>
          </form>
        </div>
      )}

      {phase === "answered" && result && (
        <div className="space-y-5">
          <div
            className={`card relative overflow-hidden p-6 ${
              result.correct ? "animate-fade-in-up" : "animate-shake"
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${
              result.correct ? "from-success-500 to-info-500" : "from-danger-500 to-accent-500"
            }`} />
            <div className="flex items-center gap-3 mb-5">
              <div className={`shrink-0 w-12 h-12 rounded-xl text-white flex items-center justify-center text-2xl shadow-sm ${
                result.correct
                  ? "bg-gradient-to-br from-success-500 to-info-500"
                  : "bg-gradient-to-br from-danger-500 to-accent-500"
              }`}>
                {result.correct ? "✓" : "✕"}
              </div>
              <div className="flex-1">
                <p className="eyebrow-primary mb-0.5">{result.correct ? "Bravo!" : "Not quite"}</p>
                <p className={`text-h3 font-extrabold ${
                  result.correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"
                }`}>
                  {result.correct ? "Correct!" : "Almost there"}
                </p>
              </div>
              {result.accuracy != null && (
                <div className="text-right shrink-0">
                  <p className="section-label">Accuracy</p>
                  <p className="text-h3 font-extrabold text-surface-900 dark:text-surface-100 tabular-nums">
                    {Math.round(result.accuracy * 100)}%
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-surface-50 dark:bg-surface-700/40 border border-surface-200 dark:border-surface-700 p-4 space-y-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="section-label">Expected</span>
                <span className="text-body font-semibold text-success-700 dark:text-success-300">{result.expected ?? result.expected_text}</span>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="section-label">You typed</span>
                <span className={`text-body font-semibold ${result.correct ? "text-surface-900 dark:text-surface-100" : "text-danger-700 dark:text-danger-300"}`}>{result.user_text}</span>
              </div>
            </div>

            {result.xp_earned > 0 && (
              <div className="mt-4 inline-flex items-center gap-1.5 bg-warn-100 dark:bg-warn-900/30 text-warn-800 dark:text-warn-200 rounded-lg px-3 py-1.5 text-sm font-bold animate-pop-in">
                <span>⚡</span>+{result.xp_earned} XP
              </div>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={loading}
            className="btn-primary btn-lg w-full"
          >
            {loading ? "Loading…" : "Next sentence"}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
