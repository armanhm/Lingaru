import client from "./client";

export const getNews = ({ topic, page = 1 } = {}) =>
  client.get("/news/", { params: { topic: topic || undefined, page } });

export const getNewsArticle = (id) =>
  client.get(`/news/${id}/`);

export const generateNews = (topic) =>
  client.post("/news/generate/", { topic: topic || undefined });

export const interactWithNews = (id) =>
  client.post(`/news/${id}/interact/`);
