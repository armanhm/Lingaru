import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Bonjour, {user?.username}!
      </h1>
      <p className="text-gray-600">
        Welcome to Lingaru. Your French learning journey starts here.
      </p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Target Level</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {user?.target_level}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Daily Goal</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {user?.daily_goal_minutes} min
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700">Streak</h2>
          <p className="text-3xl font-bold text-primary-600 mt-2">0 days</p>
        </div>
      </div>
    </div>
  );
}
