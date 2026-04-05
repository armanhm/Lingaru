import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTopics } from "../api/content";

const difficultyColors = {
  A1: "bg-green-100 text-green-800",
  A2: "bg-emerald-100 text-emerald-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-orange-100 text-orange-800",
  C1: "bg-red-100 text-red-800",
  C2: "bg-purple-100 text-purple-800",
};

export default function Topics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopics()
      .then((res) => setTopics(res.data))
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Topics</h1>
      <p className="text-gray-600 mb-8">Choose a topic to start learning.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            to={`/topics/${topic.id}`}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 block"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{topic.icon || "📘"}</span>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  difficultyColors[topic.difficulty_level] || "bg-gray-100 text-gray-800"
                }`}
              >
                {topic.difficulty_level}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{topic.name_fr}</h2>
            <p className="text-sm text-gray-500 mb-2">{topic.name_en}</p>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{topic.description}</p>
            <div className="text-xs text-gray-400">
              {topic.lesson_count} {topic.lesson_count === 1 ? "lesson" : "lessons"}
            </div>
          </Link>
        ))}
      </div>

      {topics.length === 0 && (
        <p className="text-gray-500 text-center py-12">No topics available yet.</p>
      )}
    </div>
  );
}
