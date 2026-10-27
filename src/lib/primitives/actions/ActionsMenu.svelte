<script lang="ts" module>
	// ActionsMenu is a Select whose rows are actions: the panel, placement,
	// keyboard and auto-dismiss all live in Select. What stays here is the kebab
	// trigger and its flourish, and the stricter item type — an action must
	// carry an onclick, which a Select choice need not.
	import type { IconName } from '../../icons/Icon.svelte';
	import type { MotionExit } from '../../motion/exits.js';
	import type { SelectHeader, SelectSeparator } from '../forms/Select.svelte';

	export {
		SELECT_DISMISS as ACTIONS_MENU_DISMISS,
		resolveDismiss
	} from '../forms/Select.svelte';
	export type {
		SelectPlacement as ActionsMenuPlacement,
		SelectDismiss as ActionsMenuDismiss,
		SelectDismissConfig as ActionsMenuDismissConfig
	} from '../forms/Select.svelte';

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

	export type ActionMenuHeader = SelectHeader;
	export type ActionMenuSeparator = SelectSeparator;

	/** Discriminated on `kind` so an action still *requires* `label` + `onclick`
	 *  while a header requires neither. */
	export type ActionMenuItem = ActionMenuAction | ActionMenuHeader | ActionMenuSeparator;

	/** @deprecated Use `MotionExit` from `motion/exits.js` — kept as an alias. */
	export type ActionsMenuExit = MotionExit;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';
	import Flourish from '../../motion/Flourish.svelte';
	import Select, { type SelectDismiss, type SelectPlacement } from '../forms/Select.svelte';
	import type { FlourishKind } from '../../motion/effects.js';
	import { advancedSettings } from '../../settings/store.svelte.js';

	interface ActionsMenuProps {
		items: ActionMenuItem[];
		placement?: SelectPlacement;
		disabled?: boolean;
		/** Custom trigger snippet. Defaults to the ⋮ kebab button. */
		trigger?: Snippet<[{ open: boolean; toggle: () => void }]>;
		/** Accessible label for the default kebab trigger. */
		label?: string;
		/** False for a multi-select set (`selected` on every item). */
		closeOnSelect?: boolean;
		/** Content pinned below the items, under a separator. */
		footer?: Snippet;
		/** Close after a period of no hover and no focus. Off unless asked for. */
		autoDismiss?: SelectDismiss;
		ondismiss?: () => void;
		/**
		 * Flourish played on the default kebab. Omit to follow the user's "Nav
		 * selection effect" setting — one preference drives the side nav and the
		 * kebabs alike. `'none'` opts out. A custom `trigger` renders its own.
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

	const fxKind = $derived(flourish ?? advancedSettings.navFlourish);
	// Separate counters so the open burst and the close burst can overlap
	// without one resetting the other.
	let burst = $state(0);
	let closeBurst = $state(0);
</script>

{#snippet kebab({ open, toggle }: { open: boolean; toggle: () => void })}
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
{/snippet}

<Select
	{items}
	{placement}
	{disabled}
	{closeOnSelect}
	{footer}
	{autoDismiss}
	{ondismiss}
	{label}
	trigger={trigger ?? kebab}
	onopenchange={(o) => (o ? burst++ : closeBurst++)}
/>

<style>
	/* Matches the ghost-button weight of PageContextMenu's overflow trigger, so
	   a kebab and a context-strip button read as the same control. */
	.kebab-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* Anchors the Flourish overlay; particles may spill past the box. */
		position: relative;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-control);
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
</style>
