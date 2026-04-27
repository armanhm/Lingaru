import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import client from "../api/client";
import { PageHeader } from "../components/ui";

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
  { id: "profile",    label: "Profile",    icon: "👤", tint: "from-primary-500 to-purple-600" },
  { id: "appearance", label: "Appearance", icon: "🎨", tint: "from-accent-500 to-warn-500" },
  { id: "learning",   label: "Learning",   icon: "📚", tint: "from-info-500 to-primary-600" },
  { id: "games",      label: "Mini Games", icon: "🎮", tint: "from-success-500 to-info-500" },
  { id: "security",   label: "Security",   icon: "🔒", tint: "from-danger-500 to-accent-600" },
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

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("profile");

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

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        subtitle="Tune Lingaru to fit how you learn — profile, preferences, and account in one place."
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
                <span className="relative z-10">{tab.label}</span>
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

          <SectionCard title="Documents" description="Upload French textbooks and notes — the AI assistant uses them to give grounded answers." icon="📄" tint="from-accent-500 to-warn-500">
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
    </div>
  );
}
