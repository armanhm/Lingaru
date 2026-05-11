import { useState, useEffect, useCallback } from "react";
import { getConjugationVerbs, checkConjugation } from "../../../api/progress";
import InlineRoundWidget from "../InlineRoundWidget";

/**
 * Inline conjugation drill: one verb / tense / subject, type the form,
 * grade. Picks a random subject from the standard six. Full page loops
 * through all six and computes a session score; inline gives a single
 * round only.
 */

const SUBJECTS = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ConjugationInline() {
  const [verbs, setVerbs] = useState([]);
  const [tenses, setTenses] = useState([]);
  const [verb, setVerb] = useState(null);
  const [tense, setTense] = useState(null);
  const [subject, setSubject] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load metadata once
  useEffect(() => {
    let alive = true;
    getConjugationVerbs()
      .then((res) => {
        if (!alive) return;
        setVerbs(res.data.verbs || []);
        setTenses(res.data.tenses || []);
      })
      .catch(() => alive && setError("Impossible de charger la liste des verbes."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  // Pick a fresh round whenever the metadata is ready or onAgain is called
  const newRound = useCallback(() => {
    if (!verbs.length || !tenses.length) return;
    setVerb(pickRandom(verbs));
    setTense(pickRandom(tenses));
    setSubject(pickRandom(SUBJECTS));
    setAnswer("");
    setFeedback(null);
  }, [verbs, tenses]);

  useEffect(() => { newRound(); }, [newRound]);

  const submit = async () => {
    if (!answer.trim() || feedback || submitting) return;
    setSubmitting(true);
    try {
      const res = await checkConjugation(verb, tense, subject, answer.trim());
      setFeedback(res.data);
    } catch (err) {
      setFeedback({
        is_correct: false,
        correct_answer: "N/A",
        explanation: err.response?.data?.detail || "Erreur lors de la vérification.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InlineRoundWidget
      title="Conjugaison"
      emoji="📝"
      loading={loading}
      empty={(!verbs.length || !tenses.length) && !loading}
      emptyMessage={error || "Pas de verbes disponibles pour la conjugaison."}
      score={feedback ? { correct: feedback.is_correct ? 1 : 0, total: 1 } : null}
      onAgain={feedback ? newRound : null}
      fullSessionTo="/practice/conjugation"
    >
      {verb && tense && subject && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 text-center">
            Conjugue le verbe
          </p>
          <p className="text-center text-[15px] text-surface-900 dark:text-surface-50">
            <span className="font-bold">{verb}</span>
            <span className="text-surface-500 dark:text-surface-400"> au </span>
            <span className="font-bold">{tense}</span>
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-[16px] font-bold text-surface-900 dark:text-surface-50">
              {subject}
            </span>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={!!feedback}
              placeholder="…"
              className={`px-3 py-1.5 rounded-lg border-2 text-[16px] font-semibold text-center w-40 outline-none transition-all ${
                feedback?.is_correct
                  ? "border-success-500 bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300"
                  : feedback
                  ? "border-danger-500 bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300"
                  : "border-[color:var(--mode-accent)] bg-white dark:bg-surface-800 focus:ring-2 focus:ring-[color:var(--mode-accent)]/30"
              }`}
            />
          </div>
          {!feedback ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={submit}
                disabled={!answer.trim() || submitting}
                className="px-4 py-1.5 rounded-lg text-[12px] font-bold mode-grad-bg text-white shadow-sm active:scale-95 transition-all disabled:opacity-40 focus-ring"
              >
                {submitting ? "Vérification…" : "Valider"}
              </button>
            </div>
          ) : (
            <div className="space-y-1 text-center">
              <p className={`text-[12px] font-semibold ${feedback.is_correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"}`}>
                {feedback.is_correct ? "✓ Bonne réponse !" : `Forme correcte : ${feedback.correct_answer}`}
              </p>
              {feedback.explanation && (
                <p className="text-[11px] text-surface-500 dark:text-surface-400">
                  {feedback.explanation}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
