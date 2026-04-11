import { useState, useEffect, useRef } from "react";
import { getFeed, generateMore } from "../api/discover";
import { CompactCard, ExpandedCard } from "../components/DiscoverCard";
import { staggerDelay } from "../hooks/useAnimations";

export default function Discover() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const expandedRef = useRef(null);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getFeed();
      setCards(resp.data.results || []);
    } catch {
      setError("Failed to load discover feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleGenerateMore = async () => {
    setGenerating(true);
    try {
      await generateMore();
      await loadFeed();
    } catch {
      setError("Failed to generate new cards.");
    } finally {
      setGenerating(false);
    }
  };

  const handleInteracted = (cardId) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, interacted: true } : c
      )
    );
  };

  const handleOpen = (id) => {
    setExpandedId(id);
  };

  // Scroll to expanded card after it renders
  useEffect(() => {
    if (expandedId == null || !expandedRef.current) return;
    // Wait for the expand animation to start, then scroll
    const timer = setTimeout(() => {
      expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  }, [expandedId]);

  const handleClose = () => {
    setExpandedId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Discover</h1>
        <button
          onClick={handleGenerateMore}
          disabled={generating}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-200"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating...
            </span>
          ) : "Generate More"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm animate-shake">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <div className="text-5xl mb-4 animate-bounce-in">🔍</div>
          <p className="text-surface-500 dark:text-surface-400 mb-4">
            No discover cards yet. Generate some to get started!
          </p>
          <button
            onClick={handleGenerateMore}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-700 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-200 animate-pulse-glow"
          >
            {generating ? "Generating..." : "Generate Cards"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, i) => {
            const isExpanded = expandedId === card.id;

            if (isExpanded) {
              return (
                <div
                  key={card.id}
                  ref={expandedRef}
                  className="col-span-1 md:col-span-2 lg:col-span-3 py-2"
                  style={{ scrollMarginTop: "5rem" }}
                >
                  <ExpandedCard
                    card={card}
                    onClose={handleClose}
                    onInteracted={handleInteracted}
                  />
                </div>
              );
            }

            return (
              <div
                key={card.id}
                className="animate-fade-in-up h-full"
                style={staggerDelay(i, 60)}
              >
                <CompactCard
                  card={card}
                  onOpen={() => handleOpen(card.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
