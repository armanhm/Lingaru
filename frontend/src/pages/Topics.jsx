import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTopics } from "../api/content";
import { staggerDelay } from "../hooks/useAnimations";

const difficultyColors = {
  A1: "badge-success",
  A2: "badge-success",
  B1: "badge-warn",
  B2: "badge-warn",
  C1: "badge-danger",
  C2: "badge-primary",
};

export default function Topics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopics()
      .then((res) => setTopics(res.data.results || res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load topics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 mb-2">Topics</h1>
      <p className="text-surface-600 dark:text-surface-400 mb-8">Choose a topic to start learning.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {topics.map((topic, i) => (
          <Link
            key={topic.id}
            to={`/topics/${topic.id}`}
            className="card card-hover hover:-translate-y-1 hover:scale-[1.02] transition-all p-6 block animate-fade-in-up"
            style={staggerDelay(i, 40)}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{topic.icon || "📘"}</span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  difficultyColors[topic.difficulty_level] || "bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-200"
                }`}
              >
                {topic.difficulty_level}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">{topic.name_fr}</h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">{topic.name_en}</p>
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-4 line-clamp-2">{topic.description}</p>
            <div className="text-xs text-surface-400 dark:text-surface-500">
              {topic.lesson_count} {topic.lesson_count === 1 ? "lesson" : "lessons"}
            </div>
          </Link>
        ))}
      </div>

      {topics.length === 0 && (
        <p className="text-surface-500 dark:text-surface-400 text-center py-12">No topics available yet.</p>
      )}
    </div>
  );
}
