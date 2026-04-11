import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import client from "../api/client";

const LEVEL_OPTIONS = [
  { value: "A1", label: "A1 — Beginner" },
  { value: "A2", label: "A2 — Elementary" },
  { value: "B1", label: "B1 — Intermediate" },
  { value: "B2", label: "B2 — Upper Intermediate" },
  { value: "C1", label: "C1 — Advanced" },
  { value: "C2", label: "C2 — Proficiency" },
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

// Default preferences — used when user has no saved prefs yet
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
  // Mini Games
  missing_letter_rounds: 8,
  word_scramble_rounds: 8,
  word_scramble_timer: 30,
  match_pairs_count: 6,
  match_pairs_preview: 3,
  gender_snap_rounds: 10,
  speed_round_questions: 12,
  speed_round_timer: 45,
};

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
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
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${checked ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-600"}`}
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
        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center font-bold text-lg transition-colors"
      >−</button>
      <span className="w-10 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center font-bold text-lg transition-colors"
      >+</button>
    </div>
  );
}

function SelectInput({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-primary-400 transition-colors ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { showToast } = useToast();

  // Profile
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dailyGoal, setDailyGoal] = useState(15);
  const [targetLevel, setTargetLevel] = useState("B1");
  const [nativeLang, setNativeLang] = useState("en");
  const [profileSaving, setProfileSaving] = useState(false);

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

  const inputClass =
    "w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors bg-white dark:bg-gray-700 dark:text-gray-100";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-400 dark:text-gray-500 mt-1 text-sm">Manage your profile, preferences, and account.</p>
      </div>

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <SectionCard title="Appearance">
        <FieldRow label="Theme" description="Switch between light and dark mode">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{dark ? "Dark" : "Light"}</span>
            <Toggle checked={dark} onChange={toggleTheme} />
          </div>
        </FieldRow>
      </SectionCard>

      {/* ── Profile ────────────────────────────────────────────────────────── */}
      <SectionCard title="Profile" description="Your account information and learning goals">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Native Language</label>
              <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value)} className={inputClass}>
                {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Level</label>
              <select value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} className={inputClass}>
                {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Goal (min)</label>
              <input type="number" min={5} max={180} value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} className={inputClass} />
            </div>
          </div>
          <button type="submit" disabled={profileSaving} className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
            {profileSaving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </SectionCard>

      {/* ── Flashcards ─────────────────────────────────────────────────────── */}
      <SectionCard title="Flashcards" description="Customize your daily flashcard review sessions">
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

      {/* ── Practice ───────────────────────────────────────────────────────── */}
      <SectionCard title="Practice" description="Adjust question counts and difficulty for practice modes">
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

      {/* ── Learning ───────────────────────────────────────────────────────── */}
      <SectionCard title="Learning" description="Coaching and feedback preferences">
        <FieldRow label="Coach tips" description="Show personalized coaching insights on the dashboard">
          <Toggle checked={prefs.coaching_tips} onChange={(v) => setPref("coaching_tips", v)} />
        </FieldRow>
        <FieldRow label="Daily reminder" description="Receive a reminder to practice each day (requires Telegram)">
          <Toggle checked={prefs.daily_reminder} onChange={(v) => setPref("daily_reminder", v)} />
        </FieldRow>
      </SectionCard>

      {/* ── Mini Games ──────────────────────────────────────────────────── */}
      <SectionCard title="Mini Games" description="Customize difficulty and length of each mini game">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Word Scramble</p>
        <FieldRow label="Words per game" description="Number of words to unscramble each round">
          <NumberStepper value={prefs.word_scramble_rounds} onChange={(v) => setPref("word_scramble_rounds", v)} min={3} max={20} step={1} />
        </FieldRow>
        <FieldRow label="Time per word (sec)" description="Seconds allowed to solve each word">
          <NumberStepper value={prefs.word_scramble_timer} onChange={(v) => setPref("word_scramble_timer", v)} min={10} max={60} step={5} />
        </FieldRow>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2" />
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Match Pairs</p>
        <FieldRow label="Number of pairs" description="French–English pairs to match (more pairs = harder)">
          <NumberStepper value={prefs.match_pairs_count} onChange={(v) => setPref("match_pairs_count", v)} min={4} max={10} step={1} />
        </FieldRow>
        <FieldRow label="Preview time (sec)" description="Seconds to memorize cards before they flip">
          <NumberStepper value={prefs.match_pairs_preview} onChange={(v) => setPref("match_pairs_preview", v)} min={1} max={10} step={1} />
        </FieldRow>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2" />
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Gender Snap</p>
        <FieldRow label="Words per game" description="Number of le/la questions each round">
          <NumberStepper value={prefs.gender_snap_rounds} onChange={(v) => setPref("gender_snap_rounds", v)} min={5} max={20} step={1} />
        </FieldRow>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2" />
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Missing Letter</p>
        <FieldRow label="Words per game" description="Number of fill-in-the-blank words">
          <NumberStepper value={prefs.missing_letter_rounds} onChange={(v) => setPref("missing_letter_rounds", v)} min={3} max={20} step={1} />
        </FieldRow>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2" />
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Speed Round</p>
        <FieldRow label="Questions per game" description="Number of true/false questions">
          <NumberStepper value={prefs.speed_round_questions} onChange={(v) => setPref("speed_round_questions", v)} min={5} max={30} step={1} />
        </FieldRow>
        <FieldRow label="Time limit (sec)" description="Total seconds to answer all questions">
          <NumberStepper value={prefs.speed_round_timer} onChange={(v) => setPref("speed_round_timer", v)} min={15} max={120} step={5} />
        </FieldRow>
      </SectionCard>

      {/* Save preferences button */}
      <div className="flex justify-end mb-5">
        <button
          onClick={handlePrefsSave}
          disabled={prefsSaving}
          className="px-6 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {prefsSaving ? "Saving…" : "Save Preferences"}
        </button>
      </div>

      {/* ── Password ───────────────────────────────────────────────────────── */}
      <SectionCard title="Change Password">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} required minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required minLength={8} />
            </div>
          </div>
          {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
          <button type="submit" disabled={passwordSaving} className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
            {passwordSaving ? "Changing…" : "Change Password"}
          </button>
        </form>
      </SectionCard>

      {/* ── Telegram ───────────────────────────────────────────────────────── */}
      <SectionCard title="Telegram Bot">
        {user?.telegram_id ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              ✓ Linked
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ID: <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{user.telegram_id}</code>
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Not linked. Start the Lingaru bot on Telegram and send <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">/start</code> to connect your account.
          </p>
        )}
      </SectionCard>

      {/* ── Danger zone ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-red-200 dark:border-red-900 overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-red-100 dark:border-red-900">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Once you delete your account all data is permanently removed.
          </p>
          <button disabled className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg opacity-40 cursor-not-allowed">
            Delete Account (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
