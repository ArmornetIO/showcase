<script lang="ts">
	/**
	 * Armornet crest — the full brand mark.
	 *
	 * Construction, so this can be re-cut cleanly:
	 *
	 * · The A is NOT a filled letterform. It is three members stroked wide, with
	 *   a narrower stroke masked out of the middle of each. That leaves two
	 *   parallel contours and a TRANSPARENT core, so the mark sits on any
	 *   background — no hard-coded dark fill anywhere.
	 * · The five joints are rings built the same way: a disc in the mask's
	 *   positive, a smaller disc in its negative. Inner strokes and inner discs
	 *   are painted into ONE mask, so they merge and the counters read as a
	 *   single continuous channel.
	 * · The halo is a BLURRED UNDERLAY of the mark, not a filter on the mark
	 *   itself. Filtering the mark directly bleeds glow into the counter and over
	 *   the mesh, which reads as a neon sign rather than a drawn line.
	 * · The A is deliberately imperfect: the right bar joint sits higher than the
	 *   left, and both legs kick outward below their joint, so the letter reads
	 *   as a drawn mesh rather than a typeset glyph.
	 * · The mesh is FIVE STRUTS from the A's joints to the shield wall, at one
	 *   weight, rather than clusters of hairline chains. Hairlines vanish in
	 *   print and in single-colour reproduction; a strut at 0.24 survives both
	 *   and still reads as a minimal network.
	 *
	 * Geometry (24-unit box):
	 *   shield 3.9–20.1 wide, 2.1–21.9 tall
	 *   apex 12,6.25 · feet 7.5,16.75 and 16.62,16.75
	 *   bar joints 9.364,13 (left) and 14.46,12.55 (right, lifted)
	 *   member 1.24 outer, 0.64 inner → 0.30 contour
	 *
	 * For a single-weight line version that survives 16px, use
	 * `<Icon name="armornet" />` instead.
	 */
	interface CrestProps {
		size?: number;
		/** Brand colour of the shield and core. */
		color?: string;
		/** Muted colour of the mesh footprint behind the crest. */
		meshColor?: string;
		/** Blurred underlay behind the mark — atmosphere, not structure. */
		glow?: boolean;
		/** The struts tying the A to the shield wall. Drop them below ~32px. */
		mesh?: boolean;
		title?: string;
		class?: string;
		style?: string;
	}

	let {
		size = 64,
		color = 'var(--accent)',
		meshColor = '#7fa79a',
		glow = true,
		mesh = true,
		title = 'Armornet',
		class: cls = '',
		style = ''
	}: CrestProps = $props();

	// Scoped so several crests can share a page without their defs colliding.
	const uid = $props.id();
	const maskId = `crest-core-${uid}`;
	const haloId = `crest-halo-${uid}`;
	const markId = `crest-mark-${uid}`;

	// Apex → bar joint → foot, per leg, then the bar. Drawn as polylines so the
	// outward kick at each joint carries a round join.
	const CORE_MEMBERS =
		'M12 6.25 L9.364 13 L7.5 16.75 M12 6.25 L14.46 12.55 L16.62 16.75 M9.364 13 L14.46 12.55';
</script>

<svg
	class="crest {cls}"
	{style}
	width={size}
	height={size}
	viewBox="-2 -2 28 28"
	role="img"
	aria-label={title}
>
	<title>{title}</title>

	<defs>
		<filter id={haloId} x="-45%" y="-45%" width="190%" height="190%">
			<feGaussianBlur stdDeviation="0.7" />
		</filter>

		<!-- Hollows the core: white keeps, black cuts. stroke-width 0 on the group
		     because the discs are pure fills — left at the default of 1 they
		     inherit a stroke that swallows the ring. -->
		<mask id={maskId} maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">
			<rect x="-2" y="-2" width="28" height="28" fill="#fff" />
			<g stroke="#000" fill="#000" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">
				<path d={CORE_MEMBERS} fill="none" stroke-width="0.64" />
				<circle cx="12" cy="6.25" r="0.69" />
				<circle cx="9.364" cy="13" r="0.52" />
				<circle cx="14.46" cy="12.55" r="0.52" />
				<circle cx="7.5" cy="16.75" r="0.74" />
				<circle cx="16.62" cy="16.75" r="0.74" />
			</g>
		</mask>

		<g id={markId} fill="none" stroke={color} stroke-linecap="round" stroke-linejoin="round">
			<!-- shield: peaked crown, straight flanks, long curve to a soft point -->
			<path
				d="M12 2.1 L20.1 5.3 L20.1 12.9 C20.1 17.4 16.7 20.5 12 21.9 C7.3 20.5 3.9 17.4 3.9 12.9 L3.9 5.3 Z"
				stroke-width="0.43"
			/>
			<g mask="url(#{maskId})" fill={color}>
				<path d={CORE_MEMBERS} stroke-width="1.24" />
				<circle cx="12" cy="6.25" r="0.99" stroke="none" />
				<circle cx="9.364" cy="13" r="0.82" stroke="none" />
				<circle cx="14.46" cy="12.55" r="0.82" stroke="none" />
				<circle cx="7.5" cy="16.75" r="1.04" stroke="none" />
				<circle cx="16.62" cy="16.75" r="1.04" stroke="none" />
			</g>
		</g>
	</defs>

	<!-- halo, then the struts, then the crisp mark on top -->
	{#if glow}
		<use href="#{markId}" filter="url(#{haloId})" opacity="0.5" />
	{/if}

	{#if mesh}
		<!-- Struts: five members running from the A's joints out to the shield
		     wall, each landing on a node. They are the only mesh in the mark —
		     one weight, no clusters — so the whole thing holds at print sizes and
		     in single-colour reproduction. Drawn UNDER the mark, so they read as
		     passing beneath the joints rather than butting into them. -->
		<g stroke={meshColor} stroke-opacity="0.55" stroke-width="0.24" stroke-linecap="round">
			<path d="M12 6.25 L16.5 3.88" />
			<path d="M9.364 13 L3.9 10.6" />
			<path d="M14.46 12.55 L20.04 13.88" />
			<path d="M7.5 16.75 L5.78 18.1" />
			<path d="M16.62 16.75 L18.22 18.1" />
		</g>
		<g fill={meshColor} fill-opacity="0.7">
			<circle cx="16.5" cy="3.88" r="0.3" />
			<circle cx="3.9" cy="10.6" r="0.3" />
			<circle cx="20.04" cy="13.88" r="0.3" />
			<circle cx="5.78" cy="18.1" r="0.3" />
			<circle cx="18.22" cy="18.1" r="0.3" />
		</g>
	{/if}

	<use href="#{markId}" />
</svg>

<style>
	.crest {
		display: inline-block;
		flex-shrink: 0;
		vertical-align: middle;
	}
</style>
