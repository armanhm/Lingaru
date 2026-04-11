import { useState, useEffect, useRef } from "react";

/**
 * Animate a number from 0 to `target` over `duration` ms.
 * Returns the current animated value.
 */
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target == null || target === prevTarget.current) return;
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;
    prevTarget.current = target;

    const startTime = performance.now();
    let raf;
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/**
 * Returns a style object with animation-delay for staggering children.
 * Use: style={staggerDelay(index)}
 */
export function staggerDelay(index, baseMs = 60) {
  return {
    animationDelay: `${index * baseMs}ms`,
    animationFillMode: "both",
  };
}

/**
 * Hook that returns true once the component has mounted,
 * useful for triggering entrance animations.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Small delay to ensure the initial render is committed before animating
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
