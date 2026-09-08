<script lang="ts">
	// ── The card bench · panel ───────────────────────────────────────────────
	// Which card, who is standing in it, and every number the shot is made of.
	//
	// The knobs are grouped by WHAT THEY MOVE rather than by type, because that
	// is the question being asked at the bench: "the building is too close" is
	// one thought, and it should not require finding `e` in a list of eleven
	// sliders that also contains the camera's.
	//
	// The source box at the bottom is the point of the whole screen. Tuning a
	// card is worth nothing if the result lives in a browser tab, so the panel
	// prints exactly what changed, in the shape `card-scene.ts` keys on.
	import { SETTINGS, STAND_INS, type CardBench } from './cards.svelte.js';
	import { DOING_KEYS } from '$examples/breach/cards/card-scene.js';

	interface Props {
		bench: CardBench;
	}

	let { bench }: Props = $props();

	const live = $derived(bench.live);
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(bench.asSource());
		copied = true;
		setTimeout(() => (copied = false), 1400);
	}
</script>

{#snippet slide(
	label: string,
	value: number,
	min: number,
	max: number,
	step: number,
	set: (n: number) => void
)}
	<label class="row">
		<span>{label}</span>
		<input
			type="range"
			{min}
			{max}
			{step}
			{value}
			oninput={(e) => set(e.currentTarget.valueAsNumber)}
		/>
		<b>{value.toFixed(2)}</b>
	</label>
{/snippet}

<aside class="panel">
	<!-- ── What is being tuned ──────────────────────────────────────────── -->
	<div class="pick">
		<select value={bench.key} onchange={(e) => bench.select(e.currentTarget.value)}>
			{#each bench.cards as c (c.ability.key)}
				<option value={c.ability.key}>{c.ability.name}</option>
			{/each}
		</select>
		<p class="text">{bench.card.ability.text}</p>
	</div>

	<!-- The stand-in. A shot that only works for one body is a shot that breaks
	     the day somebody else is drawn in it. -->
	<section>
		<h4>Standing in</h4>
		<div class="who">
			<button class:active={!bench.standIn} onclick={() => (bench.standIn = null)}>Owner</button>
			{#each STAND_INS as c (c.key)}
				<button
					class:active={bench.standIn?.key === c.key}
					title={c.name}
					onclick={() => (bench.standIn = c)}>{c.shape}</button
				>
			{/each}
		</div>
	</section>

	<section>
		<h4>The cast</h4>
		<label class="row">
			<span>Doing</span>
			<select value={live.doing} onchange={(e) => bench.set('doing', e.currentTarget.value as never)}>
				{#each DOING_KEYS as d (d)}<option value={d}>{d}</option>{/each}
			</select>
		</label>
		{@render slide('In shot', live.cast, 1, 4, 1, (n) => bench.set('cast', n))}
		{@render slide('Lead ←→', live.lead.e, -4, 4, 0.05, (n) => bench.set('lead', { e: n }))}
		{@render slide('Lead depth', live.lead.n, -3, 6, 0.05, (n) => bench.set('lead', { n }))}
		<!-- Off the ground. Only matters on a card whose cast is not standing on
		     the planet — an upstairs room, a gantry — but on those it is the
		     difference between a figure in a window and a figure under it. -->
		{@render slide('Lead height', live.lead.h, -1, 3, 0.02, (n) => bench.set('lead', { h: n }))}
		{@render slide('Lead facing', live.lead.face, -3.2, 3.2, 0.05, (n) =>
			bench.set('lead', { face: n })
		)}
	</section>

	<section>
		<h4>The place</h4>
		<label class="row">
			<span>Building</span>
			<select
				value={live.setting}
				onchange={(e) => bench.set('setting', e.currentTarget.value || undefined)}
			>
				<option value="">— from the card —</option>
				{#each SETTINGS as s (s)}<option value={s}>{s}</option>{/each}
			</select>
		</label>
		{@render slide('←→', live.backdrop.e, -6, 6, 0.05, (n) => bench.set('backdrop', { e: n }))}
		{@render slide('Depth', live.backdrop.n, -2, 10, 0.05, (n) => bench.set('backdrop', { n }))}
		{@render slide('Size', live.backdrop.size, 0.3, 4, 0.05, (n) => bench.set('backdrop', { size: n }))}
		{@render slide('Turned', live.backdrop.face, -3.2, 3.2, 0.05, (n) =>
			bench.set('backdrop', { face: n })
		)}
		{@render slide('Lit', live.backdrop.tint, 0.1, 1, 0.02, (n) => bench.set('backdrop', { tint: n }))}
	</section>

	<section>
		<h4>The ground</h4>
		{@render slide('Lit', live.ground.tint, 0.05, 1, 0.02, (n) => bench.set('ground', { tint: n }))}
		{@render slide('Relief', live.ground.relief, 0, 2, 0.02, (n) => bench.set('ground', { relief: n }))}
		<!-- Where the ground STOPS. With an orthographic camera the far edge of the
		     patch is the skyline — there is no vanishing point to make one. -->
		{@render slide('Horizon', live.ground.far, 2, 20, 0.25, (n) => bench.set('ground', { far: n }))}
	</section>

	<section>
		<h4>The camera</h4>
		{@render slide('Bearing', live.yaw, -3.2, 3.2, 0.02, (n) => bench.set('yaw', n))}
		{@render slide('Tilt', live.pitch, -0.2, 0.9, 0.01, (n) => bench.set('pitch', n))}
		{@render slide('Pan ←→', live.look.e, -4, 4, 0.05, (n) => bench.set('look', { e: n }))}
		{@render slide('Dolly', live.look.n, -3, 8, 0.05, (n) => bench.set('look', { n }))}
		{@render slide('Height', live.look.h, -1, 5, 0.05, (n) => bench.set('look', { h: n }))}
		{@render slide('Width', live.look.width, 1.5, 12, 0.05, (n) => bench.set('look', { width: n }))}
	</section>

	<!-- ── Keeping it ───────────────────────────────────────────────────── -->
	<section class="out">
		<h4>
			The shot
			{#if bench.dirty}<button class="link" onclick={() => bench.revert()}>Revert</button>{/if}
		</h4>
		{#if bench.dirty}
			<pre>{bench.asSource()}</pre>
			<button class="keep" onclick={copy}>{copied ? 'Copied' : 'Copy for card-scene.ts'}</button>
		{:else}
			<p class="text">Untouched — this card prints what <code>card-scene.ts</code> says.</p>
		{/if}
	</section>
</aside>

<style>
	.panel {
		width: 320px;
		border-left: 1px solid var(--border);
		background: var(--surface-raised);
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.pick select {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--bg);
		color: var(--fg);
		font-size: 0.76rem;
	}
	.text {
		margin: 6px 0 0;
		font-size: 0.64rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	h4 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin: 0 0 2px;
		font-family: var(--mono);
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.row {
		display: grid;
		grid-template-columns: 62px 1fr 34px;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--fg-dim);
	}
	.row b {
		color: var(--fg);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.row select {
		grid-column: 2 / -1;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--bg);
		color: var(--fg);
		font-size: 0.62rem;
	}
	.row input[type='range'] {
		width: 100%;
	}

	.who {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.who button {
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		cursor: pointer;
	}
	.who button.active {
		border-color: var(--tone, #34d399);
		color: var(--fg);
	}

	.out pre {
		margin: 0;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.56rem;
		line-height: 1.45;
		white-space: pre-wrap;
		overflow-x: auto;
	}
	.keep {
		padding: 5px 10px;
		border: 1px solid color-mix(in srgb, var(--tone, #34d399) 45%, transparent);
		border-radius: 3px;
		background: color-mix(in srgb, var(--tone, #34d399) 12%, transparent);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.6rem;
		cursor: pointer;
	}
	.link {
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.54rem;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
