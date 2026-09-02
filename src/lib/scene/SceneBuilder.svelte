<script lang="ts">
	// ── SceneBuilder — the tool ───────────────────────────────────────────────
	// Owns the clock, the selection and the scene. Everything else is a view of
	// those three things.
	//
	// ONE rAF advancing ONE number. Every frame the picture is `sceneStateAt(
	// scene, elapsed)` — so scrubbing is not a special path, it is the only path,
	// and editing during playback needs no apply step because the frame under the
	// cursor is already the result.
	import { onMount, untrack } from 'svelte';
	import type { Scene, SceneObject, Cue } from './types.js';
	import { sceneStateAt, beatEnd, cueAt } from './state.js';
	import { planPlacement, placementAt, globePoseAt, type PlacementPlan } from './place.js';
	import { SAMPLE_SCENE } from './sample-scene.js';
	import SceneViewport from './SceneViewport.svelte';
	import SceneDock from './SceneDock.svelte';
	import SceneInspector from './SceneInspector.svelte';
	import SceneCuePicker from './SceneCuePicker.svelte';
	import ScenePalette from './ScenePalette.svelte';
	import SceneCaptions from './SceneCaptions.svelte';
	import { REGISTRY } from '../builder/registry.js';
	import { MESH_LAYOUTS } from '../mesh-studio/layout/mesh-layout.js';
	import type { CanvasCamera } from '../primitives/canvas/canvas-camera.js';

	let {
		initial = SAMPLE_SCENE,
		/** Where "back" goes. The tool fills the window and hides the shell, so
		 *  without this there is no way out but the browser's back button. */
		backHref = '',
	}: { initial?: Scene; backHref?: string } = $props();

	// Seeded once. The editor owns the scene from mount on; `initial` is a
	// starting point, not a binding.
	let scene = $state<Scene>(structuredClone(untrack(() => initial)));
	let elapsed = $state(0);
	let playing = $state(false);
	let scrubbing = $state(false);
	let loopBeatId = $state<string | null>(null);

	let selectedObjectId = $state<string | null>(null);
	let selectedBeatId = $state<string | null>(null);
	let selectedCueId = $state<string | null>(null);
	let pickerOpen = $state(false);
	let camera = $state<CanvasCamera | undefined>();

	/** A hovered row in the cue picker, applied on top of the real scene so the
	 *  canvas shows the proposal before anything is written. Costs nothing: the
	 *  evaluator is already a pure function, so previewing is evaluating a scene
	 *  with one extra cue in it. */
	let preview = $state<{ channel?: string; burst?: string; to?: unknown } | null>(null);

	// ── Placement ─────────────────────────────────────────────────────────────
	// Recomputed when STRUCTURE changes, not every frame: the solver is O(n²) and
	// positions do not depend on time. Keyed on the things a solve actually reads.
	const placementKey = $derived(
		JSON.stringify([
			scene.layout,
			scene.hub,
			scene.objects.map((o) => [o.id, o.kind, o.place.mode, o.place.x, o.place.y, o.node?.r, o.component?.w]),
		]),
	);
	// The static half — solved rings, or the sphere's directions. Only structural
	// edits invalidate it, so the O(n²) solve never runs on a frame boundary.
	let plan = $state<PlacementPlan>({ mode: 'planar', positions: new Map() });
	$effect(() => {
		placementKey;
		untrack(() => (plan = planPlacement(scene)));
	});

	// The moving half. Planar layouts ignore `t`; the globe reprojects through
	// the current spin, which is banked spin-enabled TIME — so scrubbing lands on
	// the orientation playback would have reached.
	const placement = $derived(placementAt(scene, plan, elapsed));
	const globePose = $derived(scene.layout === 'globe' ? globePoseAt(scene, elapsed) : null);

	// ── Evaluation ────────────────────────────────────────────────────────────
	const previewScene = $derived.by((): Scene => {
		if (!preview || !selectedObjectId) return scene;
		const ghost: Cue = {
			id: '__preview__',
			target: selectedObjectId,
			channel: preview.channel,
			burst: preview.burst,
			at: Math.max(0, elapsed - 1),
			dur: preview.burst ? 900 : 400,
			to: preview.to,
			ease: 'out',
		};
		return { ...scene, cues: [...scene.cues, ghost] };
	});

	// Not named `state`: svelte2tsx emits the runes as bare identifiers, so a
	// local `state` collides with `$state` and the whole file stops type-checking.
	const evaluated = $derived(sceneStateAt(previewScene, elapsed));
	// Pulled out as PRIMITIVE deriveds. `evaluated` is a fresh object every frame,
	// so an effect reading `evaluated.beatIndex` re-runs every frame — which had
	// the camera re-fitting 60×/s and stamping on every pan the user attempted.
	const beatIndex = $derived(evaluated.beatIndex);
	const beatProgress = $derived(evaluated.beatProgress);

	const selectedObject = $derived(scene.objects.find((o) => o.id === selectedObjectId) ?? null);
	const selectedBeat = $derived(scene.beats.find((b) => b.id === selectedBeatId) ?? null);
	const selectedCue = $derived(scene.cues.find((c) => c.id === selectedCueId) ?? null);

	// ── Transport ─────────────────────────────────────────────────────────────
	let raf = 0;
	let originAt = 0;

	function bounds(): [number, number] {
		if (!loopBeatId) return [0, scene.runMs];
		const i = scene.beats.findIndex((b) => b.id === loopBeatId);
		if (i < 0) return [0, scene.runMs];
		return [scene.beats[i].at, beatEnd(scene, i)];
	}

	function frame(now: number) {
		const [lo, hi] = bounds();
		const t = now - originAt;
		if (t >= hi) {
			originAt = now - lo;
			elapsed = lo;
		} else {
			elapsed = Math.max(lo, t);
		}
		raf = requestAnimationFrame(frame);
	}

	function play() {
		stop();
		playing = true;
		originAt = performance.now() - elapsed;
		raf = requestAnimationFrame(frame);
	}
	function stop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		playing = false;
	}
	function seekTo(t: number) {
		elapsed = Math.max(0, Math.min(scene.runMs, t));
		if (playing) originAt = performance.now() - elapsed;
	}

	// Camera follows the beat. Cuts while scrubbing: boundaries get crossed at
	// arbitrary speed, so a 900ms flight leaves the camera trailing the playhead.
	/** Once you move the camera by hand it is yours until you ask for it back.
	 *  Without this the beat camera fights every pan — which is worse than it
	 *  sounds, because the fight is silent and looks like a broken canvas. */
	let freeLook = $state(false);

	/** Fit padding. Generous padding left the mesh occupying a third of the
	 *  canvas, so the scene read timid and the eye went to the palette instead of
	 *  to the subject. */
	const FIT_PAD = 40;

	$effect(() => {
		const i = beatIndex;
		const cut = scrubbing;
		untrack(() => {
			if (freeLook) return;
			const b = scene.beats[i];
			if (!b || !camera) return;
			if (b.camera.kind === 'fit') camera.fitAll({ padding: FIT_PAD, duration: cut ? 0 : 800 });
			else if (cut) camera.cut(b.camera.target);
			else void camera.flyTo(b.camera.target, { duration: 800, zoom: b.camera.zoom });
		});
	});

	function reclaimCamera() {
		freeLook = false;
		const b = scene.beats[beatIndex];
		if (!b || !camera) return;
		if (b.camera.kind === 'fit') camera.fitAll({ padding: FIT_PAD, duration: 500 });
		else void camera.flyTo(b.camera.target, { duration: 500, zoom: b.camera.zoom });
	}

	// ── Cast mutation ─────────────────────────────────────────────────────────
	let seq = 0;
	const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

	function addNode() {
		const id = uid('node');
		scene = {
			...scene,
			objects: [
				...scene.objects,
				{
					id,
					name: id,
					kind: 'mesh.node',
					place: { mode: 'solved' },
					tags: ['agent'],
					node: { type: 'agentic', state: 'healthy', label: id, r: 32, flow: 0.4, opacity: 1 },
				},
			],
		};
		selectAll(id);
	}

	/** Dropped from the palette — lands exactly where the pointer released. */
	function addComponentAt(componentId: string, x: number, y: number) {
		addComponent(componentId, { x, y });
	}

	function addComponent(componentId: string, at?: { x: number; y: number }) {
		const meta = REGISTRY.find((r) => r.id === componentId);
		const id = uid('cmp');
		// Seed from the registry's own declared defaults — the same values the
		// builder drops a fresh component with. Inventing props here would render
		// something the builder never would.
		const props: Record<string, unknown> = {};
		for (const [key, def] of Object.entries(meta?.props ?? {})) props[key] = def.default;
		scene = {
			...scene,
			objects: [
				...scene.objects,
				{
					id,
					name: meta?.label ?? componentId,
					kind: 'component',
					place: {
						mode: 'fixed',
						x: at?.x ?? scene.hub.x + 320,
						y: at?.y ?? scene.hub.y + 200,
					},
					tags: ['stage'],
					// `||` not `??`: ~20 registry entries declare `defaultW: 0` meaning
					// "intrinsic width", and 0 would render the component naked.
					component: { componentId, props, w: meta?.defaultW || 260, opacity: 1 },
				},
			],
		};
		selectAll(id);
	}

	function addEdgeFromHub() {
		if (!selectedObject || selectedObject.kind !== 'mesh.node') return;
		const id = uid('edge');
		scene = {
			...scene,
			objects: [
				...scene.objects,
				{
					id,
					name: `hub → ${selectedObject.name}`,
					kind: 'mesh.edge',
					place: { mode: 'solved' },
					tags: ['link'],
					edge: {
						from: '__hub__',
						to: selectedObject.id,
						dataType: 'lifecycle',
						style: 'energy',
						sig: 0.6,
						active: true,
					},
				},
			],
		};
	}

	function deleteObject(id: string) {
		scene = {
			...scene,
			// An edge whose endpoint disappears would draw to nowhere, so it goes too.
			objects: scene.objects.filter((o) => o.id !== id && o.edge?.to !== id && o.edge?.from !== id),
			cues: scene.cues.filter((c) => c.target !== id),
		};
		if (selectedObjectId === id) selectedObjectId = null;
	}

	function pin(id: string, x: number, y: number) {
		scene = {
			...scene,
			objects: scene.objects.map((o) =>
				o.id === id ? { ...o, place: { mode: 'pinned' as const, x, y } } : o,
			),
		};
	}
	function unpin(id: string) {
		scene = {
			...scene,
			objects: scene.objects.map((o) =>
				o.id === id ? { ...o, place: { mode: 'solved' as const } } : o,
			),
		};
	}
	function moveComponent(id: string, x: number, y: number) {
		scene = {
			...scene,
			objects: scene.objects.map((o) =>
				o.id === id ? { ...o, place: { mode: 'fixed' as const, x, y } } : o,
			),
		};
	}

	// ── Cues ──────────────────────────────────────────────────────────────────
	function addCue(sel: { channel?: string; burst?: string; to?: unknown; dur: number; ease: string; anchored: boolean }) {
		if (!selectedObjectId) return;
		const i = evaluated.beatIndex;
		const beat = scene.beats[i];
		const cue: Cue = {
			id: uid('cue'),
			target: selectedObjectId,
			channel: sel.channel,
			burst: sel.burst,
			at: sel.anchored ? 0 : Math.round(elapsed),
			anchor: sel.anchored ? { beatId: beat.id, offset: Math.round(elapsed - beat.at) } : undefined,
			dur: sel.dur,
			to: sel.to,
			ease: sel.ease as Cue['ease'],
		};
		scene = { ...scene, cues: [...scene.cues, cue] };
		selectedCueId = cue.id;
		pickerOpen = false;
	}

	/** Retime a cue by `deltaMs`. An anchored cue moves its OFFSET from the beat,
	 *  so it keeps travelling with that beat afterwards; an absolute one moves its
	 *  own `at`. Dragging must not silently convert one into the other. */
	function moveCue(id: string, deltaMs: number) {
		scene = {
			...scene,
			cues: scene.cues.map((c) => {
				if (c.id !== id) return c;
				if (c.anchor) {
					return { ...c, anchor: { ...c.anchor, offset: Math.round(c.anchor.offset + deltaMs) } };
				}
				return { ...c, at: Math.max(0, Math.round(c.at + deltaMs)) };
			}),
		};
	}

	/** Trim an edge. The right edge changes duration only. The left edge moves the
	 *  onset AND compensates the duration, so the cue's end stays put — which is
	 *  what every NLE means by trimming the head. */
	function trimCue(id: string, edge: 'left' | 'right', deltaMs: number) {
		scene = {
			...scene,
			cues: scene.cues.map((c) => {
				if (c.id !== id) return c;
				if (edge === 'right') return { ...c, dur: Math.max(50, Math.round(c.dur + deltaMs)) };
				const d = Math.min(deltaMs, c.dur - 50);
				const next = { ...c, dur: Math.max(50, Math.round(c.dur - d)) };
				if (c.anchor) next.anchor = { ...c.anchor, offset: Math.round(c.anchor.offset + d) };
				else next.at = Math.max(0, Math.round(c.at + d));
				return next;
			}),
		};
	}

	function deleteCue(id: string) {
		scene = { ...scene, cues: scene.cues.filter((c) => c.id !== id) };
		if (selectedCueId === id) selectedCueId = null;
	}

	/** Split the current beat at the playhead. The cheapest way to grow a spine:
	 *  write the whole thing as one beat, then cut it where the story turns. */
	function splitBeat() {
		const i = evaluated.beatIndex;
		const b = scene.beats[i];
		const at = Math.round(elapsed);
		if (at - b.at < 600 || beatEnd(scene, i) - at < 600) return;
		const next = { ...b, id: uid('b'), at, caption: 'New beat', sub: undefined };
		scene = {
			...scene,
			beats: [...scene.beats.slice(0, i + 1), next, ...scene.beats.slice(i + 1)],
		};
		selectAll(null, next.id);
	}

	// ── Selection ─────────────────────────────────────────────────────────────
	function selectAll(objectId: string | null, beatId: string | null = null, cueId: string | null = null) {
		selectedObjectId = objectId;
		selectedBeatId = beatId;
		selectedCueId = cueId;
	}

	function onKey(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
		if (pickerOpen) return;
		const step = e.shiftKey ? 1000 : 100;
		if (e.key === ' ') {
			e.preventDefault();
			playing ? stop() : play();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			seekTo(elapsed - step);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			seekTo(elapsed + step);
		} else if (e.key === 'a' || e.key === 'A') {
			if (selectedObjectId) pickerOpen = true;
		} else if (e.key === 'n' || e.key === 'N') {
			addNode();
		} else if (e.key === 'l' || e.key === 'L') {
			loopBeatId = loopBeatId ? null : scene.beats[evaluated.beatIndex].id;
		} else if (e.key === 'Enter' && e.altKey) {
			e.preventDefault();
			splitBeat();
		} else if (e.key === '[') {
			const i = Math.max(0, evaluated.beatIndex - 1);
			seekTo(scene.beats[i].at);
		} else if (e.key === ']') {
			const i = Math.min(scene.beats.length - 1, evaluated.beatIndex + 1);
			seekTo(scene.beats[i].at);
		} else if (e.key === 'f' || e.key === 'F') {
			reclaimCamera();
		} else if (e.key === 'Escape') {
			selectAll(null);
		}
	}

	onMount(() => {
		const kick = requestAnimationFrame(() =>
			requestAnimationFrame(() => camera?.fitAll({ padding: FIT_PAD, duration: 0 })),
		);
		// Play once on open. A tool for making animations that greets you with a
		// frozen graph has to be asked to prove itself; one 20s pass does it for
		// free, and the transport is right there to stop it.
		const intro = setTimeout(() => play(), 500);
		return () => {
			cancelAnimationFrame(kick);
			clearTimeout(intro);
			stop();
		};
	});

</script>

<svelte:window onkeydown={onKey} />

<div class="sb">
	<div class="hd">
		{#if backHref}<a class="back" href={backHref}>← SHOWCASE</a>{/if}
		<span class="ttl">SCENE BUILDER</span>
		<span class="dim">{scene.label}</span>
		<span class="grow"></span>
		{#if freeLook}
			<button class="freelook" onclick={reclaimCamera} title="Re-apply the beat camera (F)">
				FREE LOOK · press F to release
			</button>
		{/if}
		<span class="dim sm">
			N node · A cue · ⌥⏎ split beat · Space play · ←/→ scrub · L loop · [ ] beat
		</span>
	</div>

	<div class="mid">
		<!-- ── Palette ───────────────────────────────────────────────────── -->
		<div class="pal">
			<!-- Mesh + arrangement first and fixed: they are scene-level settings, and
			     they must not scroll away under a long component grid. -->
			<div class="pal-top">
				<div class="sec">MESH</div>
				<div class="rowb">
					<button class="pbtn" onclick={addNode}>+ node <span class="k">N</span></button>
					<button
						class="pbtn"
						onclick={addEdgeFromHub}
						disabled={selectedObject?.kind !== 'mesh.node'}>+ edge</button
					>
				</div>

				<div class="sec">ARRANGEMENT</div>
				<select
					value={scene.layout}
					onchange={(e) => (scene = { ...scene, layout: e.currentTarget.value as Scene['layout'] })}
				>
					<!-- MESH_LAYOUTS is the single source of truth for this menu — the
					     same five options every other mesh canvas offers, globe included. -->
					{#each MESH_LAYOUTS as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
				</select>
				<div class="cap">{MESH_LAYOUTS.find((l) => l.id === scene.layout)?.hint}</div>
			</div>

			<ScenePalette onAdd={(id) => addComponent(id)} />
		</div>

		<SceneViewport
			{scene}
			objects={evaluated.objects}
			bursts={evaluated.bursts}
			{placement}
			{globePose}
			globeRadius={plan.globe?.radius ?? 0}
			bind:camera
			selectedId={selectedObjectId}
			onSelect={(id) => selectAll(id)}
			onPin={pin}
			onMoveComponent={moveComponent}
			onDropComponent={addComponentAt}
			onUserCamera={() => (freeLook = true)}
		>
			<!-- Captions render ON the stage, not just in a panel. Authoring the line
			     the audience reads without ever seeing it laid out was the single
			     biggest blind spot in the tool. `chrome` off — the dock is the
			     progress indicator here. -->
			<SceneCaptions beat={evaluated.beat} beatIndex={evaluated.beatIndex} chrome={false} />
		</SceneViewport>

		<SceneInspector
			bind:scene
			{selectedObject}
			selectedId={selectedObjectId}
			{selectedBeat}
			{selectedCue}
			onAddCue={() => (pickerOpen = true)}
			onDeleteCue={deleteCue}
			onDeleteObject={deleteObject}
			onUnpin={unpin}
			onSelectBeat={(id) => {
				selectAll(null, id);
				const b = scene.beats.find((x) => x.id === id);
				if (b) seekTo(b.at);
			}}
		/>
	</div>

	<SceneDock
		{scene}
		{elapsed}
		{playing}
		beatIndex={evaluated.beatIndex}
		beatProgress={evaluated.beatProgress}
		{selectedBeatId}
		{selectedCueId}
		{selectedObjectId}
		{loopBeatId}
		onSeek={seekTo}
		onPlay={play}
		onPause={stop}
		onScrubStart={() => (scrubbing = true)}
		onScrubEnd={() => (scrubbing = false)}
		onSelectBeat={(id) => {
			selectAll(null, id);
			// Selecting a beat SEEKS to it. Editing beat 4's caption while looking at
			// a beat-1 frame is the fastest way to author something wrong.
			const b = scene.beats.find((x) => x.id === id);
			if (b) seekTo(b.at);
		}}
		onSelectCue={(id) => {
			selectAll(null, null, id);
			const c = scene.cues.find((x) => x.id === id);
			if (c) seekTo(cueAt(scene, c));
		}}
		onSelectObject={(id) => selectAll(id)}
		onMoveCue={moveCue}
		onTrimCue={trimCue}
		onLoopBeat={(id) => (loopBeatId = id)}
		onSplitBeat={splitBeat}
	/>

	<SceneCuePicker
		kind={selectedObject?.kind ?? 'mesh.node'}
		targetName={selectedObject?.name ?? '—'}
		componentId={selectedObject?.component?.componentId}
		componentProps={selectedObject?.component?.props}
		at={elapsed}
		open={pickerOpen}
		onPick={addCue}
		onClose={() => (pickerOpen = false)}
		onPreview={(p) => (preview = p)}
	/>
</div>

<style>
	.sb {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
	}
	.hd {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.5rem 0.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.72rem;
	}
	.back {
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		color: var(--fg-dim);
		text-decoration: none;
	}
	.back:hover {
		color: var(--accent);
	}
	.ttl {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		color: var(--accent);
	}
	.dim {
		color: var(--fg-dim);
	}
	.sm {
		font-size: 0.6rem;
	}
	.grow {
		flex: 1;
	}
	.freelook {
		padding: 0.2rem 0.45rem;
		border: 1px solid rgba(251, 191, 36, 0.5);
		border-radius: 0.25rem;
		background: rgba(251, 191, 36, 0.12);
		color: #fbbf24;
		cursor: pointer;
		font: inherit;
		font-size: 0.55rem;
		letter-spacing: 0.1em;
	}
	.mid {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	/* Wide enough for a two-up thumbnail grid — a card you can't recognise is not
	   a preview. The palette owns its own scroll so the sticky search header and
	   the arrangement picker below it stay put. */
	.pal {
		width: 17rem;
		flex: none;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 0 0.6rem 0.6rem;
		border-right: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.7rem;
	}
	.sec {
		margin: 0.7rem 0 0.35rem;
		padding-bottom: 0.15rem;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.pal-top {
		flex: none;
	}
	.rowb {
		display: flex;
		gap: 0.3rem;
	}
	.pbtn {
		display: flex;
		align-items: center;
		width: 100%;
		margin-bottom: 0.25rem;
		padding: 0.3rem 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 0.3rem;
		background: rgba(255, 255, 255, 0.03);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 0.66rem;
		text-align: left;
	}
	.pbtn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.k {
		margin-left: auto;
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	select {
		width: 100%;
		padding: 0.26rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font: inherit;
		font-size: 0.68rem;
	}
	.cap {
		font-size: 0.56rem;
		line-height: 1.45;
		color: var(--fg-dim);
		margin: 0.25rem 0 0.4rem;
	}
</style>
