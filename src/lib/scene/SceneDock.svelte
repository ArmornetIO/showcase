<script lang="ts">
	// ── SceneDock — transport, ruler, spine and lanes ─────────────────────────
	// Docked bottom, full width, because multiple time-aligned lanes need width.
	// The lane headers ARE the cast list: in an NLE the track headers are the
	// object list, so merging them turns five competing screen regions into four.
	//
	// ONE GEOMETRY. The gutter is a fixed width and every time-positioned thing —
	// ruler ticks, beat blocks, cue blocks, the playhead — is placed as a
	// percentage of the same track. Two coordinate systems (a range input for
	// scrubbing, a calc() for the playhead) had them disagreeing by up to 230ms.
	import type { Scene, Cue, SceneObject } from './types.js';
	import { beatEnd, cueAt } from './state.js';
	import { PLACEMENT_LABEL } from './place.js';

	let {
		scene,
		elapsed = 0,
		playing = false,
		beatIndex = 0,
		beatProgress = 0,
		selectedBeatId = null,
		selectedCueId = null,
		selectedObjectId = null,
		loopBeatId = null,
		onSeek,
		onPlay,
		onPause,
		onScrubStart,
		onScrubEnd,
		onSelectBeat,
		onSelectCue,
		onSelectObject,
		onLoopBeat,
		onSplitBeat,
		onMoveCue,
		onTrimCue,
	}: {
		scene: Scene;
		elapsed?: number;
		playing?: boolean;
		beatIndex?: number;
		beatProgress?: number;
		selectedBeatId?: string | null;
		selectedCueId?: string | null;
		selectedObjectId?: string | null;
		loopBeatId?: string | null;
		onSeek?: (t: number) => void;
		onPlay?: () => void;
		onPause?: () => void;
		onScrubStart?: () => void;
		onScrubEnd?: () => void;
		onSelectBeat?: (id: string) => void;
		onSelectCue?: (id: string) => void;
		onSelectObject?: (id: string) => void;
		onLoopBeat?: (id: string | null) => void;
		onSplitBeat?: () => void;
		onMoveCue?: (id: string, deltaMs: number) => void;
		onTrimCue?: (id: string, edge: 'left' | 'right', deltaMs: number) => void;
	} = $props();

	const GUTTER = 210;
	const pct = (t: number) => (t / scene.runMs) * 100;

	let trackEl = $state<HTMLDivElement | undefined>();
	/** Measured reactively so label-collision maths survives a window resize. */
	let trackPx = $state(1);
	$effect(() => {
		if (!trackEl) return;
		const ro = new ResizeObserver(([e]) => (trackPx = e.contentRect.width || 1));
		ro.observe(trackEl);
		trackPx = trackEl.getBoundingClientRect().width || 1;
		return () => ro.disconnect();
	});
	const trackW = () => trackEl?.getBoundingClientRect().width ?? trackPx;
	const msPerPx = () => scene.runMs / Math.max(1, trackW());

	const byId = $derived(new Map(scene.objects.map((o) => [o.id, o])));

	/** Lanes exist because cues exist — nobody adds one by hand. Grouped by
	 *  resolved target so a selector cue gets its own lane instead of smearing
	 *  across six. */
	const lanes = $derived.by(() => {
		const map = new Map<string, { key: string; label: string; object?: SceneObject; cues: Cue[] }>();
		for (const c of scene.cues) {
			if (!map.has(c.target)) {
				const o = byId.get(c.target);
				map.set(c.target, {
					key: c.target,
					label: o ? o.name : c.target.startsWith('tag:') ? `${c.target.slice(4)} ▸ set` : c.target,
					object: o,
					cues: [],
				});
			}
			map.get(c.target)!.cues.push(c);
		}
		// Sorted per lane so label-room can be measured against the NEXT cue.
		for (const l of map.values()) l.cues.sort((a, b) => cueAt(scene, a) - cueAt(scene, b));
		return [...map.values()];
	});

	/** A label rides outside its block, so it needs clear track before the next
	 *  cue starts. Without this, two cues 400ms apart print their labels on top of
	 *  each other and both become unreadable. The tooltip always has the full text.
	 */
	const LABEL_PX = 74;
	function labelFits(l: { cues: Cue[] }, i: number): boolean {
		const c = l.cues[i];
		const end = cueAt(scene, c) + (c.burst ? 0 : c.dur);
		const next = l.cues[i + 1];
		const roomMs = next ? cueAt(scene, next) - end : scene.runMs - end;
		return roomMs / msPerPx() >= LABEL_PX;
	}

	function laneGlyph(l: { object?: SceneObject }): string {
		if (!l.object) return '◈';
		const mode = scene.layout === 'globe' && l.object.kind === 'mesh.node' ? 'projected' : l.object.place.mode;
		return PLACEMENT_LABEL[mode]?.glyph ?? '·';
	}

	function cueLabel(c: Cue): string {
		if (c.burst) return c.burst.replace(/^.*\./, '');
		return `${(c.channel ?? '').replace(/^.*\./, '')}${c.to === undefined ? '' : ` → ${c.to}`}`;
	}

	/** Kind drives colour so lanes are tellable apart at a glance — every cue
	 *  being the same blue made the timeline one undifferentiated band. */
	function cueKind(c: Cue): string {
		if (c.burst) return 'burst';
		if (c.channel?.startsWith('edge.')) return 'edge';
		if (c.channel?.startsWith('props.') || c.channel?.startsWith('component.')) return 'cmp';
		return 'node';
	}

	// ── Ruler ────────────────────────────────────────────────────────────────
	/** A tick every second, labelled as often as the width allows. */
	const ticks = $derived.by(() => {
		const secs = Math.ceil(scene.runMs / 1000);
		const every = secs > 40 ? 5 : secs > 20 ? 2 : 1;
		return Array.from({ length: secs + 1 }, (_, i) => ({
			t: i * 1000,
			major: i % every === 0,
			label: i % every === 0 ? `${i}s` : '',
		})).filter((k) => k.t <= scene.runMs);
	});

	function scrubFrom(clientX: number) {
		if (!trackEl) return;
		const r = trackEl.getBoundingClientRect();
		onSeek?.(((clientX - r.left) / r.width) * scene.runMs);
	}

	let scrubbing = $state(false);
	function rulerDown(e: PointerEvent) {
		scrubbing = true;
		onScrubStart?.();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		scrubFrom(e.clientX);
	}
	function rulerMove(e: PointerEvent) {
		if (scrubbing) scrubFrom(e.clientX);
	}
	function rulerUp() {
		if (!scrubbing) return;
		scrubbing = false;
		onScrubEnd?.();
	}

	// ── Cue drag / trim ──────────────────────────────────────────────────────
	// Deltas, not absolutes: the parent decides whether that means moving an
	// anchored cue's offset or an absolute cue's `at`, and this layer should not
	// know the difference.
	type Drag = { id: string; mode: 'move' | 'left' | 'right'; lastX: number; moved: boolean };
	let drag = $state<Drag | null>(null);

	/** Snap targets in ms — beat edges, the playhead, and the run bounds. */
	const snaps = $derived([
		0,
		scene.runMs,
		elapsed,
		...scene.beats.map((b) => b.at),
		...scene.beats.map((_, i) => beatEnd(scene, i)),
	]);
	const SNAP_PX = 6;

	function snapDelta(cueStart: number, rawDelta: number): number {
		const target = cueStart + rawDelta;
		const tol = SNAP_PX * msPerPx();
		let best = rawDelta;
		let bestDist = tol;
		for (const s of snaps) {
			const d = Math.abs(s - target);
			if (d < bestDist) {
				bestDist = d;
				best = s - cueStart;
			}
		}
		return best;
	}

	function cueDown(e: PointerEvent, c: Cue, mode: Drag['mode']) {
		e.stopPropagation();
		drag = { id: c.id, mode, lastX: e.clientX, moved: false };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function cueMove(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.lastX;
		if (Math.abs(dx) < 1) return;
		drag.lastX = e.clientX;
		drag.moved = true;
		const c = scene.cues.find((x) => x.id === drag!.id);
		if (!c) return;
		const raw = dx * msPerPx();
		if (drag.mode === 'move') onMoveCue?.(c.id, snapDelta(cueAt(scene, c), raw));
		else onTrimCue?.(c.id, drag.mode, raw);
	}

	function cueUp(c: Cue) {
		// A press that never moved is a click — select it.
		if (drag && !drag.moved) onSelectCue?.(c.id);
		drag = null;
	}

	const splitLegal = $derived.by(() => {
		const b = scene.beats[beatIndex];
		if (!b) return false;
		return elapsed - b.at >= 600 && beatEnd(scene, beatIndex) - elapsed >= 600;
	});
</script>

<svelte:window onpointermove={cueMove} onpointerup={() => (drag = null)} />

<div class="dock">
	<!-- ── Transport ─────────────────────────────────────────────────────── -->
	<div class="tr">
		<button class="ic ic--go" onclick={() => (playing ? onPause?.() : onPlay?.())} title="Play / pause (Space)">
			{playing ? '⏸' : '▶'}
		</button>
		<button class="ic" onclick={() => onSeek?.(0)} title="Back to start">⏮</button>
		<button
			class="ic"
			class:ic--on={loopBeatId !== null}
			onclick={() => onLoopBeat?.(loopBeatId ? null : scene.beats[beatIndex].id)}
			title="Loop this beat (L)">↻</button
		>
		<button
			class="ic"
			disabled={!splitLegal}
			onclick={() => onSplitBeat?.()}
			title={splitLegal
				? 'Split beat at playhead (⌥⏎)'
				: 'Too close to a beat edge to split — a beat must keep 600ms either side'}>⇥|</button
		>
		<span class="t">
			{(elapsed / 1000).toFixed(2)}<span class="dim">/{(scene.runMs / 1000).toFixed(1)}s</span>
			<span class="dim"> · beat {beatIndex + 1} · p={beatProgress.toFixed(2)}</span>
		</span>
		<span class="grow"></span>
		<span class="dim sm">{scene.objects.length} objects · {scene.cues.length} cues</span>
	</div>

	<!-- ── Scrolling body: ruler + lanes share one track geometry ────────── -->
	<div class="body">
		<div class="row row--ruler">
			<div class="gutter gutter--fixed">▸ TIME</div>
			<div
				class="track track--ruler"
				bind:this={trackEl}
				onpointerdown={rulerDown}
				onpointermove={rulerMove}
				onpointerup={rulerUp}
				onpointercancel={rulerUp}
				role="presentation"
			>
				{#each ticks as k (k.t)}
					<div class="tick" class:tick--major={k.major} style:left="{pct(k.t)}%">
						{#if k.label}<span class="tick-l">{k.label}</span>{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="row row--beats">
			<div class="gutter gutter--fixed">▸ BEATS</div>
			<div class="track">
				{#each scene.beats as b, i (b.id)}
					<button
						class="beat"
						class:beat--now={i === beatIndex}
						class:beat--sel={b.id === selectedBeatId}
						class:beat--loop={b.id === loopBeatId}
						style:left="{pct(b.at)}%"
						style:width="{pct(beatEnd(scene, i) - b.at)}%"
						onclick={() => onSelectBeat?.(b.id)}
						title={b.caption}
					>
						<span class="beat-n">{i + 1}</span>
						<span class="beat-c">{b.caption}</span>
						<span class="beat-g">{b.camera.kind === 'fit' ? '⊙' : '⊕'}{b.spin ? '↻' : ''}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="row row--camera">
			<div class="gutter gutter--fixed">▸ CAMERA</div>
			<div class="track">
				{#each scene.beats as b, i (b.id)}
					<div class="cam" style:left="{pct(b.at)}%" style:width="{pct(beatEnd(scene, i) - b.at)}%">
						{b.camera.kind === 'fit' ? '⊙ fit' : `⊕ ${b.camera.target}`}
					</div>
				{/each}
			</div>
		</div>

		{#each lanes as l (l.key)}
			<div class="row">
				<button
					class="gutter gutter--btn"
					class:gutter--sel={l.object?.id === selectedObjectId}
					onclick={() => l.object && onSelectObject?.(l.object.id)}
					title={l.object ? PLACEMENT_LABEL[l.object.place.mode]?.hint : 'Selector — matches a set'}
				>
					<span class="g">{laneGlyph(l)}</span>
					<span class="nm">{l.label}</span>
				</button>
				<div class="track">
					{#each l.cues as c, ci (c.id)}
						{@const at = cueAt(scene, c)}
						<div
							class="cue cue--{cueKind(c)}"
							class:cue--sel={c.id === selectedCueId}
							class:cue--anchored={!!c.anchor}
							class:cue--dragging={drag?.id === c.id}
							style:left="{pct(at)}%"
							style:width={c.burst ? undefined : `${pct(c.dur)}%`}
							onpointerdown={(e) => cueDown(e, c, 'move')}
							onpointerup={() => cueUp(c)}
							title="{cueLabel(c)} · {(at / 1000).toFixed(2)}s + {c.dur}ms{c.anchor
								? ` · anchored to ${c.anchor.beatId}`
								: ' · absolute'} — drag to retime, drag an edge to trim"
							role="presentation"
						>
							{#if c.burst}
								<span class="dia">◆</span>
							{:else}
								<span
									class="grip grip--l"
									onpointerdown={(e) => cueDown(e, c, 'left')}
									role="presentation"
								></span>
								<span
									class="grip grip--r"
									onpointerdown={(e) => cueDown(e, c, 'right')}
									role="presentation"
								></span>
							{/if}
						</div>
						<!-- The label rides OUTSIDE the block. A 400ms cue in a 20s run is
						     ~28px wide; anything inside it is clipped to two characters. -->
						{#if labelFits(l, ci) || c.id === selectedCueId}
							<span
								class="cue-tag"
								class:cue-tag--sel={c.id === selectedCueId}
								style:left="calc({pct(at) + (c.burst ? 0 : pct(c.dur))}% + 7px)"
							>
								{cueLabel(c)}
							</span>
						{/if}
					{/each}
				</div>
			</div>
		{/each}

		<!-- One playhead over every lane, on the SAME geometry as everything else. -->
		<div class="ph" style:left="calc({GUTTER}px + (100% - {GUTTER}px) * {pct(elapsed) / 100})">
			<span class="ph-head"></span>
		</div>
	</div>
</div>

<style>
	/* A fixed budget. Without one the dock is content-sized, so adding lanes
	   crushes the canvas instead of scrolling. */
	.dock {
		position: relative;
		flex: 0 0 clamp(190px, 32vh, 420px);
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: rgba(5, 7, 12, 0.96);
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.7rem;
		color: var(--fg);
	}

	.tr {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.6rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.ic {
		width: 1.7rem;
		height: 1.7rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 0.3rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 0.7rem;
	}
	.ic:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.ic--go {
		border-color: var(--accent);
		color: var(--accent);
	}
	.ic--on {
		background: rgba(95, 234, 212, 0.16);
		color: var(--accent);
	}
	.t {
		margin-left: 0.4rem;
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
	}
	.grow {
		flex: 1;
	}
	.dim {
		color: var(--fg-dim);
	}
	.sm {
		font-size: 0.62rem;
	}

	.body {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.row {
		display: flex;
		align-items: stretch;
		height: 26px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
	/* Ruler and spine stay put while cue lanes scroll under them. */
	.row--ruler {
		position: sticky;
		top: 0;
		z-index: 4;
		height: 24px;
		background: rgba(5, 7, 12, 0.98);
	}
	.row--beats {
		position: sticky;
		top: 24px;
		z-index: 3;
		background: rgba(5, 7, 12, 0.98);
	}
	.row--camera {
		position: sticky;
		top: 50px;
		z-index: 3;
		background: rgba(5, 7, 12, 0.98);
	}

	.gutter {
		flex: none;
		width: 210px;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.5rem;
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
	}
	.gutter--fixed {
		color: var(--accent);
	}
	.gutter--btn {
		background: none;
		border-top: none;
		border-bottom: none;
		border-left: none;
		cursor: pointer;
		text-align: left;
	}
	.gutter--sel {
		background: rgba(95, 234, 212, 0.12);
		color: var(--fg);
	}
	.g {
		flex: none;
		font-size: 0.66rem;
	}
	.nm {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.track {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.track--ruler {
		cursor: ew-resize;
	}

	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: rgba(255, 255, 255, 0.09);
	}
	.tick--major {
		background: rgba(255, 255, 255, 0.22);
	}
	.tick-l {
		position: absolute;
		left: 3px;
		top: 3px;
		font-size: 0.5rem;
		font-family: var(--mono);
		color: var(--fg-dim);
		white-space: nowrap;
	}

	.beat,
	.cam,
	.cue {
		position: absolute;
		top: 2px;
		bottom: 2px;
		border-radius: 0.22rem;
		font-size: 0.58rem;
		overflow: hidden;
		white-space: nowrap;
	}

	.beat {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.05);
		color: var(--fg-dim);
		cursor: pointer;
	}
	.beat--now {
		background: rgba(95, 234, 212, 0.14);
		color: var(--fg);
	}
	.beat--sel {
		border-color: var(--accent);
	}
	.beat--loop {
		box-shadow: inset 0 -2px 0 var(--accent);
	}
	.beat-n {
		font-weight: 700;
	}
	.beat-c {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.beat-g {
		margin-left: auto;
		opacity: 0.75;
	}

	.cam {
		display: flex;
		align-items: center;
		padding: 0 0.35rem;
		border: 1px dashed rgba(255, 255, 255, 0.14);
		color: var(--fg-dim);
	}

	.cue {
		display: flex;
		align-items: center;
		padding: 0 0.3rem;
		border: 1px solid;
		cursor: grab;
		min-width: 6px;
	}
	.cue--dragging {
		cursor: grabbing;
		filter: brightness(1.3);
	}
	.cue--node {
		border-color: rgba(196, 168, 255, 0.55);
		background: rgba(196, 168, 255, 0.2);
		color: #e2d5ff;
	}
	.cue--edge {
		border-color: rgba(56, 189, 248, 0.55);
		background: rgba(56, 189, 248, 0.2);
		color: #cfe9ff;
	}
	.cue--cmp {
		border-color: rgba(110, 231, 183, 0.55);
		background: rgba(110, 231, 183, 0.2);
		color: #d3f7e8;
	}
	/* A zero-extent effect drawn as a sliver is unclickable and lies about having
	   duration. Bursts get a diamond. */
	.cue--burst {
		width: 1rem;
		margin-left: -0.5rem;
		justify-content: center;
		padding: 0;
		border-radius: 50%;
		border-color: rgba(251, 191, 36, 0.7);
		background: rgba(251, 191, 36, 0.22);
		color: #fbbf24;
	}
	.cue--sel {
		outline: 1px solid var(--accent);
		outline-offset: 1px;
	}
	/* A tether marks a cue that travels when its beat is retimed. */
	.cue--anchored::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--accent);
		opacity: 0.75;
	}
	.cue-tag {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		max-width: 13rem;
		font-size: 0.55rem;
		font-family: var(--mono);
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
	}
	.cue-tag--sel {
		color: var(--accent);
	}
	.dia {
		font-size: 0.55rem;
		pointer-events: none;
	}
	.grip {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 5px;
		cursor: ew-resize;
	}
	.grip--l {
		left: 0;
	}
	.grip--r {
		right: 0;
	}

	.ph {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--accent);
		pointer-events: none;
		z-index: 5;
	}
	.ph-head {
		position: absolute;
		top: 0;
		left: -4px;
		width: 9px;
		height: 9px;
		clip-path: polygon(0 0, 100% 0, 50% 100%);
		background: var(--accent);
	}
</style>
