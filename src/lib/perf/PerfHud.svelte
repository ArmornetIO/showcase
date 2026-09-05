<script lang="ts">
	// ── perf/PerfHud — the game HUD, for a page ──────────────────────────────────
	// What a debug overlay in a game shows: the frame graph, the budget line, and
	// one row per thing that draws, with its rate. Deliberately NOT `PerfPanel`,
	// which reports a mean FPS — a mean over 60 frames moves four tenths of a
	// frame per second for a 40ms stall, so the number a hand can feel is the one
	// it cannot show. Everything here is p95, max, and per-layer rates.
	//
	// ── What it is actually for ──────────────────────────────────────────────────
	// The bug it was built for read as "the globe stutters occasionally" and was
	// none of the things anyone looked at. It was garbage: the page allocated
	// megabytes a frame, the collector ran every eighth frame, and a collection
	// stops every rAF loop on the page at once — which is why it showed up in the
	// globe, the pipeline scene and the login screen alike. So ALLOC is on the top
	// row beside FPS, at the same size. Frame time says whether the page is smooth
	// now; allocation says whether it is about to stop being.
	//
	// The layer table answers the second question that bug raised — WHICH of these
	// is drawing, and is it even on screen. A mesh scene 6,500px below the fold
	// was redrawing five WebGL layers at 68fps into a viewport it was nowhere
	// near. On the page that is invisible. Here it is a row with a rate and an
	// `off` tag.
	//
	// ── Cost ─────────────────────────────────────────────────────────────────────
	// Yes, watching costs something. It is bounded on purpose: the numbers are
	// sampled 4× a second rather than per frame, the graph is one canvas drawn in
	// the same tick, and the only per-frame work in the whole instrument is
	// `hitchWatch`'s own rAF — one timestamp subtraction and a counter. Nothing
	// here writes `$state` per frame, which is the mistake that makes a profiler
	// perturb what it profiles.
	import { hitchWatch, type HitchSnapshot } from './hitch-watch.js';

	let { onClose }: { onClose?: () => void } = $props();

	// ── Where it sits, and how much it takes ────────────────────────────────────
	// A game HUD is readable without being in the way, and it never eats a click:
	// the panel is transparent at rest, solid while the pointer is on it, and
	// pointer-transparent everywhere except the title bar — so the page underneath
	// stays clickable through it. That last rule is why the lists are capped
	// rather than scrollable; a scrollbar you cannot reach is furniture.
	//
	// Movable two ways on purpose. Dragging the bar is the obvious one; `~`
	// (shift-backtick) cycles the four corners without the pointer ever entering
	// it, which is the one that matters when the thing you are watching is
	// wherever the HUD currently is.
	const MARGIN = 8;
	const W = 280;
	const KEY = 'perf-hud-pos';
	let corner = $state(0);
	let pos = $state<{ x: number; y: number } | null>(null);
	let el = $state<HTMLElement | null>(null);
	/** Rows before a list is truncated. Long enough for every layer on a busy
	 *  page, short enough that the panel never becomes the biggest thing on it. */
	const MAX_ROWS = 8;

	function cornerPos(i: number) {
		const h = el?.offsetHeight ?? 420;
		const right = window.innerWidth - W - MARGIN;
		const bottom = window.innerHeight - h - MARGIN;
		return [
			{ x: right, y: MARGIN },
			{ x: right, y: Math.max(MARGIN, bottom) },
			{ x: MARGIN, y: Math.max(MARGIN, bottom) },
			{ x: MARGIN, y: MARGIN }
		][i % 4];
	}

	function place(next: { x: number; y: number }) {
		const h = el?.offsetHeight ?? 420;
		pos = {
			x: Math.max(0, Math.min(next.x, window.innerWidth - W)),
			y: Math.max(0, Math.min(next.y, window.innerHeight - Math.min(h, window.innerHeight)))
		};
		try {
			localStorage.setItem(KEY, JSON.stringify(pos));
		} catch {
			// Private mode; the HUD just forgets where it was.
		}
	}

	function drag(e: PointerEvent) {
		if (e.button !== 0) return;
		const box = el?.getBoundingClientRect();
		if (!box) return;
		const dx = e.clientX - box.left;
		const dy = e.clientY - box.top;
		const move = (m: PointerEvent) => place({ x: m.clientX - dx, y: m.clientY - dy });
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		e.preventDefault();
	}

	$effect(() => {
		try {
			const saved = localStorage.getItem(KEY);
			if (saved) pos = JSON.parse(saved);
		} catch {
			// ignore
		}
		if (!pos) pos = cornerPos(0);
		// `~` is shift-backtick, so opening the HUD and moving it are the same key
		// with and without shift — no second shortcut to remember.
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== '~') return;
			const a = document.activeElement as HTMLElement | null;
			if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
			e.preventDefault();
			corner = (corner + 1) % 4;
			place(cornerPos(corner));
		};
		const onResize = () => pos && place(pos);
		window.addEventListener('keydown', onKey);
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', onResize);
		};
	});

	/** 4Hz. Fast enough to feel live, slow enough to be free. */
	const TICK_MS = 250;
	/** Frames in the graph — about 4 seconds at 60Hz, 2 at 120. */
	const GRAPH_N = 240;

	let snap = $state<HitchSnapshot | null>(null);
	let canvases = $state<{ label: string; size: string; on: boolean }[]>([]);
	let gl = $state<{ layer: string; size: string; rate: number; blank: boolean; lost: number }[]>([]);
	let graph = $state<HTMLCanvasElement | null>(null);
	const buf = new Float64Array(GRAPH_N);

	/** Previous GL frame counts, to turn a total into a rate. */
	const glSeen = new Map<string, { frames: number; at: number }>();

	function readGl() {
		const all = (globalThis as Record<string, unknown>).__glHealth as
			| Record<string, { frames: number; css: [number, number]; blank: boolean; lostCount: number }[]>
			| undefined;
		if (!all) return [];
		const now = performance.now();
		const rows: typeof gl = [];
		for (const [layer, recs] of Object.entries(all)) {
			recs.forEach((r, i) => {
				const key = `${layer}#${i}`;
				const prev = glSeen.get(key);
				const dt = prev ? (now - prev.at) / 1000 : 0;
				const rate = prev && dt > 0.1 ? (r.frames - prev.frames) / dt : 0;
				glSeen.set(key, { frames: r.frames, at: now });
				rows.push({
					layer: recs.length > 1 ? `${layer} #${i + 1}` : layer,
					size: `${r.css[0]}×${r.css[1]}`,
					rate,
					blank: r.blank,
					lost: r.lostCount
				});
			});
		}
		return rows.sort((a, b) => b.rate - a.rate);
	}

	/** Every canvas on the page and whether it is in the viewport — "the shapes",
	 *  literally. Cheap at 4Hz; it would not be per frame. */
	function readCanvases() {
		const vh = window.innerHeight;
		const vw = window.innerWidth;
		return [...document.querySelectorAll('canvas')].map((c) => {
			const r = c.getBoundingClientRect();
			const cls = (c.getAttribute('class') || '')
				.split(' ')
				.filter((x) => x && !x.startsWith('svelte-'))
				.join('.');
			return {
				label: cls || '(unclassed)',
				size: `${Math.round(r.width)}×${Math.round(r.height)}`,
				on: r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
			};
		});
	}

	function drawGraph(s: HitchSnapshot) {
		const c = graph;
		if (!c) return;
		const ctx = c.getContext('2d');
		if (!ctx) return;
		const n = s.recent(buf);
		const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
		const w = c.clientWidth;
		const h = c.clientHeight;
		if (c.width !== Math.round(w * dpr)) {
			c.width = Math.round(w * dpr);
			c.height = Math.round(h * dpr);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		// Scaled to three frame budgets, so a dropped frame has somewhere to go and
		// the steady state still fills a third of the box rather than a flat line
		// pinned to the floor.
		const ceil = Math.max(s.period * 3, 20);
		const y = (ms: number) => h - Math.min(ms / ceil, 1) * h;

		ctx.strokeStyle = 'rgba(255,255,255,0.18)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, y(s.period));
		ctx.lineTo(w, y(s.period));
		ctx.stroke();

		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			const x = (i / Math.max(n - 1, 1)) * w;
			const v = y(buf[i]);
			i ? ctx.lineTo(x, v) : ctx.moveTo(x, v);
		}
		ctx.strokeStyle = 'rgba(47,255,224,0.85)';
		ctx.lineWidth = 1;
		ctx.stroke();

		// Late frames as marks rather than as part of the line: a spike one pixel
		// wide is invisible at this width, and the spikes are the whole point.
		const late = Math.max(s.period * 1.5, s.period + 4);
		ctx.fillStyle = 'rgba(248,113,133,0.9)';
		for (let i = 0; i < n; i++) {
			if (buf[i] <= late) continue;
			const x = (i / Math.max(n - 1, 1)) * w;
			ctx.fillRect(x - 1, y(buf[i]) - 1, 2, h - y(buf[i]) + 1);
		}
	}

	$effect(() => {
		hitchWatch.enable();
		const id = setInterval(() => {
			const s = hitchWatch.snapshot();
			snap = s;
			gl = readGl();
			canvases = readCanvases();
			drawGraph(s);
		}, TICK_MS);
		return () => clearInterval(id);
	});

	const n1 = (v: number) => v.toFixed(1);
	/** Rough bands, not a verdict: green is a page holding frame, amber is one
	 *  that will start to fail somewhere else on the machine, red is now. */
	const allocClass = $derived(!snap ? '' : snap.alloc > 60 ? 'bad' : snap.alloc > 15 ? 'warn' : 'ok');
	const p95Class = $derived(
		!snap ? '' : snap.p95 > snap.period * 1.5 ? 'bad' : snap.p95 > snap.period * 1.2 ? 'warn' : 'ok'
	);
</script>

<div
	class="perf-hud"
	bind:this={el}
	style:left="{pos?.x ?? 0}px"
	style:top="{pos?.y ?? 0}px"
	style:width="{W}px"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="bar" onpointerdown={drag} title="drag to move · ~ cycles corners">
		<span class="title">// frame</span>
		<span class="grow"></span>
		<button class="x" onclick={() => onClose?.()} title="close (`)">×</button>
	</div>

	{#if snap}
		<div class="big">
			<div>
				<span class="k">fps</span>
				<span class="v">{Math.round(snap.fps)}</span>
			</div>
			<div>
				<span class="k">alloc</span>
				<span class="v {allocClass}">{n1(snap.alloc)}<i>MB/s</i></span>
			</div>
			<div>
				<span class="k">p95</span>
				<span class="v {p95Class}">{n1(snap.p95)}<i>ms</i></span>
			</div>
		</div>

		<canvas class="graph" bind:this={graph}></canvas>

		<div class="row">
			<span>dt p50 {n1(snap.p50)} · max {n1(snap.max)}ms</span>
			<span>period {n1(snap.period)}ms</span>
		</div>
		<div class="row">
			<span>hitches {snap.hitches} <i>({snap.gcHitches} on GC)</i></span>
			<span>heap {n1(snap.heap)}MB · gc {n1(snap.gcPerSec)}/s</span>
		</div>

		{#if snap.last}
			<div class="last">
				last: {n1(snap.last.dt)}ms @{snap.last.at}s ·
				{snap.last.task ?? 'no longtask'}{snap.last.heap < -0.5 ? ' · GC' : ''}
			</div>
		{/if}

		{#if gl.length}
			<div class="head">gl layers</div>
			{#each gl.slice(0, MAX_ROWS) as g (g.layer)}
				<div class="row layer">
					<span class="nm">{g.layer}{g.blank ? ' ⚠blank' : ''}{g.lost ? ` ⚠lost×${g.lost}` : ''}</span>
					<span class="sz">{g.size}</span>
					<span class="rt" class:idle={g.rate < 1}>{Math.round(g.rate)}/s</span>
				</div>
			{/each}
		{/if}

		{#if snap.loops.length}
			<div class="head">loops</div>
			{#each snap.loops.slice(0, MAX_ROWS) as l (l.name)}
				<div class="row layer">
					<span class="nm">{l.name}</span>
					<span class="sz"></span>
					<span class="rt" class:idle={l.rate < 1}>{Math.round(l.rate)}/s</span>
				</div>
			{/each}
		{/if}

		{#if canvases.length}
			<div class="head">canvases</div>
			{#each canvases.slice(0, MAX_ROWS) as c, i (i)}
				<div class="row layer">
					<span class="nm">{c.label}</span>
					<span class="sz">{c.size}</span>
					<span class="rt" class:idle={!c.on}>{c.on ? 'on' : 'off'}</span>
				</div>
			{/each}
			{#if canvases.length > MAX_ROWS}
				<div class="row layer"><span class="nm idle">+{canvases.length - MAX_ROWS} more</span></div>
			{/if}
		{/if}

		<div class="keys">` hide · ~ move · drag the bar</div>
	{:else}
		<div class="row"><span>sampling…</span></div>
	{/if}
</div>

<style>
	/* Transparent at rest and pointer-transparent throughout: the page underneath
	   stays both visible and clickable. Only the title bar takes the pointer, so
	   the panel can still be dragged. */
	.perf-hud {
		position: fixed;
		z-index: 2147483000;
		padding: 6px 9px 8px;
		border: 1px solid rgba(47, 255, 224, 0.16);
		border-radius: 6px;
		background: rgba(6, 12, 14, 0.34);
		color: rgba(226, 240, 238, 0.78);
		pointer-events: none;
		/* Values stay legible over a bright page without a background to hide
		   behind — cheaper and steadier than a backdrop blur, which is a filter
		   over live content and repaints with it. */
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
		transition:
			background-color 120ms ease,
			opacity 120ms ease,
			border-color 120ms ease;
	}
	/* Solid the moment you go to read it. */
	.perf-hud:hover {
		background: rgba(6, 12, 14, 0.92);
		border-color: rgba(47, 255, 224, 0.4);
		color: rgba(226, 240, 238, 0.95);
	}
	.perf-hud {
		font:
			11px/1.45 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		letter-spacing: 0.02em;
	}
	/* The one part that takes the pointer — grab here to move it. */
	.bar {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
		pointer-events: auto;
		cursor: grab;
		touch-action: none;
	}
	.bar:active {
		cursor: grabbing;
	}
	.title {
		color: rgba(47, 255, 224, 0.9);
	}
	.grow {
		flex: 1;
	}
	.x {
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 3px;
		padding: 0 5px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.big {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin-bottom: 6px;
	}
	.big .k {
		display: block;
		opacity: 0.55;
		font-size: 10px;
	}
	.big .v {
		font-size: 17px;
		line-height: 1.1;
	}
	.big i {
		font-style: normal;
		font-size: 10px;
		opacity: 0.55;
		margin-left: 2px;
	}
	.ok {
		color: rgb(47, 255, 224);
	}
	.warn {
		color: rgb(251, 191, 36);
	}
	.bad {
		color: rgb(248, 113, 133);
	}
	.graph {
		display: block;
		width: 100%;
		height: 44px;
		margin-bottom: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 3px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		opacity: 0.85;
	}
	.row i {
		font-style: normal;
		opacity: 0.6;
	}
	.last {
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		color: rgba(251, 191, 36, 0.85);
	}
	.head {
		margin: 7px 0 2px;
		padding-top: 5px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		color: rgba(47, 255, 224, 0.7);
	}
	.layer .nm {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.layer .sz {
		opacity: 0.5;
	}
	.layer .rt {
		width: 46px;
		text-align: right;
	}
	.idle {
		opacity: 0.4;
	}
	.keys {
		margin-top: 6px;
		opacity: 0.35;
		font-size: 10px;
	}
</style>
