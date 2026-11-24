import { cx } from "./cx";

const TONES = {
  neutral: "bg-canvas text-fg-2 border-line",
  accent: "bg-canvas text-accent border-accent",
  ok: "bg-ok-bg text-ok border-ok-line",
  err: "bg-err-bg text-err border-err",
  warn: "bg-warn-bg text-warn border-warn",
};

/** Small status pill. */
export function Badge({ tone = "neutral", className, children, ...props }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-[10px] border px-2 py-0.5 text-caption font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
