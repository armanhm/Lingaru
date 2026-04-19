import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getLesson } from "../api/content";
import { useAuth } from "../contexts/AuthContext";
import AudioPlayButton from "../components/AudioPlayButton";
import VideoSection from "../components/VideoSection";
import { staggerDelay } from "../hooks/useAnimations";

const TYPE_ICON = { vocab: "📝", vocabulary: "📝", grammar: "📐", text: "📖", reading: "📖" };

function SectionHeader({ icon, title, count }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-lg">{icon}</span>
      <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">{title}</h2>
      {count != null && (
        <span className="text-xs font-medium bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

function VocabSection({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-8">
      <SectionHeader icon="📝" title="Vocabulary" count={items.length} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((word, i) => (
          <div
            key={word.id}
            className="card p-4 card-hover animate-fade-in-up"
            style={staggerDelay(i, 30)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-surface-900 dark:text-surface-100">{word.french}</span>
                {word.gender && (
                  <span className="badge-info text-[10px] px-1.5 py-0">{word.gender}</span>
                )}
                <AudioPlayButton text={word.french} />
              </div>
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">{word.english}</span>
            </div>
            {word.pronunciation && (
              <p className="text-xs text-surface-400 dark:text-surface-500 font-mono mb-1.5">/{word.pronunciation}/</p>
            )}
            {word.example_sentence && (
              <div className="flex items-start gap-1.5 border-t border-surface-100 dark:border-surface-700/50 pt-2 mt-2">
                <p className="text-xs text-surface-500 dark:text-surface-400 italic flex-1 leading-relaxed">
                  {word.example_sentence}
                </p>
                <AudioPlayButton text={word.example_sentence} />
              </div>
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
      <SectionHeader icon="📐" title="Grammar Rules" count={rules.length} />
      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="card p-5">
            <h3 className="font-bold text-surface-900 dark:text-surface-100 mb-2">{rule.title}</h3>
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-3 leading-relaxed">{rule.explanation}</p>
            {rule.formula && (
              <div className="bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-900/20 dark:to-violet-900/20 rounded-xl px-4 py-2.5 mb-3 font-mono text-sm text-primary-800 dark:text-primary-300 border border-primary-100 dark:border-primary-800/30">
                {rule.formula}
              </div>
            )}
            {rule.examples && rule.examples.length > 0 && (
              <div className="mb-3">
                <p className="section-label mb-2">Examples</p>
                <div className="space-y-1.5">
                  {rule.examples.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-surface-50 dark:bg-surface-700/30 rounded-lg px-3 py-2">
                      <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <p className="text-sm text-surface-700 dark:text-surface-300">{ex}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {rule.exceptions && rule.exceptions.length > 0 && (
              <div className="bg-warn-50 dark:bg-warn-700/20 border border-warn-200 dark:border-warn-700 rounded-xl px-4 py-2.5">
                <p className="text-xs font-semibold text-warn-600 dark:text-warn-400 mb-1">⚠️ Exceptions</p>
                <ul className="list-disc list-inside text-sm text-warn-700 dark:text-warn-300 space-y-0.5">
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
      <SectionHeader icon="📖" title="Reading" count={texts.length} />
      <div className="space-y-5">
        {texts.map((text) => (
          <div key={text.id} className="card p-5">
            {text.title && (
              <h3 className="font-bold text-surface-900 dark:text-surface-100 mb-3">{text.title}</h3>
            )}
            <div className="bg-surface-50 dark:bg-surface-700/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed whitespace-pre-line">
                {text.content_fr}
              </p>
            </div>
            {text.content_en && (
              <details className="border-t border-surface-100 dark:border-surface-700/50 pt-3 group">
                <summary className="text-sm font-medium text-primary-600 dark:text-primary-400 cursor-pointer hover:text-primary-700 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Show English translation
                </summary>
                <p className="text-sm text-surface-600 dark:text-surface-400 mt-3 leading-relaxed whitespace-pre-line pl-5">
                  {text.content_en}
                </p>
              </details>
            )}
            {text.highlighted_vocabulary && text.highlighted_vocabulary.length > 0 && (
              <div className="border-t border-surface-100 dark:border-surface-700/50 pt-3 mt-3">
                <p className="section-label mb-2">Key vocabulary</p>
                <div className="flex flex-wrap gap-1.5">
                  {text.highlighted_vocabulary.map((word, i) => (
                    <span
                      key={i}
                      className="badge-warn"
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
  const regularQuestions = questions.filter((q) => !q.prompt.startsWith("[VIDEO]"));
  if (regularQuestions.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader icon="❓" title="Practice Questions" count={regularQuestions.length} />
        <Link
          to={`/practice/quiz/${lessonId}`}
          className="btn-primary btn-sm"
        >
          Start Quiz
        </Link>
      </div>
      <div className="card p-5">
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
          {regularQuestions.length} question{regularQuestions.length !== 1 ? "s" : ""} available.
          Start the quiz to practice interactively.
        </p>
        <div className="space-y-2.5">
          {regularQuestions.slice(0, 3).map((q, index) => (
            <div key={q.id} className="flex gap-3 items-start bg-surface-50 dark:bg-surface-700/30 rounded-lg px-3 py-2.5">
              <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 text-xs flex items-center justify-center font-bold">
                {index + 1}
              </span>
              <div>
                <p className="text-sm text-surface-800 dark:text-surface-200">{q.prompt}</p>
                <span className="badge-info text-[10px] mt-1">{q.type}</span>
              </div>
            </div>
          ))}
          {regularQuestions.length > 3 && (
            <p className="text-xs text-surface-400 dark:text-surface-500 pl-8">
              + {regularQuestions.length - 3} more question{regularQuestions.length - 3 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LessonDetail() {
  const { id } = useParams();
  const { user } = useAuth();
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
      <div className="card border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-700/20 p-6 text-danger-700 dark:text-danger-400">
        {error}
      </div>
    );
  }

  if (!lesson) return null;

  const isStaff = user?.is_staff || false;
  const videoQuestions = (lesson.questions || []).filter((q) => q.prompt.startsWith("[VIDEO]"));

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Link
        to={lesson.topic ? `/topics/${lesson.topic.id}` : "/topics"}
        className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 mb-3 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Topic
      </Link>

      <div className="mb-8 flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-2xl shadow-glow-primary">
          {TYPE_ICON[lesson.type] || "📄"}
        </div>
        <div>
          <h1 className="text-h1 text-surface-900 dark:text-surface-100">{lesson.title}</h1>
          <p className="text-body text-surface-500 dark:text-surface-400 leading-relaxed mt-1">{lesson.description}</p>
        </div>
      </div>

      <VideoSection
        video={lesson.video}
        lessonId={id}
        isStaff={isStaff}
        lessonQuestionCount={videoQuestions.length}
      />

      <VocabSection items={lesson.vocabulary || lesson.vocab} />
      <GrammarSection rules={lesson.grammar_rules} />
      <ReadingSection texts={lesson.reading_texts} />
      <QuestionsSection questions={lesson.questions} lessonId={id} />
    </div>
  );
}
