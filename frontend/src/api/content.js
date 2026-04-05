import client from "./client";

export const getTopics = () => client.get("/content/topics/");
export const getTopic = (id) => client.get(`/content/topics/${id}/`);
export const getLesson = (id) => client.get(`/content/lessons/${id}/`);
export const getLessonVideo = (lessonId) => client.get(`/content/lessons/${lessonId}/video/`);
export const submitLessonVideo = (lessonId, youtubeUrl) =>
  client.post(`/content/lessons/${lessonId}/video/`, { youtube_url: youtubeUrl });
