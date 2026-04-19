import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
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
  { value: "roleplay", label: "Roleplay", description: "Practice French in real-life situations" },
];

const PROMPT_TEMPLATES = {
  conversation: [
    { label: "How do I say…",      text: "How do I say 'I would like to make a reservation' in French?" },
    { label: "Correct my French",  text: "Can you correct this sentence: 'Je suis allé au magasin hier et j'ai acheter du pain.'" },
    { label: "Teach me slang",     text: "Teach me 5 common French slang expressions used by young people." },
    { label: "Daily phrases",      text: "What are the most useful phrases for everyday life in France?" },
    { label: "French culture",     text: "Tell me something interesting about French culture or customs." },
    { label: "False friends",      text: "What are some common false friends between English and French?" },
  ],
  grammar_correction: [
    { label: "Check this sentence", text: "Please correct: 'Je mange beaucoup de les pommes chaque matin.'" },
    { label: "Past tense mistake",  text: "Did I use the past tense correctly: 'Hier, j'ai été au cinéma et j'ai regardé un bon film.'?" },
    { label: "Gender agreement",    text: "Check my gender agreement: 'La voiture est beau et rapide.'" },
    { label: "Subjunctive use",     text: "Is this correct: 'Il faut que tu viens avec moi.'?" },
  ],
  grammar_explanation: [
    { label: "Passé composé vs Imparfait", text: "Explain the difference between passé composé and imparfait with examples." },
    { label: "Subjunctive mood",           text: "When do I use the subjunctive in French? Give me examples." },
    { label: "Gender rules",               text: "What are the rules for noun gender in French? Any tips to remember them?" },
    { label: "Articles explained",         text: "Explain the difference between du, de la, des, and de in French." },
    { label: "Reflexive verbs",            text: "How do reflexive verbs work in French? Explain with examples." },
    { label: "Future tense",               text: "Explain futur simple vs futur proche in French with examples." },
  ],
  roleplay: [
    { label: "Start the scene",    text: "Bonjour, je voudrais commencer." },
    { label: "Ask for help",       text: "Excusez-moi, pouvez-vous m'aider ?" },
    { label: "I don't understand", text: "Je ne comprends pas, pouvez-vous répéter plus lentement ?" },
    { label: "How much is it?",    text: "Combien ça coûte ?" },
  ],
};

const ROLEPLAY_SCENARIOS = [
  { value: "roleplay_hotel", label: "Hotel", emoji: "🏨", description: "Check in, ask about rooms & services" },
  { value: "roleplay_airport", label: "Airport", emoji: "✈️", description: "Check in, baggage, boarding" },
  { value: "roleplay_bank", label: "Bank", emoji: "🏦", description: "Account, transfers, inquiries" },
  { value: "roleplay_school", label: "School", emoji: "🏫", description: "Talk to a teacher, classes, homework" },
  { value: "roleplay_job_interview", label: "Job Interview", emoji: "💼", description: "Professional French practice" },
  { value: "roleplay_restaurant", label: "Restaurant", emoji: "🍽️", description: "Order food at a Parisian bistro" },
  { value: "roleplay_doctor", label: "Doctor", emoji: "🏥", description: "Describe symptoms, get advice" },
  { value: "roleplay_market", label: "Market", emoji: "🥖", description: "Buy at a French outdoor market" },
  { value: "roleplay_train", label: "Train Station", emoji: "🚆", description: "Buy tickets, find platforms" },
  { value: "roleplay_pharmacy", label: "Pharmacy", emoji: "💊", description: "Ask about medicines, dosage" },
];

function ModeSelector({ mode, scenario, onModeChange, onScenarioChange }) {
  const isRoleplay = mode === "roleplay";

  return (
    <div className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
      <div className="flex gap-2 p-3">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === opt.value
                ? "bg-primary-600 text-white"
                : "bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700"
            }`}
            title={opt.description}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isRoleplay && (
        <div className="px-3 pb-3 grid grid-cols-5 gap-1.5">
          {ROLEPLAY_SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => onScenarioChange(s.value)}
              title={s.description}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                scenario === s.value
                  ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700"
                  : "bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700"
              }`}
            >
              <span className="text-base">{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
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
            : "bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-100 rounded-bl-md"
        }`}
      >
        {message.imagePreview && (
          <img
            src={message.imagePreview}
            alt="Uploaded"
            className="max-w-full max-h-48 rounded-lg mb-2"
          />
        )}
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none
            prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1
            prose-h3:text-base prose-h3:font-semibold
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-strong:font-semibold prose-em:italic
            prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
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
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{message.provider}</p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ label = "Claude is thinking" }) {
  return (
    <div className="flex justify-start mb-4 animate-fade-in-up">
      <div className="flex items-center gap-2.5 bg-surface-100 dark:bg-surface-800 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
        <div className="flex gap-1 items-end h-4">
          <span className="w-1.5 h-1.5 bg-primary-400 dark:bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
          <span className="w-1.5 h-1.5 bg-primary-500 dark:bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
          <span className="w-1.5 h-1.5 bg-primary-600 dark:bg-primary-300 rounded-full animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
        </div>
        <span className="text-caption font-medium text-surface-500 dark:text-surface-400">{label}</span>
      </div>
    </div>
  );
}

function ConversationSidebar({ conversations, activeId, onSelect, onNew }) {
  return (
    <div className="w-64 border-r border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 flex flex-col">
      <div className="p-3 border-b border-surface-200 dark:border-surface-700">
        <button
          onClick={onNew}
          className="btn-primary btn-sm w-full"
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 border-b border-surface-100 dark:border-surface-700 text-sm transition-colors ${
              activeId === conv.id
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-300"
                : "text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            }`}
          >
            <p className="font-medium truncate">{conv.title}</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
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
    <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-200 dark:border-surface-700 bg-blue-50 dark:bg-blue-900/20">
      <img src={preview} alt="Preview" className="h-12 w-12 object-cover rounded" />
      <span className="text-sm text-surface-600 dark:text-surface-400 flex-1 truncate">{file.name}</span>
      <button
        onClick={onRemove}
        className="text-surface-400 dark:text-surface-500 hover:text-red-500 text-lg font-bold"
        title="Remove image"
      >
        x
      </button>
    </div>
  );
}

export default function Assistant() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => searchParams.get("prompt") || "");
  const [mode, setMode] = useState(() => {
    const m = searchParams.get("mode");
    return ["conversation", "grammar_correction", "grammar_explanation", "roleplay"].includes(m) ? m : "conversation";
  });
  const [scenario, setScenario] = useState(() => {
    const s = searchParams.get("scenario");
    return s && s.startsWith("roleplay_") ? s : "roleplay_hotel";
  });
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
      const resolvedMode = mode === "roleplay" ? scenario : mode;
      const res = await sendChatMessage(trimmed, resolvedMode, conversationId);
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

  const handleTemplate = useCallback((text) => {
    setInput(text);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem-4rem)] card overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={loadConversation}
        onNew={startNewChat}
      />

      <div className="flex-1 flex flex-col">
        <ModeSelector
          mode={mode}
          scenario={scenario}
          onModeChange={setMode}
          onScenarioChange={setScenario}
        />

        {/* Image preview banner */}
        <ImagePreviewBanner file={imageFile} onRemove={removeImage} />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
              {/* Mode label */}
              <div className="text-center">
                {mode === "roleplay" ? (
                  <>
                    <p className="text-3xl mb-1">
                      {ROLEPLAY_SCENARIOS.find((s) => s.value === scenario)?.emoji}
                    </p>
                    <p className="text-base font-semibold text-surface-700 dark:text-surface-200">
                      {ROLEPLAY_SCENARIOS.find((s) => s.value === scenario)?.label} Roleplay
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                      {ROLEPLAY_SCENARIOS.find((s) => s.value === scenario)?.description}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold text-surface-700 dark:text-surface-200">
                      {MODE_OPTIONS.find((m) => m.value === mode)?.label}
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                      {MODE_OPTIONS.find((m) => m.value === mode)?.description}
                    </p>
                  </>
                )}
              </div>

              {/* Prompt templates */}
              {(PROMPT_TEMPLATES[mode] || PROMPT_TEMPLATES.roleplay).length > 0 && (
                <div className="w-full max-w-lg">
                  <p className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide mb-2 text-center">
                    Try one of these
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(PROMPT_TEMPLATES[mode] || PROMPT_TEMPLATES.roleplay).map((t) => (
                      <button
                        key={t.label}
                        onClick={() => handleTemplate(t.text)}
                        className="text-left px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
                      >
                        <p className="text-xs font-semibold text-surface-700 dark:text-surface-200 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                          {t.label}
                        </p>
                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {t.text}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div className="bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-800 rounded-xl p-3 mb-4 text-sm text-danger-600 dark:text-danger-400 animate-shake">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-surface-200 dark:border-surface-700 p-4">
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
              className="p-3 text-surface-400 hover:text-primary-600 transition-colors disabled:opacity-50"
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
                  : "text-surface-400 hover:text-primary-600"
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
                  : mode === "roleplay"
                  ? "Say something in French to start the scene..."
                  : "Type your message in French..."
              }
              rows={1}
              className="flex-1 px-4 py-3 border border-surface-200 rounded-xl resize-none focus:border-primary-500 focus:ring-0 focus:outline-none text-sm dark:bg-surface-700 dark:border-surface-600 dark:text-surface-100"
              disabled={loading}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !imageFile)}
              className="btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
