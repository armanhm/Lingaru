import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { checkPronunciation, generateTTS } from "../api/media";
import { useCountUp } from "../hooks/useAnimations";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http")
    ? rawUrl
    : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

// Fetch random vocabulary from the content API for practice
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
      // Silently fail for TTS playback
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
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        to="/"
        className="text-sm text-primary-600 hover:text-primary-800 mb-6 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 mb-1">
          Pronunciation Practice
        </h1>
        <p className="text-surface-600">
          Listen to the word, then record yourself saying it.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {permissionDenied && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 mb-6 text-sm">
          Microphone access was denied. Please enable it in your browser settings to use pronunciation practice.
        </div>
      )}

      {loading && !word && (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      )}

      {word && (
        <div className="bg-white dark:bg-surface-800 rounded-xl shadow-lg p-8 animate-scale-in" key={word.id}>
          {/* Word display */}
          <div className="text-center mb-8">
            <p className="text-4xl font-bold text-surface-900 mb-2">
              {word.french}
            </p>
            {word.pronunciation && (
              <p className="text-lg text-surface-400 mb-1">
                /{word.pronunciation}/
              </p>
            )}
            <p className="text-surface-500">{word.english}</p>
          </div>

          {/* Listen button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={handleListen}
              className="flex items-center gap-2 px-6 py-3 bg-primary-100 text-primary-700 font-medium rounded-xl hover:bg-primary-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
              Listen First
            </button>
          </div>

          {/* Record section */}
          {!result && (
            <div className="text-center">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading}
                className={`inline-flex items-center gap-2 px-8 py-4 font-semibold rounded-xl transition-all ${
                  recording
                    ? "bg-red-500 text-white hover:bg-red-600 animate-recording-pulse"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                } disabled:opacity-50`}
              >
                {recording ? (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop Recording
                  </>
                ) : loading ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Record Yourself
                  </>
                )}
              </button>
              {!recording && !loading && (
                <p className="text-xs text-surface-400 mt-3">
                  Click to start recording, then click again to stop.
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="text-center">
                <p className="text-sm text-surface-500 mb-1">Accuracy</p>
                <p className={`text-5xl font-bold ${accuracyColor(result.accuracy_score)} animate-count-up`}>
                  {animatedAccuracy}%
                </p>
              </div>

              <div className="bg-surface-50 rounded-xl p-4 space-y-3">
                <div>
                  <span className="text-sm font-medium text-surface-500">
                    We heard:{" "}
                  </span>
                  <span className="text-surface-900">{result.transcription}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-surface-500">
                    Expected:{" "}
                  </span>
                  <span className="text-surface-900">{result.expected_text}</span>
                </div>
                {result.feedback && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-surface-700">{result.feedback}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setResult(null)}
                  className="flex-1 px-6 py-3 border border-surface-300 dark:border-surface-600 rounded-xl font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 hover:-translate-y-0.5 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  Next Word
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
