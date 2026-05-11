import { createContext, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { SUPPORTED_LANGUAGES } from "../i18n";

/**
 * Bridges the user's saved `ui_language` (en / fr) into i18next's active
 * language and onto <html lang="..."> for accessibility.
 *
 * Resolution per render:
 *   - If user is authenticated and has a stored ui_language, use that.
 *   - Otherwise fall through to whatever i18next already detected
 *     (localStorage > navigator > "en"), set up in src/i18n.js.
 *
 * Mirrors ModeContext: a thin "user state -> DOM/i18n state" bridge.
 */

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    const target = user?.ui_language;
    if (target && SUPPORTED_LANGUAGES.includes(target) && i18n.language !== target) {
      i18n.changeLanguage(target);
    }
  }, [user?.ui_language, i18n]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", i18n.language || "en");
  }, [i18n.language]);

  return (
    <LanguageContext.Provider value={{ language: i18n.language, changeLanguage: i18n.changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext) || { language: "en", changeLanguage: () => {} };
}
