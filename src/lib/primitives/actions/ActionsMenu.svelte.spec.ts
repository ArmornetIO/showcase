import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import ActionsMenu, {
  ACTIONS_MENU_DISMISS,
  resolveDismiss,
  type ActionMenuItem,
} from "./ActionsMenu.svelte";
import { exitSpec } from "../../motion/exits.js";
import { advancedSettings } from "../../settings/store.svelte.js";

const items: ActionMenuItem[] = [
  { label: "Edit", icon: "pencil", onclick: () => {} },
  { label: "Delete", destructive: true, onclick: () => {} },
];

describe("ActionsMenu", () => {
  it("renders the default kebab trigger and keeps the menu closed", async () => {
    render(ActionsMenu, { items });
    await expect
      .element(page.getByRole("button", { name: "Actions" }))
      .toBeInTheDocument();
    expect(page.getByRole("menu").elements()).toHaveLength(0);
  });

  it("opens on trigger click and renders every item", async () => {
    render(ActionsMenu, { items });
    await page.getByRole("button", { name: "Actions" }).click();
    await expect.element(page.getByRole("menu")).toBeInTheDocument();
    await expect.element(page.getByText("Edit")).toBeInTheDocument();
    await expect.element(page.getByText("Delete")).toBeInTheDocument();
  });

  it("fires an item's onclick and closes", async () => {
    const onclick = vi.fn();
    render(ActionsMenu, { items: [{ label: "Edit", onclick }] });
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByText("Edit").click();
    expect(onclick).toHaveBeenCalledOnce();
    expect(page.getByRole("menu").elements()).toHaveLength(0);
  });

  it("uses a custom trigger snippet when given a label override", async () => {
    render(ActionsMenu, { items, label: "Row actions" });
    await expect
      .element(page.getByRole("button", { name: "Row actions" }))
      .toBeInTheDocument();
  });

  // ── group headers / separators ────────────────────────────────────────────
  // These exist so grouped menus stop faking a heading with a `disabled` item,
  // which renders as an unavailable action and is announced as a radio option.
  it("renders a header as non-interactive text, not a menu item", async () => {
    render(ActionsMenu, {
      items: [
        { kind: "header", label: "Trackers" },
        { label: "Linear", onclick: () => {} },
      ],
    });
    await page.getByRole("button", { name: "Actions" }).click();
    await expect.element(page.getByText("Trackers")).toBeInTheDocument();
    // The header must not be one of the menu's actionable rows.
    expect(page.getByRole("menuitemradio").elements()).toHaveLength(1);
  });

  it("renders a separator with the separator role", async () => {
    render(ActionsMenu, {
      items: [
        { label: "Linear", onclick: () => {} },
        { kind: "separator" },
        { label: "Slack", onclick: () => {} },
      ],
    });
    await page.getByRole("button", { name: "Actions" }).click();
    await expect.element(page.getByRole("separator")).toBeInTheDocument();
    expect(page.getByRole("menuitemradio").elements()).toHaveLength(2);
  });

  it("keys duplicate labels across groups without collapsing them", async () => {
    render(ActionsMenu, {
      items: [
        { kind: "header", label: "Trackers" },
        { label: "Security", onclick: () => {} },
        { kind: "separator" },
        { kind: "header", label: "Channels" },
        { label: "Security", onclick: () => {} },
      ],
    });
    await page.getByRole("button", { name: "Actions" }).click();
    expect(page.getByRole("menuitemradio").elements()).toHaveLength(2);
  });

  it("marks a selected item with aria-checked", async () => {
    render(ActionsMenu, {
      items: [{ label: "Critical", selected: true, onclick: () => {} }],
    });
    await page.getByRole("button", { name: "Actions" }).click();
    await expect
      .element(page.getByRole("menuitemradio", { name: "Critical" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("does not open when disabled", async () => {
    render(ActionsMenu, { items, disabled: true });
    await page.getByRole("button", { name: "Actions" }).click({ force: true });
    expect(page.getByRole("menu").elements()).toHaveLength(0);
  });
});

// ── auto-dismiss policy ─────────────────────────────────────────────────────
// Pure resolver checks: these guard the "one central default" property, which is
// the whole point of the config living in a single frozen object.
describe("resolveDismiss", () => {
  it("defaults to off so no existing menu changes behaviour", () => {
    expect(ACTIONS_MENU_DISMISS.enabled).toBe(false);
    expect(resolveDismiss(undefined).enabled).toBe(false);
  });

  it("pulls the motion half from the global settings, not from a prop", () => {
    const r = resolveDismiss(true);
    expect(r.idleMs).toBe(advancedSettings.overlayIdleMs);
    expect(r.exit).toBe(advancedSettings.exit.transition);
    expect(r.exitMs).toBe(advancedSettings.exit.duration);
  });

  it("follows the global exit preference when it changes", () => {
    const before = resolveDismiss(true);
    advancedSettings.setOverlayExit("collapse");
    try {
      const after = resolveDismiss(true);
      expect(after.exit).not.toBe(before.exit);
      expect(after.exit).toBe(exitSpec("collapse").transition);
      expect(after.exitMs).toBe(exitSpec("collapse").duration);
    } finally {
      advancedSettings.setOverlayExit("vanish");
    }
  });

  it("follows the global idle window when it changes", () => {
    advancedSettings.setOverlayIdleMs(4321);
    try {
      expect(resolveDismiss(true).idleMs).toBe(4321);
    } finally {
      advancedSettings.setOverlayIdleMs(2000);
    }
  });

  it("treats `true` as opt-in", () => {
    expect(resolveDismiss(true).enabled).toBe(true);
  });

  it("treats a partial override as opt-in", () => {
    expect(resolveDismiss({ idleMs: 5000 })).toMatchObject({
      enabled: true,
      idleMs: 5000,
    });
  });

  it("still honours an explicit opt-out", () => {
    expect(resolveDismiss(false).enabled).toBe(false);
    expect(resolveDismiss({ enabled: false, idleMs: 5000 })).toMatchObject({
      enabled: false,
      idleMs: 5000,
    });
  });

  it("cannot be mutated by a caller", () => {
    expect(Object.isFrozen(ACTIONS_MENU_DISMISS)).toBe(true);
  });
});

describe("ActionsMenu auto-dismiss", () => {
  it("stays open past the idle window when not enabled", async () => {
    vi.useFakeTimers();
    try {
      render(ActionsMenu, { items });
      await page.getByRole("button", { name: "Actions" }).click();
      vi.advanceTimersByTime(10_000);
      expect(page.getByRole("menu").elements()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes after the idle window and reports it via ondismiss", async () => {
    vi.useFakeTimers();
    try {
      const ondismiss = vi.fn();
      render(ActionsMenu, { items, autoDismiss: { idleMs: 50 }, ondismiss });
      await page.getByRole("button", { name: "Actions" }).click();
      // Opening assumes hover; move the pointer away to arm the timer.
      await page.getByRole("menu").hover();
      document.body.dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true }),
      );
      vi.advanceTimersByTime(60);
      expect(ondismiss).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
