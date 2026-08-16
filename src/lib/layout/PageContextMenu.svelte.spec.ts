import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import PageContextMenu from "./PageContextMenu.svelte";

describe("PageContextMenu", () => {
  it("renders the primary action", async () => {
    render(PageContextMenu, { primary: { label: "New", onclick: () => {} } });
    await expect.element(page.getByText("New")).toBeInTheDocument();
  });

  it("fires the primary onclick", async () => {
    const onclick = vi.fn();
    render(PageContextMenu, { primary: { label: "New", onclick } });
    await page.getByText("New").click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  it("renders secondary actions", async () => {
    render(PageContextMenu, {
      secondary: [{ label: "Mesh", onclick: () => {} }],
    });
    await expect.element(page.getByText("Mesh")).toBeInTheDocument();
  });

  it("shows the Filter trigger when search or filterGroups are provided", async () => {
    render(PageContextMenu, { search: { value: "", set: () => {} } });
    await expect.element(page.getByText("Filter")).toBeInTheDocument();
  });

  it("shows the Display trigger when sort is provided", async () => {
    render(PageContextMenu, {
      sort: {
        options: [{ v: "a", l: "A" }],
        key: "a",
        dir: "asc",
        set: () => {},
      },
    });
    await expect.element(page.getByText("Display")).toBeInTheDocument();
  });

  it("renders active filter chips", async () => {
    render(PageContextMenu, {
      chips: [{ label: "Status: Open", remove: () => {} }],
    });
    await expect.element(page.getByText("Status: Open")).toBeInTheDocument();
  });
});
