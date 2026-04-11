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
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-900">
      {/* Left — gradient branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-purple-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-white max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl font-extrabold">L</span>
            <span className="text-3xl font-extrabold">Lingaru</span>
          </div>
          <h2 className="text-4xl font-extrabold leading-tight">
            Learn French,<br />one word at a time.
          </h2>
          <p className="text-lg text-white/70 leading-relaxed">
            Interactive lessons, AI conversations, mini games, and spaced repetition — everything you need to become fluent.
          </p>
          <div className="flex gap-4 pt-2">
            <div className="text-center">
              <p className="text-2xl font-bold">20+</p>
              <p className="text-xs text-white/60">Topics</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">6</p>
              <p className="text-xs text-white/60">Mini Games</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">AI</p>
              <p className="text-xs text-white/60">Tutor</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-2">
            <span className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm">L</span>
            <span className="text-2xl font-extrabold text-gradient-primary">Lingaru</span>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-extrabold text-surface-900 dark:text-surface-100">
              Welcome back
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Sign in to continue your French journey
            </p>
          </div>

          {error && (
            <div className="bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 p-3 rounded-xl text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
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
              ) : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 dark:text-surface-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
