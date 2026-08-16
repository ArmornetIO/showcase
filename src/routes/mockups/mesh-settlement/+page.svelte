<script lang="ts">
	// ── /mockups/mesh-settlement ───────────────────────────────────────────────
	// Every building in the settlement, side by side, on a turntable.
	//
	// The globe mockups show whether a scene reads. This shows whether the PIECES
	// do, which is a different question and the one that cannot be answered on a
	// globe: there, each building is seen once, at whatever bearing the spin
	// happens to leave it, next to neighbours it never shares a sightline with.
	// Here they are all at the same bearing, the same size, in the same light —
	// so a silhouette that fails to distinguish itself has nowhere to hide.
	//
	// Two controls carry the whole review:
	//  · SIZE, because these are drawn at ~40px on a real globe and every shape
	//    ever authored looks good at 200. Take it down to 40 and most of the
	//    detail arguments settle themselves.
	//  · SQUINT, a blur — the oldest test there is. If two buildings converge
	//    under it they are the same building however different the geometry.
	import { NodePiece, ALL_PIECES, MODE_PIECES, MODES } from '$lib/index.js';
	import { tangentFrame, type Vec3 } from '$lib/physics/sphere.js';
	import type { Piece, PieceVert } from '$lib/index.js';

	// ── Controls ────────────────────────────────────────────────────────────────
	let bearing = $state(35);
	/** The width a building is DRAWN at, in real screen pixels. The frame below is
	 *  fixed, so this scales the cell and not the geometry — which is the only way
	 *  the 40px test means anything. */
	let size = $state(120);
	let squint = $state(false);
	let mono = $state(true);
	let ground = $state(true);
	let offline = $state(false);

	/** The proposed collapse: the world in one cold hue, identity carried by the
	 *  shape rather than the tint. Toggle it against the mode palette to see what
	 *  the shapes are actually doing for you. */
	const MONO = '#7FE3F0';
	const LAND = '#2C4A57';

	/** A fixed three-quarter view, shared by every cell so the comparison is about
	 *  the buildings and nothing else. Off the sub-viewer point on both axes: dead
	 *  centre is the degenerate case where `u` collapses and every roof looks the
	 *  same from directly overhead. */
	const VIEW: Vec3 = (() => {
		const v = { x: 0.2, y: -0.34, z: 1 };
		const m = Math.hypot(v.x, v.y, v.z);
		return { x: v.x / m, y: v.y / m, z: v.z / m };
	})();

	/** One node radius, in the frame's own units. Fixed: the review changes how big
	 *  a building is drawn, never how it is built or how it is seen. */
	const STEP = 60;
	const SINK = 0.14;

	const frame = tangentFrame(VIEW, STEP * 3.2, { step: STEP, lean: 0.34 });

	/** Turn a building on its own plot.
	 *
	 *  A rotation in the tangent plane rather than a change of viewpoint: moving
	 *  the frame instead would slide each piece toward the limb and foreshorten
	 *  it, so late bearings would be judged on a worse view than early ones. A
	 *  rotation has positive determinant, so winding — and therefore culling and
	 *  shading — carries through untouched. */
	function turn(piece: Piece, deg: number): Piece {
		const t = (deg * Math.PI) / 180;
		const c = Math.cos(t);
		const s = Math.sin(t);
		return piece.map((solid) => ({
			faces: solid.faces,
			verts: solid.verts.map((v) => ({ e: v.e * c - v.n * s, n: v.e * s + v.n * c, h: v.h }))
		}));
	}

	/** The plot each building stands in, as screen offsets from its centre, each
	 *  flagged nearer to the viewer than the node. NodePiece draws the far half
	 *  behind the piece and the near half over its footings, which is what buries
	 *  it in the ground instead of parking it on top. */
	const plot = $derived.by(() => {
		const N = 28;
		const r = 1.15;
		return Array.from({ length: N }, (_, i) => {
			const t = (i / N) * Math.PI * 2;
			const e = Math.cos(t) * r;
			const n = Math.sin(t) * r;
			return {
				x: e * frame.e.x + n * frame.n.x,
				y: e * frame.e.y + n * frame.n.y,
				near: e * frame.axis.e.z + n * frame.axis.n.z > 0
			};
		});
	});

	const cells = $derived(
		MODES.map((m) => ({
			key: m.key,
			label: m.label,
			shape: MODE_PIECES[m.key],
			color: mono ? MONO : m.color,
			piece: turn(ALL_PIECES[MODE_PIECES[m.key]], bearing)
		}))
	);

	/** Where a local vertex lands on screen — NodePiece's own placement, repeated
	 *  here because framing has to agree with drawing exactly. A building extends
	 *  UP from its base, so a box centred on the origin cuts its roof off; the only
	 *  way to frame it correctly is to measure where it actually goes. */
	function at(v: PieceVert): { x: number; y: number } {
		const h = v.h - (ground ? SINK : 0);
		const k = 1 + (frame.grow - 1) * h;
		return {
			x: (v.e * frame.e.x + v.n * frame.n.x) * k + h * frame.u.x,
			y: (v.e * frame.e.y + v.n * frame.n.y) * k + h * frame.u.y
		};
	}

	/** ONE viewBox for every cell, fitted to the union of all seventeen.
	 *
	 *  Fitting each building to its own cell would be easy and wrong: it would
	 *  normalise away the size differences BETWEEN them, and those differences are
	 *  content — `hut` is deliberately half the footprint and two thirds the height
	 *  of its neighbours, and a sheet that silently scales it up to match is
	 *  hiding the one thing that mode is saying about itself. */
	const box = $derived.by(() => {
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		const eat = (p: { x: number; y: number }) => {
			if (p.x < x0) x0 = p.x;
			if (p.y < y0) y0 = p.y;
			if (p.x > x1) x1 = p.x;
			if (p.y > y1) y1 = p.y;
		};
		for (const c of cells) for (const s of c.piece) for (const v of s.verts) eat(at(v));
		// The plot is drawn too, and on a short building it is the widest thing.
		for (const p of plot) eat(p);
		const pad = 14;
		return {
			x: x0 - pad,
			y: y0 - pad,
			w: x1 - x0 + pad * 2,
			h: y1 - y0 + pad * 2
		};
	});

	// Sweep the turntable so a stale silhouette cannot hide at one lucky bearing.
	let spinning = $state(false);
	$effect(() => {
		if (!spinning) return;
		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			bearing = (bearing + (now - last) * 0.03) % 360;
			last = now;
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="page">
	<header>
		<div>
			<h1>The settlement</h1>
			<p>
				All {MODES.length} agent modes, one building each. Identity carried by silhouette so the
				globe's palette can collapse to a single hue.
			</p>
		</div>
	</header>

	<div class="controls">
		<label>
			<span>Bearing <b>{Math.round(bearing)}°</b></span>
			<input type="range" min="0" max="360" step="1" bind:value={bearing} />
		</label>
		<label>
			<span>Drawn at <b>{size}px</b></span>
			<input type="range" min="32" max="200" step="2" bind:value={size} />
		</label>
		<div class="toggles">
			<button class:on={spinning} onclick={() => (spinning = !spinning)}>Sweep</button>
			<button class:on={squint} onclick={() => (squint = !squint)}>Squint</button>
			<button class:on={mono} onclick={() => (mono = !mono)}>Mono</button>
			<button class:on={ground} onclick={() => (ground = !ground)}>Ground</button>
			<button class:on={offline} onclick={() => (offline = !offline)}>Offline</button>
		</div>
	</div>

	<div class="sheet" class:squint style:--cell="{size}px">
		{#each cells as c (c.key)}
			<figure>
				<svg
					viewBox="{box.x.toFixed(1)} {box.y.toFixed(1)} {box.w.toFixed(1)} {box.h.toFixed(1)}"
					style:width="{size}px"
					role="img"
					aria-label={c.label}
				>
					<NodePiece
						piece={c.piece}
						{frame}
						color={c.color}
						{offline}
						plot={1.15}
						ground={ground ? plot : undefined}
						sink={ground ? SINK : 0}
						groundColor={ground ? LAND : undefined}
					/>
				</svg>
				<figcaption>
					<b>{c.label}</b>
					<span>{c.shape}</span>
				</figcaption>
			</figure>
		{/each}
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		background: #05070c;
		color: #cfe0e7;
		padding: 40px 32px 100px;
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	header {
		max-width: 1400px;
		margin: 0 auto 28px;
	}

	h1 {
		font-size: 22px;
		font-weight: 500;
		letter-spacing: 0.04em;
		margin: 0 0 8px;
		color: #eaf6fa;
	}

	header p {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: #6f8794;
		max-width: 70ch;
	}

	.controls {
		max-width: 1400px;
		margin: 0 auto 26px;
		display: flex;
		gap: 28px;
		align-items: center;
		flex-wrap: wrap;
		padding: 14px 18px;
		border: 1px solid #16222e;
		background: #080d14;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #6f8794;
		min-width: 190px;
	}

	.controls label b {
		color: #7fe3f0;
		font-weight: 500;
	}

	input[type='range'] {
		width: 100%;
		accent-color: #7fe3f0;
	}

	.toggles {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-left: auto;
	}

	button {
		font: inherit;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		padding: 7px 13px;
		background: transparent;
		border: 1px solid #22303f;
		color: #6f8794;
		cursor: pointer;
	}

	button:hover {
		border-color: #33465a;
		color: #9fb4bf;
	}

	button.on {
		border-color: #7fe3f0;
		color: #7fe3f0;
		background: rgba(127, 227, 240, 0.08);
	}

	button:focus-visible {
		outline: 2px solid #7fe3f0;
		outline-offset: 2px;
	}

	.sheet {
		max-width: 1400px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(var(--cell) + 34px), 1fr));
		gap: 1px;
		background: #111b25;
		border: 1px solid #111b25;
	}

	.sheet.squint svg {
		filter: blur(2.4px);
	}

	figure {
		margin: 0;
		background: #05070c;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 14px 8px 12px;
	}

	svg {
		height: auto;
		display: block;
		/* Clipped, not visible: a building that overflows its cell is overlapping
		   its neighbours, and the whole value of a contact sheet is that each one
		   is judged inside the same box. */
		overflow: hidden;
	}

	figcaption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		margin-top: 6px;
	}

	figcaption b {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		color: #b6ccd6;
	}

	figcaption span {
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #4e6472;
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet.squint svg {
			filter: none;
		}
	}
</style>
