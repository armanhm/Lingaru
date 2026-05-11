import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

/**
 * App-chrome i18n. The language being LEARNED is always French; this
 * config is for the wrapping UI (nav, settings, buttons, toasts).
 *
 * Resolution order at boot:
 *   1. localStorage `lingaru-ui-language` (set by user via Settings picker)
 *   2. navigator.language (browser-detected)
 *   3. fallback: "en"
 *
 * After login, Layout/AuthContext reads `user.ui_language` and calls
 * `i18n.changeLanguage(...)` to override 1+2 with the server value.
 */

export const SUPPORTED_LANGUAGES = ["en", "fr"];
export const DEFAULT_LANGUAGE = "en";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true, // map "fr-FR" -> "fr"
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lingaru-ui-language",
      caches: ["localStorage"],
    },
    returnEmptyString: false,
  });

export default i18n;
