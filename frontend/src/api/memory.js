import client from "./client";

/**
 * List memory notes for the current user. Pass {includeInactive: true}
 * to also return soft-deleted entries (used by the "Show inactive" toggle).
 */
export const listMemoryNotes = ({ includeInactive = false } = {}) =>
  client.get("/memory/notes/", {
    params: includeInactive ? { include_inactive: "true" } : undefined,
  });

export const createMemoryNote = ({ content, category = "other" }) =>
  client.post("/memory/notes/", { content, category });

export const updateMemoryNote = (id, payload) =>
  client.patch(`/memory/notes/${id}/`, payload);

export const deleteMemoryNote = (id) =>
  client.delete(`/memory/notes/${id}/`);
