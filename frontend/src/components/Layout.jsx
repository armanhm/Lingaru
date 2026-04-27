import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { to: "/", label: "Dashboard", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )},
      { to: "/topics", label: "Topics", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )},
      { to: "/discover", label: "Discover", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )},
      { to: "/news", label: "News", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m0 13a2 2 0 002-2V8a2 2 0 00-2-2h-2m-7 4h4m-4 4h4m-4 4h4" />
        </svg>
      )},
    ],
  },
  {
    label: "Practice",
    collapsible: true,
    items: [
      { to: "/practice/dictation", label: "Dictation", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 9.5l-3 3m0 0l3 3m-3-3h7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )},
      { to: "/practice/pronunciation", label: "Pronunciation", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )},
      { to: "/practice/conjugation", label: "Conjugation", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      )},
      { to: "/practice/srs", label: "Flashcards", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )},
      { to: "/mini-games", label: "Mini Games", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )},
      { to: "/grammar", label: "Grammar Booster", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )},
      { to: "/exam-prep", label: "Exam Prep", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )},
    ],
  },
  {
    label: "AI",
    items: [
      { to: "/assistant", label: "Assistant", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )},
    ],
  },
  {
    label: "Dictionary",
    items: [
      { to: "/dictionary", label: "Dictionary", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )},
    ],
  },
  {
    label: "Personal",
    items: [
      { to: "/progress", label: "Progress", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )},
    ],
  },
];

// ── UserMenu ─────────────────────────────────────────────────────────────────
function UserMenu({ user, collapsed, onLogout }) {
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="border-t border-surface-100 dark:border-surface-700/50 p-3 relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors ${collapsed ? "justify-center" : ""}`}
        title={collapsed ? user.username : undefined}
      >
        <span className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
          {user.username?.[0]?.toUpperCase() || "U"}
        </span>
        {!collapsed && (
          <>
            <span className="text-sm font-medium text-surface-700 dark:text-surface-200 truncate flex-1 text-left">
              {user.username}
            </span>
            <svg
              className={`w-4 h-4 text-surface-400 transition-transform shrink-0 ${open ? "" : "rotate-180"}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute bottom-full mb-2 bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700/50 shadow-lg overflow-hidden z-50 animate-fade-in ${collapsed ? "left-14 w-52" : "left-3 right-3"}`}>
          {/* Dark / Light toggle */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-surface-700 dark:text-surface-200">{dark ? "Dark mode" : "Light mode"}</span>
            <button
              onClick={toggle}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${dark ? "bg-primary-600" : "bg-surface-200"}`}
              aria-label="Toggle theme"
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform duration-200 ${dark ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="h-px bg-surface-100 dark:bg-surface-700" />

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
          >
            <svg className="w-4 h-4 text-surface-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>

          <div className="h-px bg-surface-100 dark:bg-surface-700" />

          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-700/20 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
const COLLAPSED_SECTIONS_KEY = "lingaru.sidebar.collapsedSections.v1";

function loadCollapsedSections() {
  try {
    const raw = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(loadCollapsedSections);

  const toggleSection = (label) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(next)); }
      catch { /* ignore */ }
      return next;
    });
  };

  const isActive = (path) => {
    const [base, query] = path.split("?");
    if (base === "/") return location.pathname === "/";
    // Items with a query param need exact path + param match
    if (query) {
      const [paramKey, paramVal] = query.split("=");
      return location.pathname === base && new URLSearchParams(location.search).get(paramKey) === paramVal;
    }
    // Exact match only — prevents /progress from lighting up when on /progress/mistakes
    return location.pathname === base;
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const SidebarInner = ({ onNav }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-surface-100 dark:border-surface-700/50 ${collapsed ? "justify-center" : ""}`}>
        <Link to="/" onClick={onNav} className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">L</span>
          {!collapsed && <span className="text-lg font-extrabold text-gradient-primary">Lingaru</span>}
        </Link>
        {!onNav && !collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-4 px-3">
        {NAV_SECTIONS.map((section) => {
          const hasActive = section.items.some((it) => isActive(it.to));
          // A section is hidden only if collapsible AND user collapsed it AND
          // no active item lives inside it (so the user can still see where they are).
          const userCollapsed = !!collapsedSections[section.label];
          const sectionOpen  = !section.collapsible || !userCollapsed || hasActive;

          return (
            <div key={section.label ?? "main"}>
              {section.label && !collapsed && (
                section.collapsible ? (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center gap-1.5 px-3 mb-1.5 group focus-ring rounded-md"
                    aria-expanded={sectionOpen}
                  >
                    <span className="section-label flex-1 text-left">{section.label}</span>
                    <svg
                      className={`w-3 h-3 text-surface-400 dark:text-surface-500 transition-transform duration-200 ${sectionOpen ? "rotate-90" : ""} group-hover:text-surface-600 dark:group-hover:text-surface-300`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <p className="px-3 mb-1.5 section-label">{section.label}</p>
                )
              )}

              {sectionOpen && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={onNav}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 focus-ring ${
                          active
                            ? "bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/40 dark:to-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm ring-1 ring-primary-200/50 dark:ring-primary-800/50"
                            : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/60 hover:text-surface-900 dark:hover:text-surface-100"
                        } ${collapsed ? "justify-center" : ""}`}
                      >
                        <span className={`shrink-0 ${active ? "text-primary-500 dark:text-primary-400" : "text-surface-400 dark:text-surface-500"}`}>
                          {item.icon}
                        </span>
                        {!collapsed && <span>{item.label}</span>}
                        {active && !collapsed && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User menu */}
      <UserMenu user={user} collapsed={collapsed} onLogout={handleLogout} />
    </div>
  );

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950 overflow-hidden transition-colors duration-200">

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-r border-surface-100 dark:border-surface-800/70 transition-all duration-200 shrink-0 ${collapsed ? "w-16" : "w-60"}`}>
        <SidebarInner onNav={null} />
      </aside>

      {/* Expand tab when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="hidden md:flex fixed left-16 top-1/2 -translate-y-1/2 z-40 w-5 h-10 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-r-lg items-center justify-center text-surface-400 hover:text-primary-600 transition-colors shadow-sm"
          title="Expand sidebar"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-surface-900 border-r border-surface-100 dark:border-surface-800/70 transform transition-transform duration-300 ease-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarInner onNav={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-100 dark:border-surface-800/70 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus-ring"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/" className="text-lg font-extrabold text-gradient-primary">Lingaru</Link>
        </header>

        {/* The Assistant page renders edge-to-edge with its own scrolling
           region so its sticky header and composer can span the full width. */}
        {location.pathname === "/assistant" ? (
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Outlet />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
