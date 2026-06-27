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

// Error subclass so callers can branch on .code without parsing strings.
// `code` is one of "timeout" | "not_found" | "server" | "network".
export class ExamGradingPollError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExamGradingPollError";
    this.code = code;
  }
}

/**
 * Poll the grading endpoint until grading is "done" or "failed", or until
 * `timeoutMs` elapses. Returns the final payload (which includes the
 * `grading` dict on success).
 *
 * The interval grows mildly (500ms → 1500ms) so quick-finishing grades
 * resolve fast and slow ones don't hammer the server.
 *
 * Distinguishes failure modes via `ExamGradingPollError.code`:
 *   - "timeout"   — we polled until `timeoutMs` without leaving pending
 *   - "not_found" — server returned 404 (response was deleted)
 *   - "server"    — 5xx (grading service is unavailable)
 *   - "network"   — request failed before we got an HTTP status
 */
export async function pollExamGrading(responseId, { timeoutMs = 60000 } = {}) {
  const start = Date.now();
  let delay = 500;
  while (Date.now() - start < timeoutMs) {
    let data;
    try {
      ({ data } = await getExamResponseGrading(responseId));
    } catch (err) {
      const httpStatus = err?.response?.status;
      if (httpStatus === 404) {
        throw new ExamGradingPollError("not_found", "Response not found.");
      }
      if (httpStatus >= 500) {
        throw new ExamGradingPollError("server", "Grading service unavailable.");
      }
      throw new ExamGradingPollError("network", "Network error while polling for grading.");
    }
    if (data.status !== "pending") return data;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(1500, delay + 250);
  }
  throw new ExamGradingPollError("timeout", "Grading timed out.");
}

export const completeExamSession = (sessionId) =>
  client.post(`/exam-prep/sessions/${sessionId}/complete/`);

export const getExamHistory = (section) =>
  client.get("/exam-prep/sessions/history/", { params: { section: section || undefined } });
