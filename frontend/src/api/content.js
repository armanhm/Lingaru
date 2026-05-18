import client from "./client";

export const getTopics = () => client.get("/content/topics/");
export const getTopic = (id) => client.get(`/content/topics/${id}/`);
export const getLesson = (id) => client.get(`/content/lessons/${id}/`);
export const getLessonVideo = (lessonId) => client.get(`/content/lessons/${lessonId}/video/`);
export const getRandomVocabulary = (count = 1, { singleWord, gendered } = {}) =>
  client.get("/content/vocabulary/random/", {
    params: { count, single_word: singleWord || undefined, gendered: gendered || undefined },
  });
export const submitLessonVideo = (lessonId, youtubeUrl) =>
  client.post(`/content/lessons/${lessonId}/video/`, { youtube_url: youtubeUrl });

/**
 * Normalize a /content/vocabulary/random/ response into an array.
 *
 * The endpoint has three shapes the widgets need to handle:
 *   - count=1 with a hit       -> bare object  { french, english, ... }
 *   - count>1                  -> array        [{ ... }, ...]
 *   - paginator-wrapped (rare) -> { results: [...] }
 *
 * Callers always want an array; this util collapses the three shapes
 * into one so each widget doesn't reinvent the unwrapping logic.
 *
 * Always returns an array (possibly empty); never undefined or null.
 */
export function normalizeVocabResponse(data) {
  if (data && typeof data === "object" && data.french) return [data];
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}
