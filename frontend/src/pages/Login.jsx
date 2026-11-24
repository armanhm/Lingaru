import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      // Surface the server's message when it's specific (e.g. account
      // pending approval), otherwise fall back to a generic line.
      const data = err?.response?.data;
      const msg = data?.detail
        || (typeof data === "string" ? data : null)
        || "Invalid username or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950">
      {/* Left, calm brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 bg-card border-r border-line">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 bg-canvas border border-line rounded-2xl flex items-center justify-center font-editorial text-3xl text-fg">L</span>
            <div>
              <span className="font-editorial text-3xl text-fg">Lingaru</span>
              <p className="text-caption text-fg-3 uppercase tracking-[0.14em] mt-0.5">Apprends. Parle. Maîtrise.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-display text-fg">
              Learn French,<br />
              <span className="text-accent">one word at a time.</span>
            </h2>
            <p className="text-body-lg text-fg-2">
              Interactive lessons, AI conversations, mini games, and spaced repetition, everything you need to become fluent.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { n: "20+", l: "Topics", icon: "📚" },
              { n: "6", l: "Mini games", icon: "🎮" },
              { n: "AI", l: "Tutor", icon: "🤖" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-canvas border border-line-soft p-3 text-center">
                <p className="text-2xl">{s.icon}</p>
                <p className="text-h3 text-fg mt-1">{s.n}</p>
                <p className="text-caption uppercase tracking-[0.12em] text-fg-3 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right, form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        {/* Subtle background mesh on form side */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-200/30 dark:bg-primary-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent-200/30 dark:bg-accent-700/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md space-y-7 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-2">
            <span className="w-11 h-11 bg-linear-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-glow-primary">L</span>
            <span className="text-2xl font-extrabold text-gradient-primary">Lingaru</span>
          </div>

          <div className="text-center lg:text-left">
            <p className="eyebrow-primary mb-2">Welcome back</p>
            <h1 className="text-h1 text-surface-900 dark:text-surface-100">
              Sign in to continue
            </h1>
            <p className="text-body text-surface-500 dark:text-surface-400 mt-2">
              Pick up your French journey right where you left off.
            </p>
          </div>

          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 px-4 py-3 rounded-xl text-sm animate-shake flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Your username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-lg w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-caption text-surface-500 dark:text-surface-400">
            New to Lingaru?{" "}
            <Link to="/register" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
