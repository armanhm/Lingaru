import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { lookupWord, conjugateVerb } from "../api/dictionary";
import AudioPlayButton from "../components/AudioPlayButton";
import { staggerDelay } from "../hooks/useAnimations";

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
  "Présent":              "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20",
  "Imparfait":            "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20",
  "Passé composé":        "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20",
  "Futur simple":         "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20",
  "Conditionnel présent": "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20",
  "Subjonctif présent":   "border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20",
  "Impératif":            "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20",
  "Plus-que-parfait":     "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20",
};

const POS_COLORS = {
  noun:          "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  verb:          "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  adjective:     "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  adverb:        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  pronoun:       "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  preposition:   "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
  conjunction:   "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  interjection:  "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300",
};

function SearchBar({ value, onChange, onSubmit, loading, placeholder }) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{word}</h2>
          <AudioPlayButton text={word} />
        </div>
        <div className="flex flex-wrap gap-2">
          {part_of_speech && (
            <Badge className={POS_COLORS[part_of_speech] || "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}>
              {part_of_speech}
            </Badge>
          )}
          {gender && gender !== "null" && (
            <Badge className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300">
              {gender === "masculine" ? "masc." : gender === "feminine" ? "fém." : gender}
            </Badge>
          )}
          {register && register !== "neutral" && (
            <Badge className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {register}
            </Badge>
          )}
        </div>
      </div>

      {/* Definitions */}
      {definitions?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Definitions</h3>
          <ol className="space-y-2">
            {definitions.map((def, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-gray-800 dark:text-gray-200 text-sm font-medium">{def.en}</p>
                  {def.fr && <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 italic">{def.fr}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Examples */}
      {examples?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Examples</h3>
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <div key={i} className="border-l-2 border-primary-200 dark:border-primary-800 pl-3">
                <div className="flex items-start gap-2">
                  <p className="text-sm text-gray-800 dark:text-gray-200 italic flex-1">{ex.fr}</p>
                  <AudioPlayButton text={ex.fr} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ex.en}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synonyms & Antonyms */}
      <div className="grid grid-cols-2 gap-4">
        {synonyms?.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Synonyms</h3>
            <div className="flex flex-wrap gap-1.5">
              {synonyms.map((s, i) => (
                <span key={i} className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {antonyms?.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Antonyms</h3>
            <div className="flex flex-wrap gap-1.5">
              {antonyms.map((a, i) => (
                <span key={i} className="px-2.5 py-1 text-xs rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Etymology */}
      {etymology && etymology !== "null" && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Etymology</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">{etymology}</p>
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
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{verb}</h2>
          <AudioPlayButton text={verb} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
          {auxiliary && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">auxiliary:</span>
              <span className="font-bold text-primary-600 dark:text-primary-400">{auxiliary}</span>
            </span>
          )}
          {past_participle && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">past participle:</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">{past_participle}</span>
            </span>
          )}
          {present_participle && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">present participle:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{present_participle}</span>
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tense
                ? "bg-primary-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {tense}
          </button>
        ))}
      </div>

      {/* Active tense table */}
      {tenses?.[activeTab] && (
        <div className={`rounded-xl border-2 p-4 ${TENSE_COLORS[activeTab] || "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"}`}>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">{activeTab}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(tenses[activeTab]).map(([pronoun, form]) => (
              <div key={pronoun} className="flex items-center justify-between gap-4 bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{pronoun}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{form}</span>
                  <AudioPlayButton text={`${pronoun} ${form}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All tenses overview (collapsed) */}
      <details className="group">
        <summary className="text-xs font-medium text-gray-400 dark:text-gray-500 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none list-none flex items-center gap-1">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Show all tenses at once
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableTenses.map((tense) => (
            <div key={tense} className={`rounded-lg border p-3 ${TENSE_COLORS[tense] || ""}`}>
              <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">{tense}</h4>
              <div className="space-y-1">
                {Object.entries(tenses[tense]).map(([pronoun, form]) => (
                  <div key={pronoun} className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{pronoun}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{form}</span>
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dictionary</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Look up French words and conjugate verbs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setTab("dictionary")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "dictionary"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          📖 Dictionary
        </button>
        <button
          onClick={() => setTab("conjugator")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === "conjugator"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          ✏️ Verb Conjugator
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
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">Try a word:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_WORDS.map((w, i) => (
                  <button
                    key={w}
                    onClick={() => quickLookup(w)}
                    style={staggerDelay(i, 50)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 hover:scale-105 transition-all animate-fade-in-up"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dictLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm">Looking up word…</p>
            </div>
          )}

          {dictError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
              {dictError}
            </div>
          )}

          {dictResult && !dictLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 animate-scale-in">
              <DictionaryResult result={dictResult} />
              {/* Link to conjugator if it's a verb */}
              {dictResult.part_of_speech === "verb" && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => quickConjugate(dictResult.word)}
                    className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Conjugate &ldquo;{dictResult.word}&rdquo; →
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
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">Common verbs:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_VERBS.map((v, i) => (
                  <button
                    key={v}
                    onClick={() => quickConjugate(v)}
                    style={staggerDelay(i, 50)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 hover:scale-105 transition-all animate-fade-in-up"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conjLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm">Conjugating verb…</p>
            </div>
          )}

          {conjError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
              {conjError}
            </div>
          )}

          {conjResult && !conjLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 animate-scale-in">
              <ConjugationResult result={conjResult} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
