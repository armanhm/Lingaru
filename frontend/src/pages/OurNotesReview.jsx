import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listNotes, getNote, generateNoteQuiz } from "../api/notes";
import { useAuth } from "../contexts/AuthContext";
import { PageHeader, EmptyState } from "../components/ui";

const SWIPE_THRESHOLD = 80;
const FLY_DISTANCE = 600;
const FLY_DURATION = 300;

const WORD_EMOJIS = ["✨", "🌱", "📚", "🔑", "💡", "🪐", "🌊", "🎯", "🪶", "🌿", "🍀", "🧩", "🔥", "🌸", "🍂", "🌟", "⚡", "🎨", "🪴", "🌈", "🐚", "🪷", "🌻", "🔮"];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function formatTelegramDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export default function OurNotesReview() {
  const { user } = useAuth();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEn = user?.target_language === "en";

  const [notes, setNotes] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentNote, setCurrentNote] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [detailError, setDetailError] = useState(null);

  const [dragging, setDragging] = useState(false);
  const [dx, setDx] = useState(0);
  const [exiting, setExiting] = useState(null);
  const startRef = useRef(null);
  const transitioningRef = useRef(false);
  const swipeTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
  }, []);

  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(null);

  useEffect(() => {
    if (!isEn) {
      setListLoading(false);
      return;
    }
    listNotes()
      .then((res) => {
        const list = res.data.results || res.data || [];
        const sorted = [...list].sort(
          (a, b) => (a.note_number ?? a.id) - (b.note_number ?? b.id),
        );
        setNotes(sorted);
      })
      .catch((err) => setListError(err.response?.data?.detail || "Failed to load notes."))
      .finally(() => setListLoading(false));
  }, [isEn]);

  useEffect(() => {
    if (!notes.length) return;
    if (routeId) {
      const idx = notes.findIndex((n) => String(n.id) === String(routeId));
      setActiveIndex(idx >= 0 ? idx : 0);
    } else {
      setActiveIndex(Math.floor(Math.random() * notes.length));
    }
  }, [notes, routeId]);

  useEffect(() => {
    if (!notes.length) return;
    const note = notes[activeIndex];
    if (!note) return;
    let cancelled = false;
    setDetailError(null);
    getNote(note.id)
      .then((res) => { if (!cancelled) setCurrentNote(res.data); })
      .catch(() => { if (!cancelled) setDetailError(t("ourNotes.review.loadError")); });
    return () => { cancelled = true; };
  }, [notes, activeIndex, t]);

  const goTo = useCallback((newIndex) => {
    if (newIndex < 0 || newIndex >= notes.length) return;
    setActiveIndex(newIndex);
    const target = notes[newIndex];
    if (target) {
      navigate(`/our-notes/review/${target.id}`, { replace: true });
    }
  }, [notes, navigate]);

  const shuffleToRandom = useCallback(() => {
    if (notes.length <= 1) return;
    let next;
    do {
      next = Math.floor(Math.random() * notes.length);
    } while (next === activeIndex);
    goTo(next);
  }, [notes.length, activeIndex, goTo]);

  const handleGenerateQuiz = useCallback(async () => {
    const note = notes[activeIndex];
    if (!note || quizLoading) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const res = await generateNoteQuiz(note.id);
      const lessonId = res.data?.lesson_id ?? res.data?.id;
      if (lessonId) {
        navigate(`/practice/quiz/${lessonId}`);
      } else {
        setQuizError(t("ourNotes.actions.quizError"));
      }
    } catch {
      setQuizError(t("ourNotes.actions.quizError"));
    } finally {
      setQuizLoading(false);
    }
  }, [notes, activeIndex, quizLoading, navigate, t]);

  const swipeTo = useCallback((direction) => {
    if (transitioningRef.current) return;
    const nextIndex = direction === "next" ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex < 0 || nextIndex >= notes.length) return;
    transitioningRef.current = true;
    setExiting({ x: direction === "next" ? -FLY_DISTANCE : FLY_DISTANCE });
    if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
    swipeTimeoutRef.current = setTimeout(() => {
      goTo(nextIndex);
      setExiting(null);
      setDx(0);
      setDragging(false);
      transitioningRef.current = false;
      swipeTimeoutRef.current = null;
    }, FLY_DURATION);
  }, [activeIndex, notes.length, goTo]);

  const onPointerDown = (e) => {
    if (exiting || transitioningRef.current) return;
    // Track origin + intent. We don't lock the pointer or set
    // `dragging` until the user has moved far enough HORIZONTALLY for
    // us to be confident this is a swipe (not a tap, not a scroll).
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      committed: false,
    };
    setDx(0);
  };

  const onPointerMove = (e) => {
    const start = startRef.current;
    if (!start) return;
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    if (!start.committed) {
      // Wait until the user has moved at least 10px in some direction.
      // If the dominant axis is vertical, let the browser scroll the
      // page naturally — bail out of swipe tracking entirely.
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        startRef.current = null;
        return;
      }
      start.committed = true;
      setDragging(true);
      try { e.currentTarget.setPointerCapture(start.pointerId); } catch (_e) { /* ignore */ }
    }
    setDx(deltaX);
  };

  const onPointerUp = () => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || !start.committed) {
      setDragging(false);
      setDx(0);
      return;
    }
    setDragging(false);
    if (dx < -SWIPE_THRESHOLD && activeIndex < notes.length - 1) {
      swipeTo("next");
    } else if (dx > SWIPE_THRESHOLD && activeIndex > 0) {
      swipeTo("prev");
    } else {
      setDx(0);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (exiting || transitioningRef.current) return;
      if (e.key === "ArrowRight" && activeIndex < notes.length - 1) {
        swipeTo("next");
      } else if (e.key === "ArrowLeft" && activeIndex > 0) {
        swipeTo("prev");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, notes.length, exiting, swipeTo]);

  if (!isEn) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          eyebrow="Our Notes"
          title={t("ourNotes.pageTitle")}
          icon="🗒️"
          gradient
        />
        <div className="card p-6">
          <EmptyState
            icon="🇫🇷"
            title={t("ourNotes.comingSoonForFrench")}
            action={
              <Link to="/settings" className="btn-primary btn-lg">
                {t("nav.settings")}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (listLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (listError) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState icon="⚠️" title="Couldn't load notes" subtitle={listError} tone="warn" />
      </div>
    );
  }

  if (!notes.length) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState icon="🗒️" title={t("ourNotes.empty")} />
      </div>
    );
  }

  const headNote = notes[activeIndex];
  const noteNumber = headNote?.note_number ?? headNote?.id;
  const title = headNote?.title;
  const dateStr = formatTelegramDate(headNote?.date);
  const wordsLoaded = currentNote && String(currentNote.id) === String(headNote?.id);
  const words = wordsLoaded ? currentNote.words : [];

  const tx = exiting ? exiting.x : dx;
  const rotate = tx * 0.04;
  const scale = exiting ? 0.95 : (dragging ? 1.01 : 1);
  const transition = dragging ? "none" : `transform ${FLY_DURATION}ms cubic-bezier(.4,.9,.3,1), opacity ${FLY_DURATION}ms ease`;

  const leftHintOp = dragging ? clamp(dx / SWIPE_THRESHOLD, 0, 1) : 0;
  const rightHintOp = dragging ? clamp(-dx / SWIPE_THRESHOLD, 0, 1) : 0;

  const actionButtons = [
    { key: "shuffle", icon: "🔀", label: t("ourNotes.review.shuffle"), onClick: shuffleToRandom, disabled: notes.length <= 1 },
    { key: "quiz", icon: "🎯", label: quizLoading ? t("ourNotes.actions.generatingQuiz") : t("ourNotes.actions.generateQuiz"), onClick: handleGenerateQuiz, disabled: quizLoading || !wordsLoaded },
    { key: "full", icon: "👁️", label: t("ourNotes.review.fullNote"), onClick: () => navigate(`/our-notes/${headNote?.id}`), disabled: !headNote },
  ];

  return (
    <div className="max-w-2xl mx-auto select-none relative">
      <div className="mb-4">
        <Link
          to="/our-notes"
          className="inline-flex items-center gap-1.5 text-caption font-medium text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors focus-ring rounded-md -mx-1 px-1 py-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("ourNotes.detail.backToList")}
        </Link>
      </div>

      <div className="relative overflow-visible" style={{ minHeight: 400 }}>
        <aside className="hidden lg:flex absolute left-0 top-0 -translate-x-[calc(100%+1rem)] h-full z-20 flex-col items-center pointer-events-none">
          <div className="sticky top-0 pointer-events-auto">
            <div className="flex flex-col gap-2 p-2 rounded-2xl bg-white/90 dark:bg-surface-800/90 backdrop-blur-md border border-surface-200 dark:border-surface-700 shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
              {actionButtons.map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  className="group relative w-14 h-14 flex items-center justify-center rounded-xl bg-surface-50 dark:bg-surface-700/60 border border-surface-100 dark:border-surface-600/40 text-2xl shadow-sm hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-md hover:scale-110 active:scale-95 transition-all duration-200 ease-out focus-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label={btn.label}
                >
                  <span aria-hidden>{btn.icon}</span>
                  <span className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-surface-900 dark:bg-surface-700 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
                    {btn.label}
                  </span>
                </button>
              ))}
            </div>
            {quizError && (
              <p className="w-20 mt-2 text-[10px] text-danger-600 dark:text-danger-400 text-center">
                {quizError}
              </p>
            )}
          </div>
        </aside>
        <div
          key={headNote?.id}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative rounded-2xl bg-surface-900 text-surface-100 shadow-card p-6 sm:p-8 touch-pan-y dark:bg-surface-800 dark:ring-1 dark:ring-surface-700 animate-soft-zoom"
          style={{
            transform: `translateX(${tx}px) rotate(${rotate}deg) scale(${scale})`,
            transition,
            opacity: exiting ? 0 : 1,
            cursor: notes.length > 1 ? "grab" : "default",
          }}
        >
          <div
            className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-primary-400/80 pointer-events-none"
            style={{ opacity: leftHintOp }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1.5 rounded-r-2xl bg-primary-400/80 pointer-events-none"
            style={{ opacity: rightHintOp }}
          />

          <p className="text-sm font-bold mb-5 text-surface-200">
            {dateStr}{" "}
            <span className="text-primary-400">#notes</span>{" "}
            <span>note{noteNumber}</span>
            {title && (
              <span className="italic text-surface-300"> &quot;{title}&quot;</span>
            )}
          </p>

          {detailError ? (
            <p className="text-sm text-danger-300">{detailError}</p>
          ) : !wordsLoaded ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="skeleton h-4 w-3/4 rounded bg-surface-700/60" />
                  <div className="skeleton h-3 w-1/2 rounded bg-surface-700/40 ml-4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {words.map((w, idx) => (
                <div key={w.id}>
                  <p className="text-[15px] leading-relaxed">
                    <span aria-hidden>{WORD_EMOJIS[((Number(noteNumber) || 0) * 7 + idx) % WORD_EMOJIS.length]} </span>
                    <span className="font-bold underline decoration-primary-400/60 underline-offset-2">{w.word}</span>
                    {w.definition && (
                      <>
                        : <span className="text-surface-200">{w.definition}</span>
                      </>
                    )}
                  </p>
                  {w.example && (
                    <p className="text-[14px] leading-relaxed text-surface-400 mt-1 pl-5 italic">
                      Ex: {w.example}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 gap-3">
        <button
          onClick={() => swipeTo("prev")}
          disabled={activeIndex === 0}
          className="btn-secondary btn-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← {t("ourNotes.review.previous")}
        </button>
        <button
          onClick={() => swipeTo("next")}
          disabled={activeIndex === notes.length - 1}
          className="btn-primary btn-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("ourNotes.review.next")} →
        </button>
      </div>

      <p className="text-xs text-center text-surface-500 dark:text-surface-400 mt-3 pb-24 lg:pb-0">
        {t("ourNotes.review.hint")}
      </p>

      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-surface-900/95 backdrop-blur-md border-t border-surface-200 dark:border-surface-700"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-3 max-w-md mx-auto">
          {actionButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={btn.onClick}
              disabled={btn.disabled}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-surface-700 dark:text-surface-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 active:bg-primary-100 dark:active:bg-primary-900/50 transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={btn.label}
            >
              <span className="text-2xl leading-none" aria-hidden>{btn.icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                {btn.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col items-end">
        <div className="relative max-h-[80vh] py-2 pr-2 pl-32 -ml-32 overflow-y-auto overflow-x-visible scrollbar-thin">
          <ul className="flex flex-col gap-1 items-end">
            {notes.map((n, i) => {
              const num = n.note_number ?? n.id;
              const active = i === activeIndex;
              return (
                <li key={n.id} className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    ref={(el) => {
                      if (active && el && !dragging && !exiting) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    }}
                    className={`origin-right w-24 text-center whitespace-nowrap px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ease-out focus-ring backdrop-blur shadow-sm hover:scale-150 hover:font-bold hover:shadow-md hover:z-10 relative ${
                      active
                        ? "bg-primary-600 text-white scale-110 ring-2 ring-primary-300 dark:ring-primary-700"
                        : "bg-white/85 dark:bg-surface-800/85 text-surface-700 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300"
                    }`}
                  >
                    {t("ourNotes.detail.noteHeader", { number: num })}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
