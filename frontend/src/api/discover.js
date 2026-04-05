import client from "./client";

export const getFeed = (page = 1) =>
  client.get("/discover/feed/", { params: { page } });

export const generateMore = () =>
  client.post("/discover/generate-more/");

export const interactWithCard = (cardId) =>
  client.post(`/discover/cards/${cardId}/interact/`);
