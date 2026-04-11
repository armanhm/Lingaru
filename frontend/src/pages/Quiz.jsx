import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { startQuiz, submitAnswer, completeQuiz } from "../api/practice";
import { completeLesson } from "../api/progress";
import { useToast } from "../contexts/ToastContext";
import { useCountUp, staggerDelay } from "../hooks/useAnimations";

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-6">
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
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        {question.prompt}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(question.options || []).map((option, i) => (
          <button
            key={i}
            onClick={() => handleSelect(option)}
            disabled={disabled}
            className={`p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 hover:scale-[1.02] ${
              selected === option
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
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
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {question.prompt}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
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
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors disabled:opacity-75 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
      className={`mt-6 p-5 rounded-xl border-2 ${
        result.is_correct
          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 animate-fade-in"
          : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 animate-shake"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{result.is_correct ? "✅" : "❌"}</span>
        <span
          className={`font-bold text-lg ${
            result.is_correct ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-400"
          }`}
        >
          {result.is_correct ? "Correct!" : "Incorrect"}
        </span>
      </div>
      {!result.is_correct && (
        <p className="text-sm text-red-700 dark:text-red-400 mb-1">
          Correct answer: <strong>{result.correct_answer}</strong>
        </p>
      )}
      {result.explanation && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{result.explanation}</p>
      )}
      <button
        onClick={onContinue}
        className="px-6 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function ReviewList({ answers }) {
  const [open, setOpen] = useState(false);
  if (!answers || answers.length === 0) return null;

  return (
    <div className="w-full max-w-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-primary-600 hover:text-primary-800 font-medium mb-3 flex items-center gap-1"
      >
        {open ? "▲" : "▼"} {open ? "Hide" : "Show"} answer review
      </button>
      {open && (
        <div className="space-y-2 text-left">
          {answers.map((a, i) => (
            <div
              key={i}
              style={staggerDelay(i, 50)}
              className={`rounded-lg border p-3 animate-fade-in-up ${
                a.is_correct
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">{a.is_correct ? "✅" : "❌"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {a.prompt}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Your answer: <span className={a.is_correct ? "text-green-700" : "text-red-700"}>{a.user_answer}</span>
                  </p>
                  {!a.is_correct && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Correct: <span className="text-green-700 font-medium">{a.correct_answer}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreSummary({ result, lessonId, answers }) {
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
      <div className="text-6xl mb-4 animate-bounce-in">{pct === 100 ? "🌟" : pct >= 60 ? "🎉" : "💪"}</div>
      <h2 className={`text-3xl font-bold mb-2 ${gradeColor} animate-fade-in-up`}>{grade}</h2>
      <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
        {result.lesson_title}
      </p>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6 text-center animate-scale-in">
        <p className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {result.score}/{result.total_questions}
        </p>
        <p className="text-gray-500 dark:text-gray-400">questions correct</p>
        <div className="mt-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-3 mx-auto">
          <div
            className="bg-primary-500 h-3 rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{pct}%</p>
      </div>

      <ReviewList answers={answers} />

      <div className="flex flex-wrap gap-3 mt-6 justify-center">
        <Link
          to={`/lesson/${lessonId}`}
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Back to Lesson
        </Link>
        {result.next_lesson && (
          <Link
            to={`/lesson/${result.next_lesson.id}`}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            Next Lesson →
          </Link>
        )}
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
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [summary, setSummary] = useState(null);
  const [answers, setAnswers] = useState([]);

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
        setAnswers((prev) => [
          ...prev,
          {
            prompt: question.prompt,
            user_answer: answer,
            correct_answer: res.data.correct_answer,
            is_correct: res.data.is_correct,
          },
        ]);
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
      try {
        const res = await completeQuiz(sessionId);
        const quizData = res.data;
        const score = quizData.score;
        const total = quizData.total_questions;

        // Mark lesson as complete and get next lesson info
        let nextLesson = null;
        try {
          const completionRes = await completeLesson(lessonId, score, total);
          nextLesson = completionRes.data.next_lesson;
          const xp = completionRes.data.xp_earned;
          if (xp > 0) {
            showToast(`Lesson completed! +${xp} XP`, "success");
          }
        } catch {
          // Non-fatal: quiz result still shows
        }

        setSummary({ ...quizData, next_lesson: nextLesson });
        const xp = quizData.xp_earned;
        if (xp) showToast(`Quiz completed! +${xp} XP`, "success");
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to complete quiz.");
      }
    }
  }, [currentIndex, questions.length, sessionId, lessonId]);

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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-red-700 dark:text-red-400">
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
        <ScoreSummary result={summary} lessonId={lessonId} answers={answers} />
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate(`/lesson/${lessonId}`)}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          aria-label="Close quiz"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <ProgressBar current={answeredCount} total={questions.length} />

      <div className="min-h-[300px] animate-fade-in" key={currentIndex}>
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
