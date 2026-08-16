<script lang="ts">
	// Mesh Globe — agents spread over a sphere around the crest, spun by dragging.
	//
	// Exists to exercise physics/sphere against the real MeshStudio renderer rather
	// than against assertions: the tests can prove the maths, but only this shows
	// whether the thing reads as round.
	import { onMount } from 'svelte';
	import { Canvas, MeshStudio, GlobeFrame, packSphere, spin, project } from '$lib/index.js';
	import { orbitIntroStart, playOrbitIntro, registerGlobe } from '$lib/index.js';
	import type { StudioNode, StudioEdge, Vec3, OrbitIntroConfig } from '$lib/index.js';
	import { glyphForMode } from '$lib/icons/mode-tool-icons.js';

	const MODES = ['dns_proxy', 'supply_chain_proxy', 'github_runner', 'vendor_risk', 'hello_world'];
	const HUB = 'hub';
	const CX = 520;
	const CY = 360;
	const HUB_R = 58;
	const NODE_R = 40;

	// The globe camera's resting pose + its reusable orbit intro (physics/orbit).
	const REST = { yaw: 0.6, pitch: 0.35, viewDistance: 2.6 };
	const orbit: OrbitIntroConfig = { rest: REST };
	let orbitIntro = $state(true); // the on/off switch for the feature

	// Start at the orbit's far pose so the first frame is already pulled back, no
	// flash of REST before the fly-in begins.
	const START = orbitIntroStart(orbit);

	let count = $state(24);
	let yaw = $state(START.yaw);
	let pitch = $state(START.pitch);
	let viewDistance = $state(START.viewDistance);
	let showBack = $state(true);
	let showFrame = $state(true);
	let surface = $state(0.72);
	let backFade = $state(0.86);
	let backBlur = $state(2.4);

	// The sphere is the state; x/y is only ever a projection of it.
	const sphere = $derived(packSphere(Array(count).fill(NODE_R + 22), { margin: 12 }));
	const radius = $derived(Math.max(sphere.radius, HUB_R + 40 + NODE_R));

	const nodes = $derived.by((): StudioNode[] => {
		const out: StudioNode[] = [
			{ id: HUB, type: 'control-plane', state: 'healthy', label: 'armornet', x: CX, y: CY, r: HUB_R, glyphAsBody: true }
		];
		sphere.dirs.forEach((d: Vec3, i) => {
			const p = project(spin(d, yaw, pitch), radius, viewDistance);
			if (!p.front && !showBack) return;
			const mode = MODES[i % MODES.length];
			out.push({
				id: `n${i}`,
				type: 'agentic',
				state: i % 7 === 0 ? 'degraded' : 'healthy',
				label: mode,
				x: CX + p.x,
				y: CY + p.y,
				// Perspective scale is most of what reads as roundness.
				r: NODE_R * p.scale,
				// Visible through the surface, but not reachable through it.
				inert: !p.front,
				// The far side has to recede, or the globe reads as a flat ring of
				// discs. Nothing drawn BEHIND the nodes can do this.
				opacity: p.front ? 1 : 1 + p.depth * backFade,
				// Fading says faint; blur says "not on your focal plane". Together
				// they read as distance.
				blur: p.front ? 0 : -p.depth * backBlur,
				iconMarkup: glyphForMode(mode),
				iconKey: `glyph-${mode}`
			});
		});
		// Paint back to front. MeshStudio renders in array order, so sorting by
		// depth IS the hidden-surface pass — the crest's depth of 0 puts the far
		// half behind it and the near half in front.
		const depth = new Map<string, number>([[HUB, 0]]);
		sphere.dirs.forEach((d: Vec3, i) => depth.set(`n${i}`, spin(d, yaw, pitch).z));
		return out.sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);
	});

	const edges = $derived.by((): StudioEdge[] =>
		nodes.filter((n) => n.id !== HUB).map((n) => ({
			id: `e-${n.id}`,
			from: HUB,
			to: n.id,
			dataType: 'lifecycle',
			style: n.state === 'degraded' ? ('degraded' as const) : ('energy' as const),
			sig: 0.6
		}))
	);

	// Orbit-intro driver handle, so a drag (or a replay) can cancel a running fly-in.
	let cancelIntro: (() => void) | null = null;

	function stopIntro() {
		cancelIntro?.();
		cancelIntro = null;
	}

	// Play any intro config — the mockup's default (moon) on mount, or whatever the
	// DevCog hands over when you pick a different preset.
	function runIntro(cfg: OrbitIntroConfig = orbit) {
		stopIntro();
		const s = orbitIntroStart(cfg);
		yaw = s.yaw;
		pitch = s.pitch;
		viewDistance = s.viewDistance;
		cancelIntro = playOrbitIntro(cfg, (p) => {
			yaw = p.yaw;
			pitch = p.pitch;
			viewDistance = p.viewDistance;
		});
	}

	let drag: { x: number; y: number; yaw: number; pitch: number } | null = $state(null);
	const MAX_PITCH = (80 * Math.PI) / 180;
	function down(e: PointerEvent) {
		cancelIntro?.(); // grabbing the globe takes over from the fly-in
		drag = { x: e.clientX, y: e.clientY, yaw, pitch };
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
		pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, drag.pitch + (e.clientY - drag.y) * 0.008));
	}
	function up() {
		drag = null;
	}

	// Play the orbit intro on mount when the feature is on; otherwise sit at REST.
	onMount(() => {
		if (orbitIntro) runIntro();
		else ({ yaw, pitch, viewDistance } = REST);

		// Announce this globe to the DevCog so its globe controls appear. The cog
		// drives the same runIntro/stopIntro the local buttons do.
		const unregister = registerGlobe({
			id: 'mesh-globe',
			label: 'Mesh Globe',
			rest: REST,
			play: (cfg) => runIntro(cfg),
			cancel: () => stopIntro()
		});

		return () => {
			stopIntro();
			unregister();
		};
	});
</script>

<div class="wrap">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="stage"
		class:grabbing={!!drag}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={up}
	>
		<Canvas allowPan={false}>
			<!-- Before MeshStudio, so the web sits behind the nodes it carries. -->
			{#if showFrame}
				<GlobeFrame cx={CX} cy={CY} {radius} {yaw} {pitch} {viewDistance} {surface} />
			{/if}
			<MeshStudio concept="instrument" edgeCurve="line" {nodes} {edges} allowNodeDrag={false} allowLinkDraw={false} depthSortedParticles />
		</Canvas>
	</div>

	<aside class="panel">
		<h1>MESH GLOBE</h1>
		<p class="hint">Drag the globe to spin it.</p>

		<label for="g-count">Agents <b>{count}</b></label>
		<input id="g-count" type="range" min="3" max="60" step="1" bind:value={count} />

		<label for="g-dist">View distance <b>{viewDistance.toFixed(1)}</b></label>
		<input id="g-dist" type="range" min="1.4" max="6" step="0.1" bind:value={viewDistance} />

		<label for="g-yaw">Yaw <b>{((yaw * 180) / Math.PI).toFixed(0)}°</b></label>
		<input id="g-yaw" type="range" min="-3.14" max="3.14" step="0.01" bind:value={yaw} />

		<label for="g-pitch">Pitch <b>{((pitch * 180) / Math.PI).toFixed(0)}°</b></label>
		<input id="g-pitch" type="range" min="-1.4" max="1.4" step="0.01" bind:value={pitch} />

		<label for="g-surface">Surface <b>{surface.toFixed(2)}</b></label>
		<input id="g-surface" type="range" min="0" max="1" step="0.01" bind:value={surface} />

		<label for="g-fade">Far-side fade <b>{backFade.toFixed(2)}</b></label>
		<input id="g-fade" type="range" min="0" max="1" step="0.01" bind:value={backFade} />

		<label for="g-blur">Far-side blur <b>{backBlur.toFixed(1)}</b></label>
		<input id="g-blur" type="range" min="0" max="8" step="0.1" bind:value={backBlur} />

		<label class="check">
			<input type="checkbox" bind:checked={orbitIntro} />
			Orbit intro
		</label>

		<button class="replay" onclick={() => runIntro()}>▶ Replay intro</button>

		<label class="check">
			<input type="checkbox" bind:checked={showFrame} />
			Wireframe
		</label>

		<label class="check">
			<input type="checkbox" bind:checked={showBack} />
			Draw the far side
		</label>

		<dl>
			<dt>SPHERE R</dt><dd>{radius.toFixed(0)}</dd>
			<dt>DRAWN</dt><dd>{nodes.length - 1}/{count}</dd>
		</dl>
	</aside>
</div>

<style>
	.wrap { position: absolute; inset: 0; display: flex; background: var(--bg); }
	.stage { flex: 1; position: relative; cursor: grab; }
	.stage.grabbing { cursor: grabbing; }
	.panel {
		width: 250px; flex-shrink: 0; padding: 20px 18px;
		border-left: 1px solid var(--border); background: var(--surface);
		font-family: 'JetBrains Mono', monospace; overflow-y: auto;
	}
	h1 { font-size: 12px; letter-spacing: 0.2em; color: var(--fg); margin-bottom: 4px; }
	.hint { font-size: 10px; color: var(--fg-dim); margin-bottom: 18px; }
	label {
		display: flex; justify-content: space-between; align-items: center;
		font-size: 10px; letter-spacing: 0.1em; color: var(--fg-dim);
		text-transform: uppercase; margin: 14px 0 5px;
	}
	label b { color: var(--accent); font-weight: 500; }
	input[type='range'] { width: 100%; accent-color: var(--accent); }
	.check { justify-content: flex-start; gap: 9px; text-transform: none; cursor: pointer; }
	.replay {
		margin-top: 10px; width: 100%; padding: 7px; cursor: pointer;
		font-family: inherit; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
		color: var(--accent); background: transparent;
		border: 1px solid var(--border); border-radius: 3px;
	}
	.replay:hover { border-color: var(--accent); }
	dl {
		display: grid; grid-template-columns: 1fr auto; gap: 5px 10px;
		margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--border);
		font-size: 10px;
	}
	dt { color: var(--fg-dim); letter-spacing: 0.1em; }
	dd { color: var(--fg); text-align: right; }
</style>
