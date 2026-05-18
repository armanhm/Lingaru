import { useTranslation } from "react-i18next";

/**
 * Wraps a feature card / page in a "coming soon" treatment.
 *
 * Usage:
 *   <ComingSoonBadge available={isAvailable("exam_prep", user.target_language)}>
 *     <ExamPrepCard />
 *   </ComingSoonBadge>
 *
 * When `available` is true, renders children unchanged. When false,
 * renders children at 60% opacity with pointer-events disabled, plus
 * a small amber pill in the top-right corner.
 */
export function ComingSoonBadge({ children, available }) {
  const { t } = useTranslation();
  if (available) return children;
  return (
    <div className="relative">
      <div className="opacity-60 pointer-events-none">
        {children}
      </div>
      <span
        aria-label={t("common.comingSoon")}
        className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider"
      >
        {t("common.comingSoon")}
      </span>
    </div>
  );
}
