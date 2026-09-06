<script lang="ts">
	// Dev-console controls for globe cameras and the accelerated layers under
	// them. Contributed as the RENDER and GLOBE groups; `only` picks which half,
	// because the console gives them separate rail entries — a combined canvas
	// group measured 1,289px against ~700px of usable height.
	//
	// Every explanation here is a `detail=` on the control it explains. This file
	// used to carry 191 words of standing paragraphs, which is most of the reason
	// the old panel could not be read.
	import { globeRegistry, type GlobeSurface } from '../../physics/globeRegistry.svelte.js';
	import { ORBIT_PRESETS, orbitConfigFor } from '../../physics/orbit.js';
	import { frameProbe } from '../../perf/frame-probe.js';
	import { renderTunables } from '../gl/render-tunables.svelte.js';
	import Fader from '../../devcog/controls/Fader.svelte';
	import FaderBank from '../../devcog/controls/FaderBank.svelte';
	import InfoDot from '../../devcog/controls/InfoDot.svelte';
	import Seg from '../../devcog/controls/Seg.svelte';
	import ControlRow from '../../devcog/controls/ControlRow.svelte';

	interface GlobeDevControlsProps {
		/**
		 * Which half to render. Omitted renders both, which is what a host with a
		 * single flat panel still wants.
		 */
		only?: 'render' | 'globe';
	}

	let { only }: GlobeDevControlsProps = $props();

	/** Bumped to re-read the probe's report. The probe holds NO reactive state on
	 *  purpose — writing `$state` sixty times a second is a cost the measurement
	 *  would then be measuring — so the cog pulls the result instead of being
	 *  pushed it. A counter is the whole subscription. */
	let probeTick = $state(0);
	// A capture ends itself when the move it was watching ends, so poll slowly
	// while one is running and stop as soon as it is not.
	$effect(() => {
		if (!frameProbe.isArmed) return;
		const t = setInterval(() => probeTick++, 250);
		return () => clearInterval(t);
	});

	// Selected preset per globe id — defaults to the first (moon orbit).
	let picked = $state<Record<string, string>>({});
	// Wall height per globe id. Held HERE and pushed one-way into the globe: the
	// handle carries a starting value, not a live reading, so a slider that read
	// back from it would fight its own writes.
	let walls = $state<Record<string, number>>({});
	// Same one-way arrangement for the 3D pieces' lean, in radians.
	let leans = $state<Record<string, number>>({});
	// …and for the terrain's relief, in globe radii.
	let reliefs = $state<Record<string, number>>({});
	// …and for which of the two globes is being drawn.
	let surfaces = $state<Record<string, GlobeSurface>>({});

	/** Ceiling on the slider. Past roughly a quarter of the globe's radius the
	 *  walls of the far territories start showing over the near ones' crests, which
	 *  stops reading as a boundary — so this is where a useful range ends, not
	 *  where the projection breaks. */
	const MAX_WALL = 0.25;
	/** Past ~35° a piece's far base edge visibly lifts off the ground it is
	 *  standing on, and the lean starts reading as a mistake rather than a view. */
	const MAX_LEAN = 35;
	/** Relief is measured against the node radii standing on it: much past 0.06 of
	 *  a globe radius the hills are taller than the buildings, and the mesh starts
	 *  reading as a landscape with some markers lost in it. */
	const MAX_RELIEF = 0.12;

	// The measured sweet spots, drawn on the tracks. These used to be the
	// paragraphs; a tick says the same thing in the place you are already looking.
	const REF_DPR = 1.25;
	const REF_WALL = 0.06;
	const REF_RELIEF = 0.012;
	const REF_LEAN = 12;

	const DPR_DETAIL =
		'Biggest single lever measured on the marketing page at dpr 2, ±6% noise. Late frames/s — 2.0: 38.5 · 1.5: 21.8 · 1.25: 14.8 · 1.0: 11.6. The tick is the measured sweet spot.';
	const MSAA_DETAIL =
		'Measured a wash here: 22.15/s off vs 21.84/s on. A context-creation attribute, so it needs a reload to take effect — which is exactly why it is saved.';
	const SURFACE_DETAIL =
		'Relief: ground, 3D pieces standing in it, walls standing up. Flat: a smooth sphere, disc nodes, walls lying on the surface. One switch, because the three things it moves are not independent.';
	const WALL_DETAIL =
		'How far the territory walls stand off the sphere, in globe radii. 0 lays them flat on the surface.';
	const RELIEF_DETAIL =
		'How high the ground rolls, in globe radii. 0 is a perfectly smooth sphere with nothing to stand in.';
	const LEAN_DETAIL =
		'How far the 3D pieces tip back toward you. 0 stands them straight out of the sphere, where the one facing you shows only its roof.';
	const PROBE_DETAIL =
		'DROPPED is frames that missed 16.7ms — the stutters you can feel, which an average FPS cannot see. SCRIPT% is how much of the frame was our own code: low means the cost is in what we asked the renderer to redraw, and optimising the maths will not touch it. The capture stops itself when the move it was watching ends.';

	const SURFACES = [
		{ value: 'relief', label: 'relief' },
		{ value: 'flat', label: 'flat' }
	];

	const ORBIT_OPTIONS = ORBIT_PRESETS.map((p) => ({
		value: p.id,
		label: p.label,
		title: p.description
	}));

	function presetFor(id: string) {
		const wantId = picked[id] ?? ORBIT_PRESETS[0].id;
		return ORBIT_PRESETS.find((p) => p.id === wantId) ?? ORBIT_PRESETS[0];
	}
</script>

<!-- Outside the globe gate on purpose: these dials govern every accelerated
     layer on the page, not just a registered globe, and the page that most needs
     them (six live contexts) is not the one with a registry entry. -->
{#if only !== 'globe'}
	<FaderBank>
		<Fader
			label="density"
			value={renderTunables.dprCeiling}
			min={0.5}
			max={3}
			step={0.25}
			reference={REF_DPR}
			applies="resize"
			format={(v) => `${v.toFixed(2)}×`}
			detail={DPR_DETAIL}
			oninput={(v) => {
				renderTunables.dprCeiling = v;
				renderTunables.save();
			}}
		/>
		<div class="gdc-strip">
			<label class="gdc-check">
				<input
					type="checkbox"
					bind:checked={renderTunables.antialias}
					onchange={() => renderTunables.save()}
				/>
				<span class="gdc-lab">msaa</span>
				<span class="gdc-badge">reload</span>
				<InfoDot detail={MSAA_DETAIL} />
			</label>
			<button class="gdc-btn" onclick={() => renderTunables.reset()}>reset</button>
		</div>
	</FaderBank>
{/if}

{#if only !== 'render' && globeRegistry.globes.length > 0}
	<div class="gdc">
		{#each globeRegistry.globes as globe (globe.id)}
			{@const preset = presetFor(globe.id)}
			<div class="gdc-globe">
				{#if globeRegistry.globes.length > 1}
					<ControlRow label={globe.label} />
				{/if}

				<Seg
					options={ORBIT_OPTIONS}
					value={preset.id}
					onchange={(v) => (picked[globe.id] = v)}
				/>

				<div class="gdc-btns">
					<button
						class="gdc-btn gdc-go"
						onclick={() => globe.play(orbitConfigFor(preset, globe.rest))}>▶ intro</button
					>
					<button class="gdc-btn" onclick={() => globe.cancel()}>■ stop</button>
					<!-- "probe", not "arm": the cluster's inspector is the armed thing
					     in this tool, and two arms is one too many. -->
					<button
						class="gdc-btn"
						class:gdc-on={frameProbe.isArmed}
						onclick={() => {
							if (frameProbe.isArmed) frameProbe.stop();
							else frameProbe.arm(globe.label);
							probeTick++;
						}}>{frameProbe.isArmed ? '● probing' : '◉ probe'}</button
					>
					<button
						class="gdc-btn"
						title="Probe the intro — the control case: same pose maths, no canvas zoom."
						onclick={() => {
							frameProbe.arm(`${globe.label} · intro`);
							globe.play(orbitConfigFor(preset, globe.rest));
							probeTick++;
						}}>+intro</button
					>
					<InfoDot detail={PROBE_DETAIL} />
				</div>

				<!-- Numbers, so they line up between one capture and the next —
				     comparing two runs is the entire use of this readout. -->
				{#key probeTick}
					<p class="gdc-probe">{frameProbe.format()}</p>
				{/key}

				{#if globe.setSurface}
					{@const surface = surfaces[globe.id] ?? globe.surface ?? 'relief'}
					<ControlRow label="surface" detail={SURFACE_DETAIL} />
					<Seg
						options={SURFACES}
						value={surface}
						onchange={(v) => {
							surfaces[globe.id] = v as GlobeSurface;
							globe.setSurface?.(v as GlobeSurface);
						}}
					/>
				{/if}

				{#if globe.setWallHeight || globe.setRelief || globe.setPieceLean}
					<FaderBank>
						{#if globe.setWallHeight}
							<Fader
								label="wall"
								value={walls[globe.id] ?? globe.wallHeight ?? 0}
								min={0}
								max={MAX_WALL}
								step={0.005}
								reference={REF_WALL}
								format={(v) => v.toFixed(2)}
								detail={WALL_DETAIL}
								oninput={(v) => {
									walls[globe.id] = v;
									globe.setWallHeight?.(v);
								}}
							/>
						{/if}
						{#if globe.setRelief}
							<Fader
								label="relief"
								value={reliefs[globe.id] ?? globe.relief ?? 0}
								min={0}
								max={MAX_RELIEF}
								step={0.002}
								reference={REF_RELIEF}
								format={(v) => v.toFixed(3)}
								detail={RELIEF_DETAIL}
								oninput={(v) => {
									reliefs[globe.id] = v;
									globe.setRelief?.(v);
								}}
							/>
						{/if}
						{#if globe.setPieceLean}
							<Fader
								label="lean"
								value={((leans[globe.id] ?? globe.pieceLean ?? 0) * 180) / Math.PI}
								min={0}
								max={MAX_LEAN}
								step={1}
								reference={REF_LEAN}
								format={(v) => `${v.toFixed(0)}°`}
								detail={LEAN_DETAIL}
								oninput={(deg) => {
									const v = (deg * Math.PI) / 180;
									leans[globe.id] = v;
									globe.setPieceLean?.(v);
								}}
							/>
						{/if}
					</FaderBank>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.gdc {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		font-family: var(--mono);
	}
	.gdc-globe {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Bottom-aligned beside the fader so the checkbox and the track share a
	   baseline; without it the strip floats against a 96px column. */
	.gdc-strip {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 8px;
		padding-bottom: 18px;
		flex: 2;
	}
	.gdc-check {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.gdc-lab {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.gdc-badge {
		font-family: var(--mono, monospace);
		font-size: 0.48rem;
		padding: 0 3px;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--fg-dim);
	}

	.gdc-btns {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.gdc-btn {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		white-space: nowrap;
	}
	.gdc-btn:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.gdc-go,
	.gdc-on {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.gdc-probe {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.55rem;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
		color: var(--accent);
		word-break: break-word;
	}
</style>
