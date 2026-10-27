<script lang="ts">
	// The in-game menu every BREACH game opens from the same gear. Esc is not
	// its key: in a first-person game the browser spends Esc on releasing the
	// mouse, and a menu that opened on it hid the very scene a free cursor was
	// freed to click around in. What a game adds (text size, rules) is
	// `children`; resume and leave are the same everywhere.
	import { Button, HudCard, Icon } from 'showcase';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		open?: boolean;
		/** Back into play: the first-person games recapture the mouse here. */
		onresume?: () => void;
		/** Ends the match for the table. Absent for a player who may not. */
		onleave?: () => void;
		note?: string;
		children?: Snippet;
		class?: string;
	}

	let { title, open = $bindable(false), onresume, onleave, note, children, class: cls = '' }: Props = $props();

	function resume() {
		open = false;
		onresume?.();
	}
</script>

<!-- Capture, and immediate: the game's own window handler would otherwise
     spend the same Esc clearing a selection behind the menu. -->
<svelte:window
	onkeydowncapture={(e) => {
		if (!open || e.key !== 'Escape') return;
		e.stopImmediatePropagation();
		open = false;
	}}
/>

<button type="button" class="gear {cls}" aria-label="Game menu" aria-expanded={open} onclick={() => (open = !open)}>
	<Icon name="settings" size={16} />
</button>

{#if open}
	<div class="menu" role="dialog" aria-label="Game menu">
		<HudCard eyebrow="BREACH" {title}>
			<div class="rows">
				{@render children?.()}
				<div class="actions">
					<Button variant="primary" onclick={resume}>Resume</Button>
					{#if onleave}
						<Button variant="ghost-danger" onclick={onleave}>Back to lobby</Button>
					{/if}
				</div>
				{#if note}
					<p class="note">{note}</p>
				{/if}
			</div>
		</HudCard>
	</div>
{/if}

<style>
	.gear {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid var(--border);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
		color: var(--fg-muted);
		cursor: pointer;
	}
	.gear:hover,
	.gear[aria-expanded='true'] {
		color: var(--fg);
	}
	.menu {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--bg) 55%, transparent);
	}
	.rows {
		display: grid;
		gap: var(--sp-3);
	}
	.actions {
		display: flex;
		gap: var(--sp-2);
	}
	.note {
		margin: 0;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: var(--t-micro);
	}
</style>
