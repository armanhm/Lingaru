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

// EE/EO grading is async on the backend (Celery + LLM). Poll this until
// status leaves "pending". Backend returns 202 with { response_id, status,
// poll_url } when the response is queued; this helper fetches the latest.
export const getExamResponseGrading = (responseId) =>
  client.get(`/exam-prep/responses/${responseId}/grading/`);

/**
 * Poll the grading endpoint until grading is "done" or "failed", or until
 * `timeoutMs` elapses. Returns the final payload (which includes the
 * `grading` dict on success). Throws on timeout so callers can show a
 * "still grading…" toast and retry.
 *
 * The interval grows mildly (500ms → 1500ms) so quick-finishing grades
 * resolve fast and slow ones don't hammer the server.
 */
export async function pollExamGrading(responseId, { timeoutMs = 60000 } = {}) {
  const start = Date.now();
  let delay = 500;
  while (Date.now() - start < timeoutMs) {
    const { data } = await getExamResponseGrading(responseId);
    if (data.status !== "pending") return data;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(1500, delay + 250);
  }
  throw new Error("exam grading timed out");
}

export const completeExamSession = (sessionId) =>
  client.post(`/exam-prep/sessions/${sessionId}/complete/`);

export const getExamHistory = (section) =>
  client.get("/exam-prep/sessions/history/", { params: { section: section || undefined } });
