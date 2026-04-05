import { useEffect, useState } from "react";
import { getMistakes, markMistakesReviewed } from "../api/progress";

const TYPE_LABELS = {
  gender: "Gender",
  conjugation: "Conjugation",
  preposition: "Preposition",
  spelling: "Spelling",
  other: "Other",
};

export default function MistakeJournal() {
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: "", reviewed: "" });
  const [selected, setSelected] = useState(new Set());

  const fetchMistakes = (params = {}) => {
    setLoading(true);
    const query = {};
    if (params.type || filter.type) query.type = params.type || filter.type;
    if ((params.reviewed ?? filter.reviewed) !== "")
      query.reviewed = params.reviewed ?? filter.reviewed;

    getMistakes(query)
      .then((res) => setMistakes(res.data.results || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMistakes();
  }, []);

  const handleFilterChange = (key, value) => {
    const newFilter = { ...filter, [key]: value };
    setFilter(newFilter);
    fetchMistakes(newFilter);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMarkReviewed = async () => {
    if (selected.size === 0) return;
    await markMistakesReviewed([...selected]);
    setSelected(new Set());
    fetchMistakes();
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mistake Journal</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filter.type}
          onChange={(e) => handleFilterChange("type", e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filter.reviewed}
          onChange={(e) => handleFilterChange("reviewed", e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All</option>
          <option value="false">Not reviewed</option>
          <option value="true">Reviewed</option>
        </select>

        {selected.size > 0 && (
          <button
            onClick={handleMarkReviewed}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Mark {selected.size} as reviewed
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : mistakes.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No mistakes found. Keep practicing!</p>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m) => (
            <div
              key={m.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${
                m.reviewed ? "opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleSelect(m.id)}
                className="mt-1 h-4 w-4 text-primary-600 rounded"
              />
              <div className="flex-1">
                {m.question_prompt && (
                  <p className="text-sm text-gray-500 mb-1">{m.question_prompt}</p>
                )}
                <p className="text-red-600 font-medium">
                  Your answer: <span className="line-through">{m.user_answer}</span>
                </p>
                <p className="text-green-700 font-medium">
                  Correct: {m.correct_answer}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                {TYPE_LABELS[m.mistake_type] || m.mistake_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
