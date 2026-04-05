import client from "./client";

export const sendChatMessage = (message, mode = "conversation", conversationId = null) =>
  client.post("/assistant/chat/", {
    message,
    mode,
    conversation_id: conversationId,
  });

export const getConversations = () =>
  client.get("/assistant/conversations/");

export const getConversation = (id) =>
  client.get(`/assistant/conversations/${id}/`);

export const sendImageQuery = (imageFile, question = "", conversationId = null) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  if (question) formData.append("question", question);
  if (conversationId) formData.append("conversation_id", conversationId);

  return client.post("/assistant/image-query/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const sendVoiceChat = (audioBlob, conversationId = null) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "voice.webm");
  if (conversationId) formData.append("conversation_id", conversationId);

  return client.post("/assistant/voice-chat/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
