import { useEffect, useState } from "react";
import Confetti from "./Confetti";

/**
 * Unified "done screen" hero. Sequences animations so the moment lands:
 *   emoji bounce → headline fade → stats stagger → actions fade
 *
 * Props:
 *   emoji, headline, subline, stats: [{value, label, color?}], actions,
 *   celebrate: boolean — fire confetti burst
 *   tone: 'celebratory' | 'neutral' | 'retry'
 */
const TONE = {
  celebratory: { from: "from-primary-500", via: "via-accent-500", to: "to-success-500" },
  neutral:     { from: "from-primary-500", via: "via-primary-400", to: "to-info-500"    },
  retry:       { from: "from-warn-500",    via: "via-accent-500", to: "to-primary-500"  },
};

export default function TriumphHero({
  emoji,
  headline,
  subline,
  stats = [],
  actions,
  celebrate = false,
  tone = "celebratory",
  extra,
}) {
  const [step, setStep] = useState(0); // 0 emoji, 1 heading, 2 stats, 3 actions

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 350);
    const t2 = setTimeout(() => setStep(2), 650);
    const t3 = setTimeout(() => setStep(3), 950);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const toneCfg = TONE[tone] || TONE.celebratory;

  return (
    <div className="relative max-w-xl mx-auto py-10 sm:py-16 px-4 text-center">
      {celebrate && <Confetti count={60} duration={2000} />}

      {/* Radial glow behind the emoji */}
      <div className="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
        <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${toneCfg.from} ${toneCfg.via} ${toneCfg.to} opacity-20 blur-3xl`} />
      </div>

      {/* Emoji — pops in first */}
      <div className="relative text-7xl sm:text-8xl mb-4 inline-block animate-bounce-in" aria-hidden="true">
        {emoji}
      </div>

      {/* Headline — fades in after emoji */}
      <h2
        className={`relative text-h1 sm:text-display bg-gradient-to-r ${toneCfg.from} ${toneCfg.via} ${toneCfg.to} bg-clip-text text-transparent transition-all duration-500 ${
          step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {headline}
      </h2>

      {subline && (
        <p className={`relative mt-3 text-body-lg text-surface-600 dark:text-surface-400 max-w-md mx-auto transition-all duration-500 delay-100 ${
          step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}>
          {subline}
        </p>
      )}

      {/* Stats — stagger in */}
      {stats.length > 0 && (
        <div className="relative mt-8 card card-elevated p-6 sm:p-8">
          <div className={`flex justify-center gap-6 sm:gap-10 flex-wrap transition-all duration-500 ${
            step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}>
            {stats.map((s, i) => (
              <div
                key={i}
                className="text-center transition-all duration-500"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <p className={`text-display font-extrabold tracking-tight ${s.color || "text-surface-900 dark:text-surface-100"}`}>
                  {s.value}
                </p>
                <p className="text-eyebrow uppercase text-surface-500 dark:text-surface-400 mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          {extra && (
            <div className={`transition-all duration-500 delay-200 ${step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
              {extra}
            </div>
          )}
        </div>
      )}

      {/* Actions — fade last */}
      {actions && (
        <div className={`relative mt-6 flex items-center justify-center gap-3 flex-wrap transition-all duration-500 ${
          step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}>
          {actions}
        </div>
      )}
    </div>
  );
}
