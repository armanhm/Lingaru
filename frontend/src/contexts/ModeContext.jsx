import { createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";

/**
 * Mirrors the user's mode (general / exam / agentic) onto a
 * `data-mode="<mode>"` attribute on <html>, so CSS custom properties
 * scoped per-mode in index.css can re-tint the page chrome (header
 * band, hero gradients, dashboard accents) without rewriting every
 * component.
 *
 * The actual palette tokens live in index.css under the
 * `html[data-mode="..."]` selectors. This context is only the bridge
 * between user state and the DOM attribute. Lightweight on purpose ,
 * dark mode does the same trick.
 */

const ModeContext = createContext(null);

export function ModeProvider({ children }) {
  const { user } = useAuth();
  const mode = user?.mode || "general";

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    return () => {
      // Only clean up if we're the last provider; in practice this only
      // unmounts on full app teardown so a no-op is fine.
    };
  }, [mode]);

  return <ModeContext.Provider value={{ mode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  return ctx || { mode: "general" };
}
