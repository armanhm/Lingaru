import { useState, useEffect, useRef, useCallback } from "react";
import { getRandomVocabulary } from "../../../api/content";
import { generateTTS } from "../../../api/media";
import InlineRoundWidget from "../InlineRoundWidget";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function resolveAudioUrl(raw) {
  if (!raw) return null;
  return raw.startsWith("http") ? raw : `${API_BASE_URL.replace(/\/api$/, "")}${raw}`;
}

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Inline Listening Challenge: hear a French word, type what you heard.
 * Single round, no streak / lives. Audio is TTS-generated on demand,
 * same as the full page.
 */
export default function ListeningChallengeInline() {
  const [word, setWord] = useState(null);
  const [target, setTarget] = useState("");      // article-stripped
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);    // null | 'correct' | 'wrong'
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const loadRound = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setInput("");
    setAudioUrl(null);
    try {
      const { data } = await getRandomVocabulary(1, { singleWord: true });
      // count=1 returns a bare vocab object; count>1 returns an array;
      // some endpoints wrap in {results: [...]}. Cover all three.
      const list = data && data.french
        ? [data]
        : Array.isArray(data) ? data : data?.results || [];
      const vocab = list[0];
      if (!vocab?.french) {
        setWord(null);
        return;
      }
      const cleaned = vocab.french.replace(/^(l'|le |la |les |un |une |des )/i, "");
      setWord(vocab);
      setTarget(cleaned);
      // Generate audio (fire-and-forget; user can replay if it fails)
      try {
        const tts = await generateTTS(vocab.french);
        setAudioUrl(resolveAudioUrl(tts.data.audio_url));
      } catch {
        /* TTS may fail in offline / no-key environments; user sees no replay */
      }
    } catch {
      setWord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRound(); }, [loadRound]);

  // Auto-play once when the audio is first available
  useEffect(() => {
    if (audioUrl && !result) {
      const a = new Audio(audioUrl);
      audioRef.current = a;
      a.play().catch(() => {});
      // Focus input after audio
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [audioUrl, result]);

  const replay = () => {
    if (!audioUrl) return;
    const a = new Audio(audioUrl);
    audioRef.current = a;
    a.play().catch(() => {});
  };

  const submit = () => {
    if (!input.trim() || result || !word) return;
    const guess = stripAccents(input.trim().toLowerCase());
    const okStripped = guess === stripAccents(target.toLowerCase());
    const okFull = guess === stripAccents(word.french.toLowerCase());
    setResult(okStripped || okFull ? "correct" : "wrong");
  };

  return (
    <InlineRoundWidget
      title="Listening Challenge"
      emoji="🔊"
      loading={loading}
      empty={!word && !loading}
      emptyMessage="Pas encore de mots à écouter."
      emptyHint="Apprends du vocabulaire pour débloquer l'exercice d'écoute."
      emptyCtaTo="/topics"
      emptyCtaLabel="Voir les sujets →"
      score={result ? { correct: result === "correct" ? 1 : 0, total: 1 } : null}
      onAgain={result ? loadRound : null}
      fullSessionTo="/mini-games/listening-challenge"
    >
      {word && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={replay}
              disabled={!audioUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mode-grad-bg text-white text-[13px] font-bold shadow-sm active:scale-95 transition-all focus-ring disabled:opacity-40"
            >
              🔊 Rejouer
            </button>
          </div>
          {!result ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Tape le mot…"
                className="w-full rounded-xl border-2 border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-[14px] text-center focus:border-[color:var(--mode-accent)] focus:ring-2 focus:ring-[color:var(--mode-accent)]/30 outline-none"
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!input.trim()}
                  className="px-4 py-1.5 rounded-lg text-[12px] font-bold mode-grad-bg text-white shadow-sm active:scale-95 transition-all disabled:opacity-40 focus-ring"
                >
                  Valider
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-1.5 text-center">
              <p className={`text-[14px] font-bold ${result === "correct" ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300"}`}>
                {result === "correct" ? "✓ Parfaitement entendu !" : "Pas tout à fait."}
              </p>
              <p className="text-[12px] text-surface-500 dark:text-surface-400">
                Le mot était <span className="font-bold text-surface-900 dark:text-surface-50">{word.french}</span>
                {word.english && <> — <span className="italic">{word.english}</span></>}
              </p>
            </div>
          )}
        </div>
      )}
    </InlineRoundWidget>
  );
}
