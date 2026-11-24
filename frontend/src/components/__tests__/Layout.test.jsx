import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  beforeEach(() => localStorage.clear());

  it("lists the general-mode nav items in order inside a labelled nav", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: en.layout.mainNav });
    const labels = within(nav)
      .getAllByRole("link")
      .map((a) => a.textContent.trim())
      .filter((text) => text !== "Lingaru");
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
});
