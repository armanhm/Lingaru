import { useEffect, useState } from "react";

const KEY = "lingaru:last-activity";
const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Track a user's active page + label so we can offer "Resume" later.
 * Call markActivity({label, url}) when the user enters a mid-flow page.
 * Call clearActivity() when they complete.
 */
export function markActivity(label, url) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ label, url, ts: Date.now() }));
  } catch {}
}

export function clearActivity() {
  try { sessionStorage.removeItem(KEY); } catch {}
}

export function readActivity() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > EXPIRY_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** React hook — read last activity on mount. */
export function useLastActivity() {
  const [activity, setActivity] = useState(null);
  useEffect(() => { setActivity(readActivity()); }, []);
  const dismiss = () => { clearActivity(); setActivity(null); };
  return [activity, dismiss];
}
