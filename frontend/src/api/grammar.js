import client from "./client";

export const getGrammarHub      = () => client.get("/grammar/hub/");
export const getGrammarTopics   = (params = {}) => client.get("/grammar/topics/", { params });
export const getGrammarTopic    = (slug) => client.get(`/grammar/topics/${slug}/`);
export const startGrammarSession = ({ topicId, mode = "drill" } = {}) =>
  client.post("/grammar/sessions/start/", { topic_id: topicId, mode });
export const submitGrammarAnswer = (sessionId, drillItemId, userAnswer, isCorrect) =>
  client.post(`/grammar/sessions/${sessionId}/answer/`, {
    drill_item_id: drillItemId,
    user_answer: userAnswer,
    is_correct: isCorrect,
  });
export const completeGrammarSession = (sessionId) =>
  client.post(`/grammar/sessions/${sessionId}/complete/`);
