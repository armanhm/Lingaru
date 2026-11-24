import { createElement } from "react";
import { House } from "lucide-react";

/**
 * Per-mode configuration: which nav items are visible, where the user
 * lands by default, and a short label for the mode chip.
 *
 * Modes are an audience-tailored persona, not just a theme. Switching
 * mode changes the visible navigation, the home page, and (Phase 2) the
 * visual theme. Three modes live here:
 *
 *   general , casual learners, full breadth of features.
 *   exam    , TCF / TEF prep. ALL features stay reachable; the dashboard
 *              just leads with exam content. Per the spec, learners
 *              prepping for exams need vocabulary / dictation / news /
 *              etc., they just feel "in exam mode" on the home screen.
 *   agentic , assistant-first. Most pages are reachable via in-chat
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
      "/our-notes",
      "/my-notes",
    ],
    chipLabel: "Apprentissage général",
    accent: "primary",
  },

  exam: {
    landing: "/exam-prep",
    // Exam learners get ALL features (per spec), exam-prep just leads
    // the dashboard. Same allow-list as general PLUS exam-prep.
    visible: [
      "/", "/dashboard", "/topics", "/discover", "/news",
      "/practice/dictation", "/practice/pronunciation",
      "/practice/conjugation", "/practice/srs",
      "/mini-games", "/grammar", "/exam-prep",
      "/assistant", "/agents",
      "/dictionary",
      "/progress",
      "/our-notes",
      "/my-notes",
    ],
    chipLabel: "Prépa examen",
    accent: "info",
  },

  agentic: {
    landing: "/assistant",
    // Same allow-list, escape hatches stay available so a power user
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
      "/our-notes",
      "/my-notes",
    ],
    chipLabel: "Mode agent",
    accent: "accent",
  },
};

/** Filter NAV_SECTIONS down to the items allowed by the active mode.
 *  Items may also declare a `languages` allow-list (e.g. `["en"]`); when
 *  present, they're only shown if `targetLanguage` is in that list. */
export function filterNavForMode(sections, mode, targetLanguage) {
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.general;
  const allow = new Set(cfg.visible);

  let filtered = sections
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((it) => {
        if (!allow.has(it.to)) return false;
        if (it.languages && !it.languages.includes(targetLanguage)) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  // Agentic mode: the Assistant IS the home page, so collapse Dashboard +
  // Assistant into one "Home" item pointing at /assistant. Otherwise clicking
  // Dashboard briefly flashes Dashboard then redirects to Assistant which
  // looks like a glitch.
  if (mode === "agentic") {
    const homeIcon = createElement(House, {
      "aria-hidden": "true",
      size: 20,
      strokeWidth: 1.75,
      className: "shrink-0",
    });
    filtered = filtered.map((section) => {
      const items = section.items
        .filter((it) => it.to !== "/" && it.to !== "/dashboard")
        .map((it) => (it.to === "/assistant" ? { ...it, labelKey: "nav.home", icon: homeIcon } : it));
      // Hoist Home to the top of whichever section it lives in.
      const homeIdx = items.findIndex((it) => it.to === "/assistant");
      if (homeIdx > 0) {
        const [home] = items.splice(homeIdx, 1);
        items.unshift(home);
      }
      return { ...section, items };
    });
  }

  return filtered;
}

/** Where should "/" redirect for this mode? */
export function landingRouteForMode(mode) {
  return (MODE_CONFIG[mode] || MODE_CONFIG.general).landing;
}
