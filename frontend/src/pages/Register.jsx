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
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
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
      await register(form.username, form.email, form.password, form.passwordConfirm);
      navigate("/");
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
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-900">
      {/* Left — gradient branding panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-32 left-16 w-48 h-48 bg-purple-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-white max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl font-extrabold">L</span>
            <span className="text-3xl font-extrabold">Lingaru</span>
          </div>
          <h2 className="text-4xl font-extrabold leading-tight">
            Start your French<br />adventure today.
          </h2>
          <p className="text-lg text-white/70 leading-relaxed">
            Join thousands of learners mastering French through interactive lessons, AI roleplay, and fun mini games.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              {["A", "M", "S", "J"].map((l, i) => (
                <span key={i} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-xs font-bold">
                  {l}
                </span>
              ))}
            </div>
            <p className="text-sm text-white/60">Join our learning community</p>
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
              Create your account
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Free forever — start learning French in minutes
            </p>
          </div>

          {error && (
            <div className="bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 p-3 rounded-xl text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Username</label>
                <input type="text" name="username" value={form.username} onChange={handleChange} className="input" placeholder="Choose a username" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="input" placeholder="you@example.com" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} className="input" placeholder="At least 8 characters" required minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Confirm Password</label>
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
              ) : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 dark:text-surface-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
