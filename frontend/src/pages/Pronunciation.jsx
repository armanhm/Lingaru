import { useState, useRef, useCallback, useEffect } from "react";
import client from "../api/client";
import { checkPronunciation, generateTTS } from "../api/media";
import { useCountUp } from "../hooks/useAnimations";
import { PageHeader } from "../components/ui";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http")
    ? rawUrl
    : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

async function fetchRandomVocab() {
  const res = await client.get("/content/vocabulary/random/");
  return res.data;
}

export default function Pronunciation() {
  const [word, setWord] = useState(null);
  const wordRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const animatedAccuracy = useCountUp(result ? Math.round(result.accuracy_score * 100) : 0, 600);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const loadWord = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const vocab = await fetchRandomVocab();
      wordRef.current = vocab;
      setWord(vocab);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load vocabulary word.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWord();
  }, [loadWord]);

  const handleListen = useCallback(async () => {
    if (!word) return;
    try {
      const res = await generateTTS(word.french);
      const url = resolveAudioUrl(res.data.audio_url);
      if (url) {
        const audio = new Audio(url);
        audio.play().catch(() => {});
      }
    } catch {
      // Silently fail
    }
  }, [word]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await submitRecording(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionDenied(true);
      }
      setError("Could not access microphone. Please allow microphone access.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const submitRecording = async (blob) => {
    const currentWord = wordRef.current;
    if (!currentWord) return;
    setLoading(true);
    setError(null);
    try {
      const res = await checkPronunciation(blob, currentWord.french, currentWord.id);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to check pronunciation.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = useCallback(() => {
    setResult(null);
    loadWord();
  }, [loadWord]);

  const accuracyColor = (score) => {
    if (score >= 0.8) return "text-success-600 dark:text-success-400";
    if (score >= 0.5) return "text-warn-600 dark:text-warn-400";
    return "text-danger-600 dark:text-danger-400";
  };

  const accuracyTone = (score) => {
    if (score >= 0.8) return { ring: "ring-success-200 dark:ring-success-800/40", grad: "from-success-500 to-info-500", emoji: "🎯" };
    if (score >= 0.5) return { ring: "ring-warn-200 dark:ring-warn-800/40", grad: "from-warn-500 to-accent-500", emoji: "👍" };
    return { ring: "ring-danger-200 dark:ring-danger-800/40", grad: "from-danger-500 to-accent-500", emoji: "💪" };
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow="Speak it out"
        title="Pronunciation"
        subtitle="Listen, then record yourself. We'll score your accent and give feedback."
        icon="🎤"
        backTo="/"
        backLabel="Back to dashboard"
        gradient
      />

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300 mb-5 flex items-start gap-2 animate-shake">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
          <span>{error}</span>
        </div>
      )}

      {permissionDenied && (
        <div className="bg-warn-50 dark:bg-warn-900/20 border border-warn-200 dark:border-warn-800 rounded-xl px-4 py-3 text-sm text-warn-700 dark:text-warn-300 mb-5 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0-3a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd" /></svg>
          <span>Microphone access was denied. Enable it in your browser settings to use pronunciation practice.</span>
        </div>
      )}

      {loading && !word && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      )}

      {word && (
        <div className="card relative overflow-hidden p-8 animate-scale-in" key={word.id}>
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500" />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-200/30 dark:bg-primary-700/20 rounded-full blur-3xl pointer-events-none" />

          {/* Word display */}
          <div className="relative text-center mb-8">
            <p className="text-display-xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight mb-2">
              {word.french}
            </p>
            {word.pronunciation && (
              <p className="text-body-lg text-surface-400 dark:text-surface-500 mb-1 font-mono">
                /{word.pronunciation}/
              </p>
            )}
            <p className="text-body text-surface-500 dark:text-surface-400">{word.english}</p>
          </div>

          {/* Listen button */}
          <div className="relative flex justify-center mb-8">
            <button
              onClick={handleListen}
              className="flex items-center gap-2 px-6 py-3 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold rounded-xl border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:scale-105 active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
              Listen first
            </button>
          </div>

          {/* Record section */}
          {!result && (
            <div className="relative text-center">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading}
                className={`inline-flex items-center gap-2 px-8 py-4 font-bold rounded-2xl transition-all active:scale-95 ${
                  recording
                    ? "bg-gradient-to-br from-danger-500 to-accent-600 text-white animate-recording-pulse shadow-glow-danger"
                    : "bg-gradient-to-br from-primary-600 to-purple-700 text-white hover:scale-105 shadow-glow-primary"
                } disabled:opacity-50`}
              >
                {recording ? (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop recording
                  </>
                ) : loading ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Analyzing…
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Record yourself
                  </>
                )}
              </button>
              {!recording && !loading && (
                <p className="text-caption text-surface-500 dark:text-surface-400 mt-3">
                  Click to start recording, then click again to stop.
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (() => {
            const tone = accuracyTone(result.accuracy_score);
            return (
              <div className="relative space-y-6 animate-fade-in-up">
                <div className="text-center">
                  <p className="text-4xl mb-2 animate-bounce-in">{tone.emoji}</p>
                  <p className="section-label mb-2">Accuracy</p>
                  <p className={`text-display-xl font-extrabold tracking-tight ${accuracyColor(result.accuracy_score)} animate-count-up`}>
                    {animatedAccuracy}%
                  </p>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-surface-50 to-primary-50/30 dark:from-surface-700/40 dark:to-primary-900/10 border border-surface-200 dark:border-surface-700 p-4 space-y-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="section-label">We heard</span>
                    <span className="text-body font-semibold text-surface-900 dark:text-surface-100">{result.transcription}</span>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="section-label">Expected</span>
                    <span className="text-body font-semibold text-surface-900 dark:text-surface-100">{result.expected_text}</span>
                  </div>
                  {result.feedback && (
                    <div className="border-t border-surface-200 dark:border-surface-700 pt-3">
                      <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{result.feedback}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setResult(null)}
                    className="btn-secondary btn-md flex-1"
                  >
                    Try again
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={loading}
                    className="btn-primary btn-md flex-1"
                  >
                    Next word
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
