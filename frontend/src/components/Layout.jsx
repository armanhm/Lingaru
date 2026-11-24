import { useState, useRef, useEffect, useMemo } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck, Bot, BookOpen, BookText, ChartColumn, ChevronDown, Compass, FileText,
  Gamepad2, Headphones, House, Layers, Lightbulb, LogOut, Menu, MessageSquare, Mic,
  Newspaper, PanelLeftClose, PanelLeftOpen, PenLine, PencilLine, Settings, X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { filterNavForMode } from "../lib/modeConfig";
import { Badge, IconButton, cx } from "./ui";
import { LearningLanguageFlag } from "./ui/LearningLanguageFlag";
import OnboardingModal from "./OnboardingModal";

// Line icons for the nav: 20 px, 1.75 stroke, decorative (the label names the link).
const navIcon = (Icon) => <Icon aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0" />;

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: navIcon(House) },
      { to: "/my-notes", labelKey: "nav.myNotes", icon: navIcon(PenLine) },
      { to: "/topics", labelKey: "nav.topics", icon: navIcon(BookOpen) },
      { to: "/discover", labelKey: "nav.discover", icon: navIcon(Compass) },
      { to: "/news", labelKey: "nav.news", icon: navIcon(Newspaper) },
      { to: "/assistant", labelKey: "nav.assistant", icon: navIcon(MessageSquare) },
      { to: "/agents", labelKey: "nav.agents", icon: navIcon(Bot) },
    ],
  },
  {
    label: null,
    items: [
      { to: "/dictionary", labelKey: "nav.dictionary", icon: navIcon(BookText) },
      { to: "/our-notes", labelKey: "nav.ourNotes", languages: ["en"], icon: navIcon(FileText) },
      { to: "/progress", labelKey: "nav.progress", icon: navIcon(ChartColumn) },
    ],
  },
  {
    labelKey: "nav.practice",
    collapsible: true,
    items: [
      { to: "/practice/dictation", labelKey: "nav.dictation", icon: navIcon(Headphones) },
      { to: "/practice/pronunciation", labelKey: "nav.pronunciation", icon: navIcon(Mic) },
      { to: "/practice/conjugation", labelKey: "nav.conjugation", icon: navIcon(PencilLine) },
      { to: "/practice/srs", labelKey: "nav.flashcards", icon: navIcon(Layers) },
      { to: "/mini-games", labelKey: "nav.miniGames", icon: navIcon(Gamepad2) },
      { to: "/grammar", labelKey: "nav.grammarBooster", icon: navIcon(Lightbulb) },
      { to: "/exam-prep", labelKey: "nav.examPrep", icon: navIcon(BadgeCheck) },
    ],
  },
];

// Keyboard focus ring for items inside scroll containers: inset so it is not clipped.
const INSET_RING =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

// ── UserMenu ─────────────────────────────────────────────────────────────────
function UserMenu({ user, collapsed, onLogout }) {
  const { dark, toggle } = useTheme();
  const { t } = useTranslation();
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

  const rowClass =
    "flex items-center gap-3 w-full px-4 min-h-11 text-small text-fg-2 hover:bg-canvas hover:text-fg " +
    "transition-colors duration-150 ease-out " + INSET_RING;

  return (
    <div
      ref={ref}
      className="border-t border-line p-3 relative"
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx(
          "flex items-center gap-2 w-full px-2 min-h-11 rounded-xl text-fg-2 hover:bg-card hover:text-fg",
          "transition-colors duration-150 ease-out",
          INSET_RING,
          collapsed && "justify-center",
        )}
        title={collapsed ? user.username : undefined}
      >
        <span
          aria-hidden="true"
          className="w-7 h-7 bg-accent text-on-accent rounded-full flex items-center justify-center text-caption font-semibold shrink-0"
        >
          {user.username?.[0]?.toUpperCase() || "U"}
        </span>
        {collapsed ? (
          <span className="sr-only">{user.username}</span>
        ) : (
          <>
            <span className="text-small font-medium truncate flex-1 text-left">{user.username}</span>
            <ChevronDown
              aria-hidden="true"
              size={16}
              className={cx("text-fg-3 shrink-0", !open && "rotate-180")}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className={cx(
            "absolute bottom-full mb-2 bg-card rounded-xl border border-line shadow-card-elevated overflow-hidden z-50",
            collapsed ? "left-14 w-52" : "left-3 right-3",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 min-h-11">
            <span className="text-small text-fg-2">
              {dark ? t("settings.appearance.darkMode") : t("settings.appearance.lightMode")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label={t("layout.toggleTheme")}
              onClick={toggle}
              className={cx(
                "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border",
                "after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']",
                "transition-colors duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                dark ? "bg-accent border-transparent" : "bg-canvas border-line-strong",
              )}
            >
              <span
                aria-hidden="true"
                className={cx("block size-5 rounded-full", dark ? "translate-x-6 bg-on-accent" : "translate-x-1 bg-fg-3")}
              />
            </button>
          </div>

          <div className="h-px bg-line" />

          <Link to="/settings" onClick={() => setOpen(false)} className={rowClass}>
            <Settings aria-hidden="true" size={16} strokeWidth={1.75} className="text-fg-3 shrink-0" />
            {t("nav.settings")}
          </Link>

          <div className="h-px bg-line" />

          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className={cx(rowClass, "text-err hover:text-err hover:bg-err-bg")}
          >
            <LogOut aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />
            {t("auth.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── MobilePanel ──────────────────────────────────────────────────────────────
// Slide-in phone menu. It is a modal dialog: focus moves into it, Tab stays
// inside, Escape or the backdrop closes it, and focus returns to the opener.
function MobilePanel({ label, closeLabel, onClose, children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll("a[href], button:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const inside = panelRef.current.contains(document.activeElement) && document.activeElement !== panelRef.current;
    if (e.shiftKey && (!inside || document.activeElement === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-[rgb(20_18_15/0.55)]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-canvas border-r border-line p-3 flex flex-col focus:outline-hidden"
      >
        <div className="flex items-center justify-between pb-2">
          <span className="text-h3 text-fg px-1">Lingaru</span>
          <IconButton size="sm" label={closeLabel} icon={X} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(loadCollapsedSections);

  // Filter the nav by the user's mode. New signups (mode === null) get the
  // general nav until they finish onboarding, keeps the layout stable
  // while the modal is up.
  const navSections = useMemo(
    () => filterNavForMode(NAV_SECTIONS, user?.mode || "general", user?.target_language),
    [user?.mode, user?.target_language],
  );

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
    // Exact match only, prevents /progress from lighting up when on /progress/mistakes
    return location.pathname === base;
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const skipToContent = (e) => {
    e.preventDefault();
    mainRef.current?.focus();
  };

  const modeChip = user?.mode && (
    <Badge tone="neutral">{t(`modes.${user.mode}.shortLabel`)}</Badge>
  );

  // Called as a function (not mounted as a component) so its DOM, and the
  // focus inside it, survives re-renders.
  const renderSidebar = ({ onNav }) => {
    const compact = !onNav && collapsed; // icon-only rail (desktop only)
    return (
      <div className="flex flex-col h-full">
        {onNav ? (
          // The drawer supplies the wordmark as its title.
          <div className="flex items-center gap-2 pb-3 border-b border-line">
            {user && <LearningLanguageFlag language={user.target_language} />}
            {modeChip}
          </div>
        ) : (
          <div className={cx("flex items-center gap-2 px-3 py-3 border-b border-line", compact && "justify-center px-2")}>
            {!compact && (
              <div className="flex flex-col items-start gap-1 min-w-0">
                <div className="flex items-center">
                  <Link
                    to="/"
                    className={cx("text-h3 text-fg rounded-lg min-h-11 inline-flex items-center", INSET_RING)}
                  >
                    Lingaru
                  </Link>
                  {user && <LearningLanguageFlag language={user.target_language} />}
                </div>
                {modeChip}
              </div>
            )}
            <IconButton
              size="sm"
              className={cx("-my-1", !compact && "ml-auto")}
              label={compact ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
              aria-expanded={!compact}
              icon={compact ? PanelLeftOpen : PanelLeftClose}
              onClick={() => setCollapsed(!compact)}
            />
          </div>
        )}

        <nav aria-label={t("layout.mainNav")} className="flex-1 overflow-y-auto py-4 space-y-4 px-3">
          {navSections.map((section) => {
            const hasActive = section.items.some((it) => isActive(it.to));
            // A section is hidden only if collapsible AND user collapsed it AND
            // no active item lives inside it (so the user can still see where they are).
            const sectionLabel = section.labelKey ? t(section.labelKey) : null;
            const userCollapsed = !!collapsedSections[section.labelKey];
            const sectionOpen = !section.collapsible || !userCollapsed || hasActive;

            return (
              <div key={section.labelKey ?? "main"}>
                {sectionLabel && !compact && (
                  section.collapsible ? (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.labelKey)}
                      className={cx(
                        "w-full flex items-center gap-1.5 px-3 min-h-11 md:min-h-10 rounded-xl group",
                        "text-eyebrow uppercase text-fg-3 hover:text-fg-2 transition-colors duration-150 ease-out",
                        INSET_RING,
                      )}
                      aria-expanded={sectionOpen}
                    >
                      <span className="flex-1 text-left">{sectionLabel}</span>
                      <ChevronDown
                        aria-hidden="true"
                        size={14}
                        strokeWidth={2}
                        className={cx("shrink-0", sectionOpen && "rotate-180")}
                      />
                    </button>
                  ) : (
                    <p className="px-3 mb-1.5 text-eyebrow uppercase text-fg-3">{sectionLabel}</p>
                  )
                )}

                {sectionOpen && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item.to);
                      const itemLabel = item.labelKey ? t(item.labelKey) : item.label;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={onNav}
                          title={compact ? itemLabel : undefined}
                          aria-label={compact ? itemLabel : undefined}
                          aria-current={active ? "page" : undefined}
                          className={cx(
                            "relative flex items-center gap-3 px-3 min-h-11 md:min-h-10 rounded-xl text-small",
                            "transition-colors duration-150 ease-out",
                            INSET_RING,
                            active
                              ? "text-fg font-medium"
                              : "text-fg-2 hover:bg-card hover:text-fg",
                            compact && "justify-center",
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-accent"
                            />
                          )}
                          {item.icon}
                          {!compact && <span>{itemLabel}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <UserMenu user={user} collapsed={compact} onLogout={handleLogout} />
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <a
        href="#main-content"
        onClick={skipToContent}
        className={cx(
          "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]",
          "focus:rounded-xl focus:border focus:border-line focus:bg-card focus:px-4 focus:py-2",
          "focus:text-small focus:font-medium focus:text-fg",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        {t("layout.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className={cx("hidden md:flex flex-col bg-canvas border-r border-line shrink-0", collapsed ? "w-16" : "w-60")}>
        {renderSidebar({ onNav: null })}
      </aside>

      {/* Phone menu */}
      {mobileOpen && (
        <MobilePanel
          label={t("layout.mainNav")}
          closeLabel={t("common.close")}
          onClose={() => setMobileOpen(false)}
        >
          {renderSidebar({ onNav: () => setMobileOpen(false) })}
        </MobilePanel>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-2 px-3 py-2 bg-canvas border-b border-line shrink-0">
          <IconButton label={t("layout.openMenu")} icon={Menu} onClick={() => setMobileOpen(true)} />
          <Link
            to="/"
            className="text-h3 text-fg rounded-lg min-h-11 inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Lingaru
          </Link>
        </header>

        {/* The Assistant page renders edge-to-edge with its own scrolling
           region so its sticky header and composer can span the full width. */}
        {location.pathname === "/assistant" ? (
          <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 overflow-hidden focus:outline-hidden">
            <Outlet />
          </main>
        ) : (
          <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Outlet />
            </div>
          </main>
        )}
      </div>

      {/* First-time onboarding: shows when the user is logged in but has
         no mode set yet. Existing users were backfilled to "general" by
         a data migration so they don't see this on next login. */}
      {user && !user.mode && <OnboardingModal />}
    </div>
  );
}
