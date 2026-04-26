import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { lookupWord, conjugateVerb } from "../api/dictionary";
import AudioPlayButton from "../components/AudioPlayButton";
import { staggerDelay } from "../hooks/useAnimations";
import { PageHeader } from "../components/ui";

const TENSE_ORDER = [
  "Présent",
  "Imparfait",
  "Passé composé",
  "Futur simple",
  "Conditionnel présent",
  "Subjonctif présent",
  "Impératif",
  "Plus-que-parfait",
];

const TENSE_COLORS = {
  "Présent":              "border-info-300 dark:border-info-700 bg-info-50 dark:bg-info-900/20",
  "Imparfait":            "border-warn-300 dark:border-warn-700 bg-warn-50 dark:bg-warn-900/20",
  "Passé composé":        "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20",
  "Futur simple":         "border-success-300 dark:border-success-700 bg-success-50 dark:bg-success-900/20",
  "Conditionnel présent": "border-danger-300 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/20",
  "Subjonctif présent":   "border-info-300 dark:border-info-700 bg-info-50 dark:bg-info-900/20",
  "Impératif":            "border-accent-300 dark:border-accent-700 bg-accent-50 dark:bg-accent-900/20",
  "Plus-que-parfait":     "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20",
};

const POS_COLORS = {
  noun:          "bg-info-100 dark:bg-info-900/40 text-info-700 dark:text-info-300",
  verb:          "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  adjective:     "bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300",
  adverb:        "bg-warn-100 dark:bg-warn-900/40 text-warn-700 dark:text-warn-300",
  pronoun:       "bg-danger-100 dark:bg-danger-900/40 text-danger-700 dark:text-danger-300",
  preposition:   "bg-info-100 dark:bg-info-900/40 text-info-700 dark:text-info-300",
  conjunction:   "bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300",
  interjection:  "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300",
};

function SearchBar({ value, onChange, onSubmit, loading, placeholder }) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 dark:text-surface-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3 border border-surface-200 dark:border-surface-600 rounded-xl text-base bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="btn-primary btn-lg shrink-0"
      >
        {loading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : "Search"}
      </button>
    </form>
  );
}

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function DictionaryResult({ result }) {
  const { word, part_of_speech, gender, register, definitions, examples, synonyms, antonyms, etymology } = result;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Word header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-display font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">{word}</h2>
          <AudioPlayButton text={word} />
        </div>
        <div className="flex flex-wrap gap-2">
          {part_of_speech && (
            <Badge className={POS_COLORS[part_of_speech] || "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300"}>
              {part_of_speech}
            </Badge>
          )}
          {gender && gender !== "null" && (
            <Badge className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300">
              {gender === "masculine" ? "masc." : gender === "feminine" ? "fém." : gender}
            </Badge>
          )}
          {register && register !== "neutral" && (
            <Badge className="bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400">
              {register}
            </Badge>
          )}
        </div>
      </div>

      {/* Definitions */}
      {definitions?.length > 0 && (
        <div>
          <h3 className="section-label mb-2.5">Definitions</h3>
          <ol className="space-y-2.5">
            {definitions.map((def, i) => (
              <li key={i} className="flex gap-3 animate-fade-in-up" style={staggerDelay(i, 60)}>
                <span className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5 shadow-sm">
                  {i + 1}
                </span>
                <div>
                  <p className="text-body text-surface-800 dark:text-surface-200 font-medium">{def.en}</p>
                  {def.fr && <p className="text-caption text-surface-500 dark:text-surface-400 mt-0.5 italic">{def.fr}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Examples */}
      {examples?.length > 0 && (
        <div>
          <h3 className="section-label mb-2.5">Examples</h3>
          <div className="space-y-2.5">
            {examples.map((ex, i) => (
              <div key={i} className="rounded-xl bg-primary-50/60 dark:bg-primary-900/20 border-l-4 border-primary-400 dark:border-primary-600 pl-4 pr-3 py-2.5 animate-fade-in-up" style={staggerDelay(i, 60)}>
                <div className="flex items-start gap-2">
                  <p className="text-sm text-surface-800 dark:text-surface-200 italic flex-1">{ex.fr}</p>
                  <AudioPlayButton text={ex.fr} />
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{ex.en}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synonyms & Antonyms */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {synonyms?.length > 0 && (
          <div>
            <h3 className="section-label mb-2.5">Synonyms</h3>
            <div className="flex flex-wrap gap-1.5">
              {synonyms.map((s, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {antonyms?.length > 0 && (
          <div>
            <h3 className="section-label mb-2.5">Antonyms</h3>
            <div className="flex flex-wrap gap-1.5">
              {antonyms.map((a, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Etymology */}
      {etymology && etymology !== "null" && (
        <div className="rounded-xl bg-gradient-to-br from-surface-50 to-primary-50/30 dark:from-surface-700/40 dark:to-primary-900/10 border border-surface-200 dark:border-surface-700 px-4 py-3">
          <h3 className="section-label mb-1.5 flex items-center gap-1.5"><span>📜</span> Etymology</h3>
          <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{etymology}</p>
        </div>
      )}
    </div>
  );
}

function ConjugationResult({ result }) {
  const { verb, auxiliary, past_participle, present_participle, tenses } = result;
  const [activeTab, setActiveTab] = useState(TENSE_ORDER[0]);

  const availableTenses = TENSE_ORDER.filter((t) => tenses?.[t]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Verb header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-display font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">{verb}</h2>
          <AudioPlayButton text={verb} />
        </div>
        <div className="flex flex-wrap gap-2">
          {auxiliary && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 text-xs">
              <span className="font-medium text-surface-600 dark:text-surface-300">auxiliary</span>
              <span className="font-bold text-primary-700 dark:text-primary-300">{auxiliary}</span>
            </span>
          )}
          {past_participle && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 text-xs">
              <span className="font-medium text-surface-600 dark:text-surface-300">past participle</span>
              <span className="font-bold text-purple-700 dark:text-purple-300">{past_participle}</span>
            </span>
          )}
          {present_participle && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 text-xs">
              <span className="font-medium text-surface-600 dark:text-surface-300">present participle</span>
              <span className="font-bold text-success-700 dark:text-success-300">{present_participle}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tense tabs */}
      <div className="flex flex-wrap gap-1.5">
        {availableTenses.map((tense) => (
          <button
            key={tense}
            onClick={() => setActiveTab(tense)}
            className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tense
                ? "text-white shadow-sm"
                : "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600"
            }`}
          >
            {activeTab === tense && <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600" />}
            <span className="relative z-10">{tense}</span>
          </button>
        ))}
      </div>

      {/* Active tense table */}
      {tenses?.[activeTab] && (
        <div className={`rounded-xl border-2 p-4 ${TENSE_COLORS[activeTab] || "border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"}`}>
          <h3 className="text-sm font-bold text-surface-700 dark:text-surface-200 mb-3">{activeTab}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(tenses[activeTab]).map(([pronoun, form]) => (
              <div key={pronoun} className="flex items-center justify-between gap-4 bg-white/60 dark:bg-surface-800/60 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-surface-500 dark:text-surface-400 shrink-0">{pronoun}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-surface-900 dark:text-surface-100">{form}</span>
                  <AudioPlayButton text={`${pronoun} ${form}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All tenses overview (collapsed) */}
      <details className="group">
        <summary className="text-xs font-medium text-surface-400 dark:text-surface-500 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none list-none flex items-center gap-1">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Show all tenses at once
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableTenses.map((tense) => (
            <div key={tense} className={`rounded-lg border p-3 ${TENSE_COLORS[tense] || ""}`}>
              <h4 className="text-xs font-bold text-surface-600 dark:text-surface-300 mb-2">{tense}</h4>
              <div className="space-y-1">
                {Object.entries(tenses[tense]).map(([pronoun, form]) => (
                  <div key={pronoun} className="flex justify-between text-xs">
                    <span className="text-surface-500 dark:text-surface-400">{pronoun}</span>
                    <span className="font-semibold text-surface-800 dark:text-surface-200">{form}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default function Dictionary() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "conjugator" ? "conjugator" : "dictionary");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "conjugator") setTab("conjugator");
  }, [searchParams]);

  // Dictionary state
  const [dictInput, setDictInput] = useState(searchParams.get("word") || "");
  const [dictLoading, setDictLoading] = useState(false);
  const [dictResult, setDictResult] = useState(null);
  const [dictError, setDictError] = useState(null);

  // Conjugator state
  const [conjInput, setConjInput] = useState(searchParams.get("verb") || "");
  const [conjLoading, setConjLoading] = useState(false);
  const [conjResult, setConjResult] = useState(null);
  const [conjError, setConjError] = useState(null);

  const QUICK_WORDS = ["bonjour", "amour", "liberté", "belle", "espoir", "joie"];
  const QUICK_VERBS = ["être", "avoir", "aller", "faire", "vouloir", "pouvoir", "prendre", "venir"];

  const handleDictSubmit = async (e) => {
    e?.preventDefault();
    const word = dictInput.trim();
    if (!word) return;
    setDictLoading(true);
    setDictError(null);
    setDictResult(null);
    try {
      const res = await lookupWord(word);
      setDictResult(res.data.result);
    } catch (err) {
      setDictError(err.response?.data?.detail || "Lookup failed. Please try again.");
    } finally {
      setDictLoading(false);
    }
  };

  const handleConjSubmit = async (e) => {
    e?.preventDefault();
    const verb = conjInput.trim();
    if (!verb) return;
    setConjLoading(true);
    setConjError(null);
    setConjResult(null);
    try {
      const res = await conjugateVerb(verb);
      setConjResult(res.data.result);
    } catch (err) {
      setConjError(err.response?.data?.detail || "Conjugation failed. Please try again.");
    } finally {
      setConjLoading(false);
    }
  };

  // Auto-search if word or verb param is present on mount
  useEffect(() => {
    const w = searchParams.get("word");
    const v = searchParams.get("verb");
    if (w) {
      setTab("dictionary");
      setDictLoading(true);
      lookupWord(w)
        .then((res) => setDictResult(res.data.result))
        .catch((err) => setDictError(err.response?.data?.detail || "Lookup failed."))
        .finally(() => setDictLoading(false));
    } else if (v) {
      setTab("conjugator");
      setConjLoading(true);
      conjugateVerb(v)
        .then((res) => setConjResult(res.data.result))
        .catch((err) => setConjError(err.response?.data?.detail || "Conjugation failed."))
        .finally(() => setConjLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const quickLookup = (word) => {
    setDictInput(word);
    setTab("dictionary");
    setTimeout(() => {
      setDictLoading(true);
      setDictError(null);
      setDictResult(null);
      lookupWord(word)
        .then((res) => setDictResult(res.data.result))
        .catch((err) => setDictError(err.response?.data?.detail || "Lookup failed."))
        .finally(() => setDictLoading(false));
    }, 0);
  };

  const quickConjugate = (verb) => {
    setConjInput(verb);
    setTab("conjugator");
    setTimeout(() => {
      setConjLoading(true);
      setConjError(null);
      setConjResult(null);
      conjugateVerb(verb)
        .then((res) => setConjResult(res.data.result))
        .catch((err) => setConjError(err.response?.data?.detail || "Conjugation failed."))
        .finally(() => setConjLoading(false));
    }, 0);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Lookup"
        title="Dictionary"
        subtitle="Look up French words and conjugate any verb in seconds."
        icon="📖"
        gradient
      />

      {/* Tabs */}
      <div className="card p-1.5 mb-5 inline-flex">
        <button
          onClick={() => setTab("dictionary")}
          className={`relative px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "dictionary"
              ? "text-white shadow-sm"
              : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
          }`}
        >
          {tab === "dictionary" && <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600" />}
          <span className="relative z-10">📖 Dictionary</span>
        </button>
        <button
          onClick={() => setTab("conjugator")}
          className={`relative px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "conjugator"
              ? "text-white shadow-sm"
              : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
          }`}
        >
          {tab === "conjugator" && <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-info-500 to-primary-600" />}
          <span className="relative z-10">✏️ Verb conjugator</span>
        </button>
      </div>

      {/* Dictionary tab */}
      {tab === "dictionary" && (
        <div className="space-y-5">
          <SearchBar
            value={dictInput}
            onChange={setDictInput}
            onSubmit={handleDictSubmit}
            loading={dictLoading}
            placeholder="Enter a French word… e.g. maison, beau, courir"
          />

          {/* Quick words */}
          {!dictResult && !dictLoading && (
            <div>
              <p className="section-label mb-2">Try a word</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_WORDS.map((w, i) => (
                  <button
                    key={w}
                    onClick={() => quickLookup(w)}
                    style={staggerDelay(i, 50)}
                    className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 hover:scale-105 transition-all animate-fade-in-up active:scale-95"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dictLoading && (
            <div className="card p-10 flex flex-col items-center gap-3 text-surface-500 dark:text-surface-400">
              <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm font-medium">Looking up word…</p>
            </div>
          )}

          {dictError && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-4 text-sm text-danger-700 dark:text-danger-400 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
              <span>{dictError}</span>
            </div>
          )}

          {dictResult && !dictLoading && (
            <div className="card relative overflow-hidden p-6 animate-scale-in">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-info-500" />
              <DictionaryResult result={dictResult} />
              {dictResult.part_of_speech === "verb" && (
                <div className="mt-5 pt-4 border-t border-surface-100 dark:border-surface-700">
                  <button
                    onClick={() => quickConjugate(dictResult.word)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:gap-2 transition-all"
                  >
                    Conjugate &ldquo;{dictResult.word}&rdquo;
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conjugator tab */}
      {tab === "conjugator" && (
        <div className="space-y-5">
          <SearchBar
            value={conjInput}
            onChange={setConjInput}
            onSubmit={handleConjSubmit}
            loading={conjLoading}
            placeholder="Enter a French verb… e.g. avoir, manger, partir"
          />

          {/* Quick verbs */}
          {!conjResult && !conjLoading && (
            <div>
              <p className="section-label mb-2">Common verbs</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_VERBS.map((v, i) => (
                  <button
                    key={v}
                    onClick={() => quickConjugate(v)}
                    style={staggerDelay(i, 50)}
                    className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-info-400 hover:bg-info-50 dark:hover:bg-info-900/20 hover:text-info-700 dark:hover:text-info-300 hover:scale-105 transition-all animate-fade-in-up active:scale-95"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conjLoading && (
            <div className="card p-10 flex flex-col items-center gap-3 text-surface-500 dark:text-surface-400">
              <svg className="w-8 h-8 animate-spin text-info-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm font-medium">Conjugating verb…</p>
            </div>
          )}

          {conjError && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-4 text-sm text-danger-700 dark:text-danger-400 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
              <span>{conjError}</span>
            </div>
          )}

          {conjResult && !conjLoading && (
            <div className="card relative overflow-hidden p-6 animate-scale-in">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-info-500 via-primary-500 to-purple-500" />
              <ConjugationResult result={conjResult} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
