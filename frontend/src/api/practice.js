import client from "./client";

export const startQuiz = (lessonId) =>
  client.post("/practice/quiz/start/", { lesson_id: lessonId });

export const submitAnswer = (sessionId, questionId, answer) =>
  client.post(`/practice/quiz/${sessionId}/answer/`, {
    question_id: questionId,
    answer,
  });

export const completeQuiz = (sessionId) =>
  client.post(`/practice/quiz/${sessionId}/complete/`);

export const getQuizHistory = () =>
  client.get("/practice/quiz/history/");
