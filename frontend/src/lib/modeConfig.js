/**
 * Per-mode configuration: which nav items are visible, where the user
 * lands by default, and a short label for the mode chip.
 *
 * Modes are an audience-tailored persona, not just a theme. Switching
 * mode changes the visible navigation, the home page, and (Phase 2) the
 * visual theme. Three modes live here:
 *
 *   general  — casual learners, full breadth of features.
 *   exam     — TCF / TEF prep. ALL features stay reachable; the dashboard
 *              just leads with exam content. Per the spec, learners
 *              prepping for exams need vocabulary / dictation / news /
 *              etc., they just feel "in exam mode" on the home screen.
 *   agentic  — assistant-first. Most pages are reachable via in-chat
 *              invocation rather than nav. Even so, every section is
 *              still reachable from the side nav so escape hatches exist.
 *
 * The lists below are the URL prefixes a mode wants to surface. Items not
 * in the list are filtered out of NAV_SECTIONS at render time.
 */

export const MODES = ["general", "exam", "agentic"];

// Each mode has:
//   landing:     where to send the user when they hit /
//   visible:     which to-prefixes appear in the side nav (an empty array
//                hides everything in that section)
//   showSection: section labels that are visible (everything else hidden)
//   chipLabel:   short label shown in the user menu / settings chip
export const MODE_CONFIG = {
  general: {
    landing: "/dashboard",
    visible: [
      "/", "/dashboard", "/topics", "/discover", "/news",
      "/practice/dictation", "/practice/pronunciation",
      "/practice/conjugation", "/practice/srs",
      "/mini-games", "/grammar",
      "/assistant", "/agents",
      "/dictionary",
      "/progress",
    ],
    chipLabel: "Apprentissage général",
    accent: "primary",
  },

  exam: {
    landing: "/exam-prep",
    // Exam learners get ALL features (per spec) — exam-prep just leads
    // the dashboard. Same allow-list as general PLUS exam-prep.
    visible: [
      "/", "/dashboard", "/topics", "/discover", "/news",
      "/practice/dictation", "/practice/pronunciation",
      "/practice/conjugation", "/practice/srs",
      "/mini-games", "/grammar", "/exam-prep",
      "/assistant", "/agents",
      "/dictionary",
      "/progress",
    ],
    chipLabel: "Prépa examen",
    accent: "info",
  },

  agentic: {
    landing: "/assistant",
    // Same allow-list — escape hatches stay available so a power user
    // can jump to any feature directly. The personality lives in WHERE
    // they land and the visual theme.
    visible: [
      "/", "/dashboard", "/topics", "/discover", "/news",
      "/practice/dictation", "/practice/pronunciation",
      "/practice/conjugation", "/practice/srs",
      "/mini-games", "/grammar", "/exam-prep",
      "/assistant", "/agents",
      "/dictionary",
      "/progress",
    ],
    chipLabel: "Mode agent",
    accent: "accent",
  },
};

/** Filter NAV_SECTIONS down to the items allowed by the active mode. */
export function filterNavForMode(sections, mode) {
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.general;
  const allow = new Set(cfg.visible);

  return sections
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((it) => allow.has(it.to)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Where should "/" redirect for this mode? */
export function landingRouteForMode(mode) {
  return (MODE_CONFIG[mode] || MODE_CONFIG.general).landing;
}
