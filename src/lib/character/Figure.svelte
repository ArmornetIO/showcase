<script lang="ts">
	// The character, at one of three sizes. Same paths every time — the crop is
	// the only difference between a hero and a 30px chip, because re-deriving
	// the art per size is how two views of one character stop matching.
	import { art, type ArtOpts } from './render.js';
	import type { CharacterSkin } from './characters.js';
	import type { Anchor } from './wearables.js';

	interface Props {
		klass: CharacterSkin;
		/** `hero` fits the whole figure; `bust` and `chip` crop to the head. */
		crop?: 'hero' | 'bust' | 'chip';
		/**
		 * Frame one part of the body instead, using the rect the renderer
		 * projected for it.
		 *
		 * What a thumbnail of a chest emblem needs. `bust` and `chip` are both
		 * head crops, so a list of emblems rendered at `chip` is a list of
		 * identical heads — the item is off the bottom of every cell. Overrides
		 * `crop` when set.
		 */
		focus?: Anchor;
		/** A ground shadow only makes sense under a figure that has ground. */
		shadow?: boolean;
		/**
		 * Pull back. `1` frames the head; `2` frames twice as much of the world
		 * around it, so the character is drawn half the size in the same box.
		 *
		 * The knob that stops a container from deciding how big a character is.
		 * Without it the only way to draw a smaller figure was a smaller box —
		 * which is a different picture, not a smaller one — and every surface
		 * that wanted a smaller head instead grew a `scale()` transform, an
		 * inset, or a table of per-character fudges.
		 */
		zoom?: number;
		/** Camera and suit. Omitted everywhere but the studio — a roster wants
		 *  one angle for all four, or the tiles stop being comparable. */
		art?: ArtOpts;
	}

	let { klass, crop = 'hero', focus, shadow = false, zoom = 1, art: opts }: Props = $props();

	const a = $derived(art(klass, opts));
	const view = $derived.by(() => {
		if (focus) {
			const r = a.hit[focus];
			// A hit rect is sized to be CLICKABLE, which is tighter than a picture
			// of the thing wants to be — so it is opened out to leave the part some
			// body around it. Square, because the cells that use this are.
			if (r) {
				const side = Math.max(r.w, r.h) * 1.35;
				return { x: r.x + r.w / 2 - side / 2, y: r.y + r.h / 2 - side / 2, w: side, h: side };
			}
		}
		if (crop === 'hero') return a.box;
		// `chip` is the same shot, closer. It gets there by taking the air off
		// the SIDES, not by squashing the box: a frame shorter than it is wide
		// is sliced on the left and right by a square well, and what a head
		// loses there is its own silhouette.
		const s = crop === 'chip' ? 0.88 : 1;
		const w = a.bust.w * s * zoom;
		// DELIBERATELY OVERLONG — four widths, well past the feet.
		//
		// The frame's WIDTH is the picture; its height is not a decision. With
		// `slice`, a frame taller than any container it can land in is always
		// scaled to fit the WIDTH, and the excess falls off the bottom — so the
		// container decides where the shot ends and can never take anything off
		// the sides. A square frame in a tall well did the opposite: it scaled
		// to the height and ate a third of the head, left and right, which is
		// the flat-planed skull every call site here was working around.
		//
		// The crown stays a fixed distance below the top edge whatever the zoom,
		// so pulling back adds body underneath rather than sky above.
		return { x: a.bust.x + (a.bust.w - w) / 2, y: a.bust.y, w, h: w * 4 };
	});
	const gid = $derived(`fx-${klass.key}-${focus ?? crop}`);
</script>

<svg
	viewBox="{view.x} {view.y} {view.w} {view.h}"
	preserveAspectRatio={focus ? 'xMidYMid slice' : crop === 'hero' ? 'xMidYMax meet' : 'xMidYMin slice'}
	aria-label={klass.name}
	role="img"
>
	{#if shadow}
		<defs>
			<filter id="{gid}-glow" x="-60%" y="-60%" width="220%" height="220%">
				<feGaussianBlur stdDeviation="2.2" result="b" />
				<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<!-- The pool follows what the figure is EMITTING, not what it is
			     painted: a character lit red standing in its own pink glow is
			     showing two states at once. -->
			<radialGradient id="{gid}-sh">
				<stop offset="0%" stop-color={a.lamp} stop-opacity="0.5" />
				<stop offset="100%" stop-color={a.lamp} stop-opacity="0" />
			</radialGradient>
		</defs>
		<ellipse
			cx="0"
			cy={a.floor}
			rx={a.box.w * 0.42}
			ry={a.box.w * 0.09}
			fill="url(#{gid}-sh)"
		/>
	{/if}
	{#each a.tris as t, i (i)}
		<path
			d={t.d}
			fill={t.fill}
			stroke={t.edge}
			stroke-width={crop === 'hero' ? 0.5 : 0.6}
			stroke-linejoin="round"
			filter={shadow && t.glow ? `url(#${gid}-glow)` : undefined}
		/>
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
