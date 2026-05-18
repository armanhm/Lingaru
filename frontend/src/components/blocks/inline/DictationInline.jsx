import { useState, useEffect, useRef, useCallback } from "react";
import { startDictation, checkDictation } from "../../../api/media";
import InlineRoundWidget from "../InlineRoundWidget";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  return rawUrl.startsWith("http") ? rawUrl : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
}

/**
 * Inline dictation: one phrase, play audio, type response, grade.
 * Same backend endpoints as the full /practice/dictation page.
 */
export default function DictationInline() {
  const [clip, setClip] = useState(null);
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setUserText("");
    try {
      const { data } = await startDictation();
      const next = {
        audio_clip_id: data.audio_clip.id,
        audio_url: data.audio_clip.audio_url,
      };
      setClip(next);
      // Auto-play first listen
      const url = resolveAudioUrl(next.audio_url);
      if (url) {
        const a = new Audio(url);
        audioRef.current = a;
        a.play().catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible de charger la dictée.");
      setClip(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  const replay = () => {
    if (!clip) return;
    const url = resolveAudioUrl(clip.audio_url);
    if (url) {
      const a = new Audio(url);
      audioRef.current = a;
      a.play().catch(() => {});
    }
  };

  const submit = async () => {
    if (!clip || !userText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await checkDictation(clip.audio_clip_id, userText.trim());
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible de vérifier la réponse.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InlineRoundWidget
      title="Dictée express"
      emoji="🎧"
      loading={loading}
      empty={!clip && !loading}
      emptyMessage={error || "Pas de dictée pour le moment."}
      emptyEmoji={error ? "⚠️" : "🎧"}
      emptyHint={error ? undefined : "Les dictées sont générées au fur et à mesure de tes leçons."}
      emptyCtaTo={error ? undefined : "/practice/dictation"}
      emptyCtaLabel={error ? undefined : "Aller à Dictée →"}
      score={result ? { correct: result.correct ? 1 : 0, total: 1 } : null}
      onAgain={result ? loadRound : null}
      fullSessionTo="/practice/dictation"
    >
      {clip && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mode-grad-bg text-white text-[13px] font-bold shadow-sm active:scale-95 transition-all focus-ring"
            >
              ▶ Rejouer l'audio
            </button>
          </div>
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Tape ce que tu entends…"
            className="w-full rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-[14px] focus:border-[color:var(--mode-accent)] focus:ring-2 focus:ring-[color:var(--mode-accent)]/30 outline-none resize-none"
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={submit}
              disabled={!userText.trim() || submitting}
              className="px-4 py-1.5 rounded-lg text-[12px] font-bold mode-grad-bg text-white shadow-sm active:scale-95 transition-all disabled:opacity-40 focus-ring"
            >
              {submitting ? "Vérification…" : "Valider"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400">Attendu :</span>
            <span className="text-[14px] font-semibold text-success-700 dark:text-success-300">
              {result.expected ?? result.expected_text}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400">Toi :</span>
            <span className={`text-[14px] font-semibold ${result.correct ? "text-surface-900 dark:text-surface-100" : "text-danger-700 dark:text-danger-300"}`}>
              {result.user_text}
            </span>
          </div>
          {typeof result.score === "number" && (
            <p className="text-[12px] text-surface-500 dark:text-surface-400">
              Score : <span className="font-bold">{result.score}%</span>
            </p>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
