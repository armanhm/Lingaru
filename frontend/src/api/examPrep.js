import client from "./client";

export const getExamHub = () => client.get("/exam-prep/hub/");

export const getExamExercises = (section, level) =>
  client.get("/exam-prep/exercises/", { params: { section, level: level || undefined } });

export const startExamSession = (section, cefrLevel, mode = "practice") =>
  client.post("/exam-prep/sessions/start/", { section, cefr_level: cefrLevel, mode });

export const submitExamResponse = (sessionId, exerciseId, questionIndex, answer) =>
  client.post(`/exam-prep/sessions/${sessionId}/respond/`, {
    exercise_id: exerciseId,
    question_index: questionIndex,
    answer,
  });

export const completeExamSession = (sessionId) =>
  client.post(`/exam-prep/sessions/${sessionId}/complete/`);

export const getExamHistory = (section) =>
  client.get("/exam-prep/sessions/history/", { params: { section: section || undefined } });
