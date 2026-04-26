import { useState, useEffect, useRef } from "react";
import { getFeed, generateMore } from "../api/discover";
import { CompactCard, ExpandedCard } from "../components/DiscoverCard";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader, EmptyState, SkeletonCard } from "../components/ui";

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

  useEffect(() => {
    if (expandedId == null || !expandedRef.current) return;
    const timer = setTimeout(() => {
      expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  }, [expandedId]);

  const handleClose = () => {
    setExpandedId(null);
  };

  const generateButton = (
    <button
      onClick={handleGenerateMore}
      disabled={generating}
      className="btn-primary btn-md"
    >
      {generating ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Generating…
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Generate more
        </span>
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="space-y-2 mb-7">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-10 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} height="h-56" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Bite-sized cultural learning"
        title="Discover"
        subtitle="Curated French moments — phrases, idioms, mini-stories, and culture cards."
        icon="🔭"
        gradient
        actions={generateButton}
      />

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 px-4 py-3 rounded-xl text-sm animate-shake mb-5 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
          <span>{error}</span>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState
          icon="🔭"
          title="Your discover feed is empty"
          subtitle="Generate a fresh batch of cards to see French phrases, culture facts, and mini-stories curated for your level."
          action={generateButton}
        />
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
