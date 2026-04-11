import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getConjugationVerbs, checkConjugation } from "../api/progress";
import { staggerDelay } from "../hooks/useAnimations";

export default function ConjugationDrill() {
  const [searchParams] = useSearchParams();
  const [verbs, setVerbs] = useState([]);
  const [tenses, setTenses] = useState([]);
  const [selectedVerb, setSelectedVerb] = useState("");
  const [selectedTense, setSelectedTense] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoStart, setAutoStart] = useState(false);

  // Drill state
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

  // Auto-start if verb was passed via URL param
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

  if (!drilling && results.length > 0) {
    const correct = results.filter((r) => r.is_correct).length;
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 mb-6">
          Conjugation Results: {selectedVerb} ({selectedTense})
        </h1>
        <div className="card p-6 mb-6 animate-scale-in">
          <p className="text-3xl font-bold text-center mb-4 animate-bounce-in">
            {correct}/{results.length}
          </p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                style={staggerDelay(i, 60)}
                className={`flex justify-between p-3 rounded-lg animate-fade-in-up ${
                  r.is_correct ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <span className="font-medium">{r.subject}</span>
                <span>
                  {r.is_correct ? (
                    <span className="text-green-700">{r.answer}</span>
                  ) : (
                    <>
                      <span className="text-red-600 line-through mr-2">{r.answer}</span>
                      <span className="text-green-700">{r.correct_answer}</span>
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
          Try Again
        </button>
      </div>
    );
  }

  if (!drilling) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100 mb-6">Conjugation Drill</h1>
        <div className="card p-6">
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Verb</label>
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
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Tense</label>
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
            Start Drill
          </button>
        </div>
      </div>
    );
  }

  const subject = SUBJECTS[currentSubjectIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-surface-900 dark:text-surface-100">
          {selectedVerb} — {selectedTense}
        </h1>
        <span className="text-sm text-surface-500 dark:text-surface-400">
          {currentSubjectIndex + 1} / {SUBJECTS.length}
        </span>
      </div>

      <div className="card p-8 text-center animate-scale-in" key={currentSubjectIndex}>
        <p className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6">
          {subject} ________
        </p>

        {!feedback ? (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the conjugation..."
              autoFocus
              className="input text-lg text-center"
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
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 animate-fade-in"
                  : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 animate-shake"
              }`}
            >
              <p className={`font-bold ${feedback.is_correct ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-400"}`}>
                {feedback.is_correct ? "Correct!" : "Incorrect"}
              </p>
              {!feedback.is_correct && (
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  Correct answer: <strong>{feedback.correct_answer}</strong>
                </p>
              )}
            </div>
            <button
              onClick={handleNext}
              className="btn-primary btn-lg w-full"
            >
              {currentSubjectIndex + 1 < SUBJECTS.length ? "Next" : "See Results"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
