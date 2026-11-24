import { createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";

/**
 * Mirrors the user's mode (general / exam / agentic) onto a
 * `data-mode="<mode>"` attribute on <html> and exposes it through `useMode`.
 *
 * A mode changes content (navigation, home page), not colours: every mode
 * shares one palette, so no CSS selects on `data-mode`. The attribute is a
 * hook for tests and tooling.
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
