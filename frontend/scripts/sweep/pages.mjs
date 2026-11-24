// Routes covered by the sweep. "login" runs logged out; every other route
// runs with the demo user's tokens in localStorage.
export const ROUTES = [
  "login",
  "dashboard",
  "topics",
  "practice/srs",
  "assistant",
  "agents",
  "discover",
  "news",
  "dictionary",
  "grammar",
  "exam-prep",
  "mini-games",
  "our-notes",
  "my-notes",
  "progress",
  "settings",
];

export const THEMES = ["light", "dark"];

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

export const PUBLIC_ROUTES = new Set(["login"]);
