<script lang="ts">
	// ── The mark, with its figure taken off ──────────────────────────────────────
	// `ArmornetLogo` is one object. That is right for every place it ships and
	// wrong for exactly one thing: turning the mesh figure while the shield holds
	// still. Half the mark has to move and the other half must not, and a single
	// component cannot be asked for that.
	//
	// So this draws the shield through `ArmornetCrestMesh` at `LOGO_SHAPE` — the
	// same single vote on which shield is the brand — with `meshColor="transparent"`,
	// which is the seam that lets the wall be drawn without its figure. The figure
	// is then drawn here, out of the geometry the crest itself publishes, at
	// whatever azimuth it has been turned to.
	//
	// `loose` false is the shipped component and nothing else. The swap between
	// them is invisible because a whole number of turns puts every satellite back
	// on the pixel the flat logo draws it at — see `tripod.ts`.
	//
	// ── the two artboards ──
	// This is the other thing the component is for. The line crest is authored in
	// a 24-unit box and the forged cut in 200×220, so rendering both at "the same
	// size" draws two shields 36% apart. `size` here means the same as `size` on
	// `ArmornetCrestChrome`, and everything inside is resolved against it — which
	// is what lets a scene cross-fade one onto the other and have it land on
	// itself.
	import ArmornetLogo, { LOGO_SHAPE } from '../icons/ArmornetLogo.svelte';
	import ArmornetCrestMesh from '../icons/ArmornetCrestMesh.svelte';
	import { foot } from './tripod.js';
	import { clamp01 } from './nanite.js';
	import { markGeometry } from './forge.js';

	interface Props {
		/** The shield's width in px, read the same way `ArmornetCrestChrome` reads
		 *  it — not the line crest's own box. */
		size?: number;
		/** Draw the figure separately from the wall. Off, this is the shipped
		 *  logo; on, the mark is in two pieces and `spin` moves one of them. */
		loose?: boolean;
		/** The figure's azimuth, radians. Whole turns land back on the rest pose. */
		spin?: number;
		/** How far the hub has caught, 0–1. Runs the wall from graphite to the
		 *  accent and the figure one stage further, toward white. */
		ignite?: number;
		/** The hot core's own flicker, 0–1. Separate from `ignite` because a
		 *  steady bloom reads as a gradient rather than as something burning. */
		pulse?: number;
		/** A scale on the whole mark. The breath, when a host has a clock to
		 *  drive it with. */
		breathe?: number;
	}

	let { size = 470, loose = false, spin = 0, ignite = 0, pulse = 1, breathe = 1 }: Props = $props();

	const uid = $props.id();
	const { A, TRI, figStroke } = markGeometry();

	// The line crest, resolved into the forged cut's box. 11.5 units of the
	// 220-unit box per mesh unit, 26 of them across the line crest.
	const LOGO = $derived(((11.5 * size) / 220) * 26);
	// Each mark's own box centre is not its SHIELD's centre. Nudge both onto the
	// shield instead of onto the artboard, or the crest drifts as it forges.
	const DY_CHROME = $derived(0.005784 * size);
	const DY_LOGO = $derived(0.012115 * LOGO);

	const ACCENT = [94, 234, 212];
	const GRAPHITE = [107, 116, 128];
	const mix = (a: number[], b: number[], k: number) =>
		`rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * k)).join(',')})`;

	const wallColor = $derived(mix(GRAPHITE, ACCENT, ignite));
	/** The figure runs one stage further than the wall does — through the accent
	 *  and on toward white. It is the thing that caught; the wall is only lit BY
	 *  it, and giving both the same ramp is what makes an ignition read as a
	 *  recolour of the whole logo instead of as something starting at the hub. */
	const figColor = $derived(
		mix(
			ACCENT.map((c, i) => GRAPHITE[i] + (c - GRAPHITE[i]) * clamp01(ignite * 2)),
			[236, 255, 250],
			clamp01((ignite - 0.45) * 1.9)
		)
	);

	/** Sorted by depth, so the figure can be painted back to front. A tripod
	 *  turning is the one moment it has a near side and a far side, and drawing
	 *  it in declaration order throws that away. */
	const feet = $derived(
		TRI.rest.map((az, i) => ({ i, ...foot(TRI, az + spin) })).sort((a, b) => a.depth - b.depth)
	);
</script>

<div
	class="mark"
	style:--dy="{DY_LOGO}px"
	style:transform="translate(-50%,-50%) translateY(calc(-1 * var(--dy))) scale({breathe})"
>
	{#if loose}
		<ArmornetCrestMesh
			size={LOGO}
			shape={LOGO_SHAPE}
			color={wallColor}
			meshColor="transparent"
			glow={ignite > 0.05}
			title="Armornet"
		/>
	{:else}
		<ArmornetLogo size={LOGO} color={wallColor} glow={false} title="Armornet" />
	{/if}
</div>

{#if loose}
	<svg
		class="mark"
		style:--dy="{DY_CHROME}px"
		width={size}
		height={size}
		viewBox="0 0 200 220"
		aria-hidden="true"
	>
		<defs>
			<filter id="{uid}-corehot" x="-160%" y="-160%" width="420%" height="420%">
				<feGaussianBlur stdDeviation="8" />
			</filter>
		</defs>
		{#if ignite > 0.02}
			<g filter="url(#{uid}-corehot)" opacity={ignite * pulse * 0.9}>
				<circle cx={TRI.hx} cy={TRI.hy} r={A.fig.hubR * 2} fill="var(--accent)" />
			</g>
		{/if}
		<g
			fill="none"
			stroke={figColor}
			stroke-width={figStroke}
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{#each feet as f (f.i)}
				<!-- The satellite swells as it comes toward you. The spoke is then cut
				     short of it, or the line pokes out of the far side of the ball. -->
				{@const r = A.fig.nodeR * (1 + 0.13 * f.depth)}
				{@const dx = f.x - TRI.hx}
				{@const dy = f.y - TRI.hy}
				{@const L = Math.hypot(dx, dy) || 1}
				<line x1={TRI.hx} y1={TRI.hy} x2={f.x - (dx / L) * r} y2={f.y - (dy / L) * r} />
				<circle cx={f.x} cy={f.y} r={r} />
			{/each}
		</g>
		<circle cx={TRI.hx} cy={TRI.hy} r={A.fig.hubR} fill={figColor} />
	</svg>
{/if}

<style>
	/* Both halves are nudged so the SHIELD's centre — not either artboard's —
	   lands on the host's centre. Everything in a forge scene is registered
	   against that point. */
	.mark {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) translateY(calc(-1 * var(--dy)));
		line-height: 0;
	}
</style>
