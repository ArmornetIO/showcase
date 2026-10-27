<script lang="ts">
	// Where you are, from above. The plan is drawn from the hulls you walk
	// against, so it cannot show a doorway the walls do not have. Only you are on
	// it: in a game about who was where, a map of everyone ends the game. Tab, or
	// a click, opens it over the scene; Tab or Esc closes it.
	import type { World } from 'showcase';

	interface Props {
		world: World;
		/** Named on the full map only: the mini one is too small to read them. */
		labels?: { label: string; x: number; z: number }[];
		/** Read every frame, so the frame loop's plain variables need not be $state. */
		pose: () => { x: number; z: number; yaw: number };
		/** Draw nothing until Tab: the corner is Radar.svelte's. */
		fullOnly?: boolean;
		/** Open over the scene. Bound when something else opens it, as the radar does. */
		full?: boolean;
	}
	let { world, labels = [], pose, fullOnly = false, full = $bindable(false) }: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);

	/** A hull reaching this high is a wall; one starting above `OVERHEAD` is a
	 *  lintel or the ceiling, left off so the doorways read. */
	const WALL = 2.5;
	const OVERHEAD = 1;

	$effect(() => {
		const el = canvas;
		const ctx = el?.getContext('2d');
		if (!el || !ctx) return;
		const named = full ? labels : [];
		const { min, max } = world.bounds;
		const hulls = world.hulls;
		const css = getComputedStyle(el);
		const tone = (t: string) => css.getPropertyValue(t).trim();
		const plan = document.createElement('canvas');
		let s = 1, ox = 0, oz = 0, dpr = 1;
		const px = (x: number) => ox + (x - min.x) * s;
		const pz = (z: number) => oz + (z - min.z) * s;

		function layout() {
			dpr = devicePixelRatio || 1;
			el!.width = plan.width = Math.round(el!.clientWidth * dpr);
			el!.height = plan.height = Math.round(el!.clientHeight * dpr);
			const pad = 8 * dpr;
			s = Math.min((plan.width - 2 * pad) / (max.x - min.x), (plan.height - 2 * pad) / (max.z - min.z));
			ox = (plan.width - (max.x - min.x) * s) / 2;
			oz = (plan.height - (max.z - min.z) * s) / 2;
			const g = plan.getContext('2d')!;
			g.fillStyle = tone('--bg-elev');
			g.fillRect(px(min.x), pz(min.z), (max.x - min.x) * s, (max.z - min.z) * s);
			for (const h of hulls) {
				if (h.min.y > OVERHEAD) continue;
				g.fillStyle = tone(h.max.y >= WALL ? '--fg-dim' : '--border');
				g.fillRect(px(h.min.x), pz(h.min.z), Math.max(1, (h.max.x - h.min.x) * s), Math.max(1, (h.max.z - h.min.z) * s));
			}
			g.font = `${11 * dpr}px ${tone('--mono')}`;
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			g.fillStyle = tone('--fg');
			// First come, first drawn: a label that would overprint one already
			// down is dropped, so a map lists its rooms ahead of what is in them.
			const taken: [number, number, number, number][] = [];
			const lh = 14 * dpr;
			for (const l of named) {
				const w = g.measureText(l.label).width + 6 * dpr, x = px(l.x) - w / 2, y = pz(l.z) - lh / 2;
				if (taken.some(([tx, ty, tw, th]) => x < tx + tw && tx < x + w && y < ty + th && ty < y + lh)) continue;
				taken.push([x, y, w, lh]);
				g.fillText(l.label, px(l.x), pz(l.z));
			}
		}

		const ro = new ResizeObserver(layout);
		ro.observe(el);
		const accent = tone('--accent');
		let raf = requestAnimationFrame(function frame() {
			raf = requestAnimationFrame(frame);
			// Hidden (`fullOnly`) or not laid out yet: nothing to draw into.
			if (!plan.width || !plan.height) return;
			ctx.clearRect(0, 0, el.width, el.height);
			ctx.drawImage(plan, 0, 0);
			// An arrow along the walker's forward, (sin yaw, −cos yaw).
			const p = pose(), r = (full ? 9 : 6) * dpr, b = 0.6 * r;
			const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
			const x = px(p.x), y = pz(p.z);
			ctx.beginPath();
			ctx.moveTo(x + fx * r, y + fz * r);
			ctx.lineTo(x - fx * b - fz * b, y - fz * b + fx * b);
			ctx.lineTo(x - fx * b + fz * b, y - fz * b - fx * b);
			ctx.closePath();
			ctx.fillStyle = accent;
			ctx.fill();
		});
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	function onKey(e: KeyboardEvent) {
		if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
		if (e.code === 'Tab') {
			e.preventDefault();
			full = !full;
		} else if (e.key === 'Escape' && full) full = false;
	}
</script>

<svelte:window onkeydown={onKey} />

<button
	type="button"
	class="map"
	class:full
	class:gone={fullOnly && !full}
	style:aspect-ratio={full ? undefined : `${world.bounds.max.x - world.bounds.min.x} / ${world.bounds.max.z - world.bounds.min.z}`}
	aria-label={full ? 'Close the map' : 'Open the map'}
	aria-expanded={full}
	onclick={() => (full = !full)}
>
	<canvas bind:this={canvas}></canvas>
</button>

<style>
	.map {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: color-mix(in srgb, var(--bg) 80%, transparent);
		overflow: hidden;
		cursor: pointer;
	}
	.map.gone {
		display: none;
	}
	.map.full {
		position: fixed;
		inset: 6vh 6vw;
		width: auto;
		z-index: 10;
		background: color-mix(in srgb, var(--bg) 92%, transparent);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
