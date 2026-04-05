import client from "./client";

export const getSRSDueCards = (limit = 20) =>
  client.get("/progress/srs/due/", { params: { limit } });

export const submitSRSReview = (cardId, quality) =>
  client.post("/progress/srs/review/", { card_id: cardId, quality });

export const getMistakes = (params = {}) =>
  client.get("/progress/mistakes/", { params });

export const markMistakesReviewed = (mistakeIds) =>
  client.post("/progress/mistakes/reviewed/", { mistake_ids: mistakeIds });

export const getConjugationVerbs = () =>
  client.get("/progress/conjugation/verbs/");

export const checkConjugation = (verb, tense, subject, answer) =>
  client.post("/progress/conjugation/check/", { verb, tense, subject, answer });

export const completeLesson = (lessonId, score, totalQuestions) =>
  client.post(`/progress/lessons/${lessonId}/complete/`, {
    score,
    total_questions: totalQuestions,
  });

export const getTopicProgress = (topicId) =>
  client.get(`/progress/topics/${topicId}/`);
