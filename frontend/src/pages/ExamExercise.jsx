import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { submitExamResponse, completeExamSession } from "../api/examPrep";
import { generateTTS } from "../api/media";
import AudioPlayButton from "../components/AudioPlayButton";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { useToast } from "../contexts/ToastContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http") ? rawUrl : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

const SECTION_NAMES = { CO: "Compréhension orale", CE: "Compréhension écrite" };

export default function ExamExercise() {
  const { section, sessionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Session data is passed via location state from ExamSection
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current position
  const [exIdx, setExIdx] = useState(0);       // which exercise
  const [qIdx, setQIdx] = useState(0);          // which question within exercise
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  // Done
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);

  // Audio for CO
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const animatedScore = useCountUp(summary ? Math.round(summary.percentage || 0) : 0, 800);

  // Load session data — we re-fetch by starting a new session via the ExamSection page
  // The session data comes from sessionStorage since we navigated here
  useEffect(() => {
    const stored = sessionStorage.getItem(`exam_session_${sessionId}`);
    if (stored) {
      const data = JSON.parse(stored);
      setExercises(data.exercises || []);
      setLoading(false);
    } else {
      // Fallback: can't load without session data, redirect back
      setError("Session data not found. Please start a new session.");
      setLoading(false);
    }
  }, [sessionId]);

  const currentExercise = exercises[exIdx];
  const questions = currentExercise?.content?.questions || [];
  const currentQuestion = questions[qIdx];
  const totalQuestions = exercises.reduce((acc, ex) => acc + (ex.content?.questions?.length || 0), 0);

  // Generate audio for CO passages
  useEffect(() => {
    if (section !== "CO" || !currentExercise) return;
    const passage = currentExercise.content?.passage_fr;
    if (!passage) return;

    // Check if audio_url is already in content (from backend)
    if (currentExercise.content.audio_url) {
      setAudioUrl(resolveAudioUrl(currentExercise.content.audio_url));
      return;
    }

    // Generate via TTS
    generateTTS(passage)
      .then((res) => setAudioUrl(resolveAudioUrl(res.data.audio_url)))
      .catch(() => {}); // TTS failure is non-fatal
  }, [section, exIdx, currentExercise]);

  const handleAnswer = useCallback(async (answer) => {
    if (feedback || !currentExercise) return;

    try {
      const res = await submitExamResponse(sessionId, currentExercise.id, qIdx, answer);
      setFeedback(res.data);
      setTotalAnswered((c) => c + 1);
      if (res.data.is_correct) setScore((s) => s + 1);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit answer.");
    }
  }, [feedback, currentExercise, sessionId, qIdx]);

  const handleContinue = useCallback(() => {
    setFeedback(null);

    // Next question in current exercise
    if (qIdx + 1 < questions.length) {
      setQIdx((q) => q + 1);
      return;
    }

    // Next exercise
    if (exIdx + 1 < exercises.length) {
      setExIdx((e) => e + 1);
      setQIdx(0);
      setAudioUrl(null);
      return;
    }

    // All done — complete session
    completeExamSession(sessionId)
      .then((res) => {
        setSummary(res.data);
        setXpEarned(res.data.xp_earned || 0);
        setDone(true);
        if (res.data.xp_earned) showToast(`+${res.data.xp_earned} XP earned!`, "success");
      })
      .catch(() => setError("Failed to complete session."));
  }, [qIdx, questions.length, exIdx, exercises.length, sessionId, showToast]);

  // Enter/Space to continue
  useEffect(() => {
    if (!feedback) return;
    const handler = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleContinue(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [feedback, handleContinue]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="card border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-700/20 p-6 text-danger-600 dark:text-danger-400">{error}</div>
        <Link to={`/exam-prep/${section}`} className="btn-primary btn-md inline-block">Back to Section</Link>
      </div>
    );
  }

  /* ── Done screen ────────────────────────────────────── */
  if (done && summary) {
    const pct = summary.percentage || 0;
    return (
      <div className="max-w-xl mx-auto py-8 space-y-6 text-center">
        <div className="animate-bounce-in text-6xl mb-2">
          {pct >= 85 ? "🌟" : pct >= 65 ? "🎉" : pct >= 50 ? "👍" : "💪"}
        </div>
        <h2 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 animate-fade-in-up">
          {pct >= 85 ? "Excellent!" : pct >= 65 ? "Great job!" : pct >= 50 ? "Good effort!" : "Keep practicing!"}
        </h2>

        <div className="card p-6 space-y-4 animate-scale-in">
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary-600">{animatedScore}%</p>
              <p className="text-xs text-surface-400 mt-1">score</p>
            </div>
            {summary.cefr_estimate && (
              <div className="text-center">
                <p className="text-4xl font-bold text-warn-500">{summary.cefr_estimate}</p>
                <p className="text-xs text-surface-400 mt-1">estimated level</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-4xl font-bold text-success-500">+{xpEarned}</p>
              <p className="text-xs text-surface-400 mt-1">XP earned</p>
            </div>
          </div>

          <p className="text-sm text-surface-500 dark:text-surface-400">
            {score}/{totalAnswered} questions correct
          </p>
        </div>

        <div className="flex gap-3 justify-center animate-fade-in-up">
          <Link to={`/exam-prep/${section}`} className="btn-secondary btn-md">
            ← Back to Section
          </Link>
          <Link to="/exam-prep" className="btn-primary btn-md">
            Exam Prep Hub
          </Link>
        </div>
      </div>
    );
  }

  /* ── Exercise screen ────────────────────────────────── */
  const progress = totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <Link to={`/exam-prep/${section}`} className="text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors">
          ← Exit
        </Link>
        <h1 className="text-lg font-bold text-surface-900 dark:text-surface-100">{SECTION_NAMES[section]}</h1>
        <span className="text-sm font-medium text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 px-3 py-1 rounded-full">
          {totalAnswered + 1}/{totalQuestions}
        </span>
      </div>

      {/* Progress */}
      <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Exercise card */}
      <div className="card overflow-hidden animate-scale-in" key={`${exIdx}-${qIdx}`}>
        {/* Exercise header */}
        <div className="px-6 py-3 bg-surface-50 dark:bg-surface-700/30 border-b border-surface-100 dark:border-surface-700/50 flex items-center justify-between">
          <div>
            <p className="font-bold text-surface-900 dark:text-surface-100 text-sm">{currentExercise.title}</p>
            <p className="text-xs text-surface-400 dark:text-surface-500">{currentExercise.cefr_level} · Question {qIdx + 1}/{questions.length}</p>
          </div>
          <span className="badge-primary">{currentExercise.cefr_level}</span>
        </div>

        <div className="p-6 space-y-5">
          {/* CE: Reading passage */}
          {section === "CE" && currentExercise.content.text_fr && (
            <div className="bg-surface-50 dark:bg-surface-700/30 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-line">
                {currentExercise.content.text_fr}
              </p>
            </div>
          )}

          {/* CO: Audio player */}
          {section === "CO" && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  if (audioUrl) {
                    const audio = new Audio(audioUrl);
                    audio.onended = () => setAudioPlaying(false);
                    audio.play().catch(() => {});
                    setAudioPlaying(true);
                  }
                }}
                disabled={!audioUrl || audioPlaying}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 border-2 border-primary-200 dark:border-primary-800 ${
                  audioPlaying
                    ? "bg-primary-100 dark:bg-primary-900/30 scale-105 animate-pulse"
                    : "bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 hover:scale-105 active:scale-95"
                }`}
              >
                <svg className="w-7 h-7 text-primary-600 dark:text-primary-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <p className="text-xs text-surface-400 dark:text-surface-500">
                {audioUrl ? (audioPlaying ? "Playing..." : "Tap to listen") : "Generating audio..."}
              </p>
            </div>
          )}

          {/* Question */}
          {currentQuestion && (
            <div>
              <p className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-4">
                {currentQuestion.prompt}
              </p>

              {/* MCQ options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQuestion.options || []).map((option, i) => {
                  const isSelected = feedback && feedback.is_correct !== undefined;
                  let style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:border-primary-300 hover:scale-[1.01]";

                  if (isSelected) {
                    if (option === currentQuestion.correct_answer) {
                      style = "border-success-400 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300";
                    } else if (feedback?.user_answer === option) {
                      style = "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 dark:text-danger-400";
                    } else {
                      style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-400 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(option)}
                      disabled={!!feedback}
                      className={`p-3.5 rounded-xl border-2 text-left text-sm font-medium transition-all duration-200 ${style}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`p-4 rounded-xl animate-fade-in-up ${
              feedback.is_correct
                ? "bg-success-50 dark:bg-success-700/20 border border-success-200 dark:border-success-700"
                : "bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-700"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{feedback.is_correct ? "✅" : "❌"}</span>
                <span className={`font-bold ${feedback.is_correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"}`}>
                  {feedback.is_correct ? "Correct!" : "Incorrect"}
                </span>
              </div>
              {!feedback.is_correct && feedback.correct_answer && (
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Correct answer: <strong>{feedback.correct_answer}</strong>
                </p>
              )}
              {feedback.explanation && (
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{feedback.explanation}</p>
              )}
              <button onClick={handleContinue} className="btn-primary btn-sm mt-3">
                Continue
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-center text-surface-400 dark:text-surface-500">
        Press Enter or Space to continue after answering
      </p>
    </div>
  );
}
