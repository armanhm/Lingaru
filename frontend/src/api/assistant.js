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
