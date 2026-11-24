import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

describe("Tabs", () => {
  it("moves selection with ArrowRight", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a">One</TabsTrigger>
          <TabsTrigger value="b">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="a">First</TabsContent>
        <TabsContent value="b">Second</TabsContent>
      </Tabs>,
    );
    const one = screen.getByRole("tab", { name: "One" });
    expect(one).toHaveAttribute("aria-selected", "true");
    expect(one).toHaveClass("min-h-11");
    await user.tab();
    expect(one).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Second")).toBeVisible();
  });
});

describe("Tabs layout", () => {
  it("scrolls only horizontally and draws the indicator inside the trigger", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="S" data-testid="list">
          <TabsTrigger value="a">One</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByTestId("list")).toHaveClass("overflow-y-hidden");
    expect(screen.getByRole("tab")).not.toHaveClass("-mb-px");
  });
});
