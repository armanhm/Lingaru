import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="text-xl font-bold text-primary-600">
              Lingaru
            </Link>
            <div className="flex items-center gap-6">
              <Link to="/topics" className="text-gray-600 hover:text-primary-600">
                Topics
              </Link>
              <Link to="/assistant" className="text-gray-600 hover:text-primary-600">
                Assistant
              </Link>
              <Link to="/discover" className="text-gray-600 hover:text-primary-600">
                Discover
              </Link>
              <Link to="/progress" className="text-gray-600 hover:text-primary-600">
                Progress
              </Link>
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{user.username}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
