import { useState, useEffect } from "react";
import { getFeed, generateMore } from "../api/discover";
import DiscoverCard from "../components/DiscoverCard";

export default function Discover() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

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
      await loadFeed(); // reload the full feed
    } catch {
      setError("Failed to generate new cards.");
    } finally {
      setGenerating(false);
    }
  };

  const handleInteracted = (cardId, data) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, interacted: true } : c
      )
    );
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
        <button
          onClick={handleGenerateMore}
          disabled={generating}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {generating ? "Generating..." : "Generate More"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">
            No discover cards yet. Generate some to get started!
          </p>
          <button
            onClick={handleGenerateMore}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Cards"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <DiscoverCard
              key={card.id}
              card={card}
              onInteracted={handleInteracted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
