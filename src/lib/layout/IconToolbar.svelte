<script lang="ts" module>
	import type { IconName } from '../icons/Icon.svelte';
	import type { ActionMenuItem } from '../primitives/actions/ActionsMenu.svelte';

	export type IconToolbarOrientation = 'vertical' | 'horizontal';

	interface IconToolbarButtonBase {
		divider?: false;
		icon: IconName;
		label: string;
		badge?: number | string;
		active?: boolean;
		disabled?: boolean;
	}

	export type IconToolbarButton = IconToolbarButtonBase & { onclick: () => void };

	/** A toolbar button that opens a dropdown menu instead of firing a single action. */
	export type IconToolbarMenu = IconToolbarButtonBase & { menu: ActionMenuItem[] };

	export type IconToolbarItem =
		| { divider: true; key?: string }
		| IconToolbarButton
		| IconToolbarMenu;
</script>

<script lang="ts">
	import Icon from '../icons/Icon.svelte';
	import Tooltip from '../primitives/status/Tooltip.svelte';
	import ActionsMenu from '../primitives/actions/ActionsMenu.svelte';

	interface IconToolbarProps {
		items: IconToolbarItem[];
		orientation?: IconToolbarOrientation;
		/** Extra CSS classes on the root element. */
		class?: string;
		/**
		 * Print each button's label under its icon.
		 *
		 * For a rail that is the primary way through a screen — a settings panel
		 * embedded in a page — where an icon alone makes the reader hover every
		 * button to find out what it does. A compact toolbar beside content it
		 * acts on leaves this off and keeps the tooltip.
		 */
		showLabels?: boolean;
		/**
		 * Drop the toolbar's own border, background and radius.
		 *
		 * For a rail docked inside a surface that already draws them —
		 * `EdgeToolbarCard`, a panel edge — where the toolbar's chrome would sit
		 * as a second box inside the first.
		 */
		bare?: boolean;
	}

	let {
		items,
		orientation = 'vertical',
		class: cls = '',
		showLabels = false,
		bare = false
	}: IconToolbarProps = $props();

	const tooltipPlacement = $derived(orientation === 'vertical' ? 'left' : 'bottom');
	// A right-edge vertical rail wants the menu anchored to the button's right edge
	// so it opens inward; a horizontal bar opens down-left from the trigger.
	const menuPlacement = $derived(orientation === 'vertical' ? 'bottom-end' : 'bottom-start');
</script>

<div
	class="icon-toolbar orientation-{orientation} {cls}"
	class:with-labels={showLabels}
	class:bare
	role="toolbar"
>
	{#each items as item, i (item.divider ? `div-${i}` : item.label)}
		{#if item.divider}
			<div class="divider" role="separator" aria-hidden="true"></div>
		{:else if 'menu' in item}
			<!-- Dropdown trigger. No Tooltip wrapper: ActionsMenu measures its
			     trigger's first child box, and Tooltip's display:contents anchor
			     would zero that out and misplace the menu. -->
			<ActionsMenu items={item.menu} placement={menuPlacement} disabled={item.disabled}>
				{#snippet trigger({ open, toggle })}
					<button
						type="button"
						class="toolbar-btn"
						class:active={item.active || open}
						disabled={item.disabled}
						onclick={toggle}
						aria-label={item.label}
						aria-haspopup="menu"
						aria-expanded={open}
					>
						<Icon name={item.icon} size={16} strokeWidth={1.75} />
						{#if item.badge !== undefined}
							<span class="badge" aria-label="{item.badge} notifications">{item.badge}</span>
						{/if}
					</button>
				{/snippet}
			</ActionsMenu>
		{:else}
			{#snippet actionBtn()}
				<button
					type="button"
					class="toolbar-btn"
					class:active={item.active}
					disabled={item.disabled}
					onclick={item.onclick}
					aria-label={item.label}
					aria-pressed={item.active}
				>
					<Icon name={item.icon} size={16} strokeWidth={1.75} />
					{#if showLabels}<span class="btn-label">{item.label}</span>{/if}
					{#if item.badge !== undefined}
						<span class="badge" aria-label="{item.badge} notifications">{item.badge}</span>
					{/if}
				</button>
			{/snippet}
			<!-- Rendered bare when the label is printed: a hover card repeating the
			     word already under the icon is noise, and Tooltip has no "off". -->
			{#if showLabels}
				{@render actionBtn()}
			{:else}
				<Tooltip content={item.label} placement={tooltipPlacement} delay={300}>
					{@render actionBtn()}
				</Tooltip>
			{/if}
		{/if}
	{/each}
</div>

<style>
	/* ── Container ───────────────────────────────────────────────────────── */
	.icon-toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
	}

	.orientation-vertical {
		flex-direction: column;
		width: 44px;
		padding: 6px 0;
		border-radius: var(--radius-control);
	}

	.orientation-horizontal {
		flex-direction: row;
		height: 44px;
		padding: 0 6px;
		border-radius: var(--radius-control);
	}

	/* ── Divider ─────────────────────────────────────────────────────────── */
	.divider {
		background: var(--border);
		flex-shrink: 0;
	}

	.orientation-vertical .divider {
		width: 24px;
		height: 1px;
		margin: 4px auto;
	}

	.bare {
		background: transparent;
		border: 0;
		border-radius: 0;
	}

	/* ── Labelled variant ────────────────────────────────────────────────── */
	/* The bar stops being a fixed 32px-button strip and sizes to the stacked
	   icon+label, so the buttons still read as one attached group rather than
	   separate chips. */
	.with-labels .toolbar-btn {
		flex-direction: column;
		gap: 4px;
		width: auto;
		height: auto;
		min-width: 62px;
		padding: 8px 10px;
	}
	.btn-label {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
	}
	/* The vertical rail widens to fit the label under each icon. The tick stays
	   short and centred: a full-width rule would cut the column into separate
	   buttons, and these are one attached group. */
	.with-labels.orientation-vertical {
		width: auto;
		min-width: 78px;
		padding: 6px 4px;
	}
	.with-labels.orientation-vertical .toolbar-btn {
		width: 100%;
		margin: 2px 0;
	}
	.with-labels.orientation-vertical .divider {
		width: 32px;
		margin: 3px auto;
	}

	.orientation-horizontal .divider {
		width: 1px;
		height: 20px;
		margin: 0 4px;
	}

	/* ── Button ──────────────────────────────────────────────────────────── */
	.toolbar-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		margin: 2px auto;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
		flex-shrink: 0;
	}

	.orientation-horizontal .toolbar-btn {
		margin: auto 2px;
	}

	.toolbar-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
		pointer-events: none;
	}

	.toolbar-btn:hover {
		color: var(--accent);
		border-color: var(--border-strong);
		background: var(--accent-faint);
	}

	.toolbar-btn.active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.35);
		background: rgba(94, 234, 212, 0.08);
	}

	.toolbar-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* ── Badge ───────────────────────────────────────────────────────────── */
	.badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		background: var(--accent);
		color: var(--text-onaccent);
		border-radius: var(--radius-control);
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 700;
		line-height: 14px;
		text-align: center;
		pointer-events: none;
	}
</style>
