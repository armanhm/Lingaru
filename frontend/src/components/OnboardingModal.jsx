import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";

/**
 * First-time onboarding picker: choose a mode + proficiency level.
 *
 * Triggered from <Layout> when the authenticated user has no `mode` set.
 * Two steps: (1) mode card-grid, (2) proficiency dropdown + placement
 * test stub. Submitting calls PATCH /api/users/me/ then `refreshUser()`
 * so the rest of the app picks up the new mode immediately (nav,
 * landing route, future theme).
 *
 * Existing users were backfilled to `general` by a data migration so
 * this modal never fires for them. New signups see it once.
 */

const MODES = [
  { key: "general", emoji: "🎒", tint: "from-primary-500 to-purple-600" },
  { key: "exam",    emoji: "🎯", tint: "from-info-500 to-primary-600" },
  { key: "agentic", emoji: "🤖", tint: "from-accent-500 to-purple-600" },
];

const LEVEL_KEYS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function OnboardingModal() {
  const { refreshUser } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [targetLanguage, setTargetLanguage] = useState("fr");
  const [mode, setMode] = useState(null);
  const [level, setLevel] = useState(null);
  const [showPlacementStub, setShowPlacementStub] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!mode || !level) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.patch("/users/me/", {
        target_language: targetLanguage,
        mode,
        proficiency_level: level,
      });
      await refreshUser();
      // Modal disappears on its own once user.mode is set.
    } catch (err) {
      setError(err.response?.data?.detail || t("onboarding.saveError"));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 bg-black/60 dark:bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-100 dark:border-surface-700 overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-7 py-6 border-b border-surface-100 dark:border-surface-800">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary-600 dark:text-primary-400">
            {t("onboarding.step", { step })}
          </p>
          <h2 className="font-editorial text-[26px] sm:text-[30px] leading-tight text-surface-900 dark:text-surface-50 mt-1">
            {step === 1 ? t("onboarding.languageTitle") : step === 2 ? t("onboarding.step1Title") : t("onboarding.step2Title")}
          </h2>
          <p className="text-[13.5px] text-surface-600 dark:text-surface-400 mt-1.5">
            {step === 1 ? t("onboarding.languageSubtitle") : step === 2 ? t("onboarding.step1Subtitle") : t("onboarding.step2Subtitle")}
          </p>
        </div>

        {/* Body */}
        <div className="px-7 py-6 max-h-[55vh] overflow-y-auto">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { code: "fr", flag: "🇫🇷", labelKey: "onboarding.languageFrLabel" },
                { code: "en", flag: "🇬🇧", labelKey: "onboarding.languageEnLabel" },
              ].map((opt) => {
                const selected = targetLanguage === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setTargetLanguage(opt.code)}
                    className={`p-6 rounded-xl border-2 transition-all focus-ring ${
                      selected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                        : "border-surface-200 dark:border-surface-700 hover:border-surface-300"
                    }`}
                  >
                    <div aria-hidden="true" className="text-5xl mb-2">{opt.flag}</div>
                    <div className="font-bold">{t(opt.labelKey)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-3">
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`relative text-left rounded-2xl border-2 px-5 py-4 transition-all focus-ring ${
                      active
                        ? "border-primary-400 dark:border-primary-600 bg-primary-50/60 dark:bg-primary-900/25 shadow-sm"
                        : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/15"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br ${m.tint} text-white flex items-center justify-center text-2xl shadow-sm`}>
                        {m.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="text-[15.5px] font-bold text-surface-900 dark:text-surface-50">
                            {t(`modes.${m.key}.title`)}
                          </h3>
                          <p className="text-[12px] text-surface-500 dark:text-surface-400 italic">
                            {t(`modes.${m.key}.tagline`)}
                          </p>
                        </div>
                        <p className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug mt-1">
                          {t(`modes.${m.key}.description`)}
                        </p>
                      </div>
                      {active && (
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {LEVEL_KEYS.map((key) => {
                  const active = level === key;
                  // levels.A1 = "A1: Beginner". The descriptor is the part after ": "
                  const fullLabel = t(`levels.${key}`);
                  const descriptor = fullLabel.includes(": ")
                    ? fullLabel.split(": ")[1]
                    : fullLabel.includes(" : ")
                    ? fullLabel.split(" : ")[1]
                    : fullLabel;
                  return (
                    <button
                      key={key}
                      onClick={() => setLevel(key)}
                      className={`relative rounded-xl border-2 px-3 py-3 text-center transition-all focus-ring ${
                        active
                          ? "border-primary-400 dark:border-primary-600 bg-primary-50/60 dark:bg-primary-900/25"
                          : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:border-primary-300 dark:hover:border-primary-700"
                      }`}
                    >
                      <p className="text-[18px] font-extrabold text-surface-900 dark:text-surface-50 leading-none">{key}</p>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-1">{descriptor}</p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border-2 border-dashed border-surface-200 dark:border-surface-700 px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[13px] font-semibold text-surface-900 dark:text-surface-50">
                    {t("onboarding.placementTitle")}
                  </p>
                  <p className="text-[12px] text-surface-500 dark:text-surface-400 mt-0.5">
                    {t("onboarding.placementSubtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowPlacementStub(true)}
                  className="text-[12px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline focus-ring rounded px-1"
                >
                  {t("onboarding.placementCta")} →
                </button>
              </div>

              <button
                onClick={() => setLevel("unsure")}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all focus-ring ${
                  level === "unsure"
                    ? "border-primary-400 dark:border-primary-600 bg-primary-50/60 dark:bg-primary-900/25"
                    : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:border-primary-300 dark:hover:border-primary-700"
                }`}
              >
                <p className="text-[13px] font-semibold text-surface-900 dark:text-surface-50">
                  {t("onboarding.placementUnsureLabel")}
                </p>
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[12.5px] text-danger-700 dark:text-danger-300 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between bg-surface-50/60 dark:bg-surface-900/60">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1 || submitting}
            className="text-[12.5px] font-semibold text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← {t("onboarding.back")}
          </button>

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2 rounded-xl text-[13px] font-bold bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
            >
              {t("onboarding.next")} →
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!mode}
              className="px-5 py-2 rounded-xl text-[13px] font-bold bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
            >
              {t("onboarding.next")} →
            </button>
          )}

          {step === 3 && (
            <button
              onClick={submit}
              disabled={!level || submitting}
              className="px-5 py-2 rounded-xl text-[13px] font-bold bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
            >
              {submitting ? t("common.saving") : t("onboarding.save")}
            </button>
          )}
        </div>
      </div>

      {/* Placement test stub, Phase 4 will replace with the real CEFR quiz. */}
      {showPlacementStub && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-surface-900 rounded-2xl shadow-2xl border border-surface-100 dark:border-surface-700 p-6 animate-fade-in-up">
            <div className="text-center">
              <span className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 text-white items-center justify-center text-2xl shadow-sm">
                🧪
              </span>
              <h3 className="font-editorial text-[22px] mt-4 text-surface-900 dark:text-surface-50">
                {t("onboarding.placementTitle")}
              </h3>
              <p className="text-[13px] text-surface-600 dark:text-surface-400 mt-2 leading-relaxed">
                {t("onboarding.placementStubBody")}
              </p>
            </div>
            <button
              onClick={() => setShowPlacementStub(false)}
              className="mt-5 w-full px-4 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-br from-primary-600 to-purple-700 text-white shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
