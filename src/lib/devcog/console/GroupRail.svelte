<script lang="ts">
	// The group switcher.
	//
	// Vertical because six labels do not fit a horizontal strip at this width,
	// and a rail leaves the whole panel width for the fader banks. Built here
	// rather than by adding an orientation to `navigation/Tabs.svelte`: that
	// file is depended on by product screens, has no keyboard handling at all,
	// and has no notion of a group being unavailable. One dev-only consumer is
	// not enough reason to grow it.
	import type { ToolGroup } from './types.js';

	interface GroupRailProps {
		groups: ToolGroup[];
		active: string;
		onselect: (id: string) => void;
	}

	let { groups, active, onselect }: GroupRailProps = $props();

	// Roving focus: one tab stop for the whole rail, arrows move within it.
	function onKeydown(e: KeyboardEvent) {
		const i = groups.findIndex((g) => g.id === active);
		if (i < 0) return;
		let next: number;
		if (e.key === 'ArrowDown') next = (i + 1) % groups.length;
		else if (e.key === 'ArrowUp') next = (i - 1 + groups.length) % groups.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = groups.length - 1;
		else return;
		e.preventDefault();
		onselect(groups[next].id);
		// Follow focus, or the arrow keys move the selection out from under the
		// keyboard user and leave them tabbing from where they started.
		(e.currentTarget as HTMLElement)
			.querySelectorAll<HTMLButtonElement>('[role="tab"]')
			[next]?.focus();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<nav
	class="dc-rail"
	role="tablist"
	aria-orientation="vertical"
	aria-label="Tool groups"
	onkeydown={onKeydown}
>
	{#each groups as g (g.id)}
		<button
			role="tab"
			class="dc-tab"
			class:dc-tab-on={active === g.id}
			class:dc-tab-gated={g.available === false}
			aria-selected={active === g.id}
			tabindex={active === g.id ? 0 : -1}
			title={g.available === false ? g.gate : g.label}
			onclick={() => onselect(g.id)}
		>
			<span class="dc-glyph">{g.glyph ?? '·'}</span>
			<span class="dc-tab-lab">{g.label}</span>
			{#if g.count}<span class="dc-count">{g.count > 9 ? '9+' : g.count}</span>{/if}
		</button>
	{/each}
</nav>

<style>
	.dc-rail {
		width: 52px;
		flex: none;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		padding-top: 6px;
	}
	.dc-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 7px 2px;
		border: none;
		border-left: 2px solid transparent;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		font-family: var(--mono, monospace);
		position: relative;
	}
	.dc-tab:hover {
		color: var(--fg);
	}
	.dc-tab:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -2px;
	}
	.dc-tab-on {
		color: var(--accent);
		border-left-color: var(--accent);
		background: var(--accent-faint);
	}
	/* Dimmed, not removed: the gate is information. */
	.dc-tab-gated {
		opacity: 0.38;
	}
	.dc-glyph {
		font-size: 0.9rem;
		line-height: 1;
	}
	.dc-tab-lab {
		font-size: 0.44rem;
		letter-spacing: 0.08em;
	}
	.dc-count {
		position: absolute;
		top: 3px;
		right: 5px;
		font-size: 0.44rem;
		background: var(--accent);
		color: var(--bg);
		border-radius: 6px;
		padding: 0 3px;
	}
</style>
