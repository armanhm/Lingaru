import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client";

export default function RandomQuiz() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get("/practice/quiz/random-lesson/")
      .then((res) => {
        navigate(`/practice/quiz/${res.data.lesson_id}`, { replace: true });
      })
      .catch(() => setError("No quizzes available yet. Add content first."));
  }, [navigate]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <span className="text-5xl">📝</span>
        <p className="text-surface-600 dark:text-surface-400">{error}</p>
        <Link to="/" className="btn-primary btn-md inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
    </div>
  );
}
