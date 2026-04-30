import client from "./client";

export const getAgents = () =>
  client.get("/agents/");

export const getAgent = (slug) =>
  client.get(`/agents/${slug}/`);

export const startAgentRun = (slug) =>
  client.post(`/agents/${slug}/start/`);

export const getAgentRuns = (slug) =>
  client.get(`/agents/${slug}/runs/`);
