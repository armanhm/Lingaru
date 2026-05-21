import client from "./client";

export const listNotes = () => client.get("/notes/");
export const getNote = (id) => client.get(`/notes/${id}/`);
export const askNote = (id, question) => client.post(`/notes/${id}/ask/`, { question });
export const addNoteToSrs = (id) => client.post(`/notes/${id}/add-to-srs/`);
export const generateNoteQuiz = (id) => client.post(`/notes/${id}/generate-quiz/`);
