import client from "./client";

export const getFeed = (page = 1) =>
  client.get("/discover/feed/", { params: { page } });

export const generateMore = (rounds = 3) =>
  client.post("/discover/generate-more/", { rounds });

export const interactWithCard = (cardId) =>
  client.post(`/discover/cards/${cardId}/interact/`);
