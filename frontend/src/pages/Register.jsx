import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // { username, email } once submitted
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  // navigate kept for future flows (e.g. email confirmation), unused now
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      // New accounts land in a "pending admin approval" state — we don't
      // log the user in. Show a confirmation card instead.
      const res = await register(form.username, form.email, form.password, form.passwordConfirm);
      setPending({ username: res?.username || form.username, email: res?.email || form.email });
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const messages = Object.values(data).flat().join(" ");
        setError(messages);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950">
      {/* Left — gradient branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 bg-accent-400 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 left-10 w-64 h-64 bg-purple-300 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/3 w-56 h-56 bg-success-400 rounded-full blur-3xl" />
        </div>
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
              Start your French<br />
              <span className="bg-gradient-to-r from-white via-accent-200 to-white bg-clip-text text-transparent bg-[size:200%_auto] animate-gradient-shift">adventure today.</span>
            </h2>
            <p className="text-body-lg text-white/75 leading-relaxed">
              Join thousands of learners mastering French through interactive lessons, AI roleplay, and fun mini games.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { icon: "📚", t: "20+ topical lessons", s: "From greetings to politics" },
              { icon: "🧠", t: "Grammar Booster", s: "Master tenses, pronouns, articles" },
              { icon: "🎮", t: "6 mini games", s: "Word scramble, gender snap & more" },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-2.5">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{f.t}</p>
                  <p className="text-xs text-white/60 leading-tight mt-0.5">{f.s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-200/30 dark:bg-primary-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent-200/30 dark:bg-accent-700/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md space-y-7 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-2">
            <span className="w-11 h-11 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-glow-primary">L</span>
            <span className="text-2xl font-extrabold text-gradient-primary">Lingaru</span>
          </div>

          {pending ? (
            <div className="space-y-5 animate-fade-in-up">
              <div className="text-center lg:text-left">
                <p className="eyebrow-primary mb-2">Account created</p>
                <h1 className="text-h1 text-surface-900 dark:text-surface-100">
                  En attente d'approbation
                </h1>
                <p className="text-body text-surface-500 dark:text-surface-400 mt-2">
                  Your account <span className="font-semibold text-surface-900 dark:text-surface-100">{pending.username}</span>{" "}
                  has been created. An administrator needs to approve it before you can log in.
                </p>
                <p className="text-caption text-surface-500 dark:text-surface-400 mt-3">
                  We'll send confirmation to <span className="font-medium">{pending.email}</span>{" "}
                  once your access is enabled.
                </p>
              </div>
              <div className="rounded-xl bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 px-4 py-3 text-sm text-info-700 dark:text-info-300 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 112 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>
                <span>This is a private build. Sign-ups are reviewed by hand to keep the experience focused.</span>
              </div>
              <Link to="/login" className="btn-secondary btn-lg w-full justify-center">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
          <div className="text-center lg:text-left">
            <p className="eyebrow-primary mb-2">Create your account</p>
            <h1 className="text-h1 text-surface-900 dark:text-surface-100">
              Free forever
            </h1>
            <p className="text-body text-surface-500 dark:text-surface-400 mt-2">
              No credit card. No nonsense. Just French, every day.
            </p>
          </div>

          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 px-4 py-3 rounded-xl text-sm animate-shake flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Username</label>
                <input type="text" name="username" value={form.username} onChange={handleChange} className="input" placeholder="learner42" required autoFocus />
              </div>
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="input" placeholder="you@example.com" required />
              </div>
            </div>
            <div>
              <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} className="input" placeholder="At least 8 characters" required minLength={8} />
            </div>
            <div>
              <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Confirm password</label>
              <input type="password" name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange} className="input" placeholder="Repeat your password" required minLength={8} />
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
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Create my account
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-caption text-surface-500 dark:text-surface-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Sign in
            </Link>
          </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
