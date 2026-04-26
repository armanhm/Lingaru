import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getConjugationVerbs, checkConjugation } from "../api/progress";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader } from "../components/ui";

export default function ConjugationDrill() {
  const [searchParams] = useSearchParams();
  const [verbs, setVerbs] = useState([]);
  const [tenses, setTenses] = useState([]);
  const [selectedVerb, setSelectedVerb] = useState("");
  const [selectedTense, setSelectedTense] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoStart, setAutoStart] = useState(false);

  const SUBJECTS = ["je", "tu", "il/elle", "nous", "vous", "ils/elles"];
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [drilling, setDrilling] = useState(false);

  useEffect(() => {
    const paramVerb = searchParams.get("verb");
    getConjugationVerbs()
      .then((res) => {
        setVerbs(res.data.verbs);
        setTenses(res.data.tenses);
        if (paramVerb && res.data.verbs.includes(paramVerb)) {
          setSelectedVerb(paramVerb);
          setAutoStart(true);
        } else if (res.data.verbs.length > 0) {
          setSelectedVerb(res.data.verbs[0]);
        }
        if (res.data.tenses.length > 0) setSelectedTense(res.data.tenses[0]);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const startDrill = () => {
    setDrilling(true);
    setCurrentSubjectIndex(0);
    setResults([]);
    setFeedback(null);
    setAnswer("");
  };

  useEffect(() => {
    if (autoStart && !loading && selectedVerb && selectedTense) {
      setAutoStart(false);
      startDrill();
    }
  }, [autoStart, loading, selectedVerb, selectedTense]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!answer.trim()) return;

      const subject = SUBJECTS[currentSubjectIndex];
      try {
        const res = await checkConjugation(
          selectedVerb, selectedTense, subject, answer.trim()
        );
        setFeedback(res.data);
        setResults((prev) => [
          ...prev,
          { subject, answer: answer.trim(), ...res.data },
        ]);
      } catch (err) {
        setFeedback({
          is_correct: false,
          correct_answer: "N/A",
          explanation: err.response?.data?.detail || "Error checking answer.",
        });
      }
    },
    [answer, currentSubjectIndex, selectedVerb, selectedTense]
  );

  const handleNext = () => {
    setFeedback(null);
    setAnswer("");
    if (currentSubjectIndex + 1 < SUBJECTS.length) {
      setCurrentSubjectIndex((prev) => prev + 1);
    } else {
      setDrilling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Results screen
  if (!drilling && results.length > 0) {
    const correct = results.filter((r) => r.is_correct).length;
    const pct = Math.round((correct / results.length) * 100);
    const tone = pct >= 80 ? "success" : pct >= 50 ? "warn" : "danger";
    const toneEmoji = pct === 100 ? "🌟" : pct >= 80 ? "🎯" : pct >= 50 ? "💪" : "📚";

    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          eyebrow="Drill complete"
          title={`${selectedVerb} · ${selectedTense}`}
          subtitle={`${correct} of ${results.length} correct`}
          icon="✏️"
          backTo="/"
          backLabel="Back to dashboard"
          gradient
        />

        <div className="card relative overflow-hidden p-8 mb-5 animate-scale-in">
          <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${
            tone === "success" ? "from-success-500 to-info-500" :
            tone === "warn" ? "from-warn-500 to-accent-500" :
            "from-danger-500 to-accent-500"
          }`} />

          <div className="text-center mb-6">
            <p className="text-5xl mb-3 animate-bounce-in">{toneEmoji}</p>
            <p className="eyebrow-primary mb-1">Score</p>
            <p className={`text-display-xl font-extrabold tracking-tight ${
              tone === "success" ? "text-success-600 dark:text-success-400" :
              tone === "warn" ? "text-warn-600 dark:text-warn-400" :
              "text-danger-600 dark:text-danger-400"
            }`}>
              {correct}/{results.length}
            </p>
            <p className="text-body text-surface-500 dark:text-surface-400 mt-1 font-semibold tabular-nums">{pct}%</p>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                style={staggerDelay(i, 60)}
                className={`flex items-center justify-between p-3 rounded-xl animate-fade-in-up border ${
                  r.is_correct
                    ? "bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800"
                    : "bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    r.is_correct ? "bg-success-500 text-white" : "bg-danger-500 text-white"
                  }`}>
                    {r.is_correct ? "✓" : "✕"}
                  </span>
                  <span className="font-semibold text-surface-700 dark:text-surface-200">{r.subject}</span>
                </div>
                <span className="font-mono text-sm">
                  {r.is_correct ? (
                    <span className="text-success-700 dark:text-success-300 font-semibold">{r.answer}</span>
                  ) : (
                    <>
                      <span className="text-danger-600 dark:text-danger-400 line-through mr-2">{r.answer}</span>
                      <span className="text-success-700 dark:text-success-300 font-semibold">{r.correct_answer}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={startDrill}
          className="btn-primary btn-lg w-full"
        >
          Try again
        </button>
      </div>
    );
  }

  // Setup screen
  if (!drilling) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          eyebrow="Verb practice"
          title="Conjugation drill"
          subtitle="Pick a verb and tense — we'll quiz all six pronouns."
          icon="✏️"
          backTo="/"
          backLabel="Back to dashboard"
          gradient
        />

        <div className="card relative overflow-hidden p-6 animate-fade-in-up">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 to-purple-600" />

          <div className="space-y-4 mb-6">
            <div>
              <label className="block section-label mb-1.5">Verb</label>
              <select
                value={selectedVerb}
                onChange={(e) => setSelectedVerb(e.target.value)}
                className="input"
              >
                {verbs.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block section-label mb-1.5">Tense</label>
              <select
                value={selectedTense}
                onChange={(e) => setSelectedTense(e.target.value)}
                className="input"
              >
                {tenses.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={startDrill}
            disabled={!selectedVerb || !selectedTense}
            className="btn-primary btn-lg w-full"
          >
            Start drill
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    );
  }

  // Drill screen
  const subject = SUBJECTS[currentSubjectIndex];
  const progress = ((currentSubjectIndex + 1) / SUBJECTS.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow={`${selectedVerb} · ${selectedTense}`}
        title={`Question ${currentSubjectIndex + 1} of ${SUBJECTS.length}`}
        icon="✏️"
        gradient
      />

      {/* Progress bar */}
      <div className="mb-5 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-purple-600 transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        className={`card relative overflow-hidden p-8 text-center animate-scale-in ${
          feedback
            ? feedback.is_correct
              ? "ring-2 ring-success-300 dark:ring-success-700"
              : "ring-2 ring-danger-300 dark:ring-danger-700"
            : ""
        }`}
        key={currentSubjectIndex}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500" />

        <p className="section-label mb-3">Conjugate</p>
        <p className="text-display font-extrabold text-surface-900 dark:text-surface-100 mb-2 tracking-tight">
          {subject} <span className="text-primary-500">______</span>
        </p>
        <p className="text-caption text-surface-500 dark:text-surface-400 mb-6">
          {selectedVerb} · {selectedTense}
        </p>

        {!feedback ? (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the conjugation…"
              autoFocus
              className="input text-h3 text-center font-bold py-4"
            />
            <button
              type="submit"
              disabled={!answer.trim()}
              className="btn-primary btn-lg w-full mt-4"
            >
              Check
            </button>
          </form>
        ) : (
          <div>
            <div
              className={`p-4 rounded-xl border-2 mb-4 ${
                feedback.is_correct
                  ? "bg-success-50 dark:bg-success-900/20 border-success-300 dark:border-success-800 animate-fade-in"
                  : "bg-danger-50 dark:bg-danger-900/20 border-danger-300 dark:border-danger-800 animate-shake"
              }`}
            >
              <p className={`text-h3 font-extrabold ${feedback.is_correct ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"}`}>
                {feedback.is_correct ? "✓ Correct!" : "✕ Not quite"}
              </p>
              {!feedback.is_correct && (
                <p className="text-sm text-danger-700 dark:text-danger-300 mt-1.5">
                  Correct answer: <span className="font-bold font-mono">{feedback.correct_answer}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleNext}
              className="btn-primary btn-lg w-full"
              autoFocus
            >
              {currentSubjectIndex + 1 < SUBJECTS.length ? "Next" : "See results"}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
