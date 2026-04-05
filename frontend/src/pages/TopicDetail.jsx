import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTopic } from "../api/content";

const typeIcons = {
  vocabulary: "📝",
  grammar: "📐",
  reading: "📖",
};

const typeLabels = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
};

export default function TopicDetail() {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopic(id)
      .then((res) => setTopic(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load topic."))
      .finally(() => setLoading(false));
  }, [id]);

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

  if (!topic) return null;

  const lessons = topic.lessons || [];

  return (
    <div>
      <Link to="/topics" className="text-sm text-primary-600 hover:text-primary-800 mb-4 inline-block">
        &larr; Back to Topics
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{topic.icon || "📘"}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{topic.name_fr}</h1>
            <p className="text-gray-500">{topic.name_en}</p>
          </div>
        </div>
        <p className="text-gray-600 mt-2">{topic.description}</p>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Lessons ({lessons.length})
      </h2>

      {lessons.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No lessons in this topic yet.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, index) => (
            <Link
              key={lesson.id}
              to={`/lesson/${lesson.id}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5 flex items-center gap-4 block"
            >
              <span className="text-sm font-medium text-gray-400 w-8 text-center">
                {index + 1}
              </span>
              <span className="text-2xl">
                {typeIcons[lesson.lesson_type] || "📄"}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                <p className="text-sm text-gray-500 truncate">{lesson.description}</p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                {typeLabels[lesson.lesson_type] || lesson.lesson_type}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
