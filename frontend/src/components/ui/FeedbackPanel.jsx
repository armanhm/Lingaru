import { forwardRef, useEffect, useRef, useState } from "react";
import { cx } from "./cx";

const STATES = {
  correct: { panel: "bg-ok-bg border-ok-line", title: "text-ok" },
  nearly: { panel: "bg-ok-bg border-ok-line", title: "text-ok" },
  wrong: { panel: "bg-err-bg border-err", title: "text-err" },
};
const CLEAR_AFTER_MS = 1500;
const NEUTRAL = { panel: "bg-card border-line", title: "text-fg" };

/**
 * Learning feedback after an answer. The verdict is announced through a
 * visually hidden polite live node whose text is set after mount (a live
 * region that mounts with its text is often silent) and cleared again once
 * announced, so browse mode reads it once. `action` is for the Continue
 * button.
 *
 * Each new feedback is announced once: when `announceKey`, `state`, `title`
 * or the text changes. Identical props cannot signal "new", so callers that
 * keep one panel mounted across questions pass the question id as
 * `announceKey` (string or number); then "Correct" twice in a row is
 * announced twice.
 */
export const FeedbackPanel = /* @__PURE__ */ forwardRef(function FeedbackPanel(
  { state = "correct", title, children, action, announceKey, className, ...props },
  ref,
) {
  const known = Object.hasOwn(STATES, state);
  if (!known && import.meta.env.DEV) {
    console.error(`FeedbackPanel: unknown state "${state}"; use correct, nearly or wrong.`);
  }
  const styles = known ? STATES[state] : NEUTRAL;
  const bodyRef = useRef(null);
  const lastRef = useRef(null);
  // `id` is bumped per announcement so the clear timer is rescheduled even
  // when the same text is announced again.
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" });

  // `children` is a new element on every parent render, so this effect runs
  // each time and announces only when the feedback actually changed.
  useEffect(() => {
    const body = bodyRef.current?.textContent?.trim();
    const text = [title, body].filter(Boolean).join(". ");
    const signature = JSON.stringify([announceKey ?? null, state, text]);
    if (signature === lastRef.current) return;
    lastRef.current = signature;
    setAnnouncement((prev) => ({ id: prev.id + 1, text }));
  }, [announceKey, state, title, children]);

  // Clear the hidden copy once announced. Own effect with a cleanup, so
  // StrictMode's extra mount-cleanup-mount run reschedules the timer.
  useEffect(() => {
    if (!announcement.text) return undefined;
    const timer = setTimeout(
      () => setAnnouncement((prev) => (prev.id === announcement.id ? { ...prev, text: "" } : prev)),
      CLEAR_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [announcement]);

  return (
    <div ref={ref} className={cx("rounded-xl border p-4", styles.panel, className)} {...props}>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement.text}
      </div>
      <p className={cx("text-h4", styles.title)}>{title}</p>
      {children ? (
        <div ref={bodyRef} className="mt-1 text-body text-fg">
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
});
