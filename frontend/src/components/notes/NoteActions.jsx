import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { addNoteToSrs, generateNoteQuiz } from "../../api/notes";
import { useToast } from "../../contexts/ToastContext";

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
  );
}

export default function NoteActions({ noteId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [addingSrs, setAddingSrs] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [error, setError] = useState(null);

  async function handleAddToSrs() {
    if (addingSrs) return;
    setError(null);
    setAddingSrs(true);
    try {
      const res = await addNoteToSrs(noteId);
      const created = res.data?.created ?? 0;
      const existing = res.data?.existing ?? 0;
      if (created === 0 && existing > 0) {
        showToast(t("ourNotes.actions.allAlreadyInSrs"), "info");
      } else {
        showToast(t("ourNotes.actions.addedToSrs", { count: created }), "success");
      }
    } catch {
      setError(t("ourNotes.actions.srsError"));
    } finally {
      setAddingSrs(false);
    }
  }

  async function handleGenerateQuiz() {
    if (generatingQuiz) return;
    setError(null);
    setGeneratingQuiz(true);
    try {
      const res = await generateNoteQuiz(noteId);
      const lessonId = res.data?.lesson_id;
      if (lessonId) {
        navigate(`/practice/quiz/${lessonId}`);
      } else {
        setError(t("ourNotes.actions.quizError"));
      }
    } catch {
      setError(t("ourNotes.actions.quizError"));
    } finally {
      setGeneratingQuiz(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleAddToSrs}
          disabled={addingSrs}
          className="btn-secondary btn-md w-full justify-center"
        >
          {addingSrs ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-surface-400/40 border-t-surface-700 dark:border-t-surface-200 animate-spin" />
              {t("ourNotes.actions.addingToSrs")}
            </>
          ) : (
            <>
              <span aria-hidden>📚</span>
              {t("ourNotes.actions.addToSrs")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleGenerateQuiz}
          disabled={generatingQuiz}
          className="btn-primary btn-md w-full justify-center"
        >
          {generatingQuiz ? (
            <>
              <Spinner />
              {t("ourNotes.actions.generatingQuiz")}
            </>
          ) : (
            <>
              <span aria-hidden>🎯</span>
              {t("ourNotes.actions.generateQuiz")}
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-danger-200 dark:border-danger-900/40 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 text-sm px-4 py-2.5">
          {error}
        </div>
      )}
    </div>
  );
}
