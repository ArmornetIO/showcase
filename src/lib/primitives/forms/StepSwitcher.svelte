<script lang="ts">
	// ── StepSwitcher — `‹ value ›`, and the value opens a menu ────────────────
	// A composite of the two ways to pick from a short ordered list, because the
	// two are good at opposite things and a control that only does one makes the
	// other awkward:
	//
	//   • the chevrons are for nudging — one click to the neighbouring value,
	//     no aiming, no popover, and the change is visible in place.
	//   • the value is a menu trigger — one click to ANY value, and it shows the
	//     whole list, which is the only way to answer "what else is there".
	//
	// Stepping alone forces four clicks to reach the far end and never reveals
	// the set; a menu alone makes "the next one" a two-step aim. Together, the
	// cheap move stays cheap and the far move stays one click.
	//
	// Keyboard: the value is the single tab stop. ←/→ (and ↑/↓) step, Enter and
	// Space open the menu, so the chevrons are `tabindex="-1"` — they duplicate
	// the arrow keys and would otherwise cost two extra stops per control.
	import Icon from '../../icons/Icon.svelte';
	import ActionsMenu from '../actions/ActionsMenu.svelte';
	import type { ActionMenuItem } from '../actions/ActionsMenu.svelte';
	import type { ChoiceOption } from './choice.types.js';

	interface StepSwitcherProps {
		/** The ordered set. Order is the step order — it is what ‹ and › walk. */
		options: ChoiceOption[];
		/** The selected `value`. An unknown value lands on the first option. */
		value: string;
		/** Called with the newly selected `value`. */
		onpick: (value: string) => void;
		/** Accessible name for the group, e.g. "Impact". */
		label?: string;
		/**
		 * Step past the ends and come around. Off by default: for a scale
		 * (low → critical) wrapping from the top back to the bottom is a
		 * misclick waiting to happen, and the disabled chevron is what tells you
		 * you are at the end. Turn it on for a set with no natural extremes.
		 */
		wrap?: boolean;
		disabled?: boolean;
		/** Width of the whole control. A row of them aligns when this matches. */
		width?: string;
		/** Colour for the value text — a per-value hue, if the set carries one. */
		color?: string;
		/** Extra classes on the host, so a page can place it. */
		class?: string;
	}

	let {
		options,
		value,
		onpick,
		label = 'Option',
		wrap = false,
		disabled = false,
		width = '156px',
		color,
		class: cls = ''
	}: StepSwitcherProps = $props();

	// An unknown value resolves to 0 rather than -1, so the control always shows
	// a real option and the chevrons always have somewhere to go.
	const i = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
	const current = $derived(options[i]);
	const atStart = $derived(i <= 0);
	const atEnd = $derived(i >= options.length - 1);

	function step(d: -1 | 1) {
		if (!options.length) return;
		const n = wrap
			? (i + d + options.length) % options.length
			: Math.min(options.length - 1, Math.max(0, i + d));
		if (n !== i) onpick(options[n].value);
	}

	const items = $derived<ActionMenuItem[]>(
		options.map((o) => ({
			label: o.label,
			selected: o.value === value,
			onclick: () => onpick(o.value)
		}))
	);

	function onkeydown(e: KeyboardEvent) {
		const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown')
			return;
		e.preventDefault();
		step(d);
	}
</script>

<div
	class="ss {cls}"
	class:is-disabled={disabled}
	role="group"
	aria-label={label}
	style={`--ss-w:${width}${color ? `; --ss-c:${color}` : ''}`}
>
	<button
		type="button"
		class="ss-b"
		tabindex="-1"
		aria-hidden="true"
		disabled={disabled || (atStart && !wrap)}
		onclick={() => step(-1)}
	>
		<Icon name="chevron-left" size={12} />
	</button>

	<ActionsMenu {items} placement="bottom-start" {disabled}>
		{#snippet trigger({ open, toggle })}
			<button
				type="button"
				class="ss-v"
				class:is-open={open}
				{disabled}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`${label}: ${current?.label ?? ''}`}
				title={current?.description ?? current?.label}
				onclick={toggle}
				{onkeydown}
			>
				{current?.label ?? ''}
			</button>
		{/snippet}
	</ActionsMenu>

	<button
		type="button"
		class="ss-b"
		tabindex="-1"
		aria-hidden="true"
		disabled={disabled || (atEnd && !wrap)}
		onclick={() => step(1)}
	>
		<Icon name="chevron-right" size={12} />
	</button>
</div>

<style>
	.ss {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		width: var(--ss-w);
		max-width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--bg);
		transition: border-color 0.12s;
	}
	.ss:hover:not(.is-disabled),
	.ss:focus-within {
		border-color: var(--border-strong);
	}
	.ss.is-disabled {
		opacity: 0.5;
	}

	/* ActionsMenu wraps the trigger snippet in its own span — it needs to behave
	   as the middle grid cell rather than shrink-wrap the label. */
	.ss :global(.trigger-wrap) {
		display: block;
		min-width: 0;
	}

	.ss-b {
		display: grid;
		place-items: center;
		width: 22px;
		height: 25px;
		border: 0;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		transition: color 0.12s;
	}
	.ss-b:hover:not(:disabled) {
		color: var(--fg);
	}
	.ss-b:disabled {
		opacity: 0.22;
		cursor: default;
	}

	.ss-v {
		display: block;
		width: 100%;
		height: 25px;
		padding: 0 0.15rem;
		border: 0;
		background: transparent;
		text-align: center;
		font-family: var(--mono);
		font-size: 0.72rem;
		/* Falls back to the plain value colour when no hue was passed. */
		color: var(--ss-c, var(--fg));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.ss-v:disabled {
		cursor: default;
	}
	.ss-v.is-open {
		background: var(--surface-strong);
	}
	.ss-v:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		border-radius: var(--radius-control);
	}
</style>
