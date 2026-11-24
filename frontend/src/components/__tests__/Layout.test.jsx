import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import en from "../../locales/en.json";

const authValue = {
  user: { username: "ada", mode: "general", target_language: "en" },
  logout: vi.fn(),
};
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => authValue }));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ dark: false, toggle: vi.fn() }),
}));
vi.mock("../OnboardingModal", () => ({ default: () => null }));

import Layout from "../Layout";

// Order of the main nav for mode `general` and target language `en`.
const GENERAL_LABELS = [
  en.nav.dashboard,
  en.nav.myNotes,
  en.nav.topics,
  en.nav.discover,
  en.nav.news,
  en.nav.assistant,
  en.nav.agents,
  en.nav.dictionary,
  en.nav.ourNotes,
  en.nav.progress,
  en.nav.dictation,
  en.nav.pronunciation,
  en.nav.conjugation,
  en.nav.flashcards,
  en.nav.miniGames,
  en.nav.grammarBooster,
];

// A controllable matchMedia: `setDesktop(true)` fires the change listeners.
let mediaListeners;
function installMatchMedia() {
  mediaListeners = new Set();
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener: (_type, cb) => mediaListeners.add(cb),
    removeEventListener: (_type, cb) => mediaListeners.delete(cb),
  }));
}
function setDesktop(matches) {
  act(() => mediaListeners.forEach((cb) => cb({ matches })));
}

function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<p>page body</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Layout shell", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.overflow = "";
    installMatchMedia();
  });

  const appContent = () => document.querySelector("[inert]");
  const openMenu = async (user) => {
    await user.click(screen.getByRole("button", { name: en.layout.openMenu }));
    return screen.getByRole("dialog", { name: en.layout.menu });
  };

  it("lists the general-mode nav items in order inside a labelled nav", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: en.layout.mainNav });
    const labels = within(nav)
      .getAllByRole("link")
      .map((a) => a.textContent.trim());
    expect(labels).toEqual(GENERAL_LABELS);
  });

  it("marks exactly one item as the current page", () => {
    renderAt("/");
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(en.nav.dashboard);
  });

  it("has one main landmark and a skip link as the first focusable element", async () => {
    renderAt("/");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    const user = userEvent.setup();
    await user.tab();
    const skip = screen.getByRole("link", { name: en.layout.skipToContent });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("collapses and expands the sidebar with a named control", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("button", { name: en.layout.collapseSidebar }));
    const expand = screen.getByRole("button", { name: en.layout.expandSidebar });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);
    expect(screen.getByRole("button", { name: en.layout.collapseSidebar })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("opens the phone menu as a dialog and closes it with Escape", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const opener = screen.getByRole("button", { name: en.layout.openMenu });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the phone menu while it is open", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("button", { name: en.layout.openMenu }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
  });

  it("keeps Shift+Tab inside the phone menu", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const dialog = await openMenu(user);
    for (let i = 0; i < 40; i += 1) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement);
    }
  });

  it("makes the app content inert and locks scroll while the menu is open", async () => {
    const user = userEvent.setup();
    renderAt("/");
    expect(appContent()).toBeNull();
    const dialog = await openMenu(user);
    const inert = appContent();
    expect(inert).not.toBeNull();
    expect(inert).toContainElement(screen.getByRole("main", { hidden: true }));
    expect(inert).not.toContainElement(dialog);
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(appContent()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the menu and removes inert when the viewport reaches desktop width", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await openMenu(user);
    setDesktop(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(appContent()).toBeNull();
    expect(document.body.style.overflow).toBe("");
    // The phone menu button is hidden at desktop width, so it must not get focus.
    expect(screen.getByRole("button", { name: en.layout.openMenu })).not.toHaveFocus();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("closes the menu from the backdrop, the close button and a link", async () => {
    const user = userEvent.setup();
    renderAt("/");
    let dialog = await openMenu(user);
    await user.click(dialog.previousSibling);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    dialog = await openMenu(user);
    await user.click(within(dialog).getByRole("button", { name: en.common.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    dialog = await openMenu(user);
    await user.click(within(dialog).getByRole("link", { name: en.nav.topics }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes only the user dropdown on the first Escape inside the menu", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const dialog = await openMenu(user);
    const trigger = within(dialog).getByRole("button", { name: /ada/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves focus to the main landmark from the skip link", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("link", { name: en.layout.skipToContent }));
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("still restores focus to the menu button after a resize while the menu was closed", async () => {
    const user = userEvent.setup();
    renderAt("/");
    setDesktop(true);
    setDesktop(false);
    const opener = screen.getByRole("button", { name: en.layout.openMenu });
    await openMenu(user);
    await user.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });
});
