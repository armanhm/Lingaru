import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getLesson } from "../api/content";

function VocabSection({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Vocabulary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((word) => (
          <div key={word.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-lg font-semibold text-gray-900">
                {word.french}
                {word.gender && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({word.gender})
                  </span>
                )}
              </span>
              <span className="text-sm text-primary-600">{word.english}</span>
            </div>
            {word.pronunciation && (
              <p className="text-xs text-gray-400 mb-2">{word.pronunciation}</p>
            )}
            {word.example_sentence && (
              <p className="text-sm text-gray-600 italic border-t pt-2 mt-2">
                {word.example_sentence}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GrammarSection({ rules }) {
  if (!rules || rules.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Grammar Rules</h2>
      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-900 mb-2">{rule.title}</h3>
            <p className="text-gray-600 mb-3">{rule.explanation}</p>
            {rule.formula && (
              <div className="bg-primary-50 rounded px-4 py-2 mb-3 font-mono text-sm text-primary-800">
                {rule.formula}
              </div>
            )}
            {rule.examples && rule.examples.length > 0 && (
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700 mb-1">Examples:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {rule.examples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}
            {rule.exceptions && rule.exceptions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-orange-700 mb-1">Exceptions:</p>
                <ul className="list-disc list-inside text-sm text-orange-600 space-y-1">
                  {rule.exceptions.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingSection({ texts }) {
  if (!texts || texts.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Reading</h2>
      <div className="space-y-6">
        {texts.map((text) => (
          <div key={text.id} className="bg-white rounded-lg shadow p-5">
            {text.title && (
              <h3 className="font-semibold text-gray-900 mb-3">{text.title}</h3>
            )}
            <div className="prose prose-sm max-w-none mb-4">
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                {text.content_fr}
              </p>
            </div>
            {text.content_en && (
              <details className="border-t pt-3">
                <summary className="text-sm text-primary-600 cursor-pointer hover:text-primary-800">
                  Show English translation
                </summary>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed whitespace-pre-line">
                  {text.content_en}
                </p>
              </details>
            )}
            {text.highlighted_vocabulary && text.highlighted_vocabulary.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Key vocabulary:</p>
                <div className="flex flex-wrap gap-2">
                  {text.highlighted_vocabulary.map((word, i) => (
                    <span
                      key={i}
                      className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-full px-3 py-1"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionsSection({ questions, lessonId }) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Practice Questions
        </h2>
        <Link
          to={`/practice/quiz/${lessonId}`}
          className="px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors text-sm"
        >
          Start Quiz
        </Link>
      </div>
      <div className="bg-gray-50 rounded-lg border p-5">
        <p className="text-sm text-gray-500 mb-4">
          {questions.length} question{questions.length !== 1 ? "s" : ""} available.
          Start the quiz to practice interactively.
        </p>
        <div className="space-y-3">
          {questions.slice(0, 3).map((q, index) => (
            <div key={q.id} className="flex gap-3 items-start">
              <span className="text-sm font-medium text-gray-400 mt-0.5">
                {index + 1}.
              </span>
              <div>
                <p className="text-sm text-gray-800">{q.prompt}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Type: {q.type}
                </p>
              </div>
            </div>
          ))}
          {questions.length > 3 && (
            <p className="text-xs text-gray-400 pl-7">
              + {questions.length - 3} more question{questions.length - 3 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LessonDetail() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getLesson(id)
      .then((res) => setLesson(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load lesson."))
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

  if (!lesson) return null;

  return (
    <div>
      <Link
        to={lesson.topic ? `/topics/${lesson.topic}` : "/topics"}
        className="text-sm text-primary-600 hover:text-primary-800 mb-4 inline-block"
      >
        &larr; Back to Topic
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{lesson.title}</h1>
        <p className="text-gray-600">{lesson.description}</p>
      </div>

      <VocabSection items={lesson.vocabulary || lesson.vocab} />
      <GrammarSection rules={lesson.grammar_rules} />
      <ReadingSection texts={lesson.reading_texts} />
      <QuestionsSection questions={lesson.questions} lessonId={id} />
    </div>
  );
}
