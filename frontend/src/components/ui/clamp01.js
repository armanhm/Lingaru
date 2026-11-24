export const clamp01 = (v) => (typeof v !== "number" || Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v)));
