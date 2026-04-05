import { useState } from "react";
import { Link } from "react-router-dom";
import { submitLessonVideo } from "../api/content";
import { useToast } from "../contexts/ToastContext";
import AudioPlayButton from "./AudioPlayButton";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── YouTube embed ──────────────────────────────────────────────────────────

function YouTubeEmbed({ videoId }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}
      <iframe
        className="absolute inset-0 w-full h-full rounded-xl"
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
        title="Lesson video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ── Transcript panel ───────────────────────────────────────────────────────

function TranscriptPanel({ transcriptFr, transcriptEn }) {
  const [lang, setLang] = useState("fr");
  const text = lang === "fr" ? transcriptFr : transcriptEn;

  if (!transcriptFr) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Transcript</h3>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setLang("fr")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              lang === "fr" ? "bg-white dark:bg-gray-600 shadow text-primary-700 dark:text-primary-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Français
          </button>
          {transcriptEn && (
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                lang === "en" ? "bg-white dark:bg-gray-600 shadow text-primary-700 dark:text-primary-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              English
            </button>
          )}
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line pr-1">
        {text}
      </div>
    </div>
  );
}

// ── Vocabulary cards ───────────────────────────────────────────────────────

function VideoVocabularyCard({ word }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-primary-400">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1">
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{word.french}</span>
          <AudioPlayButton text={word.french} />
        </span>
        <span className="text-sm text-primary-600 font-medium">{word.english}</span>
      </div>
      {word.pronunciation && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{word.pronunciation}</p>
      )}
      {word.example_sentence && (
        <div className="flex items-start gap-1 border-t dark:border-gray-700 pt-2 mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 italic flex-1">{word.example_sentence}</p>
          <AudioPlayButton text={word.example_sentence} />
        </div>
      )}
      {word.timestamp_seconds > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">⏱ {formatTime(word.timestamp_seconds)}</p>
      )}
    </div>
  );
}

// ── Expression cards ───────────────────────────────────────────────────────

function VideoExpressionCard({ expr }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-amber-900 dark:text-amber-200">{expr.expression_fr}</span>
          <AudioPlayButton text={expr.expression_fr} />
        </span>
        <span className="text-sm text-amber-700 dark:text-amber-400 shrink-0">{expr.expression_en}</span>
      </div>
      {expr.context_sentence && (
        <p className="text-sm text-amber-800 dark:text-amber-300 italic mt-1">{expr.context_sentence}</p>
      )}
    </div>
  );
}

// ── Processing status banner ───────────────────────────────────────────────

function StatusBanner({ status, errorMessage }) {
  if (status === "ready") return null;

  const config = {
    pending: {
      bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200",
      text: "text-blue-800",
      icon: "⏳",
      message: "Video is queued for processing...",
    },
    processing: {
      bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200",
      text: "text-yellow-800 dark:text-yellow-300",
      icon: "⚙️",
      message: "Fetching transcript and extracting content — this may take a minute.",
    },
    failed: {
      bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      text: "text-red-800 dark:text-red-400",
      icon: "❌",
      message: errorMessage || "Processing failed.",
    },
  };

  const c = config[status] || config.pending;

  return (
    <div className={`rounded-xl border p-4 ${c.bg}`}>
      <p className={`text-sm font-medium ${c.text}`}>
        {c.icon} {c.message}
      </p>
      {status !== "failed" && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Refresh the page to see the result.</p>
      )}
    </div>
  );
}

// ── URL submission form (staff only) ──────────────────────────────────────

function VideoUrlForm({ lessonId, onSubmitted }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await submitLessonVideo(lessonId, url.trim());
      showToast("Video submitted! Processing will start shortly.", "success");
      onSubmitted(res.data);
    } catch (err) {
      const status = err.response?.status;
      let msg = err.response?.data?.detail || "Failed to submit video.";
      if (status === 401) msg = "Session expired — please log out and log back in.";
      if (status === 403) msg = "Only staff users can add videos to lessons.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="text-center mb-4">
        <span className="text-4xl">🎬</span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2">Add a YouTube Video</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Paste a YouTube URL — we'll extract the transcript and generate vocabulary practice automatically.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          {loading ? "Submitting..." : "Add Video"}
        </button>
      </form>
    </div>
  );
}

// ── Main VideoSection ──────────────────────────────────────────────────────

export default function VideoSection({ video, lessonId, isStaff, lessonQuestionCount }) {
  const [currentVideo, setCurrentVideo] = useState(video);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // No video and not staff — show nothing
  if (!currentVideo && !isStaff) return null;

  // No video but staff — show submission form
  if (!currentVideo && isStaff) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Video Lesson</h2>
        <VideoUrlForm lessonId={lessonId} onSubmitted={setCurrentVideo} />
      </div>
    );
  }

  const { youtube_id, title, status, error_message, transcript_fr, transcript_en, vocabulary, expressions } = currentVideo;
  const isReady = status === "ready";
  const hasVocab = vocabulary?.length > 0;
  const hasExpressions = expressions?.length > 0;
  // Count video-generated questions (prefixed with [VIDEO])
  const videoQuestionCount = lessonQuestionCount;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Video Lesson</h2>
        {isStaff && (
          <button
            onClick={() => setCurrentVideo(null)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
            title="Replace video"
          >
            Replace video
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Player */}
        {youtube_id && <YouTubeEmbed videoId={youtube_id} />}
        {title && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>}

        {/* Processing status */}
        <StatusBanner status={status} errorMessage={error_message} />

        {/* Transcript */}
        {isReady && transcript_fr && (
          <TranscriptPanel transcriptFr={transcript_fr} transcriptEn={transcript_en} />
        )}

        {/* Vocabulary from video */}
        {isReady && hasVocab && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Vocabulary from this video
              <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">({vocabulary.length} words)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vocabulary.map((word) => (
                <VideoVocabularyCard key={word.id} word={word} />
              ))}
            </div>
          </div>
        )}

        {/* Expressions from video */}
        {isReady && hasExpressions && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Expressions &amp; Collocations
              <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">({expressions.length} expressions)</span>
            </h3>
            <div className="space-y-3">
              {expressions.map((expr) => (
                <VideoExpressionCard key={expr.id} expr={expr} />
              ))}
            </div>
          </div>
        )}

        {/* Practice CTA */}
        {isReady && videoQuestionCount > 0 && (
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/30 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-primary-900 dark:text-primary-200">Practice what you watched</p>
              <p className="text-sm text-primary-700 dark:text-primary-400 mt-0.5">
                {videoQuestionCount} question{videoQuestionCount !== 1 ? "s" : ""} based on this video
              </p>
            </div>
            <Link
              to={`/practice/quiz/${lessonId}`}
              className="px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors text-sm whitespace-nowrap"
            >
              Practice Now →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
