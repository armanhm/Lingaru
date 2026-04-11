import { useEffect, useState } from "react";
import { getMistakes, markMistakesReviewed } from "../api/progress";
import { staggerDelay } from "../hooks/useAnimations";

const TYPE_LABELS = {
  gender: "Gender",
  conjugation: "Conjugation",
  preposition: "Preposition",
  spelling: "Spelling",
  other: "Other",
};

const TYPE_BADGE = {
  gender: "badge-info",
  conjugation: "badge-primary",
  preposition: "badge-warn",
  spelling: "badge-danger",
  other: "badge bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400",
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
      <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 mb-6 animate-fade-in">Mistake Journal</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filter.type}
          onChange={(e) => handleFilterChange("type", e.target.value)}
          className="input w-auto"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filter.reviewed}
          onChange={(e) => handleFilterChange("reviewed", e.target.value)}
          className="input w-auto"
        >
          <option value="">All</option>
          <option value="false">Not reviewed</option>
          <option value="true">Reviewed</option>
        </select>

        {selected.size > 0 && (
          <button onClick={handleMarkReviewed} className="btn-primary btn-sm">
            Mark {selected.size} as reviewed
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : mistakes.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <span className="text-5xl mb-3 block">🎉</span>
          <p className="text-lg font-medium text-surface-600 dark:text-surface-400 mb-1">No mistakes found</p>
          <p className="text-sm text-surface-400 dark:text-surface-500">Keep practicing — you're doing great!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m, i) => (
            <div
              key={m.id}
              className={`card p-4 flex items-start gap-3 animate-fade-in-up ${
                m.reviewed ? "opacity-50" : ""
              }`}
              style={staggerDelay(i, 30)}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleSelect(m.id)}
                className="mt-1 h-4 w-4 text-primary-600 rounded border-surface-300 dark:border-surface-600 focus:ring-primary-500"
              />
              <div className="flex-1 min-w-0">
                {m.question_prompt && (
                  <p className="text-sm text-surface-500 dark:text-surface-400 mb-1.5">{m.question_prompt}</p>
                )}
                <p className="text-sm">
                  <span className="text-danger-600 dark:text-danger-400 font-medium">Your answer: </span>
                  <span className="text-danger-500 line-through">{m.user_answer}</span>
                </p>
                <p className="text-sm mt-0.5">
                  <span className="text-success-600 dark:text-success-400 font-medium">Correct: </span>
                  <span className="text-success-700 dark:text-success-300 font-semibold">{m.correct_answer}</span>
                </p>
              </div>
              <span className={TYPE_BADGE[m.mistake_type] || TYPE_BADGE.other}>
                {TYPE_LABELS[m.mistake_type] || m.mistake_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
