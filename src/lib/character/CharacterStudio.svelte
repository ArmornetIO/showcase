<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// CHARACTER STUDIO — a turntable for the four figures.
	//
	// Third of the builder's studios, and deliberately the same shape as the
	// other two: a bare <dialog> rather than `Modal` (Modal is title/body/footer
	// at a fixed size; this is a full-bleed stage), header of wordmark · pills ·
	// close, and one live subject in the middle.
	//
	// THE PANEL IS NOT HAND-WRITTEN. `character-knobs.ts` declares what can be
	// tuned and `BackdropControls` draws it — the same generated panel the
	// Möbius backdrop and the standalone families use. A studio with its own
	// bespoke sliders is a third copy of a swatch, an alpha slider and a
	// modified-pip to keep in step with the other two.
	//
	// STILL NOT EDITING BUILDS. `head`, `chest`, `reach`, `tall` stay a read-out:
	// there is nowhere to SAVE a build to yet, and authoring into a void is the
	// mistake the backdrop tool made when its compositions had no way back to
	// the canvas. Camera and colour are safe to expose because they are view
	// state — nothing about the character changes when you turn it round.

	import type { Snippet } from 'svelte';
	import BackdropControls from '../backdrop/BackdropControls.svelte';
	import type { Knob } from '../backdrop/backdrop-tokens.js';
	import Figure from './Figure.svelte';
	import { CHARACTERS, SHAPE_NOTE, type CharacterSkin } from './characters.js';
	import { BUILDS } from './builds.js';
	import { characterKnobs, readKnobs, setAngle } from './character-knobs.js';
	import { CLIPS, FRAMES, poseAt, REST, type ClipId } from './poses.js';
	import { lampLevel, statusById, STATUSES, type StatusId } from './status.js';

	interface Props {
		open: boolean;
		onclose: () => void;
		/**
		 * A second way of looking at the character, rendered instead of the
		 * turntable when the stage is switched to it.
		 *
		 * A SNIPPET rather than an import, and that is the whole design. The thing
		 * this slot exists for is breach's first-person cutaway, which knows about
		 * cards, shots and a board — none of which `src/lib` may know about, since
		 * a library that imports an example has been turned inside out. So the
		 * studio declares a hole the shape of "given this character, draw
		 * something", and the route that mounts both fills it.
		 *
		 * Absent, the toggle does not appear at all: a mode switch with one mode is
		 * a control that does nothing.
		 */
		pov?: Snippet<[CharacterSkin, string]>;
		/** What to call it on the toggle. */
		povLabel?: string;
	}

	let { open, onclose, pov, povLabel = 'First person' }: Props = $props();

	/**
	 * Turntable or the slot. Reset when the studio closes rather than left
	 * standing: the POV view runs a globe and an animation loop, and a modal
	 * reopened into a mode the operator picked four sessions ago is a modal that
	 * appears to have opened into the wrong thing.
	 */
	let stage = $state<'turntable' | 'pov'>('turntable');
	$effect(() => {
		if (!open) stage = 'turntable';
	});
	const inPov = $derived(stage === 'pov' && !!pov);

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let i = $state(0);

	const base = $derived(characterKnobs(CHARACTERS[i].color));
	let knobs = $state<Knob[]>(characterKnobs(CHARACTERS[i].color));

	const tuned = $derived(readKnobs(knobs));
	/** The character as painted: its own build and name, wearing whatever plate
	 *  the panel currently says. */
	const who = $derived({ ...CHARACTERS[i], color: tuned.plate });
	const build = $derived(BUILDS[CHARACTERS[i].shape]);

	/** Selecting a character reseats the colour knobs on ITS plate, but keeps the
	 *  camera — turning the model and then cycling to compare the same angle is
	 *  the whole reason to have both controls on one screen. */
	function pick(n: number) {
		const keep = knobs.filter((k) => k.kind === 'param');
		i = n;
		knobs = characterKnobs(CHARACTERS[n].color).map(
			(k) => keep.find((x) => x.kind === 'param' && k.kind === 'param' && x.prop === k.prop) ?? k
		);
	}

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	const step = (d: number) => pick((i + d + CHARACTERS.length) % CHARACTERS.length);

	// ── Drag to turn ────────────────────────────────────────────────────────
	// Grabbing the model is how anybody expects to rotate one, and it writes
	// through the SAME knobs the sliders do — two paths to one value is how a
	// panel starts disagreeing with the thing it is meant to describe.
	let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;

	function grab(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, yaw: tuned.yaw, pitch: tuned.pitch };
	}

	function turn(e: PointerEvent) {
		if (!drag) return;
		// A quarter turn per ~300px across, and a gentler rate vertically because
		// pitch has a tenth of the useful range yaw does.
		knobs = setAngle(knobs, 'yaw', drag.yaw + (e.clientX - drag.x) * 0.005);
		knobs = setAngle(knobs, 'pitch', drag.pitch + (e.clientY - drag.y) * 0.003);
	}

	const drop = () => (drag = null);

	// ── The clip ────────────────────────────────────────────────────────────
	// `frame` is an integer step, not a timestamp: `poseAt` is quantised so a
	// cycle is a loop of cached pictures rather than a fresh cull per tick. See
	// the note at the top of `poses.ts`.
	let clip = $state<ClipId>('still');
	let playing = $state(true);
	let frame = $state(0);

	const pose = $derived(
		clip === 'still' ? REST : poseAt(clip, (frame % FRAMES) / FRAMES, tuned.clip)
	);

	// ── Status ──────────────────────────────────────────────────────────────
	let status = $state<StatusId>('nominal');
	const alarm = $derived(statusById(status));
	/** A pulse is measured in frames of the same clock the walk runs on, so one
	 *  timer drives both and a flashing visor cannot drift out of step with the
	 *  stride it is flashing over. */
	const beatSteps = $derived(
		Math.max(2, Math.round(FRAMES / Math.max(0.25, alarm.rate || 1)))
	);
	const glow = $derived(lampLevel(alarm, frame, beatSteps));

	/** The clock has two customers now. It runs if EITHER wants it — a hostile
	 *  character standing still still has to flash. */
	const ticking = $derived(playing && (clip !== 'still' || alarm.pulse > 0));

	$effect(() => {
		if (!open || !ticking) return;
		// Driven off the clock rather than rAF: the pose only changes FRAMES times
		// a cycle, so waking on every repaint would be up to four wasted wake-ups
		// for every one that draws something new.
		const ms = 1000 / (FRAMES * Math.max(0.1, tuned.speed));
		const t = setInterval(() => (frame += 1), ms);
		return () => clearInterval(t);
	});

	/** Scrubbing means holding a frame, so it stops the clock. */
	function scrub(n: number) {
		playing = false;
		frame = ((n % FRAMES) + FRAMES) % FRAMES;
	}

	/** The build, as the four numbers that actually differ between roles. A
	 *  read-out rather than controls — see the note at the top. */
	const specs = $derived([
		['head', build.head.toFixed(2)],
		['chest', build.chest.toFixed(2)],
		['reach', build.reach.toFixed(2)],
		['tall', build.tall.toFixed(2)]
	]);
</script>

<dialog
	class="cs-modal"
	bind:this={dialogEl}
	aria-labelledby="cs-wordmark"
	{onclose}
	onkeydown={(e) => {
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
	}}
	onclick={(e) => {
		if (e.target === dialogEl) onclose();
	}}
>
	<!-- Two colours, because they answer different questions: `--kc` is WHO this
	     is and stays put, `--lamp` is what is happening to them and moves. -->
	<div class="cs-shell" style:--kc={who.color} style:--lamp={alarm.lamp ?? who.color}>
		<div class="cs-header">
			<span class="cs-wordmark" id="cs-wordmark">CHARACTER STUDIO</span>
			<div class="cs-pills">
				{#each CHARACTERS as c, n (c.key)}
					<button
						class="cs-pill"
						class:on={n === i}
						style:--pc={c.color}
						onclick={() => pick(n)}>{c.name.replace(/^The /, '')}</button
					>
				{/each}
			</div>
			<span class="cs-spacer"></span>
			{#if pov}
				<div class="cs-modes">
					{#each [
						{ id: 'turntable' as const, label: 'Turntable' },
						{ id: 'pov' as const, label: povLabel }
					] as m (m.id)}
						<button
							class="cs-mode"
							class:on={stage === m.id}
							onclick={() => (stage = m.id)}>{m.label}</button
						>
					{/each}
				</div>
			{/if}
			<button class="cs-close" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="cs-body">
			<button class="cs-arrow" onclick={() => step(-1)} aria-label="Previous character">‹</button>

			<!-- The stage takes the drag; the arrows and the panel sit outside it so
			     a slider drag never turns the model.

			     In POV the handlers come off entirely rather than being ignored: the
			     slot mounts a globe with its own pointer behaviour, and a parent
			     capturing the pointer to spin a turntable that is not on screen eats
			     the drag the thing on screen wanted. -->
			<div
				class="cs-stage"
				class:dragging={!!drag && !inPov}
				class:bare={inPov}
				role="presentation"
				onpointerdown={inPov ? undefined : grab}
				onpointermove={inPov ? undefined : turn}
				onpointerup={inPov ? undefined : drop}
				onpointercancel={inPov ? undefined : drop}
			>
				{#if inPov}
					{@render pov?.(who, tuned.suit)}
				{:else}
				<div class="cs-glow"></div>
				<div class="cs-figure">
					<Figure
						klass={who}
						crop="hero"
						shadow
						art={{
							yaw: tuned.yaw,
							pitch: tuned.pitch,
							suit: tuned.suit,
							pose,
							lamp: alarm.lamp,
							glow
						}}
					/>
				</div>
				<span class="cs-drag-hint">drag to turn</span>
				{/if}
			</div>

			<button class="cs-arrow" onclick={() => step(1)} aria-label="Next character">›</button>

			<aside class="cs-panel">
				{#snippet section(title: string, group: 'colour' | 'shape' | 'motion')}
					<div class="cs-group">
						<div class="cs-group-h">{title}</div>
						<BackdropControls
							{knobs}
							{group}
							defaults={base}
							showReset={false}
							hideAlpha
							onchange={(next) => (knobs = next)}
						/>
					</div>
				{/snippet}

				{@render section('Palette', 'colour')}

				<!-- Palette is the only group that survives into the POV, and it
				     survives because it genuinely reaches: plate and suit are handed
				     to the slot and painted on the body inside the shot. Camera,
				     Status and Animation drive `Figure` and nothing else, so they are
				     hidden rather than left sitting there doing nothing — a dead
				     slider is worse than a missing one, because the operator spends a
				     minute deciding whether it is broken. -->
				{#if inPov}
					<p class="cs-hint cs-scope">
						Camera, status and animation belong to the turntable. The shot owns its
						own camera — that is what a first-person cut IS.
					</p>
				{:else}
				<div class="cs-group">
					<div class="cs-group-h">Status</div>
					<div class="cs-clips">
						{#each STATUSES as s (s.id)}
							<button
								class="cs-clip"
								class:on={status === s.id}
								title={s.hint}
								style:--sc={s.lamp ?? who.color}
								onclick={() => (status = s.id)}>{s.label}</button
							>
						{/each}
					</div>
					<p class="cs-hint">{alarm.hint}</p>
				</div>

				{@render section('Camera', 'shape')}

				<div class="cs-group">
					<div class="cs-group-h">Animation</div>
					<div class="cs-clips">
						{#each CLIPS as c (c.id)}
							<button
								class="cs-clip"
								class:on={clip === c.id}
								title={c.hint}
								onclick={() => {
									clip = c.id;
									frame = 0;
									playing = true;
								}}>{c.label}</button
							>
						{/each}
					</div>

					<!-- Transport, and only when there is something to transport. A
					     play button on a still pose is a control that does nothing. -->
					{#if clip !== 'still'}
						<div class="cs-transport">
							<button class="cs-play" onclick={() => (playing = !playing)}>
								{playing ? '❚❚' : '▶'}
							</button>
							<input
								type="range"
								min="0"
								max={FRAMES - 1}
								step="1"
								value={frame % FRAMES}
								oninput={(e) => scrub(Number((e.currentTarget as HTMLInputElement).value))}
								aria-label="Frame"
							/>
							<span class="cs-frame">{String((frame % FRAMES) + 1).padStart(2, '0')}/{FRAMES}</span>
						</div>
					{/if}

					<BackdropControls
						{knobs}
						group="motion"
						defaults={base}
						showReset={false}
						hideAlpha
						onchange={(next) => (knobs = next)}
					/>
				</div>

				{/if}

				<button class="cs-reset" onclick={() => (knobs = characterKnobs(CHARACTERS[i].color))}
					>Reset</button
				>
			</aside>
		</div>

		<div class="cs-foot">
			<div class="cs-name">
				<b style:color={who.color}>{who.name}</b>
				<i>{who.shape} · {SHAPE_NOTE[who.shape]}</i>
			</div>
			<div class="cs-specs">
				{#each specs as [label, v] (label)}
					<span><em>{label}</em>{v}</span>
				{/each}
			</div>
		</div>
	</div>
</dialog>

<style>
	.cs-modal {
		width: 96vw;
		height: 92vh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
	}
	.cs-modal::backdrop {
		background: rgba(3, 6, 10, 0.6);
		backdrop-filter: blur(4px);
	}
	.cs-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.cs-header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.cs-wordmark {
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		white-space: nowrap;
	}
	.cs-spacer {
		flex: 1;
	}
	.cs-pills {
		display: flex;
		gap: 4px;
	}
	.cs-pill {
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s;
	}
	.cs-pill:hover {
		color: var(--fg);
		border-color: color-mix(in srgb, var(--pc) 50%, transparent);
	}
	.cs-pill.on {
		color: var(--pc);
		border-color: var(--pc);
		background: color-mix(in srgb, var(--pc) 14%, transparent);
	}
	.cs-close {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 6px;
		width: 28px;
		height: 28px;
		cursor: pointer;
	}
	.cs-close:hover {
		color: var(--fg);
	}

	.cs-body {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: stretch;
	}
	.cs-arrow {
		width: 64px;
		flex: none;
		border: none;
		background: transparent;
		color: var(--fg-dim);
		font-size: 2rem;
		cursor: pointer;
		transition: color 0.15s;
	}
	.cs-arrow:hover {
		color: var(--kc);
	}
	.cs-stage {
		position: relative;
		flex: 1;
		min-width: 0;
		cursor: grab;
		touch-action: none;
	}
	.cs-stage.dragging {
		cursor: grabbing;
	}
	/* The slot brings its own stage furniture, so the turntable's grab cursor and
	   centring would only fight it. */
	.cs-stage.bare {
		cursor: default;
		display: flex;
		min-height: 0;
	}
	.cs-drag-hint {
		position: absolute;
		left: 50%;
		bottom: 10px;
		transform: translateX(-50%);
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.5;
		pointer-events: none;
	}

	.cs-panel {
		width: 300px;
		flex: none;
		border-left: 1px solid var(--border);
		padding: 14px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.cs-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.cs-group-h {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--fg-dim);
		border-bottom: 1px solid var(--border);
		padding-bottom: 6px;
	}
	.cs-clips {
		display: flex;
		gap: 4px;
	}
	.cs-clip {
		flex: 1;
		padding: 5px 0;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		cursor: pointer;
	}
	.cs-clip:hover {
		color: var(--fg);
	}
	.cs-clip.on {
		color: var(--sc, var(--kc));
		border-color: var(--sc, var(--kc));
		background: color-mix(in srgb, var(--sc, var(--kc)) 14%, transparent);
	}
	.cs-hint {
		margin: 0;
		font-size: 0.66rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}
	.cs-transport {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cs-play {
		width: 28px;
		height: 24px;
		flex: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: transparent;
		color: var(--kc);
		font-size: 0.6rem;
		cursor: pointer;
	}
	.cs-transport input {
		flex: 1;
		min-width: 0;
	}
	.cs-frame {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.cs-reset {
		align-self: flex-start;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 6px;
		padding: 5px 12px;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		cursor: pointer;
	}
	.cs-reset:hover {
		color: var(--fg);
		border-color: var(--kc);
	}
	.cs-modes {
		display: flex;
		gap: 0.15rem;
		padding: 0.15rem;
		border: 1px solid #232c3d;
		border-radius: 0.35rem;
	}
	.cs-mode {
		padding: 0.22rem 0.6rem;
		border: 0;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--muted, #8b98ad);
		cursor: pointer;
		font: inherit;
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.cs-mode.on {
		background: color-mix(in srgb, var(--kc) 18%, transparent);
		color: var(--kc);
	}
	.cs-scope {
		margin: 0.2rem 0 0;
	}

	.cs-glow {
		position: absolute;
		left: 50%;
		bottom: 6%;
		width: 46%;
		aspect-ratio: 1;
		transform: translateX(-50%);
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in srgb, var(--lamp) 22%, transparent), transparent 62%);
		filter: blur(10px);
		transition: background 0.4s;
	}
	/* Pinned top and bottom: an SVG with an auto height falls back to its own
	   aspect ratio and grows straight past the stage. */
	.cs-figure {
		position: absolute;
		inset: 24px 0;
		left: 50%;
		transform: translateX(-50%);
		width: min(90%, 460px);
		animation: cs-rise 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes cs-rise {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(14px);
		}
	}

	.cs-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
	.cs-name b {
		font-size: 1rem;
		letter-spacing: 0.04em;
	}
	.cs-name i {
		display: block;
		font-style: normal;
		font-size: 0.7rem;
		color: var(--fg-dim);
		margin-top: 2px;
	}
	.cs-specs {
		display: flex;
		gap: 10px;
	}
	.cs-specs span {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 4px 8px;
	}
	.cs-specs em {
		font-style: normal;
		color: var(--fg-dim);
		letter-spacing: 0.12em;
		margin-right: 6px;
	}
</style>
