import { useState, useRef, useEffect, useCallback } from "react";
import {
  sendChatMessage,
  getConversations,
  getConversation,
  sendImageQuery,
  sendVoiceChat,
} from "../api/assistant";
import useVoiceRecorder from "../hooks/useVoiceRecorder";

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
        {message.imagePreview && (
          <img
            src={message.imagePreview}
            alt="Uploaded"
            className="max-w-full max-h-48 rounded-lg mb-2"
          />
        )}
        <p className="text-sm leading-relaxed">{message.content}</p>
        {!isUser && message.audioUrl && (
          <audio controls className="mt-2 w-full" src={message.audioUrl}>
            Your browser does not support audio.
          </audio>
        )}
        {!isUser && message.ragUsed && (
          <p className="text-xs text-blue-500 mt-1">
            Using your documents
          </p>
        )}
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

function ImagePreviewBanner({ file, onRemove }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!preview) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-blue-50">
      <img src={preview} alt="Preview" className="h-12 w-12 object-cover rounded" />
      <span className="text-sm text-gray-600 flex-1 truncate">{file.name}</span>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 text-lg font-bold"
        title="Remove image"
      >
        x
      </button>
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
  const [imageFile, setImageFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
    setImageFile(null);
  }, []);

  // --- Image upload ---
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const removeImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Send text or image message ---
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (loading) return;

    // Need either text or image
    if (!trimmed && !imageFile) return;

    setError(null);
    setLoading(true);

    // If image is attached, use image query endpoint
    if (imageFile) {
      const imagePreview = URL.createObjectURL(imageFile);
      const userMessage = {
        role: "user",
        content: trimmed || "[Image uploaded for analysis]",
        imagePreview,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      try {
        const res = await sendImageQuery(imageFile, trimmed, conversationId);
        const assistantMessage = {
          role: "assistant",
          content: res.data.ai_response,
          provider: res.data.provider,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationId(res.data.conversation_id);
      } catch (err) {
        setError(
          err.response?.data?.detail || "Failed to analyze image. Please try again."
        );
      } finally {
        setLoading(false);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }

    // Standard text message
    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await sendChatMessage(trimmed, mode, conversationId);
      const assistantMessage = {
        role: "assistant",
        content: res.data.reply,
        provider: res.data.provider,
        ragUsed: res.data.rag_used || false,
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
  }, [input, loading, mode, conversationId, imageFile]);

  // --- Voice recording ---
  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (!blob) return;

      setLoading(true);
      setError(null);

      const userMessage = {
        role: "user",
        content: "[Recording voice message...]",
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const res = await sendVoiceChat(blob, conversationId);

        // Update the last user message with the actual transcription
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "user",
            content: res.data.transcription,
          };
          return updated;
        });

        const assistantMessage = {
          role: "assistant",
          content: res.data.ai_response_text,
          provider: res.data.provider,
          audioUrl: res.data.ai_response_audio_url,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationId(res.data.conversation_id);
      } catch (err) {
        setError(
          err.response?.data?.detail || "Voice chat failed. Please try again."
        );
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await startRecording();
      } catch {
        setError("Microphone access is required for voice chat.");
      }
    }
  }, [isRecording, startRecording, stopRecording, conversationId]);

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

        {/* Image preview banner */}
        <ImagePreviewBanner file={imageFile} onRemove={removeImage} />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg font-medium mb-1">Start a conversation</p>
              <p className="text-sm">
                {MODE_OPTIONS.find((m) => m.value === mode)?.description}
              </p>
              <p className="text-xs mt-2">
                You can also upload an image or record a voice message
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
          <div className="flex gap-2 items-end">
            {/* Image upload button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="p-3 text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-50"
              title="Upload image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Voice record button */}
            <button
              onClick={handleVoiceToggle}
              disabled={loading && !isRecording}
              className={`p-3 transition-colors ${
                isRecording
                  ? "text-red-500 animate-pulse"
                  : "text-gray-400 hover:text-primary-600"
              } disabled:opacity-50`}
              title={isRecording ? "Stop recording" : "Record voice message"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Text input */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageFile
                  ? "Ask a question about the image (optional)..."
                  : mode === "grammar_correction"
                  ? "Paste French text to correct..."
                  : mode === "grammar_explanation"
                  ? "Ask about a grammar concept..."
                  : "Type your message in French..."
              }
              rows={1}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              disabled={loading}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !imageFile)}
              className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

          {isRecording && (
            <p className="text-xs text-red-500 mt-2 text-center animate-pulse">
              Recording... Click the microphone to stop.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
