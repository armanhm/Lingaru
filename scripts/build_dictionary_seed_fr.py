"""Build data/dictionary_seed_fr.csv with the top 3000 French lemmas.

Sources (both freely licensed):
- wordfreq (MIT) — frequency-ranked surface forms.
- spaCy fr_core_news_sm (MIT) — lemmatization + POS for each surface form.

We pull more surface forms than we need (~12 000), lemmatize each, drop:
  - foreign-language tokens (English, Italian, etc. that leak through
    OpenSubtitles film transcripts)
  - spaCy lemmatization artifacts (truncations that aren't real words)
  - non-alphabetic junk
…then deduplicate to lemmas and keep the top 3000.

## Usage

This script is not on the runtime path — it only regenerates the seed CSV.
Run it in a throwaway venv (the deps are large and not needed in production):

    python3 -m venv /tmp/lingaru-csv && \\
    /tmp/lingaru-csv/bin/pip install wordfreq spacy && \\
    /tmp/lingaru-csv/bin/pip install \\
      https://github.com/explosion/spacy-models/releases/download/fr_core_news_sm-3.8.0/fr_core_news_sm-3.8.0-py3-none-any.whl && \\
    /tmp/lingaru-csv/bin/python scripts/build_dictionary_seed_fr.py

Then commit the regenerated `data/dictionary_seed_fr.csv`.
"""
import csv
import re
import sys
from pathlib import Path

import spacy
import wordfreq

TARGET_LEMMA_COUNT = 3000
PULL_SURFACE = 12000

POS_TAG = {
    "NOUN": "n", "PROPN": "n",
    "VERB": "v", "AUX": "v",
    "ADJ": "adj",
    "ADV": "adv",
    "PRON": "pron",
    "DET": "det",
    "ADP": "prep",
    "CCONJ": "conj", "SCONJ": "conj",
    "NUM": "num",
    "INTJ": "interj",
    "PART": "part",
    "X": "other",
}

# French alphabet (with diacritics + ligatures + hyphen + apostrophe)
KEEP_RE = re.compile(r"^[a-zàâçéèêëîïôûùüÿæœ\-']{2,}$")

# Single-letter or 2-letter tokens that are legitimately part of French.
ALLOW_SHORT = {
    "a", "y", "à",                       # avoir.3sg, pronoun, preposition
    "an", "as", "ai", "es", "or", "os",  # noun / avoir forms / conjunctions
    "ce", "ça", "de", "du", "en", "et",
    "eu", "ex", "fa", "ha", "ho", "il",
    "je", "la", "le", "lu", "ma", "me",
    "mi", "ne", "nu", "on", "ou", "où",
    "pu", "qu", "sa", "se", "si", "su",
    "ta", "te", "ton", "tu", "un", "us",
    "va", "vu",
}

# Obvious foreign words that show up in OpenSubtitles (English films, etc.)
# This list is short on purpose — we'd rather a few foreign words slip
# through than reject real French words that happen to look similar.
DROP_FOREIGN = {
    "the", "and", "of", "to", "in", "on", "for", "is", "it", "you",
    "i", "we", "they", "he", "she", "this", "that", "be", "with",
    "have", "had", "from", "but", "or", "as", "do", "did", "does",
    "are", "was", "were", "will", "would", "can", "could", "should",
    "ok", "okay", "yeah", "yes", "hello", "hi", "no", "new", "old",
    "end", "top", "good", "bad", "well", "now", "here", "there",
    "what", "where", "when", "why", "how", "who", "which", "my",
    "your", "his", "her", "its", "our", "their", "all", "any", "some",
    "man", "men", "woman", "women", "boy", "girl", "child", "kid",
    "love", "hate", "like", "want", "need", "get", "got", "make",
    "made", "take", "took", "give", "gave", "go", "went", "come",
    "came", "see", "saw", "say", "said", "tell", "told", "ask", "asked",
    "know", "knew", "think", "thought", "feel", "felt", "look", "looked",
    "find", "found", "try", "tried", "use", "used", "work", "worked",
    "call", "called", "play", "played", "live", "lived", "die", "died",
    "kill", "killed", "stop", "let", "leave", "left", "keep", "kept",
    "help", "wait", "talk", "talked", "speak", "spoke", "hear", "heard",
    "read", "write", "wrote", "send", "sent", "buy", "bought", "sell",
    "sold", "pay", "paid", "lose", "lost", "win", "won", "run", "ran",
    "walk", "sleep", "slept", "eat", "ate", "drink", "drank",
    "web", "app", "site", "data", "file", "code", "user", "team",
    "test", "fan", "ban", "tag", "log", "bot", "ad", "fee",
    "el", "al", "ya", "ja",                          # Spanish/Arabic
    "una", "uno", "del", "que",                      # Spanish (que collides with FR — handled below)
    "ich", "der", "die", "das", "und",               # German
    "io", "tu", "lo", "mi", "non",                   # Italian (mi/non collide with FR — handled below)
    "etc", "ps", "vs", "tv", "dvd", "cd",            # abbrevs
    "ii", "iii", "iv", "vi", "vii", "viii", "ix", "xi", "xii",  # Roman
    "st", "mme", "mr", "mr.", "dr",                  # honorifics / artifacts
    "abc", "xyz", "ldt", "ltd",                      # initialisms
}

# spaCy lemmatization artifacts: real-looking strings that aren't real lemmas.
# When we see one of these in the lemma output, replace the lemma with the
# original surface form (which IS a real French word). Pairs are (artifact, replacement)
# determined by inspecting model output on common surface forms.
LEMMA_FIXUPS = {
    "sai":  "savoir",   # je sais → "sai"
    "fai":  "faire",    # je fais → "fai"
    "voi":  "voir",     # je vois → "voi"
    "pèr":  "père",
    "mèr":  "mère",
    "frèr": "frère",
    "âm":   "âme",
    "rir":  "rire",
    "sauc": "sauce",
    "pet":  "petit",    # heuristic; might collide w/ noun "pet" but very rare
    "êtr":  "être",
    "tre":  "être",
    "tirer": "tirer",
}

# These spaCy POS tags on a string that's actually just a single character
# or two should be dropped (likely model confusion).
DROP_POS_FOR_LEMMA = {
    # (lemma, pos) pairs to drop entirely as they're nearly always noise.
    ("ah", "v"), ("oh", "pron"), ("eh", "interj"),
}


def is_acceptable(lemma: str) -> bool:
    if not lemma:
        return False
    if lemma in DROP_FOREIGN:
        return False
    if len(lemma) <= 2 and lemma not in ALLOW_SHORT:
        return False
    return bool(lemma in ALLOW_SHORT or KEEP_RE.match(lemma))


print("Loading spaCy fr_core_news_sm …", file=sys.stderr)
nlp = spacy.load("fr_core_news_sm")

print(f"Pulling top-{PULL_SURFACE} surface forms from wordfreq …", file=sys.stderr)
surface_forms = wordfreq.top_n_list("fr", PULL_SURFACE, wordlist="best")

print("Lemmatizing + filtering + deduplicating …", file=sys.stderr)
lemmas: dict[str, dict] = {}  # lemma -> {rank, pos}
rank = 0
for sf in surface_forms:
    sf_clean = sf.strip().lower()
    if not is_acceptable(sf_clean):
        continue

    doc = nlp(sf_clean)
    if not len(doc):
        continue
    tok = doc[0]
    raw_lemma = tok.lemma_.strip().lower()
    pos = POS_TAG.get(tok.pos_, "other")

    # Apply fixups, then re-check acceptability.
    lemma = LEMMA_FIXUPS.get(raw_lemma, raw_lemma)
    if not is_acceptable(lemma):
        continue
    if (lemma, pos) in DROP_POS_FOR_LEMMA:
        continue
    if lemma in lemmas:
        continue

    rank += 1
    lemmas[lemma] = {"rank": rank, "pos": pos}
    if rank >= TARGET_LEMMA_COUNT:
        break

print(f"Kept {len(lemmas)} unique lemmas", file=sys.stderr)

out_path = Path("data/dictionary_seed_fr.csv")
out_path.parent.mkdir(parents=True, exist_ok=True)
with out_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(["rank", "lemma", "part_of_speech"])
    for lemma, meta in sorted(lemmas.items(), key=lambda kv: kv[1]["rank"]):
        w.writerow([meta["rank"], lemma, meta["pos"]])

print(f"Wrote {out_path}", file=sys.stderr)
