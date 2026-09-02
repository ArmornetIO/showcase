<script lang="ts">
	// Dev-cog controls for globe cameras. Drop into DevCog's `qaContent` snippet
	// alongside the other tools; it renders NOTHING until a globe registers itself
	// (globeRegistry), so it only appears on canvases that actually have one.
	//
	// Per globe: pick an intro variant and play it. This is the "play with the
	// intro" switch — the same physics/orbit primitive the globe uses on mount.
	// Plus the territory-wall height, for dialling in how far the walls stand off
	// the sphere without a rebuild.
	import { globeRegistry, type GlobeSurface } from '../../physics/globeRegistry.svelte.js';
	import { ORBIT_PRESETS, orbitConfigFor } from '../../physics/orbit.js';
	import { frameProbe } from '../../perf/frame-probe.js';

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

	function presetFor(id: string) {
		const wantId = picked[id] ?? ORBIT_PRESETS[0].id;
		return ORBIT_PRESETS.find((p) => p.id === wantId) ?? ORBIT_PRESETS[0];
	}
</script>

{#if globeRegistry.globes.length > 0}
	<div class="gdc">
		{#each globeRegistry.globes as globe (globe.id)}
			{@const preset = presetFor(globe.id)}
			<div class="gdc-globe">
				<div class="gdc-head">
					<span class="gdc-label">GLOBE · {globe.label}</span>
				</div>

				<div class="gdc-presets">
					{#each ORBIT_PRESETS as p (p.id)}
						<button
							class="gdc-btn"
							class:gdc-active={preset.id === p.id}
							title={p.description}
							onclick={() => (picked[globe.id] = p.id)}>{p.label}</button
						>
					{/each}
				</div>

				<p class="gdc-desc">{preset.description}</p>

				<div class="gdc-actions">
					<button class="gdc-play" onclick={() => globe.play(orbitConfigFor(preset, globe.rest))}>
						▶ Play intro
					</button>
					<button class="gdc-stop" onclick={() => globe.cancel()}>■ Stop</button>
				</div>

				<!-- ── Frame capture ──────────────────────────────────────────────
				     Arm, then make the move you want to measure. The capture stops
				     itself when that move ends, so there is no window to close and
				     nothing left running afterwards.

				     Two numbers matter. DROPPED is the count of frames that missed
				     16.7ms — the stutters you can actually feel, which an average
				     FPS cannot see. SCRIPT% is how much of the frame was our own
				     code: low means the cost is in what we asked the renderer to
				     redraw, and optimising the maths will not touch it. -->
				<div class="gdc-slider">
					<span class="gdc-label">FRAME CAPTURE</span>
					<div class="gdc-presets">
						<button
							class="gdc-btn"
							class:gdc-active={frameProbe.isArmed}
							onclick={() => {
								if (frameProbe.isArmed) frameProbe.stop();
								else frameProbe.arm(globe.label);
								probeTick++;
							}}>{frameProbe.isArmed ? '● Capturing…' : '◉ Arm'}</button
						>
						<button
							class="gdc-btn"
							title="Arm, then play the intro — the control case: same pose maths, no canvas zoom."
							onclick={() => {
								frameProbe.arm(`${globe.label} · intro`);
								globe.play(orbitConfigFor(preset, globe.rest));
								probeTick++;
							}}>Arm + intro</button
						>
					</div>
					{#key probeTick}
						<p class="gdc-desc gdc-probe">{frameProbe.format()}</p>
					{/key}
				</div>

				<!-- The two globes. One switch, because the three things it moves are
				     not independent — see MeshCanvas's `globeSurface`. -->
				{#if globe.setSurface}
					{@const surface = surfaces[globe.id] ?? globe.surface ?? 'relief'}
					<div class="gdc-slider">
						<span class="gdc-label">SURFACE</span>
						<div class="gdc-presets">
							{#each [{ id: 'relief', label: 'Relief' }, { id: 'flat', label: 'Flat' }] as s (s.id)}
								<button
									class="gdc-btn"
									class:gdc-active={surface === s.id}
									onclick={() => {
										surfaces[globe.id] = s.id as GlobeSurface;
										globe.setSurface?.(s.id as GlobeSurface);
									}}>{s.label}</button
								>
							{/each}
						</div>
						<p class="gdc-desc">
							Relief: ground, 3D pieces standing in it, walls standing up. Flat: a smooth sphere,
							disc nodes, walls lying on the surface.
						</p>
					</div>
				{/if}

				<!-- Only for globes that HAVE walls to raise. -->
				{#if globe.setWallHeight}
					{@const h = walls[globe.id] ?? globe.wallHeight ?? 0}
					<div class="gdc-slider">
						<div class="gdc-head">
							<span class="gdc-label">WALL HEIGHT</span>
							<span class="gdc-val">{h.toFixed(2)} R</span>
						</div>
						<input
							class="gdc-range"
							type="range"
							min="0"
							max={MAX_WALL}
							step="0.005"
							value={h}
							aria-label="Territory wall height"
							oninput={(e) => {
								const v = e.currentTarget.valueAsNumber;
								walls[globe.id] = v;
								globe.setWallHeight?.(v);
							}}
						/>
						<p class="gdc-desc">
							How far the territory walls stand off the sphere, in globe radii. 0 lays them flat on
							the surface.
						</p>
					</div>
				{/if}

				{#if globe.setRelief}
					{@const r = reliefs[globe.id] ?? globe.relief ?? 0}
					<div class="gdc-slider">
						<div class="gdc-head">
							<span class="gdc-label">RELIEF</span>
							<span class="gdc-val">{r.toFixed(3)} R</span>
						</div>
						<input
							class="gdc-range"
							type="range"
							min="0"
							max={MAX_RELIEF}
							step="0.002"
							value={r}
							aria-label="Terrain relief"
							oninput={(e) => {
								const v = e.currentTarget.valueAsNumber;
								reliefs[globe.id] = v;
								globe.setRelief?.(v);
							}}
						/>
						<p class="gdc-desc">
							How high the ground rolls, in globe radii. 0 is a perfectly smooth sphere with
							nothing to stand in.
						</p>
					</div>
				{/if}

				{#if globe.setPieceLean}
					{@const deg = ((leans[globe.id] ?? globe.pieceLean ?? 0) * 180) / Math.PI}
					<div class="gdc-slider">
						<div class="gdc-head">
							<span class="gdc-label">PIECE LEAN</span>
							<span class="gdc-val">{deg.toFixed(0)}°</span>
						</div>
						<input
							class="gdc-range"
							type="range"
							min="0"
							max={MAX_LEAN}
							step="1"
							value={deg}
							aria-label="3D piece lean"
							oninput={(e) => {
								const v = (e.currentTarget.valueAsNumber * Math.PI) / 180;
								leans[globe.id] = v;
								globe.setPieceLean?.(v);
							}}
						/>
						<p class="gdc-desc">
							How far the 3D pieces tip back toward you. 0 stands them straight out of the sphere,
							where the one facing you shows only its roof.
						</p>
					</div>
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
		gap: 0.45rem;
	}
	.gdc-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.gdc-label {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		color: var(--fg-dim);
	}
	.gdc-presets {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
	}
	.gdc-btn {
		padding: 0.32rem 0;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-elev);
		color: var(--fg-dim);
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease;
	}
	.gdc-btn:hover {
		border-color: var(--accent);
		color: var(--fg);
	}
	.gdc-active {
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.25);
	}
	.gdc-desc {
		margin: 0;
		font-size: 0.58rem;
		line-height: 1.4;
		color: var(--fg-dim);
	}
	/* Numbers, so they line up between one capture and the next — comparing two
	   runs is the entire use of this readout. */
	.gdc-probe {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		color: var(--accent);
		word-break: break-word;
	}
	.gdc-slider {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding-top: 0.45rem;
		border-top: 1px solid var(--border);
	}
	.gdc-val {
		font-size: 0.6rem;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.gdc-range {
		width: 100%;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.gdc-actions {
		display: flex;
		gap: 0.3rem;
	}
	.gdc-play,
	.gdc-stop {
		flex: 1;
		padding: 0.35rem 0;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
	}
	.gdc-play {
		border: 1px solid var(--accent);
		background: transparent;
		color: var(--accent);
	}
	.gdc-play:hover {
		background: rgba(94, 234, 212, 0.1);
	}
	.gdc-stop {
		border: 1px solid var(--border);
		background: var(--bg-elev);
		color: var(--fg-dim);
	}
	.gdc-stop:hover {
		border-color: var(--fg-dim);
		color: var(--fg);
	}
</style>
