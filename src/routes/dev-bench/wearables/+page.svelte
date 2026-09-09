<script lang="ts">
	// ── dev-bench/wearables — every worn item, on every build, from every side ──
	// Scaffolding for authoring `$lib/character/wearables.ts`, and the answer to
	// the five failures that file's header lists. Each of them is INVISIBLE in a
	// single view: a hat that does not turn looks correct face-on, a hat that
	// does not sort looks correct until the head is behind it, and a hat cut for
	// one skull looks correct on that skull. So the sheet is the cross product —
	// item × build × bearing — because that is the smallest thing that can show
	// a fault the previous overlay hid for its whole life.
	//
	//   ?yaws=0,60,120,180   bearings, degrees
	//   ?build=brute         one build instead of all four
	//   ?walk=1              mid-stride, to catch anything that fails to ride the bob
	//   ?only=emblem         items whose key starts with this
	//   ?cell=240            bigger cells — a chest badge is unreadable at 104px
	import Figure from '$lib/character/Figure.svelte';
	import { CHARACTERS } from '$lib/character/characters.js';
	import { WEARABLES } from '$lib/character/wearables.js';
	import { poseAt } from '$lib/character/poses.js';

	const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
	const yaws = (params.get('yaws') ?? '0,60,120,180')
		.split(',')
		.map((s) => (Number(s) * Math.PI) / 180);
	const only = params.get('build');
	const walk = params.get('walk') === '1';
	const pick = params.get('only');
	const cell = Number(params.get('cell') ?? 104);

	const who = $derived(only ? CHARACTERS.filter((c) => c.shape === only) : CHARACTERS);
	const items = Object.values(WEARABLES).filter((w) => !pick || w.key.startsWith(pick));
	// Mid-stride: the point in the cycle where a limb is furthest from rest,
	// which is where a crop that measured the bare body clips a foot and where
	// anything failing to ride the bob separates from the head. `poseAt` takes a
	// FRACTION of the cycle, not a frame index — a whole number is a whole
	// number of cycles, i.e. the rest pose, which is the one frame this is
	// useless at.
	const pose = walk ? poseAt('walk', 0.25) : undefined;
	const TRIM = '#F5B942';
</script>

<div class="sheet" style:--cell="{cell}px">
	{#each items as w (w.key)}
		<section>
			<h2>{w.key} <em>{w.anchor}{w.suppress ? ` · suppresses ${w.suppress.join(', ')}` : ''}</em></h2>
			<div class="row">
				{#each who as k (k.key)}
					{#each yaws as yaw (yaw)}
						<div class="cell">
							<Figure
								klass={k}
								crop="hero"
								shadow
								art={{ yaw, worn: [w.key], trim: TRIM, pose }}
							/>
							<span>{k.shape}</span>
						</div>
					{/each}
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.sheet {
		background: #0b1020;
		padding: 12px;
	}
	section {
		margin-bottom: 10px;
	}
	h2 {
		margin: 0 0 2px;
		font-family: var(--mono, monospace);
		font-size: 0.7rem;
		color: #cbd5e1;
		letter-spacing: 0.04em;
	}
	h2 em {
		color: #64748b;
		font-style: normal;
		font-size: 0.62rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}
	.cell {
		position: relative;
		width: var(--cell);
		height: calc(var(--cell) * 1.27);
	}
	.cell span {
		position: absolute;
		left: 2px;
		bottom: 0;
		font-family: var(--mono, monospace);
		font-size: 0.5rem;
		color: #475569;
	}
</style>
