import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getExamExercises, startExamSession } from "../api/examPrep";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState } from "../components/ui";

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

  const subtitle = {
    CE: "Read French texts and answer comprehension questions.",
    CO: "Listen to French audio and answer comprehension questions.",
    EE: "Write French texts graded by AI on grammar, vocabulary, and coherence.",
    EO: "Speak French and get AI feedback on pronunciation, fluency, and grammar.",
  }[section] || "";

  const sectionIcon = { CE: "📖", CO: "🎧", EE: "✏️", EO: "🎤" }[section] || "🎓";

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backTo="/exam-prep"
        backLabel="Exam prep"
        eyebrow="TEF / TCF"
        title={SECTION_NAMES[section] || section}
        subtitle={subtitle}
        icon={sectionIcon}
      />

      {/* CEFR level tabs — segmented control style */}
      <div className="mb-6">
        <p className="section-label mb-2">Choose level</p>
        <div className="inline-flex p-1 rounded-2xl bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 gap-0.5">
          {CEFR_LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all focus-ring ${
                level === l
                  ? "bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
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
        <EmptyState
          icon="📚"
          title={`No exercises at ${level} yet`}
          subtitle="Try a different level, or check back later for new content."
        />
      ) : (
        <>
          {/* Exercise list */}
          <div className="space-y-2.5 mb-6">
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className="card card-hover p-4 flex items-center gap-3 animate-fade-in-up"
                style={staggerDelay(i, 50)}
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-surface-900 dark:text-surface-100">{ex.title}</h3>
                  <p className="text-caption text-surface-500 dark:text-surface-400 mt-0.5">
                    {ex.question_count} question{ex.question_count !== 1 ? "s" : ""}
                    {ex.time_limit_seconds > 0 && ` · ~${Math.ceil(ex.time_limit_seconds / 60)} min`}
                  </p>
                </div>
                <span className="badge-primary shrink-0">{ex.cefr_level}</span>
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
