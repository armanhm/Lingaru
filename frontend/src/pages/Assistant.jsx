import { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage, getConversations, getConversation } from "../api/assistant";

const MODE_OPTIONS = [
  { value: "conversation", label: "Conversation", description: "Practice French with an AI tutor" },
  { value: "grammar_correction", label: "Grammar Correction", description: "Get your French text corrected" },
  { value: "grammar_explanation", label: "Grammar Explanation", description: "Get grammar concepts explained" },
];

function ModeSelector({ mode, onModeChange }) {
  return (
    <div className="flex gap-2 p-3 border-b border-gray-200 bg-gray-50">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onModeChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === opt.value
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
          }`}
          title={opt.description}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
          isUser
            ? "bg-primary-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-900 rounded-bl-md"
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        {!isUser && message.provider && (
          <p className="text-xs text-gray-400 mt-1">{message.provider}</p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ConversationSidebar({ conversations, activeId, onSelect, onNew }) {
  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNew}
          className="w-full px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors"
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 text-sm transition-colors ${
              activeId === conv.id
                ? "bg-primary-50 text-primary-800"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <p className="font-medium truncate">{conv.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {conv.message_count || 0} messages
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("conversation");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversation list
  useEffect(() => {
    getConversations()
      .then((res) => setConversations(res.data.results || []))
      .catch(() => {});
  }, [conversationId]);

  const loadConversation = useCallback(async (id) => {
    try {
      const res = await getConversation(id);
      setMessages(res.data.messages || []);
      setConversationId(id);
      setError(null);
    } catch {
      setError("Failed to load conversation.");
    }
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await sendChatMessage(trimmed, mode, conversationId);
      const assistantMessage = {
        role: "assistant",
        content: res.data.reply,
        provider: res.data.provider,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(res.data.conversation_id);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to get a response. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, conversationId]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={loadConversation}
        onNew={startNewChat}
      />

      <div className="flex-1 flex flex-col">
        <ModeSelector mode={mode} onModeChange={setMode} />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg font-medium mb-1">Start a conversation</p>
              <p className="text-sm">
                {MODE_OPTIONS.find((m) => m.value === mode)?.description}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "grammar_correction"
                  ? "Paste French text to correct..."
                  : mode === "grammar_explanation"
                  ? "Ask about a grammar concept..."
                  : "Type your message in French..."
              }
              rows={1}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
