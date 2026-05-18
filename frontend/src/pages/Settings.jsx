import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import client from "../api/client";
import {
  listMemoryNotes,
  createMemoryNote,
  updateMemoryNote,
  deleteMemoryNote,
} from "../api/memory";
import { PageHeader } from "../components/ui";

const UI_LANGUAGE_OPTIONS = [
  { value: "en", label: "English",   flag: "🇬🇧" },
  { value: "fr", label: "Français",  flag: "🇫🇷" },
];

const LEVEL_OPTIONS = [
  { value: "A1", label: "A1, Beginner" },
  { value: "A2", label: "A2, Elementary" },
  { value: "B1", label: "B1, Intermediate" },
  { value: "B2", label: "B2, Upper Intermediate" },
  { value: "C1", label: "C1, Advanced" },
  { value: "C2", label: "C2, Proficiency" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "ar", label: "Arabic" },
  { value: "fa", label: "Persian" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
];

const DEFAULT_PREFS = {
  flashcard_count: 20,
  quiz_questions: 10,
  conjugation_questions: 15,
  dictation_rounds: 5,
  show_pronunciation: true,
  autoplay_audio: false,
  show_example_sentences: true,
  flashcard_order: "due_first",
  quiz_difficulty: "mixed",
  coaching_tips: true,
  daily_reminder: false,
  missing_letter_rounds: 8,
  word_scramble_rounds: 8,
  word_scramble_timer: 30,
  match_pairs_count: 6,
  match_pairs_preview: 3,
  gender_snap_rounds: 10,
  speed_round_questions: 12,
  speed_round_timer: 45,
  listening_challenge_rounds: 8,
};

const TABS = [
  { id: "profile",    labelKey: "settings.tabs.profile",    icon: "👤", tint: "from-primary-500 to-purple-600" },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: "🎨", tint: "from-accent-500 to-warn-500" },
  { id: "learning",   labelKey: "settings.tabs.learning",   icon: "📚", tint: "from-info-500 to-primary-600" },
  { id: "games",      labelKey: "settings.tabs.games",      icon: "🎮", tint: "from-success-500 to-info-500" },
  { id: "security",   labelKey: "settings.tabs.security",   icon: "🔒", tint: "from-danger-500 to-accent-600" },
  { id: "memory",     labelKey: "settings.tabs.memory",     icon: "🧠", tint: "from-info-500 to-emerald-500" },
  { id: "mode",       labelKey: "settings.tabs.mode",       icon: "🧭", tint: "from-rose-500 to-purple-600" },
];

const MODE_CARDS = [
  {
    key: "general",
    initial: "G",
    accent: "#6366f1",                                 // matches html[data-mode=general] --mode-grad-from
    glow: "rgba(99, 102, 241, 0.35)",
    gradient: "from-indigo-500 via-violet-500 to-purple-600",
    chip: "Indigo · Violet",
  },
  {
    key: "exam",
    initial: "E",
    accent: "#dc2626",                                 // red-600
    glow: "rgba(225, 29, 72, 0.4)",
    gradient: "from-rose-600 via-red-600 to-red-700",
    chip: "Rouge · Examen",
  },
  {
    key: "agentic",
    initial: "A",
    accent: "#ca8a04",                                 // yellow-600
    glow: "rgba(217, 119, 6, 0.45)",
    gradient: "from-amber-500 via-yellow-500 to-amber-700",
    chip: "Ambre · Doré",
  },
];

function SectionCard({ title, description, icon, tint = "from-primary-500 to-purple-600", children }) {
  return (
    <div className="card relative overflow-hidden mb-5 animate-fade-in-up">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tint}`} />
      <div className="px-6 pt-5 pb-4 border-b border-surface-100 dark:border-surface-700/50">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${tint} text-white flex items-center justify-center text-lg shadow-glow-primary`}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-h4 text-surface-900 dark:text-surface-100">{title}</h2>
            {description && <p className="text-caption text-surface-500 dark:text-surface-400 mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-6 flex-col sm:flex-row">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-surface-700 dark:text-surface-200">{label}</p>
        {description && <p className="text-xs text-surface-500 dark:text-surface-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 focus-ring ${checked ? "bg-primary-600" : "bg-surface-300 dark:bg-surface-600"}`}
    >
      <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function NumberStepper({ value, onChange, min, max, step = 1 }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-9 h-9 rounded-lg border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-300 flex items-center justify-center font-bold text-lg transition-all active:scale-95"
      >−</button>
      <span className="w-12 text-center text-sm font-extrabold text-surface-800 dark:text-surface-100 tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-9 h-9 rounded-lg border border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-300 flex items-center justify-center font-bold text-lg transition-all active:scale-95"
      >+</button>
    </div>
  );
}

function SelectInput({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all ${className}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function GroupHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 pt-2 first:pt-0">
      <span className="text-base">{icon}</span>
      <p className="text-eyebrow uppercase font-bold text-surface-500 dark:text-surface-400 tracking-wider">{title}</p>
      <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
    </div>
  );
}

function MemoryPanel() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ content: "", category: "other" });
  const [adding, setAdding] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null);

  const refresh = async (opts = {}) => {
    setLoading(true);
    try {
      const res = await listMemoryNotes({ includeInactive: opts.includeInactive ?? includeInactive });
      setNotes(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh({ includeInactive });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const grouped = useMemo(() => {
    const acc = { goal: [], preference: [], background: [], weakness: [], other: [] };
    for (const n of notes) {
      if (acc[n.category]) acc[n.category].push(n);
      else acc.other.push(n);
    }
    return acc;
  }, [notes]);

  const handleAdd = async () => {
    if (!draft.content.trim()) return;
    await createMemoryNote({ content: draft.content.trim(), category: draft.category });
    setDraft({ content: "", category: "other" });
    setAdding(false);
    refresh();
  };

  const handleSaveEdit = async (id) => {
    if (!draft.content.trim()) return;
    await updateMemoryNote(id, { content: draft.content.trim(), category: draft.category });
    setEditingId(null);
    setDraft({ content: "", category: "other" });
    refresh();
  };

  const handleDelete = async (note) => {
    await deleteMemoryNote(note.id);
    if (recentlyDeleted?.timeoutId) clearTimeout(recentlyDeleted.timeoutId);
    const timeoutId = setTimeout(() => setRecentlyDeleted(null), 5000);
    setRecentlyDeleted({ note, timeoutId });
    refresh();
  };

  const handleUndo = async () => {
    if (!recentlyDeleted) return;
    await updateMemoryNote(recentlyDeleted.note.id, { is_active: true });
    if (recentlyDeleted.timeoutId) clearTimeout(recentlyDeleted.timeoutId);
    setRecentlyDeleted(null);
    refresh();
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setDraft({ content: note.content, category: note.category });
    setAdding(false);
  };

  const formatRelative = (iso) => {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const CATEGORIES = ["goal", "preference", "background", "weakness", "other"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
          {t("settings.memory.title")}
        </h2>
        <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
          {t("settings.memory.subtitle")}
        </p>
      </div>

      {!adding ? (
        <button
          onClick={() => { setAdding(true); setEditingId(null); setDraft({ content: "", category: "other" }); }}
          className="rounded-lg border border-dashed border-surface-300 dark:border-surface-700 px-4 py-3 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-900/50"
        >
          + {t("settings.memory.addNote")}
        </button>
      ) : (
        <div className="rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-surface-600 dark:text-surface-300">
              {t("settings.memory.categoryLabel")}
            </label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-950 px-2 py-1 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`settings.memory.categories.${c}`)}</option>
              ))}
            </select>
          </div>
          <textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder="e.g. Always confuse depuis and pendant"
            className="w-full rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-950 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setDraft({ content: "", category: "other" }); }}
              className="rounded-md px-3 py-1.5 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              {t("settings.memory.cancel")}
            </button>
            <button
              onClick={handleAdd}
              disabled={!draft.content.trim()}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {t("settings.memory.save")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-surface-500">…</div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-surface-500">{t("settings.memory.empty")}</p>
      ) : (
        CATEGORIES.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-500">
                {t(`settings.memory.categories.${cat}`)}
              </h3>
              <div className="space-y-2">
                {items.map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900/40 p-3 ${note.is_active ? "" : "opacity-50"}`}
                  >
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <select
                          value={draft.category}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                          className="rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-950 px-2 py-1 text-sm"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{t(`settings.memory.categories.${c}`)}</option>
                          ))}
                        </select>
                        <textarea
                          value={draft.content}
                          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                          maxLength={500}
                          rows={2}
                          className="w-full rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-950 px-2 py-1.5 text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setEditingId(null); setDraft({ content: "", category: "other" }); }}
                            className="rounded-md px-3 py-1 text-xs text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                          >
                            {t("settings.memory.cancel")}
                          </button>
                          <button
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={!draft.content.trim()}
                            className="rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {t("settings.memory.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-900 dark:text-surface-50">{note.content}</p>
                          <p className="mt-1 text-xs text-surface-500">
                            {note.source === "user"
                              ? t("settings.memory.sourceUser")
                              : t("settings.memory.sourceAssistant")} · {formatRelative(note.updated_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => startEdit(note)}
                            className="rounded-md px-2 py-1 text-xs text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
                          >
                            {t("settings.memory.edit")}
                          </button>
                          {note.is_active && (
                            <button
                              onClick={() => handleDelete(note)}
                              className="rounded-md px-2 py-1 text-xs text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                            >
                              {t("settings.memory.delete")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <div className="flex items-center gap-2 border-t border-surface-200 dark:border-surface-800 pt-4">
        <input
          type="checkbox"
          id="memory-show-inactive"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="memory-show-inactive" className="text-sm text-surface-700 dark:text-surface-200">
          {t("settings.memory.showInactive")}
        </label>
      </div>

      {recentlyDeleted && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-surface-900 dark:bg-surface-100 px-4 py-2 text-sm text-white dark:text-surface-900 shadow-lg">
          <span>{t("settings.memory.removed")}</span>
          <button
            onClick={handleUndo}
            className="font-medium underline underline-offset-2"
          >
            {t("settings.memory.undo")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState("profile");

  // Profile
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dailyGoal, setDailyGoal] = useState(15);
  const [targetLevel, setTargetLevel] = useState("B1");
  const [nativeLang, setNativeLang] = useState("en");
  const [profileSaving, setProfileSaving] = useState(false);

  // Mode & proficiency, set during onboarding, editable here.
  const [mode, setMode] = useState("general");
  const [proficiency, setProficiency] = useState("B1");
  const [modeSaving, setModeSaving] = useState(false);
  const [modeCelebration, setModeCelebration] = useState(null); // { card } when firing

  // UI language (en / fr). Stored on the user, applied via LanguageProvider.
  const [uiLanguage, setUiLanguage] = useState(i18n.language?.split("-")[0] || "en");
  const [uiLanguageSaving, setUiLanguageSaving] = useState(false);

  // Preferences
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
      setDailyGoal(user.daily_goal_minutes || 15);
      setTargetLevel(user.target_level || "B1");
      setNativeLang(user.native_language || "en");
      setMode(user.mode || "general");
      setProficiency(user.proficiency_level || "B1");
      setUiLanguage(user.ui_language || i18n.language?.split("-")[0] || "en");
      setPrefs({ ...DEFAULT_PREFS, ...(user.preferences || {}) });
    }
  }, [user]);

  const setPref = (key, val) => setPrefs((p) => ({ ...p, [key]: val }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await client.patch("/users/me/", {
        username,
        email,
        daily_goal_minutes: dailyGoal,
        target_level: targetLevel,
        native_language: nativeLang,
      });
      showToast("Profile saved!", "success");
    } catch (err) {
      const detail =
        err.response?.data?.username?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        "Failed to save profile.";
      showToast(detail, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleModeSave = async () => {
    setModeSaving(true);
    try {
      await client.patch("/users/me/", { mode, proficiency_level: proficiency });
      await refreshUser();
      const card = MODE_CARDS.find((m) => m.key === mode);
      setModeCelebration({ card });
      window.setTimeout(() => setModeCelebration(null), 1900);
    } catch {
      showToast(t("settings.mode.errorToast"), "error");
    } finally {
      setModeSaving(false);
    }
  };

  const handleLanguageChange = async (next) => {
    if (next === uiLanguage) return;
    setUiLanguage(next);
    // Apply immediately so the user sees the change before the request
    // returns. LanguageProvider will reconcile after refreshUser() too.
    i18n.changeLanguage(next);
    setUiLanguageSaving(true);
    try {
      await client.patch("/users/me/", { ui_language: next });
      await refreshUser();
      showToast(t("settings.language.savedToast"), "success");
    } catch {
      showToast(t("settings.language.errorToast"), "error");
    } finally {
      setUiLanguageSaving(false);
    }
  };

  const handlePrefsSave = async () => {
    setPrefsSaving(true);
    try {
      await client.patch("/users/me/", { preferences: prefs });
      await refreshUser();
      showToast("Preferences saved!", "success");
    } catch {
      showToast("Failed to save preferences.", "error");
    } finally {
      setPrefsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await client.put("/users/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      showToast("Password changed!", "success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const detail =
        err.response?.data?.old_password ||
        err.response?.data?.new_password ||
        err.response?.data?.detail ||
        "Failed to change password.";
      setPasswordError(Array.isArray(detail) ? detail[0] : detail);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow={t("settings.pageEyebrow")}
        title={t("settings.pageTitle")}
        subtitle={t("settings.pageSubtitle")}
        icon="⚙️"
        gradient
      />

      {/* Segmented tabs */}
      <div className="card p-1.5 mb-6 sticky top-0 z-20 backdrop-blur-md bg-white/90 dark:bg-surface-800/90 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "text-white shadow-sm"
                    : "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                }`}
              >
                {isActive && <span className={`absolute inset-0 rounded-lg bg-gradient-to-br ${tab.tint}`} />}
                <span className="relative z-10 text-base">{tab.icon}</span>
                <span className="relative z-10">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <SectionCard title="Profile" description="Your account information and learning goals" icon="👤" tint="from-primary-500 to-purple-600">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Native language</label>
                <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value)} className="input">
                  {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Target level</label>
                <select value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} className="input">
                  {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Daily goal (min)</label>
                <input type="number" min={5} max={180} value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} className="input" />
              </div>
            </div>
            <button type="submit" disabled={profileSaving} className="btn-primary btn-md">
              {profileSaving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </SectionCard>
      )}

      {/* Interface language — applies instantly via i18next + LanguageProvider. */}
      {activeTab === "profile" && (
        <SectionCard
          title={t("settings.language.title")}
          description={t("settings.language.description")}
          icon="🌐"
          tint="from-info-500 to-primary-600"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            {UI_LANGUAGE_OPTIONS.map((opt) => {
              const active = uiLanguage === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={uiLanguageSaving}
                  onClick={() => handleLanguageChange(opt.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all focus-ring text-left disabled:opacity-60 ${
                    active
                      ? "border-primary-400 dark:border-primary-600 bg-primary-50/60 dark:bg-primary-900/25"
                      : "border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700"
                  }`}
                >
                  <span className="text-2xl">{opt.flag}</span>
                  <span className="flex-1">
                    <span className="block text-[14px] font-bold text-surface-900 dark:text-surface-50">{opt.label}</span>
                    <span className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 dark:text-surface-400 mt-0.5">{opt.value}</span>
                  </span>
                  {active && (
                    <span className="w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Dedicated Mode tab. Cards repaint the whole app via html[data-mode]. */}
      {activeTab === "mode" && (
        <>
          <SectionCard
            title={t("settings.mode.title")}
            description={t("settings.mode.description")}
            icon="🧭"
            tint="from-rose-500 to-purple-600"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {MODE_CARDS.map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    style={{
                      "--card-accent": m.accent,
                      "--card-glow": m.glow,
                    }}
                    className={`mode-card group relative text-left rounded-2xl border-2 px-5 py-5 overflow-hidden transition-all duration-300 ease-out focus-ring will-change-transform ${
                      active
                        ? "border-[color:var(--card-accent)] bg-white dark:bg-surface-900 shadow-[0_22px_48px_-18px_var(--card-glow)] ring-2 ring-[color:var(--card-accent)]/25"
                        : "border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:-translate-y-1 hover:border-[color:var(--card-accent)]/70 hover:shadow-[0_22px_48px_-18px_var(--card-glow)] hover:ring-2 hover:ring-[color:var(--card-accent)]/20"
                    }`}
                  >
                    {/* Animated gradient accent bar */}
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${m.gradient} transition-opacity duration-300 ${active ? "opacity-100" : "opacity-50 group-hover:opacity-100"}`} />

                    {/* Soft tint wash on hover/active */}
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute -right-10 -bottom-10 w-44 h-44 rounded-full blur-3xl transition-opacity duration-500 ${active ? "opacity-30" : "opacity-0 group-hover:opacity-25"}`}
                      style={{ background: `radial-gradient(circle, ${m.accent} 0%, transparent 70%)` }}
                    />

                    {/* Active checkmark */}
                    {active && (
                      <span
                        className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md animate-fade-in-up"
                        style={{ backgroundColor: m.accent }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}

                    {/* Centered identity block: puck + title + tagline */}
                    <div className="flex flex-col items-center text-center">
                      <span
                        className={`relative inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br ${m.gradient} text-white items-center justify-center text-2xl font-extrabold shadow-lg transition-transform duration-300 ease-out ${active ? "scale-105" : "group-hover:scale-110 group-hover:rotate-[-4deg]"}`}
                      >
                        {m.initial}
                      </span>

                      <h3 className="mt-3.5 text-[16px] font-extrabold text-surface-900 dark:text-surface-50 leading-tight">
                        {t(`modes.${m.key}.title`)}
                      </h3>
                      <p
                        className="text-[12px] font-semibold uppercase tracking-wider mt-0.5"
                        style={{ color: m.accent }}
                      >
                        {t(`modes.${m.key}.tagline`)}
                      </p>
                    </div>

                    <p className="text-[13px] text-surface-600 dark:text-surface-300 leading-snug mt-3 max-w-[34ch]">
                      {t(`modes.${m.key}.description`)}
                    </p>

                    {/* Palette chip */}
                    <div className="mt-4 flex items-center gap-2">
                      <span className="flex -space-x-1">
                        <span className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-surface-900" style={{ backgroundColor: m.accent }} />
                        <span className={`w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-surface-900 bg-gradient-to-br ${m.gradient}`} />
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500 dark:text-surface-400">
                        {m.chip}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title={t("settings.mode.currentLevelTitle")}
            description={t("settings.mode.currentLevelDescription")}
            icon="📐"
            tint="from-info-500 to-primary-600"
          >
            <select
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value)}
              className="input max-w-md"
            >
              <option value="A1">{t("levels.A1")}</option>
              <option value="A2">{t("levels.A2")}</option>
              <option value="B1">{t("levels.B1")}</option>
              <option value="B2">{t("levels.B2")}</option>
              <option value="C1">{t("levels.C1")}</option>
              <option value="C2">{t("levels.C2")}</option>
              <option value="unsure">{t("levels.unsure")}</option>
            </select>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleModeSave}
                disabled={modeSaving}
                className="btn-primary btn-md"
              >
                {modeSaving ? t("common.saving") : t("settings.mode.saveButton")}
              </button>
            </div>
          </SectionCard>
        </>
      )}

      {/* Appearance tab */}
      {activeTab === "appearance" && (
        <SectionCard title="Appearance" description="Theme and visual preferences" icon="🎨" tint="from-accent-500 to-warn-500">
          <FieldRow label="Theme" description="Switch between light and dark mode">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-surface-600 dark:text-surface-400">{dark ? "🌙 Dark" : "☀️ Light"}</span>
              <Toggle checked={dark} onChange={toggleTheme} />
            </div>
          </FieldRow>
        </SectionCard>
      )}

      {/* Learning tab */}
      {activeTab === "learning" && (
        <>
          <SectionCard title="Flashcards" description="Customize your daily flashcard review sessions" icon="🃏" tint="from-info-500 to-primary-600">
            <FieldRow label="Cards per session" description="How many flashcards to review each time">
              <NumberStepper value={prefs.flashcard_count} onChange={(v) => setPref("flashcard_count", v)} min={5} max={100} step={5} />
            </FieldRow>
            <FieldRow label="Card order" description="How cards are sorted in each session">
              <SelectInput
                value={prefs.flashcard_order}
                onChange={(v) => setPref("flashcard_order", v)}
                options={[
                  { value: "due_first", label: "Due first" },
                  { value: "random", label: "Random" },
                  { value: "hardest_first", label: "Hardest first" },
                  { value: "newest_first", label: "Newest first" },
                ]}
              />
            </FieldRow>
            <FieldRow label="Show pronunciation" description="Display IPA pronunciation under the French word">
              <Toggle checked={prefs.show_pronunciation} onChange={(v) => setPref("show_pronunciation", v)} />
            </FieldRow>
            <FieldRow label="Show example sentences" description="Display example sentences when the answer is revealed">
              <Toggle checked={prefs.show_example_sentences} onChange={(v) => setPref("show_example_sentences", v)} />
            </FieldRow>
            <FieldRow label="Autoplay audio" description="Automatically read the word aloud when a card appears">
              <Toggle checked={prefs.autoplay_audio} onChange={(v) => setPref("autoplay_audio", v)} />
            </FieldRow>
          </SectionCard>

          <SectionCard title="Practice" description="Question counts and difficulty for practice modes" icon="🎯" tint="from-primary-500 to-info-500">
            <FieldRow label="Quiz questions" description="Number of questions per quiz session">
              <NumberStepper value={prefs.quiz_questions} onChange={(v) => setPref("quiz_questions", v)} min={5} max={50} step={5} />
            </FieldRow>
            <FieldRow label="Quiz difficulty" description="Default difficulty when starting a quiz">
              <SelectInput
                value={prefs.quiz_difficulty}
                onChange={(v) => setPref("quiz_difficulty", v)}
                options={[
                  { value: "easy", label: "Easy" },
                  { value: "mixed", label: "Mixed" },
                  { value: "hard", label: "Hard" },
                ]}
              />
            </FieldRow>
            <FieldRow label="Conjugation drills" description="Questions per conjugation drill session">
              <NumberStepper value={prefs.conjugation_questions} onChange={(v) => setPref("conjugation_questions", v)} min={5} max={50} step={5} />
            </FieldRow>
            <FieldRow label="Dictation rounds" description="Number of sentences per dictation exercise">
              <NumberStepper value={prefs.dictation_rounds} onChange={(v) => setPref("dictation_rounds", v)} min={1} max={20} step={1} />
            </FieldRow>
          </SectionCard>

          <SectionCard title="Coaching" description="Feedback and notification preferences" icon="🎓" tint="from-success-500 to-info-500">
            <FieldRow label="Coach tips" description="Show personalized coaching insights on the dashboard">
              <Toggle checked={prefs.coaching_tips} onChange={(v) => setPref("coaching_tips", v)} />
            </FieldRow>
            <FieldRow label="Daily reminder" description="Receive a reminder to practice each day (requires Telegram)">
              <Toggle checked={prefs.daily_reminder} onChange={(v) => setPref("daily_reminder", v)} />
            </FieldRow>
          </SectionCard>

          <div className="flex justify-end mb-5">
            <button onClick={handlePrefsSave} disabled={prefsSaving} className="btn-primary btn-md">
              {prefsSaving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </>
      )}

      {/* Mini Games tab */}
      {activeTab === "games" && (
        <>
          <SectionCard title="Mini games" description="Customize difficulty and length of each mini game" icon="🎮" tint="from-success-500 to-info-500">
            <GroupHeader icon="🔤" title="Word Scramble" />
            <FieldRow label="Words per game" description="Number of words to unscramble each round">
              <NumberStepper value={prefs.word_scramble_rounds} onChange={(v) => setPref("word_scramble_rounds", v)} min={3} max={20} step={1} />
            </FieldRow>
            <FieldRow label="Time per word (sec)" description="Seconds allowed to solve each word">
              <NumberStepper value={prefs.word_scramble_timer} onChange={(v) => setPref("word_scramble_timer", v)} min={10} max={60} step={5} />
            </FieldRow>

            <GroupHeader icon="🃏" title="Match Pairs" />
            <FieldRow label="Number of pairs" description="French–English pairs to match (more = harder)">
              <NumberStepper value={prefs.match_pairs_count} onChange={(v) => setPref("match_pairs_count", v)} min={4} max={10} step={1} />
            </FieldRow>
            <FieldRow label="Preview time (sec)" description="Seconds to memorize cards before they flip">
              <NumberStepper value={prefs.match_pairs_preview} onChange={(v) => setPref("match_pairs_preview", v)} min={1} max={10} step={1} />
            </FieldRow>

            <GroupHeader icon="⚡" title="Gender Snap" />
            <FieldRow label="Words per game" description="Number of le/la questions each round">
              <NumberStepper value={prefs.gender_snap_rounds} onChange={(v) => setPref("gender_snap_rounds", v)} min={5} max={20} step={1} />
            </FieldRow>

            <GroupHeader icon="✏️" title="Missing Letter" />
            <FieldRow label="Words per game" description="Number of fill-in-the-blank words">
              <NumberStepper value={prefs.missing_letter_rounds} onChange={(v) => setPref("missing_letter_rounds", v)} min={3} max={20} step={1} />
            </FieldRow>

            <GroupHeader icon="🚀" title="Speed Round" />
            <FieldRow label="Questions per game" description="Number of true/false questions">
              <NumberStepper value={prefs.speed_round_questions} onChange={(v) => setPref("speed_round_questions", v)} min={5} max={30} step={1} />
            </FieldRow>
            <FieldRow label="Time limit (sec)" description="Total seconds to answer all questions">
              <NumberStepper value={prefs.speed_round_timer} onChange={(v) => setPref("speed_round_timer", v)} min={15} max={120} step={5} />
            </FieldRow>

            <GroupHeader icon="🎧" title="Listening Challenge" />
            <FieldRow label="Words per game" description="Number of listen-and-type rounds">
              <NumberStepper value={prefs.listening_challenge_rounds} onChange={(v) => setPref("listening_challenge_rounds", v)} min={3} max={20} step={1} />
            </FieldRow>
          </SectionCard>

          <div className="flex justify-end mb-5">
            <button onClick={handlePrefsSave} disabled={prefsSaving} className="btn-primary btn-md">
              {prefsSaving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </>
      )}

      {/* Security tab */}
      {activeTab === "security" && (
        <>
          <SectionCard title="Change password" description="Pick a strong password you don't reuse" icon="🔒" tint="from-primary-500 to-info-500">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Current password</label>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">New password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" required minLength={8} />
                </div>
                <div>
                  <label className="block text-caption font-semibold text-surface-700 dark:text-surface-300 mb-1.5 uppercase tracking-wide">Confirm password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" required minLength={8} />
                </div>
              </div>
              {passwordError && <p className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 102 0v-1a1 1 0 10-2 0v1zm0-7a1 1 0 012 0v3a1 1 0 11-2 0V6z" clipRule="evenodd" /></svg>{passwordError}</p>}
              <button type="submit" disabled={passwordSaving} className="btn-primary btn-md">
                {passwordSaving ? "Changing…" : "Change password"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Telegram bot" description="Get reminders and quick practice on Telegram" icon="🤖" tint="from-info-500 to-primary-600">
            {user?.telegram_id ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="badge-success">✓ Linked</span>
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  ID: <code className="bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded text-xs font-mono">{user.telegram_id}</code>
                </span>
              </div>
            ) : (
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Not linked. Start the Lingaru bot on Telegram and send <code className="bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded text-xs font-mono">/start</code> to connect your account.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Documents" description="Upload French textbooks and notes, the AI assistant uses them to give grounded answers." icon="📄" tint="from-accent-500 to-warn-500">
            <Link to="/documents" className="btn-primary btn-md">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Manage documents
            </Link>
          </SectionCard>

          {/* Danger zone */}
          <div className="card relative overflow-hidden mb-5 border-2 border-danger-200 dark:border-danger-900/50">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-danger-500 to-accent-500" />
            <div className="px-6 pt-5 pb-4 border-b border-danger-100 dark:border-danger-900/40">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-danger-500 to-accent-600 text-white flex items-center justify-center text-lg shadow-glow-danger">
                  ⚠️
                </div>
                <div>
                  <h2 className="text-h4 text-danger-700 dark:text-danger-300">Danger zone</h2>
                  <p className="text-caption text-surface-500 dark:text-surface-400 mt-0.5">Irreversible account actions</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
                Once you delete your account all data is permanently removed.
              </p>
              <button disabled className="btn-danger btn-md opacity-40 cursor-not-allowed">
                Delete account (coming soon)
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === "memory" && <MemoryPanel />}

      {modeCelebration && <ModeCelebration card={modeCelebration.card} />}
    </div>
  );
}

/**
 * Full-viewport one-shot celebration: emoji puck pops in, label slides up,
 * dual radial rings ripple outward in the new mode's accent color, all
 * fading out at ~1.9s. Pointer-events disabled so it never blocks the UI.
 */
function ModeCelebration({ card }) {
  const { t } = useTranslation();
  if (!card) return null;
  return (
    <div className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Soft full-screen color wash */}
      <div
        className="absolute inset-0 animate-mode-wash"
        style={{ background: `radial-gradient(circle at 50% 45%, ${card.glow} 0%, transparent 55%)` }}
      />

      {/* Outer ripple ring */}
      <span
        className="absolute w-32 h-32 rounded-full border-[3px] animate-mode-ripple-1"
        style={{ borderColor: card.accent }}
      />
      {/* Inner ripple ring (delayed) */}
      <span
        className="absolute w-32 h-32 rounded-full border-[3px] animate-mode-ripple-2"
        style={{ borderColor: card.accent }}
      />

      {/* Center pop card */}
      <div className="relative flex flex-col items-center animate-mode-pop">
        <span
          className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center text-5xl font-extrabold shadow-2xl`}
          style={{ boxShadow: `0 24px 60px -12px ${card.glow}` }}
        >
          {card.initial}
        </span>
        <div className="mt-4 px-5 py-2.5 rounded-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-lg">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold" style={{ color: card.accent }}>
            {t("settings.mode.celebrationLabel")}
          </p>
          <p className="text-[15px] font-extrabold text-surface-900 dark:text-surface-50 mt-0.5">
            {t(`modes.${card.key}.title`)}
          </p>
        </div>
      </div>
    </div>
  );
}
