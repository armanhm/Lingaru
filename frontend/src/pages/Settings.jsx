import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import client from "../api/client";

const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Profile form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dailyGoal, setDailyGoal] = useState(15);
  const [targetLevel, setTargetLevel] = useState("A1");
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form state
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
      setTargetLevel(user.target_level || "A1");
    }
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await client.patch("/users/me/", {
        username,
        email,
        daily_goal_minutes: dailyGoal,
        target_level: targetLevel,
      });
      showToast("Profile updated!", "success");
    } catch (err) {
      const detail =
        err.response?.data?.username?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        "Failed to update profile.";
      showToast(detail, "error");
    } finally {
      setProfileSaving(false);
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
      setPasswordError(detail);
    } finally {
      setPasswordSaving(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your profile, password, and preferences.
        </p>
      </div>

      {/* Profile section */}
      <SectionCard title="Profile">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Goal (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Level
              </label>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                className={inputClass}
              >
                {LEVEL_OPTIONS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Password section */}
      <SectionCard title="Change Password">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              required
              minLength={8}
            />
          </div>
          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          <div className="pt-2">
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-6 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {passwordSaving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Telegram section */}
      <SectionCard title="Telegram">
        {user?.telegram_id ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
              Linked
            </span>
            <span className="text-sm text-gray-600">
              Telegram ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{user.telegram_id}</code>
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Not linked. Start the Lingaru Telegram bot and use the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/start</code> command to link your account.
          </p>
        )}
      </SectionCard>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border-2 border-red-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          disabled
          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg opacity-50 cursor-not-allowed"
        >
          Delete Account (coming soon)
        </button>
      </div>
    </div>
  );
}
