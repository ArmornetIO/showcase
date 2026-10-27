<script lang="ts">
	// A Call of Duty minimap: close in, centred on you, turning with you, so up
	// is always the way you face. Objectives ride the edge when they are out of
	// range, and the nearest is lit. Still only you on it: Minimap.svelte's rule
	// holds, and its full plan is still what Tab opens.
	import type { World } from 'showcase';

	interface Props {
		world: World;
		/** Read every frame, so the frame loop's plain variables need not be $state. */
		pose: () => { x: number; z: number; yaw: number };
		/** `tone` is a CSS custom property to draw the mark in; `next` lights
		 *  it, and with none next the nearest is lit. */
		marks?: { x: number; z: number; tone?: string; next?: boolean }[];
		/** Metres from you to the edge of the square. */
		range?: number;
	}
	let { world, pose, marks = [], range = 16 }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	/** Minimap.svelte's wall and lintel heights, so the two plans agree. */
	const WALL = 2.5;
	const OVERHEAD = 1;

	$effect(() => {
		const el = canvas;
		const ctx = el?.getContext('2d');
		if (!el || !ctx) return;
		const css = getComputedStyle(el);
		const tone = (t: string) => css.getPropertyValue(t).trim();
		const [floor, wall, prop, fg, accent, mono] = ['--bg-elev', '--fg-dim', '--border', '--fg', '--accent', '--mono'].map(tone);
		const hulls = world.hulls.filter((h) => h.min.y <= OVERHEAD);
		const { min, max } = world.bounds;

		let dpr = 1;
		const ro = new ResizeObserver(() => {
			dpr = devicePixelRatio || 1;
			el.width = Math.round(el.clientWidth * dpr);
			el.height = Math.round(el.clientHeight * dpr);
		});
		ro.observe(el);

		let raf = requestAnimationFrame(function frame() {
			raf = requestAnimationFrame(frame);
			const p = pose();
			const half = el.width / 2;
			const s = half / range;
			const c = Math.cos(-p.yaw), n = Math.sin(-p.yaw);
			const view = (x: number, z: number) => {
				const dx = x - p.x, dz = z - p.z;
				return { x: (dx * c - dz * n) * s, y: (dx * n + dz * c) * s };
			};
			ctx.clearRect(0, 0, el.width, el.height);

			// The world, turned so your forward (sin yaw, −cos yaw) points up.
			ctx.save();
			ctx.translate(half, half);
			ctx.rotate(-p.yaw);
			ctx.scale(s, s);
			ctx.translate(-p.x, -p.z);
			ctx.fillStyle = floor;
			ctx.fillRect(min.x, min.z, max.x - min.x, max.z - min.z);
			for (const h of hulls) {
				ctx.fillStyle = h.max.y >= WALL ? wall : prop;
				ctx.fillRect(h.min.x, h.min.z, h.max.x - h.min.x, h.max.z - h.min.z);
			}
			ctx.restore();

			// What you can see: a soft wedge up from the centre.
			const cone = ctx.createRadialGradient(half, half, 0, half, half, half * 0.9);
			cone.addColorStop(0, accent);
			cone.addColorStop(1, 'transparent');
			ctx.fillStyle = cone;
			ctx.globalAlpha = 0.3;
			ctx.beginPath();
			ctx.moveTo(half, half);
			ctx.arc(half, half, half * 0.9, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;

			const pad = 9 * dpr;
			let near = marks.findIndex((m) => m.next), best = Infinity;
			if (near < 0) {
				marks.forEach((m, i) => {
					const d = Math.hypot(m.x - p.x, m.z - p.z);
					if (d < best) [best, near] = [d, i];
				});
			}
			marks.forEach((m, i) => {
				let { x, y } = view(m.x, m.z);
				const over = Math.max(Math.abs(x), Math.abs(y)) / (half - pad);
				if (over > 1) [x, y] = [x / over, y / over];
				const lit = i === near;
				const hue = (m.tone && tone(m.tone)) || accent;
				const r = (lit ? 6 : 4.5) * dpr * 0.7;
				ctx.save();
				ctx.translate(half + x, half + y);
				ctx.rotate(Math.PI / 4);
				ctx.shadowColor = hue;
				ctx.shadowBlur = lit ? 10 * dpr : 0;
				ctx.globalAlpha = lit ? 1 : 0.6;
				if (lit) {
					ctx.fillStyle = hue;
					ctx.fillRect(-r, -r, 2 * r, 2 * r);
				} else {
					ctx.strokeStyle = hue;
					ctx.lineWidth = 1.5 * dpr;
					ctx.strokeRect(-r, -r, 2 * r, 2 * r);
				}
				ctx.restore();
			});

			// North, on the edge.
			const north = view(p.x, p.z - range * 3);
			const k = (half - pad) / Math.max(Math.abs(north.x), Math.abs(north.y));
			ctx.font = `700 ${10 * dpr}px ${mono}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = fg;
			ctx.fillText('N', half + north.x * k, half + north.y * k);

			// You, always pointing up.
			const a = 7 * dpr;
			ctx.beginPath();
			ctx.moveTo(half, half - a);
			ctx.lineTo(half + a * 0.7, half + a * 0.7);
			ctx.lineTo(half, half + a * 0.3);
			ctx.lineTo(half - a * 0.7, half + a * 0.7);
			ctx.closePath();
			ctx.fillStyle = fg;
			ctx.shadowColor = accent;
			ctx.shadowBlur = 8 * dpr;
			ctx.fill();
			ctx.shadowBlur = 0;
		});
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<div class="radar">
	<canvas bind:this={canvas}></canvas>
	<span class="tick t"></span><span class="tick r"></span><span class="tick b"></span><span class="tick l"></span>
</div>

<style>
	.radar {
		position: relative;
		width: 100%;
		height: 100%;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		border-radius: var(--r-md);
		background: color-mix(in srgb, var(--bg) 85%, transparent);
		box-shadow: 0 6px 16px color-mix(in srgb, var(--bg) 70%, transparent);
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* Bezel ticks at the cardinal edges, the CoD frame. */
	.tick {
		position: absolute;
		background: var(--accent);
		opacity: 0.6;
	}
	.t,
	.b {
		left: 50%;
		width: 1px;
		height: 6px;
	}
	.t {
		top: 0;
	}
	.b {
		bottom: 0;
	}
	.l,
	.r {
		top: 50%;
		width: 6px;
		height: 1px;
	}
	.l {
		left: 0;
	}
	.r {
		right: 0;
	}
</style>
