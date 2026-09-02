<script lang="ts">
	// ── dev-bench/particles — SMIL vs GL, same particles, same page ──────────────
	// Scaffolding, not a component. It exists because the working tree carries a
	// lot of unrelated uncommitted work, so "measure HEAD against now" would have
	// compared two trees that differ by far more than the technique under test.
	// This compares ONLY the technique: identical edge geometry, identical particle
	// count, identical colours, rendered twice by two renderers.
	//
	// `?mode=svg` is a faithful copy of the markup EdgeParticles replaced — motion
	// path defs, `<animateMotion>` per particle, `feGaussianBlur` per particle. It
	// is duplicated here rather than imported because it no longer exists in the
	// product, and a benchmark that measures something you do not ship is worthless.
	//
	// Delete this route once the numbers are recorded.
	import { setContext } from 'svelte';
	import { CANVAS_CTX, type CanvasContextValue } from '$lib/primitives/canvas/canvas-camera.js';
	import EdgeParticles from '$lib/mesh-studio/EdgeParticles.svelte';
	import type { ParticleRun } from '$lib/mesh-studio/gl/particle-instances.js';
	import { bowControl, edgePathBetween } from '$lib/primitives/canvas/edge-path.js';

	const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
	const mode = params.get('mode') ?? 'gl';
	const edgeCount = Number(params.get('edges') ?? 40);
	const perEdge = Number(params.get('count') ?? 6);

	const W = 1200;
	const H = 800;

	// A radial spray of bows — the shape a mesh actually makes, and long enough
	// that a particle spends real time on screen rather than blinking at a node.
	const edges = Array.from({ length: edgeCount }, (_, i) => {
		const t = (i / edgeCount) * Math.PI * 2;
		const inner = 130;
		const outer = 360;
		return {
			id: `e${i}`,
			a: { x: W / 2 + Math.cos(t) * inner, y: H / 2 + Math.sin(t) * inner },
			b: { x: W / 2 + Math.cos(t + 0.7) * outer, y: H / 2 + Math.sin(t + 0.7) * outer },
			color: ['#22D3EE', '#A78BFA', '#FB923C', '#4ADE80'][i % 4]
		};
	});

	const DUR = 3;
	const SIZE = 2.2;

	const runs: ParticleRun[] = edges.map((e) => ({
		a: e.a,
		b: e.b,
		curve: 'bow' as const,
		color: e.color,
		dur: DUR,
		count: perEdge,
		size: SIZE
	}));

	// EdgeParticles reads `ctx.transform` and nothing else off the canvas context.
	const transform = $state({ tx: 0, ty: 0, tk: 1 });
	setContext(CANVAS_CTX, { transform } as unknown as CanvasContextValue);

	const total = edgeCount * perEdge;
	if (typeof window !== 'undefined') {
		(window as unknown as Record<string, unknown>).__bench = { mode, edgeCount, perEdge, total };
	}
</script>

<!-- A fixed W×H box, and NO viewBox. Production MeshStudio sizes its svg to the
     canvas and does its own `translate/scale` in a `<g>`, so world units are CSS
     pixels there; a viewBox here would scale the svg and not the GL canvas, and
     the two renderers would disagree about where a particle is for a reason the
     product does not have. -->
<div class="bench" data-mode={mode} data-total={total}>
	<div class="stage-box" style:width="{W}px" style:height="{H}px">
	<svg class="stage" width={W} height={H}>
		<defs>
			{#if mode === 'svg'}
				<filter id="b-particle" x="-400%" y="-400%" width="900%" height="900%">
					<feGaussianBlur stdDeviation="1.6" result="b" />
					<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
				</filter>
				{#each edges as e (e.id)}
					<path id="bp-{e.id}" d={edgePathBetween(e.a, e.b, 'bow')} fill="none" stroke="none" />
				{/each}
			{/if}
		</defs>

		<!-- The lines themselves are identical in both modes, so they cancel out of
		     the comparison and whatever is left is the particles. -->
		{#each edges as e (e.id)}
			{@const c = bowControl(e.a, e.b)}
			<path
				d="M {e.a.x} {e.a.y} Q {c.cx} {c.cy} {e.b.x} {e.b.y}"
				fill="none"
				stroke={e.color}
				stroke-opacity="0.18"
				stroke-width="1.2"
			/>
		{/each}

		{#if mode === 'svg'}
			{#each edges as e (e.id)}
				{#each Array.from({ length: perEdge }, (_, i) => i) as i (i)}
					<circle r={SIZE} fill={e.color} opacity="0" filter="url(#b-particle)">
						<animateMotion dur="{DUR}s" repeatCount="indefinite" begin="{(i / perEdge) * DUR}s">
							<mpath href="#bp-{e.id}" />
						</animateMotion>
						<animate
							attributeName="opacity"
							from="0"
							to="1"
							begin="{(i / perEdge) * DUR}s"
							dur="0.01s"
							fill="freeze"
						/>
					</circle>
				{/each}
			{/each}
		{/if}
	</svg>

	{#if mode === 'gl'}
		<EdgeParticles {runs} />
	{/if}
	</div>
</div>

<style>
	.bench {
		position: fixed;
		inset: 0;
		background: #060910;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.stage-box {
		position: relative;
	}
	.stage {
		position: absolute;
		inset: 0;
	}
</style>
