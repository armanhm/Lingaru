import client from "./client";

export const uploadDocument = (file, title) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);

  return client.post("/documents/upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getDocuments = () =>
  client.get("/documents/");

export const deleteDocument = (id) =>
  client.delete(`/documents/${id}/`);

export const getDocumentChunks = (documentId) =>
  client.get(`/documents/${documentId}/chunks/`);
