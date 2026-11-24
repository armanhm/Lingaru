import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
// Components such as Dialog, Drawer and the toast read their names from i18n.
import "../i18n";

afterEach(() => {
  cleanup();
});
