import { useTranslation } from "react-i18next";

const FLAG_FOR = { fr: "🇫🇷", en: "🇬🇧" };

/**
 * Read-only flag emoji indicating the user's current target_language.
 * Sits next to the logo in the layout header on every authed page.
 * Hovering shows a tooltip explaining how to change it (Settings).
 *
 * Returns null for unknown languages so a future migration that
 * introduces a 3rd language but forgets to update FLAG_FOR doesn't
 * crash the layout, it just renders nothing.
 */
export function LearningLanguageFlag({ language }) {
  const { t } = useTranslation();
  const NAME_FOR = { fr: t("languages.fr"), en: t("languages.en") };
  const flag = FLAG_FOR[language];
  if (!flag) return null;
  return (
    <span
      role="img"
      aria-label={t("layout.learningLanguageAria", { language: NAME_FOR[language] })}
      title={t("layout.learningLanguageTooltip", { language: NAME_FOR[language] })}
      className="ml-1 text-lg leading-none select-none"
    >
      {flag}
    </span>
  );
}
