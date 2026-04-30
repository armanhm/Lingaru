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
      {/* Left — gradient branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800">
        {/* Decorative mesh blobs */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-accent-400 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-purple-300 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-56 h-56 bg-info-400 rounded-full blur-3xl" />
        </div>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10 text-white max-w-md space-y-8 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-2xl ring-1 ring-white/20">L</span>
            <div>
              <span className="text-3xl font-extrabold tracking-tight">Lingaru</span>
              <p className="text-xs text-white/60 uppercase tracking-[0.2em] mt-0.5">Apprends. Parle. Maîtrise.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-display font-extrabold leading-[1.1] tracking-tight">
              Learn French,<br />
              <span className="bg-gradient-to-r from-white via-accent-200 to-white bg-clip-text text-transparent bg-[size:200%_auto] animate-gradient-shift">one word at a time.</span>
            </h2>
            <p className="text-body-lg text-white/75 leading-relaxed">
              Interactive lessons, AI conversations, mini games, and spaced repetition — everything you need to become fluent.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { n: "20+", l: "Topics", icon: "📚" },
              { n: "6", l: "Mini games", icon: "🎮" },
              { n: "AI", l: "Tutor", icon: "🤖" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-3 text-center hover:bg-white/15 transition-colors">
                <p className="text-2xl">{s.icon}</p>
                <p className="text-h4 font-extrabold mt-1">{s.n}</p>
                <p className="text-eyebrow uppercase text-white/60 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        {/* Subtle background mesh on form side */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-200/30 dark:bg-primary-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent-200/30 dark:bg-accent-700/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md space-y-7 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-2">
            <span className="w-11 h-11 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-glow-primary">L</span>
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
