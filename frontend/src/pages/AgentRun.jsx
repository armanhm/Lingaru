import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getAgent, startAgentRun, getAgentRuns } from "../api/agents";
import { sendChatMessage, getConversation } from "../api/assistant";
import { PageHeader } from "../components/ui";

/* ──────────────────────────────────────────────────────────────
 * Inline icons
 * ────────────────────────────────────────────────────────────── */
const Ic = {
  send:  (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>),
  sparkle:(p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 16l.5 1.5L7 18l-1.5.5L5 20l-.5-1.5L3 18l1.5-.5L5 16z" /></svg>),
  refresh:(p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0112-3l3 3M19 15a7 7 0 01-12 3l-3-3" /></svg>),
};

/* ──────────────────────────────────────────────────────────────
 * Chat bubble (lighter than the Assistant's — no @-mention popover)
 * ────────────────────────────────────────────────────────────── */
function Bubble({ msg, agent }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fade-in-up`}>
      <span
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[16px] shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-accent-500 to-warn-500 text-white"
            : `bg-gradient-to-br ${agent?.tint || "from-primary-500 to-purple-600"} text-white`
        }`}
      >
        {isUser ? "🧑" : (agent?.emoji || "🤖")}
      </span>
      <div className={`max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-1">
          <span>{isUser ? "Vous" : (agent?.name || "Agent")}</span>
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
            isUser
              ? "bg-gradient-to-br from-primary-600 to-purple-700 text-white rounded-br-sm whitespace-pre-wrap"
              : "bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 text-surface-900 dark:text-surface-50 rounded-bl-sm"
          }`}
        >
          {isUser ? (
            msg.content
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1
              prose-h3:text-base prose-h3:font-semibold
              prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
              prose-strong:font-semibold prose-em:italic
              prose-code:bg-surface-100 prose-code:dark:bg-surface-700 prose-code:px-1 prose-code:rounded prose-code:text-xs">
              <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && msg.provider && (
          <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1.5 uppercase tracking-wider font-medium">{msg.provider}</p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ agent }) {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <span className={`shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${agent?.tint || "from-primary-500 to-purple-600"} text-white flex items-center justify-center text-[16px] shadow-sm`}>
        {agent?.emoji || "🤖"}
      </span>
      <div className="bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * MAIN
 * ────────────────────────────────────────────────────────────── */
export default function AgentRun() {
  const { slug } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [runs, setRuns] = useState([]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, sending]);

  // Load agent + start a fresh conversation + load past runs
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);
    setConversationId(null);

    Promise.all([
      getAgent(slug),
      startAgentRun(slug),
      getAgentRuns(slug),
    ])
      .then(([detailRes, startRes, runsRes]) => {
        if (cancelled) return;
        setAgent(detailRes.data);
        setConversationId(startRes.data.conversation_id);
        setRuns(runsRes.data || []);
      })
      .catch(() => !cancelled && setError("Impossible de charger l'agent."))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [slug]);

  const handleSend = useCallback(async (textOverride) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending || !agent) return;

    setError(null);
    setSending(true);
    const userMsg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await sendChatMessage(trimmed, agent.mode || "conversation", conversationId, agent.slug);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: res.data.reply,
        provider: res.data.provider,
      }]);
      setConversationId(res.data.conversation_id);
    } catch (err) {
      setError(err.response?.data?.detail || "Échec de l'envoi.");
    } finally {
      setSending(false);
    }
  }, [agent, conversationId, input, sending]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = useCallback(async () => {
    if (!agent) return;
    try {
      const res = await startAgentRun(agent.slug);
      setConversationId(res.data.conversation_id);
      setMessages([]);
      // Refresh runs list
      const runsRes = await getAgentRuns(agent.slug);
      setRuns(runsRes.data || []);
    } catch {
      setError("Impossible de démarrer une nouvelle session.");
    }
  }, [agent]);

  const handleResume = useCallback(async (run) => {
    if (!run?.conversation_id) return;
    try {
      const res = await getConversation(run.conversation_id);
      setMessages(res.data.messages || []);
      setConversationId(run.conversation_id);
    } catch {
      setError("Impossible de charger cette session.");
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="space-y-2 mb-6">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-10 w-72 rounded-lg" />
          <div className="skeleton h-3 w-96 rounded" />
        </div>
        <div className="skeleton h-[400px] rounded-3xl" />
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Agent introuvable" backTo="/agents" backLabel="Retour aux agents" />
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </div>
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        eyebrow={`@${agent.slug}`}
        title={agent.name}
        backTo="/agents"
        backLabel="Tous les agents"
        actions={
          <button
            onClick={handleNewSession}
            className="btn-secondary btn-sm"
            disabled={sending}
          >
            <Ic.refresh className="w-3.5 h-3.5 mr-1" />
            Nouvelle session
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT — hero + chat */}
        <div className="lg:col-span-8 space-y-5">
          {/* Hero */}
          <div className="card relative overflow-hidden p-5 sm:p-6 animate-fade-in-up">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${agent.tint}`} />
            <div className="flex items-start gap-4 flex-wrap">
              <div className={`shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.tint} text-white flex items-center justify-center text-3xl shadow-glow-primary`}>
                {agent.emoji}
              </div>
              <div className="flex-1 min-w-0">
                {agent.tagline && (
                  <p className="text-[15px] text-surface-700 dark:text-surface-200 leading-snug font-medium">
                    {agent.tagline}
                  </p>
                )}
                {agent.description && (
                  <p className="text-[13px] text-surface-500 dark:text-surface-400 leading-relaxed mt-2">
                    {agent.description}
                  </p>
                )}
              </div>
            </div>

            {(agent.capabilities?.length > 0 || agent.best_for?.length > 0) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-surface-100 dark:border-surface-800">
                {agent.capabilities?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-1.5">Capacités</p>
                    <ul className="space-y-1">
                      {agent.capabilities.map((c) => (
                        <li key={c} className="flex items-start gap-1.5 text-[12.5px] text-surface-700 dark:text-surface-200">
                          <span className="text-success-500 mt-0.5">✓</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {agent.best_for?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-1.5">À utiliser pour</p>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.best_for.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Empty state with suggested questions */}
          {messages.length === 0 && agent.suggested_questions?.length > 0 && (
            <div className="card p-5 animate-fade-in-up">
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-3">
                <Ic.sparkle className="w-3 h-3 inline mr-1" />
                Pour commencer
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {agent.suggested_questions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-left px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:-translate-y-0.5 hover:shadow-sm transition-all text-[13px] text-surface-800 dark:text-surface-100 leading-snug focus-ring"
                  >
                    <span className="text-primary-500 mr-1.5">↗</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat thread */}
          {messages.length > 0 && (
            <div className="space-y-5">
              {messages.map((m, i) => <Bubble key={i} msg={m} agent={agent} />)}
              {sending && <TypingIndicator agent={agent} />}
              {error && (
                <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl px-4 py-3 text-sm text-danger-700 dark:text-danger-300 animate-shake flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
                  <span>{error}</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Composer */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900/40 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={agent.suggested_questions?.[0] || "Posez votre question…"}
              rows={2}
              disabled={sending}
              className="w-full px-4 py-3 bg-transparent text-[14px] resize-none focus:outline-none text-surface-900 dark:text-surface-50 placeholder:text-surface-400 dark:placeholder:text-surface-500 disabled:opacity-60"
            />
            <div className="flex items-center px-2 pb-2 pt-1">
              <p className="text-[10px] font-mono text-surface-400 dark:text-surface-500 px-2">
                Entrée pour envoyer · Shift+Entrée pour une nouvelle ligne
              </p>
              <button
                onClick={() => handleSend()}
                disabled={sending || !input.trim()}
                className="ml-auto bg-gradient-to-br from-primary-600 to-purple-700 disabled:from-surface-300 disabled:to-surface-400 dark:disabled:from-surface-700 dark:disabled:to-surface-600 text-white px-4 py-2 rounded-lg text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-glow-primary active:scale-95 transition-all focus-ring"
              >
                Envoyer <Ic.send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — recent runs */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="card p-5 animate-fade-in-up">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-400 dark:text-surface-500 mb-3">
              Sessions récentes
            </p>
            {runs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-200 dark:border-surface-700 px-4 py-6 text-center">
                <p className="text-[12px] text-surface-500 dark:text-surface-400">
                  Aucune session pour l'instant. Pose ta première question ci-contre.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {runs.map((r) => {
                  const active = r.conversation_id === conversationId;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => handleResume(r)}
                        className={`w-full text-left rounded-lg px-3 py-2 text-[12.5px] transition-colors ${
                          active
                            ? "bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-800 text-primary-700 dark:text-primary-300"
                            : "hover:bg-surface-50 dark:hover:bg-surface-800/50 text-surface-700 dark:text-surface-200"
                        }`}
                      >
                        <p className="font-semibold truncate">{r.title || "Session"}</p>
                        <p className="text-[10.5px] text-surface-400 dark:text-surface-500 mt-0.5">
                          {new Date(r.started_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {r.message_count || 0} messages
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-surface-200 dark:border-surface-700 p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-surface-500 dark:text-surface-400 mb-1.5">
              Dans le chat
            </p>
            <p className="text-[12.5px] text-surface-700 dark:text-surface-300 leading-snug">
              Tape <code className="font-mono text-primary-600 dark:text-primary-400">@{agent.slug}</code>{" "}
              dans l'<Link to="/assistant" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">Assistant</Link>{" "}
              pour invoquer cet agent en cours de conversation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
