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

/**
 * Count active notes. The endpoint returns the full list, but the
 * caller (the indicator in Assistant.jsx) only needs the length.
 * Cheap enough to call on Assistant mount; do not call on every keystroke.
 */
export const getMemoryCount = async () => {
  const res = await listMemoryNotes();
  return Array.isArray(res.data) ? res.data.length : 0;
};
