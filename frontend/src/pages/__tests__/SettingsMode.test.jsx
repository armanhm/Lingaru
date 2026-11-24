import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import en from "../../locales/en.json";
import { MODE_CONFIG, MODES, landingRouteForMode } from "../../lib/modeConfig";

const showToast = vi.fn();
const refreshUser = vi.fn(() => Promise.resolve());
const authValue = { user: { mode: "general", proficiency_level: "B1" }, refreshUser };
const patch = vi.fn(() => Promise.resolve({ data: {} }));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => authValue,
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ dark: false, toggle: vi.fn() }),
}));
vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));
vi.mock("../../api/client", () => ({
  default: { patch: (...a) => patch(...a), get: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn() },
}));

import Settings from "../Settings";

async function openModeTab() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
  const tabs = screen.getAllByRole("button", { name: new RegExp(en.settings.tabs.mode) });
  await user.click(tabs[0]);
  return user;
}

describe("Settings mode picker", () => {
  beforeEach(() => {
    showToast.mockClear();
    refreshUser.mockClear();
    patch.mockClear();
  });

  it("offers the three modes as options", async () => {
    await openModeTab();
    for (const key of ["general", "exam", "agentic"]) {
      expect(screen.getByRole("button", { name: new RegExp(en.modes[key].title.replace(/[()/]/g, "\\$&")) })).toBeInTheDocument();
    }
  });

  it("saves the chosen mode on the server and confirms with one toast", async () => {
    const user = await openModeTab();
    await user.click(screen.getByRole("button", { name: new RegExp(en.modes.exam.title.replace(/[()/]/g, "\\$&")) }));
    await user.click(screen.getByRole("button", { name: en.settings.mode.saveButton }));

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("/users/me/", { mode: "exam", proficiency_level: "B1" });
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(en.modes.exam.title, "success");
  });
});

describe("modeConfig per-mode navigation", () => {
  it("gives each mode its own landing route", () => {
    const landings = MODES.map(landingRouteForMode);
    expect(new Set(landings).size).toBe(3);
    expect(landings).toEqual(["/dashboard", "/exam-prep", "/assistant"]);
  });

  it("exposes a different visible nav set for exam than general", () => {
    expect(MODE_CONFIG.exam.visible).toContain("/exam-prep");
    expect(MODE_CONFIG.general.visible).not.toContain("/exam-prep");
  });
});
