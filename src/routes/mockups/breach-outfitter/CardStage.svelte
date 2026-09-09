<script lang="ts">
	// ── The card, playing ────────────────────────────────────────────────────
	// The same `CardFace` the GAME deals, at a size you can work at, with the
	// clip clock wired into its cast. Nothing here is a preview of the card —
	// it IS the card, which is the only arrangement where tuning it means
	// anything.
	//
	// Drag to turn, exactly as the mannequin stage does, and writing through the
	// same value the panel's slider reads. Two paths to one number is how a
	// control starts disagreeing with the thing it moves.
	import CardFace from '$examples/breach/cards/CardFace.svelte';
	import { CLIPS } from '$lib/character/poses.js';
	import { FRAMES } from '$lib/character/poses.js';
	import type { CardBench } from './cards.svelte.js';

	interface Props {
		bench: CardBench;
	}

	let { bench }: Props = $props();

	// Quantised to the clip's frame count rather than run off a continuous clock
	// — the same reason the figure stage does it, and it matters more here: a
	// card is four hundred facets against a mannequin's two hundred, and every
	// one of them is re-projected and re-sorted on each tick.
	$effect(() => {
		if (bench.clip === 'still') return;
		const t = setInterval(
			() => (bench.frame = (bench.frame + 1 / FRAMES) % 1),
			1000 / (12 * bench.speed)
		);
		return () => clearInterval(t);
	});

	let drag: { x: number; y: number; yaw: number; pitch: number } | null = $state(null);

	function grab(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, yaw: bench.live.yaw, pitch: bench.live.pitch };
	}

	function turn(e: PointerEvent) {
		if (!drag) return;
		bench.set('yaw', drag.yaw + (e.clientX - drag.x) * 0.005);
		bench.set('pitch', Math.max(-0.2, Math.min(0.9, drag.pitch + (e.clientY - drag.y) * 0.003)));
	}

	const drop = () => (drag = null);
</script>

<div class="stage" class:turning={!!drag}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="hold"
		onpointerdown={grab}
		onpointermove={turn}
		onpointerup={drop}
		onpointercancel={drop}
	>
		<CardFace
			ability={bench.card.ability}
			fx={bench.fx}
			owner={bench.owner}
			skillMod={0}
			scale={bench.scale}
			shot={bench.edits}
			anim={bench.anim}
			raised
		/>
	</div>

	<footer class="deck">
		<div class="clips">
			{#each CLIPS as c (c.id)}
				<button
					class:active={bench.clip === c.id}
					title={c.hint}
					onclick={() => (bench.clip = c.id)}>{c.label}</button
				>
			{/each}
		</div>

		<!-- Offered only while something is moving. A slider that does nothing is a
		     slider you try twice. -->
		{#if bench.clip !== 'still'}
			<label class="knob">
				<span>Speed</span>
				<input type="range" min="0.2" max="3" step="0.05" bind:value={bench.speed} />
				<b>{bench.speed.toFixed(2)}×</b>
			</label>
		{/if}

		{#if bench.clip === 'walk'}
			<label class="knob">
				<span>Stride</span>
				<input type="range" min="0" max="0.8" step="0.01" bind:value={bench.stride} />
			</label>
			<label class="knob">
				<span>Arms</span>
				<input type="range" min="0" max="0.8" step="0.01" bind:value={bench.swing} />
			</label>
		{/if}

		<label class="knob wide">
			<span>Size</span>
			<input type="range" min="1" max="4" step="0.05" bind:value={bench.scale} />
			<b>{Math.round(136 * bench.scale)}px</b>
		</label>
	</footer>
</div>

<style>
	.stage {
		position: relative;
		min-height: 0;
		overflow: hidden;
		display: grid;
		grid-template-rows: 1fr auto;
	}

	.hold {
		display: grid;
		place-items: center;
		min-height: 0;
		padding: 16px;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.turning .hold {
		cursor: grabbing;
	}

	.deck {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 8px 14px;
		border-top: 1px solid var(--border);
		background: var(--surface-raised);
	}

	.clips {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.clips button {
		padding: 4px 10px;
		border: 0;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		cursor: pointer;
	}
	.clips button.active {
		background: color-mix(in srgb, var(--tone, #34d399) 18%, transparent);
		color: var(--fg);
	}

	.knob {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.knob.wide {
		margin-left: auto;
	}
	.knob input {
		width: 96px;
	}
	.knob b {
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
</style>
