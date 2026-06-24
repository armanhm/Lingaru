import client from "./client";

export const listMyNotes = (params = {}) => client.get("/my-notes/", { params });
export const getMyNote = (id) => client.get(`/my-notes/${id}/`);
export const createMyNote = (data) => client.post("/my-notes/", data);
export const updateMyNote = (id, data) => client.patch(`/my-notes/${id}/`, data);
export const deleteMyNote = (id) => client.delete(`/my-notes/${id}/`);
export const getPublicMyNote = (id) => client.get(`/my-notes/public/${id}/`);
