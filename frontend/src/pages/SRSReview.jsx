import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getSRSDueCards, submitSRSReview } from "../api/progress";

const QUALITY_OPTIONS = [
  { value: 0, label: "Blackout", color: "bg-red-600" },
  { value: 1, label: "Wrong", color: "bg-red-400" },
  { value: 2, label: "Hard", color: "bg-orange-400" },
  { value: 3, label: "Okay", color: "bg-yellow-400" },
  { value: 4, label: "Good", color: "bg-green-400" },
  { value: 5, label: "Easy", color: "bg-green-600" },
];

export default function SRSReview() {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getSRSDueCards()
      .then((res) => {
        setCards(res.data.cards);
        if (res.data.count === 0) setDone(true);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load cards."))
      .finally(() => setLoading(false));
  }, []);

  const handleRate = useCallback(
    async (quality) => {
      const card = cards[currentIndex];
      try {
        await submitSRSReview(card.id, quality);
        setReviewedCount((prev) => prev + 1);
        setShowAnswer(false);
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setDone(true);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to submit review.");
      }
    },
    [cards, currentIndex]
  );

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
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {reviewedCount > 0 ? "Session Complete!" : "All Caught Up!"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {reviewedCount > 0
            ? `You reviewed ${reviewedCount} card${reviewedCount !== 1 ? "s" : ""}.`
            : "No cards are due for review right now."}
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">SRS Review</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center mb-6">
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{card.french}</p>
        {card.pronunciation && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">{card.pronunciation}</p>
        )}

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="mt-6 px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Show Answer
          </button>
        ) : (
          <div className="mt-6">
            <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">{card.english}</p>
            {card.example_sentence && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-6">
                {card.example_sentence}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">How well did you know this?</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleRate(opt.value)}
                  className={`${opt.color} text-white py-2 px-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(reviewedCount / cards.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
