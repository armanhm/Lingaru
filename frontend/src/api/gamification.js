import client from "./client";

export const getStats = () => client.get("/gamification/stats/");

export const getBadges = () => client.get("/gamification/badges/");

export const getLeaderboard = (page = 1) =>
  client.get("/gamification/leaderboard/", { params: { page } });

export const getXPHistory = (page = 1) =>
  client.get("/gamification/history/", { params: { page } });

export const getTrendReport = () => client.get("/gamification/trend/");

export const submitMiniGameScore = (game, score, total) =>
  client.post("/gamification/mini-game/score/", { game, score, total });
