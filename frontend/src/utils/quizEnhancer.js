/**
 * Quiz Enhancer: generates diverse question types from standard quiz questions
 * and lesson vocabulary. Runs client-side, no new backend endpoints needed.
 *
 * Takes the standard questions from the backend and enriches them with
 * interactive question types: match_pairs, odd_one_out, reorder, error_detect, listen_choose
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

/**
 * Generate a "match_pairs" question from vocabulary-based MCQ questions.
 * Groups 4 word pairs (french→english) for the user to match.
 */
function generateMatchPairs(vocabQuestions) {
  // Need at least 4 questions to form pairs
  const candidates = vocabQuestions.filter(
    (q) => q.correct_answer && q.prompt
  );
  if (candidates.length < 4) return null;

  const selected = pickRandom(candidates, 4);
  const pairs = selected.map((q) => {
    // Prompt is usually the French word/phrase, correct_answer is English
    // Or for translate type: prompt is English, answer is French
    if (q.type === "translate") {
      return { french: q.correct_answer, english: q.prompt.replace(/^Translate:\s*/i, "").replace(/^"(.+)"$/, "$1") };
    }
    // For MCQ: prompt often contains the French word
    const frenchMatch = q.prompt.match(/[""«](.+?)[""»]/);
    if (frenchMatch) {
      return { french: frenchMatch[1], english: q.correct_answer };
    }
    return { french: q.prompt, english: q.correct_answer };
  });

  return {
    id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "match_pairs",
    pairs,
    // For answer tracking, we count this as one question
    correct_answer: "all_matched",
  };
}

/**
 * Generate an "odd_one_out" question from vocabulary.
 * Picks 3 words of the same part_of_speech/gender and 1 different one.
 */
function generateOddOneOut(vocabQuestions) {
  if (vocabQuestions.length < 4) return null;

  // Group by whether they have options (MCQ type)
  const mcqs = vocabQuestions.filter((q) => q.options && q.options.length >= 3);
  if (mcqs.length === 0) return null;

  // Take one question's correct + wrong answers as the "same" group, and find an outlier
  const q = mcqs[Math.floor(Math.random() * mcqs.length)];
  const same = [q.correct_answer, ...q.options.filter((o) => o !== q.correct_answer).slice(0, 2)];
  // Pick an outlier from a different question
  const others = vocabQuestions.filter((oq) => oq.id !== q.id && oq.correct_answer && !same.includes(oq.correct_answer));
  if (others.length === 0) return null;

  const odd = others[Math.floor(Math.random() * others.length)].correct_answer;

  const words = shuffle([
    ...same.map((t) => ({ text: t, isOdd: false })),
    { text: odd, isOdd: true },
  ]);

  return {
    id: `odd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "odd_one_out",
    words,
    category: q.prompt.replace(/^(What|Which|How|Translate|Choose).+?\??\s*/i, "").slice(0, 60) || "same category",
    correct_answer: odd,
  };
}

/**
 * Generate a "reorder" question from fill_blank or translate questions.
 * Takes a sentence and scrambles its words.
 */
function generateReorder(questions) {
  // Look for questions with sentence-length answers (3+ words)
  const candidates = questions.filter((q) => {
    const words = q.correct_answer.trim().split(/\s+/);
    return words.length >= 3 && words.length <= 10;
  });
  if (candidates.length === 0) return null;

  const q = candidates[Math.floor(Math.random() * candidates.length)];
  const sentence = q.correct_answer.trim();
  const words = sentence.split(/\s+/);

  return {
    id: `reorder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "reorder",
    words,
    correctSentence: sentence,
    prompt: q.prompt,
    correct_answer: sentence,
  };
}

/**
 * Generate an "error_detect" question from translate/fill_blank questions.
 * Takes a correct sentence and introduces one error.
 */
function generateErrorDetect(questions) {
  const candidates = questions.filter((q) => {
    const words = q.correct_answer.trim().split(/\s+/);
    return words.length >= 3 && words.length <= 12;
  });
  if (candidates.length < 2) return null;

  const q = candidates[Math.floor(Math.random() * candidates.length)];
  const sentenceWords = q.correct_answer.trim().split(/\s+/);

  // Pick a random word to replace (not the first or last for better UX)
  const errorIdx = 1 + Math.floor(Math.random() * Math.max(1, sentenceWords.length - 2));
  const correctWord = sentenceWords[errorIdx];

  // Find a replacement word from another question
  const others = questions.filter((oq) => oq.id !== q.id);
  let replacement = correctWord;
  for (const other of shuffle(others)) {
    const otherWords = other.correct_answer.split(/\s+/);
    const candidate = otherWords.find(
      (w) => w.toLowerCase() !== correctWord.toLowerCase() && w.length > 1
    );
    if (candidate) {
      replacement = candidate;
      break;
    }
  }
  if (replacement === correctWord) return null; // Couldn't find a replacement

  const errorSentence = sentenceWords.map((w, i) =>
    i === errorIdx ? replacement : w
  );

  return {
    id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "error_detect",
    words: errorSentence.map((w, i) => ({
      text: w,
      isError: i === errorIdx,
    })),
    correctWord,
    prompt: q.prompt,
    correct_answer: correctWord,
  };
}

/**
 * Generate a "listen_choose" question from MCQ vocabulary questions.
 */
function generateListenChoose(questions) {
  const mcqs = questions.filter(
    (q) => q.type === "mcq" && q.options && q.options.length >= 3
  );
  if (mcqs.length === 0) return null;

  const q = mcqs[Math.floor(Math.random() * mcqs.length)];
  // Extract the French word from the prompt
  const frenchMatch = q.prompt.match(/[""«](.+?)[""»]/);
  const word = frenchMatch ? frenchMatch[1] : q.correct_answer;

  return {
    id: `listen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "listen_choose",
    word,
    options: shuffle(q.options.slice(0, 4)),
    correct_answer: q.correct_answer,
  };
}

/**
 * Enhance a standard question set with diverse interactive types.
 * Inserts 2-4 enhanced questions spread throughout the quiz.
 */
export function enhanceQuestions(standardQuestions) {
  if (standardQuestions.length < 4) return standardQuestions;

  const enhanced = [...standardQuestions];
  const generators = [
    () => generateMatchPairs(standardQuestions),
    () => generateOddOneOut(standardQuestions),
    () => generateReorder(standardQuestions),
    () => generateErrorDetect(standardQuestions),
    () => generateListenChoose(standardQuestions),
  ];

  // Try to generate 2-3 enhanced questions
  const toInsert = [];
  const shuffledGens = shuffle(generators);
  for (const gen of shuffledGens) {
    if (toInsert.length >= 3) break;
    const q = gen();
    if (q) toInsert.push(q);
  }

  // Insert enhanced questions at evenly spaced positions
  for (let i = 0; i < toInsert.length; i++) {
    const pos = Math.min(
      enhanced.length,
      Math.floor(((i + 1) / (toInsert.length + 1)) * enhanced.length)
    );
    enhanced.splice(pos + i, 0, toInsert[i]); // +i to account for previous insertions
  }

  return enhanced;
}
