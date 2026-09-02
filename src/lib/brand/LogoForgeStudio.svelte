<script lang="ts">
	// ── The forge, with the clock exposed ────────────────────────────────────────
	// `LogoForge` plays once, from the top, wherever it ships — in the breach
	// lobby it runs in front of the setup screen and cannot even be paused. So
	// every question you might have about a frame ("is the spin landing on the
	// rest pose?", "is the reveal front ahead of the sparks?") is unanswerable at
	// the place it actually runs.
	//
	// This is the answer to those: the same component, with its clock on a
	// scrubber and a jump to each beat. It adds nothing to the scene and changes
	// nothing about it — which is the point. A studio that renders a slightly
	// different thing from the shipped one is worse than no studio.
	//
	// It fills whatever box it is given rather than the viewport, so it drops
	// into a showcase page as easily as into a full-screen route.
	import LogoForge from './LogoForge.svelte';
	import { FORGE, FORGE_BEATS, beatAt } from './forge.js';

	interface Props {
		size?: number;
		/** Bind these to drive the studio from outside — a page with its own
		 *  toolbar, or a test that wants to park on one frame. */
		t?: number;
		playing?: boolean;
		/** Take the keyboard. On for a full-screen route; off when the studio is
		 *  one block on a page of them, where a stray `space` would be a surprise. */
		keys?: boolean;
	}

	let { size = 470, t = $bindable(0), playing = $bindable(true), keys = true }: Props = $props();

	let floor = $state(true);
	const beat = $derived(beatAt(t));

	const CAPTION: Record<string, string> = {
		matte: 'Matte — the mark as it ships. Flat, one colour, inert.',
		spin: 'Spin — the mesh is a tripod, and it turns on its top node.',
		ignition: 'Ignition — the hub takes, the mark collapses, and it comes back whole.',
		assembly: 'Assembly — sparks land core-first and close on the outline.',
		chrome: 'Chrome — forged cut, brushed field, one lamp on every edge.'
	};

	function onKey(e: KeyboardEvent) {
		if (!keys || e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key.toLowerCase();
		if (k === 'r') {
			t = 0;
			playing = true;
		} else if (e.key === ' ') playing = !playing;
		else if (e.key === 'ArrowLeft') t = Math.max(0, t - 250);
		else if (e.key === 'ArrowRight') t += 250;
		else if (k === 'g') floor = !floor;
		else if (k >= '1' && k <= '5') t = FORGE_BEATS[Number(k) - 1].at;
		else return;
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="studio">
	<!-- Never keyed and never remounted. The scene is a pure function of `t`, so
	     rewinding it is rewinding the clock — a studio that remounts to replay
	     would be testing a different code path from the one that ships. -->
	<LogoForge bind:t bind:playing {size} {floor} />

	<div class="caption">{CAPTION[beat]}</div>

	<div class="hud">
		<div class="beats">
			{#each FORGE_BEATS as b, i (b.beat)}
				<button class="chip" class:on={beat === b.beat} onclick={() => (t = b.at)}>
					{#if keys}<kbd>{i + 1}</kbd>{/if}{b.beat}
				</button>
			{/each}
		</div>
		<input
			class="scrub"
			type="range"
			min="0"
			max={FORGE.T_HELD + 6000}
			step="10"
			bind:value={t}
			aria-label="timeline"
		/>
		<div class="keys">
			{#if keys}
				<kbd>R</kbd> replay · <kbd>space</kbd> {playing ? 'pause' : 'play'} ·
				<kbd>←</kbd><kbd>→</kbd> scrub · <kbd>G</kbd> floor ·
			{/if}
			{(t / 1000).toFixed(2)}s
		</div>
	</div>
</div>

<style>
	.studio {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.caption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 104px;
		text-align: center;
		pointer-events: none;
		font-size: 0.78rem;
		letter-spacing: 0.06em;
		color: var(--fg);
		opacity: 0.62;
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	.hud {
		position: absolute;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		display: grid;
		gap: 8px;
		justify-items: center;
		width: min(640px, 88%);
	}
	.beats {
		display: flex;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--line, rgba(255, 255, 255, 0.12));
		background: rgba(8, 14, 20, 0.7);
		color: var(--fg);
		opacity: 0.55;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		cursor: pointer;
	}
	.chip.on {
		opacity: 1;
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-faint-strong, rgba(94, 234, 212, 0.12));
	}
	.scrub {
		width: 100%;
		accent-color: var(--accent);
	}
	.keys {
		font-size: 0.68rem;
		opacity: 0.42;
		color: var(--fg);
		font-family: var(--font-mono, ui-monospace, monospace);
	}
	kbd {
		font: inherit;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 4px;
		padding: 0 4px;
	}
</style>
