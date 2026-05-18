/**
 * Feature availability per target language.
 *
 * Static fact about the app version. Frontend-only registry (no API call)
 * because feature availability is the same for everyone on a given
 * deployment, not a per-tenant flag.
 *
 * When a feature ships for English (Phase L3 = grammar, L4 = exam_prep,
 * L6 = gender_snap/conjugation alternatives), flip the bool here.
 */
const AVAILABILITY = {
  exam_prep:       { fr: true, en: false },
  grammar_booster: { fr: true, en: false },
  gender_snap:     { fr: true, en: false },
  conjugation:     { fr: true, en: false },
};

export function isAvailable(feature, language) {
  return AVAILABILITY[feature]?.[language] ?? true;
}
