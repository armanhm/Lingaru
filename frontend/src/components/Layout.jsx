import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navGroups = {
  main: [
    { to: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
    { to: "/topics", label: "Topics" },
    { to: "/discover", label: "Discover" },
  ],
  practice: [
    { to: "/practice/dictation", label: "Dictation" },
    { to: "/practice/pronunciation", label: "Pronunciation" },
    { to: "/practice/conjugation", label: "Conjugation" },
    { to: "/practice/srs", label: "SRS Review" },
  ],
  ai: [
    { to: "/assistant", label: "Assistant" },
  ],
  personal: [
    { to: "/progress", label: "Progress" },
    { to: "/progress/mistakes", label: "Mistakes" },
    { to: "/documents", label: "Documents" },
  ],
};

function NavLink({ to, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "text-primary-600 bg-primary-50 underline underline-offset-4"
          : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

function DesktopNavLink({ to, label, active }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary-500 text-primary-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {label}
    </Link>
  );
}

function Dropdown({ label, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300 transition-colors"
      >
        {label}
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const mobileRef = useRef(null);

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const isPracticeActive = navGroups.practice.some((item) => isActive(item.to));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobile = () => setMobileOpen(false);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        mobileOpen &&
        mobileRef.current &&
        !mobileRef.current.contains(e.target)
      ) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b" ref={mobileRef}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <Link to="/" className="text-xl font-bold text-primary-600 shrink-0">
              Lingaru
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-4 h-full">
              {navGroups.main.map((item) => (
                <DesktopNavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  active={isActive(item.to)}
                />
              ))}

              <Dropdown label="Practice">
                {navGroups.practice.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    active={isActive(item.to)}
                  />
                ))}
              </Dropdown>

              {navGroups.ai.map((item) => (
                <DesktopNavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  active={isActive(item.to)}
                />
              ))}

              {navGroups.personal.map((item) => (
                <DesktopNavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  active={isActive(item.to)}
                />
              ))}

              {/* User menu */}
              {user && (
                <div ref={userMenuRef} className="relative ml-4">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <span className="w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                      {user.username?.[0]?.toUpperCase() || "U"}
                    </span>
                    <span>{user.username}</span>
                    <svg className={`w-4 h-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50">
                      <Link
                        to="/progress"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Profile / Settings
                      </Link>
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 pb-4 space-y-4 border-t bg-white">
            {/* Main */}
            <div className="pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Main</p>
              {navGroups.main.map((item) => (
                <NavLink key={item.to} to={item.to} label={item.label} active={isActive(item.to)} onClick={closeMobile} />
              ))}
            </div>

            {/* Practice */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Practice</p>
              {navGroups.practice.map((item) => (
                <NavLink key={item.to} to={item.to} label={item.label} active={isActive(item.to)} onClick={closeMobile} />
              ))}
            </div>

            {/* AI */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">AI</p>
              {navGroups.ai.map((item) => (
                <NavLink key={item.to} to={item.to} label={item.label} active={isActive(item.to)} onClick={closeMobile} />
              ))}
            </div>

            {/* Personal */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Personal</p>
              {navGroups.personal.map((item) => (
                <NavLink key={item.to} to={item.to} label={item.label} active={isActive(item.to)} onClick={closeMobile} />
              ))}
            </div>

            {/* User actions */}
            {user && (
              <div className="border-t pt-3">
                <p className="text-sm text-gray-500 mb-2">Signed in as <span className="font-medium text-gray-700">{user.username}</span></p>
                <button
                  onClick={() => { closeMobile(); handleLogout(); }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
