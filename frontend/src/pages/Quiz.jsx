import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { startQuiz, submitAnswer, completeQuiz } from "../api/practice";

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
      <div
        className="bg-primary-500 h-3 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MCQQuestion({ question, onAnswer, disabled }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (option) => {
    if (disabled) return;
    setSelected(option);
    onAnswer(option);
  };

  return (
    <div>
      <p className="text-lg font-semibold text-gray-900 mb-6">
        {question.prompt}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(question.options || []).map((option, i) => (
          <button
            key={i}
            onClick={() => handleSelect(option)}
            disabled={disabled}
            className={`p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 ${
              selected === option
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            } ${disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextInputQuestion({ question, onAnswer, disabled }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled || !value.trim()) return;
    onAnswer(value.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-lg font-semibold text-gray-900 mb-2">
        {question.prompt}
      </p>
      <p className="text-sm text-gray-500 mb-6">
        {question.type === "translate"
          ? "Type your translation below"
          : "Fill in the blank"}
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type your answer..."
        autoFocus
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="mt-4 w-full sm:w-auto px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Check
      </button>
    </form>
  );
}

function FeedbackBanner({ result, onContinue }) {
  if (!result) return null;

  return (
    <div
      className={`mt-6 p-5 rounded-xl border-2 animate-fade-in ${
        result.is_correct
          ? "bg-green-50 border-green-300"
          : "bg-red-50 border-red-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{result.is_correct ? "\u2705" : "\u274c"}</span>
        <span
          className={`font-bold text-lg ${
            result.is_correct ? "text-green-800" : "text-red-800"
          }`}
        >
          {result.is_correct ? "Correct!" : "Incorrect"}
        </span>
      </div>
      {!result.is_correct && (
        <p className="text-sm text-red-700 mb-1">
          Correct answer: <strong>{result.correct_answer}</strong>
        </p>
      )}
      {result.explanation && (
        <p className="text-sm text-gray-600 mb-3">{result.explanation}</p>
      )}
      <button
        onClick={onContinue}
        className="px-6 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function ScoreSummary({ result, lessonId }) {
  const pct =
    result.total_questions > 0
      ? Math.round((result.score / result.total_questions) * 100)
      : 0;

  let grade, gradeColor;
  if (pct === 100) {
    grade = "Perfect!";
    gradeColor = "text-yellow-600";
  } else if (pct >= 80) {
    grade = "Great job!";
    gradeColor = "text-green-600";
  } else if (pct >= 60) {
    grade = "Good effort!";
    gradeColor = "text-blue-600";
  } else {
    grade = "Keep practicing!";
    gradeColor = "text-orange-600";
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      <div className="text-6xl mb-4">{pct === 100 ? "\ud83c\udf1f" : pct >= 60 ? "\ud83c\udf89" : "\ud83d\udcaa"}</div>
      <h2 className={`text-3xl font-bold mb-2 ${gradeColor}`}>{grade}</h2>
      <p className="text-gray-600 text-lg mb-6">
        {result.lesson_title}
      </p>
      <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
        <p className="text-5xl font-bold text-gray-900 mb-2">
          {result.score}/{result.total_questions}
        </p>
        <p className="text-gray-500">questions correct</p>
        <div className="mt-4 w-48 bg-gray-200 rounded-full h-3 mx-auto">
          <div
            className="bg-primary-500 h-3 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">{pct}%</p>
      </div>
      <div className="flex gap-4">
        <Link
          to={`/lesson/${lessonId}`}
          className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to Lesson
        </Link>
        <Link
          to={`/practice/quiz/${lessonId}`}
          reloadDocument
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}

export default function Quiz() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    startQuiz(lessonId)
      .then((res) => {
        setSessionId(res.data.session_id);
        setQuestions(res.data.questions);
      })
      .catch((err) => {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.lesson_id?.[0] ||
            "Failed to start quiz."
        );
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleAnswer = useCallback(
    async (answer) => {
      if (!sessionId || feedback) return;
      const question = questions[currentIndex];
      try {
        const res = await submitAnswer(sessionId, question.id, answer);
        setFeedback(res.data);
        setAnsweredCount((prev) => prev + 1);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to submit answer.");
      }
    },
    [sessionId, questions, currentIndex, feedback]
  );

  const handleContinue = useCallback(async () => {
    setFeedback(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // All questions answered, complete the quiz
      try {
        const res = await completeQuiz(sessionId);
        setSummary(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to complete quiz.");
      }
    }
  }, [currentIndex, questions.length, sessionId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          {error}
        </div>
        <Link
          to={`/lesson/${lessonId}`}
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-800"
        >
          &larr; Back to Lesson
        </Link>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <ScoreSummary result={summary} lessonId={lessonId} />
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate(`/lesson/${lessonId}`)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close quiz"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <ProgressBar current={answeredCount} total={questions.length} />

      <div className="min-h-[300px]">
        {question.type === "mcq" ? (
          <MCQQuestion
            key={question.id}
            question={question}
            onAnswer={handleAnswer}
            disabled={!!feedback}
          />
        ) : (
          <TextInputQuestion
            key={question.id}
            question={question}
            onAnswer={handleAnswer}
            disabled={!!feedback}
          />
        )}

        <FeedbackBanner result={feedback} onContinue={handleContinue} />
      </div>
    </div>
  );
}
