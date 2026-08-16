<script lang="ts" module>
	import type { IconName } from '../icons/Icon.svelte';
	import type { MotionExit } from '../motion/exits.js';
	import type { FlourishKind } from '../motion/effects.js';
	import { advancedSettings } from '../settings/store.svelte.js';

	/** A clickable row — the default when `kind` is omitted. */
	export interface ActionMenuAction {
		kind?: 'item';
		label: string;
		icon?: IconName;
		destructive?: boolean;
		disabled?: boolean;
		/** Marks the item as the current selection — shows a trailing check and highlight. */
		selected?: boolean;
		/** Optional accent color (any CSS color) applied to the item's icon and label. */
		color?: string;
		onclick: () => void;
	}

	/** A non-interactive group label. */
	export interface ActionMenuHeader {
		kind: 'header';
		label: string;
	}

	/** A hairline rule between groups. */
	export interface ActionMenuSeparator {
		kind: 'separator';
	}

	/**
	 * Discriminated on `kind` so an action still *requires* `label` + `onclick`
	 * while a header requires neither — a single optional-everything interface
	 * would let a real action compile with no click handler.
	 *
	 * Headers and separators exist so grouped menus stop faking a heading with a
	 * `disabled` item: that renders as an unavailable *action*, and is announced
	 * by screen readers as an unchecked radio option.
	 */
	export type ActionMenuItem = ActionMenuAction | ActionMenuHeader | ActionMenuSeparator;

	export type ActionsMenuPlacement = 'bottom-end' | 'bottom-start';

	// ── Auto-dismiss ──────────────────────────────────────────────────────────
	/** @deprecated Use `MotionExit` from `motion/exits.js` — kept as an alias. */
	export type ActionsMenuExit = MotionExit;

	/**
	 * Fully-resolved auto-dismiss policy. Every field is required here on
	 * purpose — a partially-specified policy never reaches the component, so
	 * there is exactly one place a default can come from.
	 */
	export interface ActionsMenuDismissConfig {
		/** Master switch. */
		enabled: boolean;
		/** Idle time before the menu closes itself, in ms. */
		idleMs: number;
		/** Hold the menu open while focus is inside it or its trigger. Keyboard
		 *  users never generate hover, so without this the menu closes under them. */
		pauseOnFocusWithin: boolean;
		/** Hold the menu open while the pointer is over it or its trigger. */
		pauseOnHover: boolean;
		/** Exit transition, run as the menu node is destroyed. */
		exit: MotionExit;
		/** Exit duration, ms. Motion primitives cut this to 0 under reduced-motion. */
		exitMs: number;
	}

	/** What a caller may pass: `false` to opt out, or a partial override. */
	export type ActionsMenuDismiss = boolean | Partial<ActionsMenuDismissConfig>;

	/**
	 * The behavioural half of the policy — the part that is a design decision
	 * rather than a user preference, so it is not in the settings store.
	 *
	 * `enabled` is false: a menu that closes itself on a timer is hostile to
	 * anyone still reading it, so a surface must ask for it explicitly.
	 *
	 * The *motion* half — which exit plays, and how long the idle window is —
	 * deliberately is NOT here. It comes from the global settings store at
	 * resolve time, so changing the app's motion changes every menu at once and
	 * no call site ever passes an animation in.
	 */
	export const ACTIONS_MENU_DISMISS: Readonly<
		Omit<ActionsMenuDismissConfig, 'exit' | 'exitMs' | 'idleMs'>
	> = Object.freeze({
		enabled: false,
		pauseOnFocusWithin: true,
		pauseOnHover: true
	});

	/**
	 * Narrow a caller's `boolean | Partial<…>` down to the complete policy,
	 * layering three sources — later wins:
	 *
	 *   1. the behavioural defaults above
	 *   2. the global motion settings (exit animation + idle window)
	 *   3. this call site's explicit override, if any
	 *
	 * A partial override implies opt-in: `autoDismiss={{ idleMs: 5000 }}` turns
	 * dismissal on, because tuning a timer you never enabled is never the intent.
	 * Opt out explicitly with `false`, or with `{ enabled: false }`.
	 *
	 * Reads reactive state, so call it from a `$derived` and the menu follows
	 * the global preference live.
	 */
	export function resolveDismiss(v: ActionsMenuDismiss | undefined): ActionsMenuDismissConfig {
		const spec = advancedSettings.exit;
		const base: ActionsMenuDismissConfig = {
			...ACTIONS_MENU_DISMISS,
			idleMs: advancedSettings.overlayIdleMs,
			exit: spec.transition,
			exitMs: spec.duration
		};
		if (v === undefined) return base;
		if (typeof v === 'boolean') return { ...base, enabled: v };
		return { ...base, enabled: true, ...v };
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../icons/Icon.svelte';
	import Flourish from '../motion/Flourish.svelte';
	// `advancedSettings` is imported by the module script above — the two scripts
	// share one scope, so importing it again here is a redeclaration.

	interface ActionsMenuProps {
		items: ActionMenuItem[];
		placement?: ActionsMenuPlacement;
		disabled?: boolean;
		/** Custom trigger snippet — receives `{ open }`. Defaults to the ⋮ kebab button. */
		trigger?: Snippet<[{ open: boolean; toggle: () => void }]>;
		/** Accessible label for the default kebab trigger. */
		label?: string;
		/**
		 * Whether picking an item closes the menu. Default true — one action, done.
		 * Pass false for a multi-select set (`selected` on every item), where
		 * closing after each tick makes choosing three things cost three openings.
		 */
		closeOnSelect?: boolean;
		/**
		 * Arbitrary content pinned below the items, under a separator — for the
		 * one input a menu of choices cannot express (a free-text value, a link
		 * out). Clicks inside it do not dismiss the menu. Keep it small: a menu
		 * that grows a form is a popover wearing the wrong component.
		 */
		footer?: Snippet;
		/**
		 * Close the menu after a period of no hover and no focus, playing the
		 * exit animation as the node is destroyed. Off unless asked for; see
		 * `ACTIONS_MENU_DISMISS` for the shared defaults.
		 *
		 *   autoDismiss                      → on, 2s, collapse
		 *   autoDismiss={{ idleMs: 5000 }}   → on, 5s
		 *   autoDismiss={false}              → off (the default)
		 */
		autoDismiss?: ActionsMenuDismiss;
		/** Fired when the idle timer — not a click or Escape — closed the menu. */
		ondismiss?: () => void;
		/**
		 * Selection flourish played on the default kebab when it opens the menu.
		 * Omit to follow the user's "Nav selection effect" theme setting, which is
		 * the point — one preference drives the side nav and the kebabs alike.
		 * Pass `'none'` to opt this menu out regardless of the setting.
		 *
		 * Only applies to the built-in trigger: a custom `trigger` snippet is the
		 * caller's markup, so its flourish is the caller's to render.
		 */
		flourish?: FlourishKind;
	}

	let {
		items,
		placement = 'bottom-end',
		disabled = false,
		trigger,
		label = 'Actions',
		closeOnSelect = true,
		footer,
		autoDismiss,
		ondismiss,
		flourish
	}: ActionsMenuProps = $props();

	/** Explicit prop wins; otherwise follow the theme's nav selection effect. */
	const fxKind = $derived(flourish ?? advancedSettings.navFlourish);
	// Two replay keys, one per half of the lifecycle: the menu is emitted from
	// the kebab on open and sucked back into it on close. They are separate
	// counters because the two overlays must be able to sit on screen at
	// different phases without one resetting the other.
	let burst = $state(0);
	let closeBurst = $state(0);

	/** The single resolved policy for this instance. */
	const dismiss = $derived(resolveDismiss(autoDismiss));
	/** Bound to `out:` below. Menus that never opted in run it at 0ms — one code
	 *  path, and no new exit animation on the menus that did not ask for one. */
	const exit = $derived(dismiss.exit);

	let open = $state(false);
	let triggerEl = $state<HTMLElement | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	let menuStyle = $state('');

	// ── Auto-dismiss ──────────────────────────────────────────────────────────
	let hovered = $state(false);
	let focusWithin = $state(false);

	/** Anything that should keep the menu alive regardless of the timer. */
	const held = $derived(
		(dismiss.pauseOnHover && hovered) || (dismiss.pauseOnFocusWithin && focusWithin)
	);

	// One timer, owned by an effect: it restarts whenever `held` drops back to
	// false and is cleared on teardown, so pointer-out → re-arm needs no manual
	// bookkeeping. `close()` removes the node, which is what runs `dismiss.exit`.
	$effect(() => {
		if (!open || !dismiss.enabled || held) return;
		const id = setTimeout(() => {
			close();
			ondismiss?.();
		}, dismiss.idleMs);
		return () => clearTimeout(id);
	});

	/** Is `t` inside the trigger or the menu? They are siblings, not nested. */
	function within(t: Node | null): boolean {
		return !!t && ((triggerEl?.contains(t) ?? false) || (menuEl?.contains(t) ?? false));
	}

	// The menu is portalled out of the trigger's subtree, so focus-within has to
	// be computed against both elements rather than read off one container.
	// `focusin` reports the element gaining focus as `target`; `focusout` reports
	// it as `relatedTarget` (null when focus leaves the document entirely).
	//
	// Only *visible* focus holds the menu open. Clicking the kebab focuses it, so
	// counting plain focus would let every click-opened menu pin itself open
	// forever via its own trigger. `:focus-visible` is exactly the keyboard-vs-
	// pointer distinction this needs, and it is what the guard was for.
	function setFocusWithin(t: Node | null) {
		if (!within(t)) {
			focusWithin = false;
			return;
		}
		const el = t as Element;
		focusWithin = typeof el.matches === 'function' ? el.matches(':focus-visible') : true;
	}

	// Hover is tracked at the window rather than with pointerenter on the trigger:
	// `.trigger-wrap` is `display: contents` so it has no box to enter, and a
	// bare wrapper should not have to carry an ARIA role just to observe hover.
	// pointerover bubbles for every element the pointer crosses, so this
	// self-corrects the moment the pointer moves anywhere else.
	function trackHover(e: PointerEvent) {
		if (!open) return;
		hovered = within(e.target as Node | null);
	}

	function calcPosition() {
		if (!triggerEl) return;
		const r = (triggerEl.firstElementChild ?? triggerEl).getBoundingClientRect();
		const top = r.bottom + 4;
		// `--exit-origin` points the exit back at the anchored corner, so the
		// panel retracts toward its trigger rather than toward its own middle.
		if (placement === 'bottom-end') {
			menuStyle = `top:${top}px;right:${window.innerWidth - r.right}px;--exit-origin:top right`;
		} else {
			menuStyle = `top:${top}px;left:${r.left}px;--exit-origin:top left`;
		}
	}

	function toggle() {
		if (disabled) return;
		if (!open) {
			calcPosition();
			// Fires on open only — a flourish on the way out would collide with the
			// menu's own exit animation.
			burst += 1;
			// Opening is always an activation of the trigger, so the pointer is on
			// it (or this was the keyboard, where `focusWithin` holds the menu
			// instead). Assume hover until the first pointerover says otherwise —
			// without it the timer would run from a standing start and close the
			// menu under a pointer that simply had not moved yet.
			hovered = true;
		}
		open = !open;
	}

	function close() {
		// The closing half of the lifecycle — only worth playing if the menu was
		// actually on screen, otherwise a stray close() fires particles at nothing.
		if (open) closeBurst += 1;
		open = false;
		// Stale hover/focus would otherwise disarm the timer on the next opening.
		hovered = false;
		focusWithin = false;
	}

	// A click inside the menu is not an outside click. Items that should dismiss
	// call `close()` themselves (see `closeOnSelect`) — leaving that to this
	// handler broke every menu meant to stay open: a multi-select tick and a
	// click into a footer field both closed the panel out from under the user.
	function handleWindowClick(e: MouseEvent) {
		if (!open) return;
		if (within(e.target as Node | null)) return;
		close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window
	onclick={handleWindowClick}
	onkeydown={handleKeydown}
	onfocusin={(e) => setFocusWithin(e.target as Node | null)}
	onfocusout={(e) => setFocusWithin(e.relatedTarget as Node | null)}
	onpointerover={trackHover}
/>

<span class="trigger-wrap" bind:this={triggerEl}>
	{#if trigger}
		{@render trigger({ open, toggle })}
	{:else}
		<button
			type="button"
			class="kebab-btn"
			class:open
			{disabled}
			onclick={toggle}
			aria-label={label}
			aria-haspopup="menu"
			aria-expanded={open}
		>
			<Icon name="more-vertical" size={14} />
			<Flourish kind={fxKind} trigger={burst} />
			<Flourish kind={fxKind} trigger={closeBurst} reverse />
		</button>
	{/if}
</span>

{#if open}
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="menu"
		style={menuStyle}
		role="menu"
		bind:this={menuEl}
		out:exit={{ duration: dismiss.enabled ? dismiss.exitMs : 0 }}
	>
		<!-- Keyed by position as well as label: separators carry no label, and two
		     groups can legitimately hold same-named entries. -->
		{#each items as item, i (`${i}:${item.kind ?? 'item'}:${'label' in item ? item.label : ''}`)}
			{#if item.kind === 'separator'}
				<div class="menu-sep" role="separator"></div>
			{:else if item.kind === 'header'}
				<span class="menu-header" role="presentation">{item.label}</span>
			{:else}
				<button
					type="button"
					class="menu-item"
					class:destructive={item.destructive}
					class:selected={item.selected}
					style={item.color ? `--item-color:${item.color}` : undefined}
					disabled={item.disabled}
					role={closeOnSelect ? 'menuitemradio' : 'menuitemcheckbox'}
					aria-checked={item.selected}
					onclick={() => {
						item.onclick();
						if (closeOnSelect) close();
					}}
				>
					{#if item.icon}
						<span class="item-icon"><Icon name={item.icon} size={13} /></span>
					{/if}
					<span class="item-label">{item.label}</span>
					{#if item.selected}
						<span class="item-check"><Icon name="check" size={13} /></span>
					{/if}
				</button>
			{/if}
		{/each}
		{#if footer}
			<div class="menu-sep" role="separator"></div>
			<div class="menu-footer">{@render footer()}</div>
		{/if}
	</div>
{/if}

<style>
	.trigger-wrap {
		display: contents;
	}

	/* ── Default kebab trigger ───────────────────────────────────────────── */
	/* Matches the ghost-button weight class used by PageContextMenu's overflow
	   trigger, so a kebab and a context-strip button read as the same control. */
	.kebab-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* Anchors the Flourish overlay, which fills its nearest positioned parent.
		   Particles are free to spill past the 28px box — that is the effect. */
		position: relative;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			background 0.15s;
		flex-shrink: 0;
	}
	.kebab-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}
	.kebab-btn:hover {
		color: var(--fg);
		background: var(--surface-raised);
	}
	.kebab-btn.open {
		color: var(--accent);
		background: var(--accent-faint);
	}
	.kebab-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* ── Dropdown menu ───────────────────────────────────────────────────── */
	/* The house popover recipe, shared verbatim with PageContextMenu's Filter /
	   Display panels, AppShell's org switcher and BulkActionBar's overflow:
	   elevated surface, hairline border, 8px radius, soft drop shadow. Every
	   colour is a token — the previous slate gradient was hardcoded dark and
	   inverted badly under the light theme. */
	.menu {
		position: fixed;
		z-index: 8000;
		min-width: 176px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.5rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
		overflow: hidden;
		animation: menu-in 0.12s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* ── Group header / separator ────────────────────────────────────────── */
	/* Same micro-label treatment as PageContextMenu's filter-group and "Sort by"
	   titles. Callers pass sentence case — the uppercasing belongs here. */
	.menu-header {
		padding: 0.375rem 0.5rem 0.125rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
		line-height: 1.4;
		user-select: none;
	}
	/* A header that opens the menu shouldn't be pushed off the top edge by the
	   panel's own padding. */
	.menu-header:first-child {
		padding-top: 0;
	}

	/* Padded to the item text's inset so a field in the footer lines up with the
	   labels above it rather than with the panel's edge. */
	.menu-footer {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.125rem 0.5rem 0.25rem;
	}

	.menu-sep {
		height: 1px;
		margin: 0.25rem 0;
		background: var(--border);
	}

	/* ── Menu items ──────────────────────────────────────────────────────── */
	/* Mono at 0.7rem on individually-rounded rows — the same item treatment as
	   PageContextMenu's sort list. The old sans 0.82rem rows separated by
	   hairline dividers were the loudest part of the deprecated look. */
	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.7rem;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.1s,
			color 0.1s;
	}
	.menu-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.menu-item:not(:disabled):hover {
		background: var(--surface-raised);
		color: var(--fg);
	}
	.menu-item.destructive {
		color: var(--palette-red);
	}
	.menu-item.destructive:not(:disabled):hover {
		background: color-mix(in srgb, var(--palette-red) 10%, transparent);
		color: var(--palette-red-l);
	}

	/* Item accent color — applied to the icon and, when selected, the label. */
	.menu-item[style*='--item-color'] .item-icon,
	.menu-item[style*='--item-color'] .item-check {
		color: var(--item-color);
		opacity: 1;
	}
	.menu-item.selected {
		background: color-mix(in srgb, var(--item-color, var(--accent)) 12%, transparent);
	}
	.menu-item.selected .item-label {
		color: var(--item-color, var(--accent));
	}

	.item-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		opacity: 0.7;
	}
	.menu-item:hover .item-icon {
		opacity: 1;
	}

	.item-label {
		line-height: 1.2;
	}

	.item-check {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin-left: auto;
		color: var(--item-color, var(--accent));
	}
</style>
