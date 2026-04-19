import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { submitExamResponse, completeExamSession } from "../api/examPrep";
import { generateTTS } from "../api/media";
import AudioPlayButton from "../components/AudioPlayButton";
import useVoiceRecorder from "../hooks/useVoiceRecorder";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";
import { useToast } from "../contexts/ToastContext";
import { TriumphHero } from "../components/ui";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http") ? rawUrl : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

const SECTION_NAMES = { CO: "Compréhension orale", CE: "Compréhension écrite", EE: "Expression écrite", EO: "Expression orale" };

export default function ExamExercise() {
  const { section, sessionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  // EE state
  const [writingText, setWritingText] = useState("");
  const [writingGrading, setWritingGrading] = useState(null);
  const [submittingWriting, setSubmittingWriting] = useState(false);

  // EO state
  const [transcription, setTranscription] = useState(null);
  const [speakingGrading, setSpeakingGrading] = useState(null);
  const [submittingSpeaking, setSubmittingSpeaking] = useState(false);

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
      setWritingText("");
      setWritingGrading(null);
      setTranscription(null);
      setSpeakingGrading(null);
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
    const emoji = pct >= 85 ? "🌟" : pct >= 65 ? "🎉" : pct >= 50 ? "👍" : "💪";
    const headline = pct >= 85 ? "Excellent!" : pct >= 65 ? "Great job!" : pct >= 50 ? "Good effort!" : "Keep practicing!";
    const subline = pct >= 85 ? "You're performing at exam standard — nearly ready."
      : pct >= 65 ? "Strong progress. Another session or two at this level should cement it."
      : pct >= 50 ? "Solid base. Focus on the tricky bits and try again."
      : "Each attempt teaches your brain something new. Try again when ready.";

    const stats = [
      { value: `${animatedScore}%`, label: "score", color: "text-primary-600 dark:text-primary-400" },
    ];
    if (summary.cefr_estimate) {
      stats.push({ value: summary.cefr_estimate, label: "estimated level", color: "text-warn-600 dark:text-warn-400" });
    }
    if (xpEarned) {
      stats.push({ value: `+${xpEarned}`, label: "XP earned", color: "text-success-600 dark:text-success-400" });
    }

    return (
      <TriumphHero
        emoji={emoji}
        headline={headline}
        subline={subline}
        tone={pct >= 65 ? "celebratory" : pct >= 50 ? "neutral" : "retry"}
        celebrate={pct >= 85}
        stats={stats}
        extra={
          <p className="mt-5 text-sm text-surface-500 dark:text-surface-400">
            {score}/{totalAnswered} questions correct
          </p>
        }
        actions={
          <>
            <Link to={`/exam-prep/${section}`} className="btn-secondary btn-md">
              Back to section
            </Link>
            <Link to="/exam-prep" className="btn-primary btn-md">
              Exam Prep hub
            </Link>
          </>
        }
      />
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
            <p className="text-xs text-surface-400 dark:text-surface-500">
              {currentExercise.cefr_level}
              {questions.length > 0 ? ` · Question ${qIdx + 1}/${questions.length}` : ` · Exercise ${exIdx + 1}/${exercises.length}`}
            </p>
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

          {/* CE/CO: MCQ Question */}
          {(section === "CE" || section === "CO") && currentQuestion && (
            <div>
              <p className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-4">
                {currentQuestion.prompt}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQuestion.options || []).map((option, i) => {
                  const isSelected = feedback && feedback.is_correct !== undefined;
                  let style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-200 hover:border-primary-300 hover:scale-[1.01]";
                  if (isSelected) {
                    if (option === currentQuestion.correct_answer) style = "border-success-400 bg-success-50 dark:bg-success-700/20 text-success-700 dark:text-success-300";
                    else if (feedback?.user_answer === option) style = "border-danger-400 bg-danger-50 dark:bg-danger-700/20 text-danger-600 dark:text-danger-400";
                    else style = "border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-400 opacity-50";
                  }
                  return (
                    <button key={i} onClick={() => handleAnswer(option)} disabled={!!feedback}
                      className={`p-3.5 rounded-xl border-2 text-left text-sm font-medium transition-all duration-200 ${style}`}>
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* EE: Writing */}
          {section === "EE" && currentExercise && !writingGrading && (
            <div className="space-y-4">
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-primary-100 dark:border-primary-800/30">
                <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
                  {currentExercise.content.prompt_fr}
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1 italic">
                  {currentExercise.content.prompt_en}
                </p>
              </div>
              <div>
                <textarea
                  value={writingText}
                  onChange={(e) => setWritingText(e.target.value)}
                  placeholder="Écrivez votre texte ici..."
                  rows={8}
                  disabled={submittingWriting}
                  className="input w-full resize-none text-sm leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-surface-400 dark:text-surface-500">
                    {writingText.trim().split(/\s+/).filter(Boolean).length} / {currentExercise.content.word_limit || "∞"} words
                  </span>
                  <button
                    onClick={async () => {
                      if (!writingText.trim()) return;
                      setSubmittingWriting(true);
                      try {
                        const res = await submitExamResponse(sessionId, currentExercise.id, 0, writingText.trim());
                        setWritingGrading(res.data.grading || {});
                        setTotalAnswered((c) => c + 1);
                        setScore((s) => s + (res.data.grading?.score || 0));
                      } catch { setError("Grading failed."); }
                      finally { setSubmittingWriting(false); }
                    }}
                    disabled={submittingWriting || !writingText.trim()}
                    className="btn-primary btn-sm"
                  >
                    {submittingWriting ? "Grading..." : "Submit for Grading"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EE: Writing grading result */}
          {section === "EE" && writingGrading && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary-600">{writingGrading.score || 0}/{writingGrading.max_score || 20}</p>
                <p className="text-xs text-surface-400 mt-1">AI Score</p>
              </div>
              {/* Score breakdown */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Grammar", key: "grammar_score" },
                  { label: "Vocab", key: "vocabulary_score" },
                  { label: "Coherence", key: "coherence_score" },
                  { label: "Task", key: "task_score" },
                  { label: "Spelling", key: "spelling_score" },
                ].map(({ label, key }) => (
                  <div key={key} className="text-center bg-surface-50 dark:bg-surface-700/30 rounded-lg py-2">
                    <p className="text-sm font-bold text-surface-700 dark:text-surface-300">{writingGrading[key] ?? "–"}</p>
                    <p className="text-[10px] text-surface-400">{label}</p>
                  </div>
                ))}
              </div>
              {writingGrading.feedback_en && (
                <div className="bg-info-50 dark:bg-info-700/20 border border-info-200 dark:border-info-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-info-600 dark:text-info-400 mb-1">Feedback</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{writingGrading.feedback_en}</p>
                </div>
              )}
              {writingGrading.errors?.length > 0 && (
                <div>
                  <p className="section-label mb-2">Corrections</p>
                  <div className="space-y-1.5">
                    {writingGrading.errors.map((err, i) => (
                      <div key={i} className="bg-danger-50 dark:bg-danger-700/20 rounded-lg px-3 py-2 text-sm">
                        <span className="text-danger-600 line-through">{err.original}</span>
                        <span className="mx-2">→</span>
                        <span className="text-success-600 font-medium">{err.corrected}</span>
                        {err.explanation && <p className="text-xs text-surface-500 mt-0.5">{err.explanation}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {writingGrading.corrected_text && (
                <details className="group">
                  <summary className="text-sm font-medium text-primary-600 dark:text-primary-400 cursor-pointer flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Show corrected text
                  </summary>
                  <p className="text-sm text-surface-700 dark:text-surface-300 mt-2 pl-5 leading-relaxed">{writingGrading.corrected_text}</p>
                </details>
              )}
              <button onClick={handleContinue} className="btn-primary btn-md w-full">
                {exIdx + 1 < exercises.length ? "Next Exercise →" : "See Results"}
              </button>
            </div>
          )}

          {/* EO: Speaking */}
          {section === "EO" && currentExercise && !speakingGrading && (
            <div className="space-y-4">
              <div className="bg-warn-50 dark:bg-warn-700/20 rounded-xl p-4 border border-warn-100 dark:border-warn-800/30">
                <p className="text-sm font-medium text-warn-800 dark:text-warn-200">
                  {currentExercise.content.prompt_fr}
                </p>
                <p className="text-xs text-warn-600 dark:text-warn-400 mt-1 italic">
                  {currentExercise.content.prompt_en}
                </p>
                {currentExercise.content.duration_seconds && (
                  <p className="text-xs text-warn-500 mt-2">Target duration: {currentExercise.content.duration_seconds}s</p>
                )}
              </div>
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={async () => {
                    if (isRecording) {
                      const blob = await stopRecording();
                      if (!blob) return;
                      setSubmittingSpeaking(true);
                      try {
                        // Transcribe via STT then grade
                        const formData = new FormData();
                        formData.append("audio", blob, "recording.webm");
                        const sttRes = await fetch(`${API_BASE_URL}/media/voice-chat/`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
                          body: formData,
                        });
                        const sttData = await sttRes.json();
                        const text = sttData.transcription || "";
                        setTranscription(text);
                        // Submit for AI grading
                        const res = await submitExamResponse(sessionId, currentExercise.id, 0, text);
                        setSpeakingGrading(res.data.grading || {});
                        setTotalAnswered((c) => c + 1);
                        setScore((s) => s + (res.data.grading?.score || 0));
                      } catch { setError("Recording or grading failed."); }
                      finally { setSubmittingSpeaking(false); }
                    } else {
                      try { await startRecording(); } catch { setError("Microphone access required."); }
                    }
                  }}
                  disabled={submittingSpeaking}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                    isRecording
                      ? "bg-danger-100 dark:bg-danger-900/30 border-danger-300 dark:border-danger-700 animate-recording-pulse"
                      : "bg-warn-50 dark:bg-warn-900/20 border-warn-200 dark:border-warn-800 hover:scale-105"
                  }`}
                >
                  {submittingSpeaking ? (
                    <svg className="w-6 h-6 animate-spin text-surface-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  ) : isRecording ? (
                    <svg className="w-8 h-8 text-danger-500" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  ) : (
                    <svg className="w-8 h-8 text-warn-600 dark:text-warn-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  )}
                </button>
                <p className="text-xs text-surface-400 dark:text-surface-500">
                  {submittingSpeaking ? "Analyzing your speech..." : isRecording ? "Recording... tap to stop" : "Tap to start recording"}
                </p>
              </div>
            </div>
          )}

          {/* EO: Speaking grading result */}
          {section === "EO" && speakingGrading && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary-600">{speakingGrading.score || 0}/{speakingGrading.max_score || 20}</p>
                <p className="text-xs text-surface-400 mt-1">AI Score</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Fluency", key: "fluency_score" },
                  { label: "Vocab", key: "vocabulary_score" },
                  { label: "Grammar", key: "grammar_score" },
                  { label: "Task", key: "task_score" },
                  { label: "Coherence", key: "coherence_score" },
                ].map(({ label, key }) => (
                  <div key={key} className="text-center bg-surface-50 dark:bg-surface-700/30 rounded-lg py-2">
                    <p className="text-sm font-bold text-surface-700 dark:text-surface-300">{speakingGrading[key] ?? "–"}</p>
                    <p className="text-[10px] text-surface-400">{label}</p>
                  </div>
                ))}
              </div>
              {transcription && (
                <div className="bg-surface-50 dark:bg-surface-700/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">What we heard</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300 italic">{transcription}</p>
                </div>
              )}
              {speakingGrading.feedback_en && (
                <div className="bg-info-50 dark:bg-info-700/20 border border-info-200 dark:border-info-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-info-600 dark:text-info-400 mb-1">Feedback</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300">{speakingGrading.feedback_en}</p>
                </div>
              )}
              {speakingGrading.pronunciation_notes && (
                <p className="text-xs text-surface-500 dark:text-surface-400"><strong>Pronunciation:</strong> {speakingGrading.pronunciation_notes}</p>
              )}
              {speakingGrading.grammar_notes && (
                <p className="text-xs text-surface-500 dark:text-surface-400"><strong>Grammar:</strong> {speakingGrading.grammar_notes}</p>
              )}
              <button onClick={handleContinue} className="btn-primary btn-md w-full">
                {exIdx + 1 < exercises.length ? "Next Exercise →" : "See Results"}
              </button>
            </div>
          )}

          {/* CE/CO: Feedback */}
          {(section === "CE" || section === "CO") && feedback && (
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
