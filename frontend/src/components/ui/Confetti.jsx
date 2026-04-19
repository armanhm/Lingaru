import { useEffect, useState } from "react";

/**
 * One-shot confetti burst. Mount it, and it self-destructs after the animation.
 * Usage: {showConfetti && <Confetti />}
 */
const COLORS = ["#6366f1", "#f07d1e", "#10b981", "#f43f5e", "#0ea5e9", "#f59e0b", "#8b5cf6"];

export default function Confetti({ count = 40, duration = 1500 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration + 200);
    return () => clearTimeout(t);
  }, [duration]);

  if (!visible) return null;

  const pieces = Array.from({ length: count }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 200;
    const size = 6 + Math.random() * 6;
    const color = COLORS[i % COLORS.length];
    const rotate = Math.random() * 360;
    const drift = (Math.random() - 0.5) * 100;
    return (
      <span
        key={i}
        className="absolute top-0 animate-confetti-fall"
        style={{
          left: `${left}%`,
          width: `${size}px`,
          height: `${size * 0.4}px`,
          background: color,
          transform: `rotate(${rotate}deg) translateX(${drift}px)`,
          animationDelay: `${delay}ms`,
          animationDuration: `${duration}ms`,
          borderRadius: "2px",
        }}
      />
    );
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces}
    </div>
  );
}
