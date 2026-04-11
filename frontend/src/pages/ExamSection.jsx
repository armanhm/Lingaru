import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getExamExercises, startExamSession } from "../api/examPrep";
import { staggerDelay } from "../hooks/useAnimations";

const SECTION_NAMES = { CO: "Compréhension orale", CE: "Compréhension écrite", EE: "Expression écrite", EO: "Expression orale" };
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function ExamSection() {
  const { section } = useParams();
  const navigate = useNavigate();
  const [level, setLevel] = useState("A1");
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getExamExercises(section, level)
      .then((res) => setExercises(res.data))
      .catch(() => setError("Failed to load exercises."))
      .finally(() => setLoading(false));
  }, [section, level]);

  const handleStart = async (mode = "practice") => {
    if (exercises.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      const res = await startExamSession(section, level, mode);
      // Store session data for the exercise page
      sessionStorage.setItem(`exam_session_${res.data.session_id}`, JSON.stringify(res.data));
      navigate(`/exam-prep/${section}/${res.data.session_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start session.");
      setStarting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <Link to="/exam-prep" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 mb-4 inline-flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Exam Prep
        </Link>
        <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100">
          {SECTION_NAMES[section] || section}
        </h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">
          {section === "CE" && "Read French texts and answer comprehension questions"}
          {section === "CO" && "Listen to French audio and answer comprehension questions"}
          {section === "EE" && "Write French texts graded by AI on grammar, vocabulary, and coherence"}
          {section === "EO" && "Speak French and get AI feedback on pronunciation, fluency, and grammar"}
        </p>
      </div>

      {/* CEFR level tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {CEFR_LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              level === l
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="card border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-700/20 p-4 text-danger-600 dark:text-danger-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <span className="text-5xl mb-3 block">📚</span>
          <p className="text-lg font-medium text-surface-600 dark:text-surface-400 mb-1">No exercises at {level} yet</p>
          <p className="text-sm text-surface-400 dark:text-surface-500">Try a different level, or check back later for new content.</p>
        </div>
      ) : (
        <>
          {/* Exercise list */}
          <div className="space-y-3">
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className="card p-4 flex items-center justify-between animate-fade-in-up"
                style={staggerDelay(i, 50)}
              >
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100">{ex.title}</h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    {ex.question_count} questions
                    {ex.time_limit_seconds > 0 && ` · ${Math.ceil(ex.time_limit_seconds / 60)} min`}
                  </p>
                </div>
                <span className="badge-primary">{ex.cefr_level}</span>
              </div>
            ))}
          </div>

          {/* Start button */}
          <div className="flex gap-3">
            <button
              onClick={() => handleStart("practice")}
              disabled={starting}
              className="btn-primary btn-lg flex-1"
            >
              {starting ? "Starting..." : `Start Practice (${exercises.length} exercises)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
