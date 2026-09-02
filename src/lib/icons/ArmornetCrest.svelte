<script lang="ts">
	/**
	 * Armornet crest — the full brand mark.
	 *
	 * The artwork is `ArmornetMeshLogo-transparent.svg` made themeable. Geometry
	 * is that file's, verbatim, in its native 617 box — NOT redrawn at 24 — so
	 * the component and the shipped asset stay the same mark rather than drifting
	 * into two marks that merely resemble each other.
	 *
	 * Construction, so this can be re-cut cleanly:
	 *
	 * · The A is a SOLID stroked letterform: two members apex→foot plus a
	 *   crossbar, one weight, round caps. It is not hollowed and not skewed —
	 *   the mark reads as a drawn monogram, and asymmetry only ever read as a
	 *   rendering fault at small sizes.
	 * · The shield is DOUBLE: a heavy outer wall and a hairline inset. The inset
	 *   is what gives the mark its depth; without it the outer wall reads as a
	 *   sticker outline.
	 * · The nodes are filled discs with holes punched through the WHOLE mark by
	 *   one mask, so a node reads as a ring and the A's stroke is cut where it
	 *   passes underneath. Masking the whole group, not each disc, is what makes
	 *   the counters line up.
	 * · The mesh lives INSIDE the A — crossbar ends down to a centre dot, then
	 *   out to the feet. Earlier cuts ran struts outward to the shield wall;
	 *   they crowded the wall and vanished in single-colour reproduction.
	 * · The halo is a BLURRED UNDERLAY of the mark, not a filter on the mark
	 *   itself. Filtering the mark directly bleeds glow into the counters and
	 *   reads as a neon sign rather than a drawn line.
	 *
	 * The mark is monochrome by design; `meshColor` exists only for the rare
	 * two-tone placement and defaults to `color`.
	 *
	 * For a single-weight line version that survives 16px, use
	 * `<Icon name="armornet" />` instead.
	 */
	interface CrestProps {
		size?: number;
		/** Brand colour of the whole mark. */
		color?: string;
		/** Overrides the inner mesh only. Defaults to `color` — the mark is monochrome. */
		meshColor?: string;
		/** Blurred underlay behind the mark — atmosphere, not structure. */
		glow?: boolean;
		/** The inner mesh tying the crossbar to the feet. Drop it below ~32px. */
		mesh?: boolean;
		title?: string;
		class?: string;
		style?: string;
	}

	let {
		size = 64,
		color = 'var(--accent)',
		meshColor,
		glow = true,
		mesh = true,
		title = 'Armornet',
		class: cls = '',
		style = ''
	}: CrestProps = $props();

	const meshStroke = $derived(meshColor ?? color);

	// Scoped so several crests can share a page without their defs colliding.
	const uid = $props.id();
	const maskId = `crest-nodes-${uid}`;
	const haloId = `crest-halo-${uid}`;
	const markId = `crest-mark-${uid}`;

	const OUTER_SHIELD =
		'M308.5 74.7148L513.363 142.199V315.73C513.363 419.367 429.008 496.492 308.5 542.285C187.992 496.492 103.637 419.367 103.637 315.73V142.199L308.5 74.7148Z';
	const INNER_SHIELD =
		'M308.5 109L488 167.887V319.309C488 409.742 414.088 477.041 308.5 517C202.912 477.041 129 409.742 129 319.309V167.887L308.5 109Z';
	const LETTER = 'M172.326 477.211L307.897 96.4062L443.469 477.211M237.454 322.961H378.341';
	const MESH =
		'M245.088 344L309 414.656M309 414.656L372.912 344M309 414.656L186 477M309 414.656L432 477';

	// Node discs and the hole cut out of each, as one list — the two radii must
	// move together or the ring goes lopsided.
	const NODES = [
		{ cx: 308.348, cy: 77.357, r: 31, hole: 13.5 },
		{ cx: 228.965, cy: 322.961, r: 31.332, hole: 13.256 },
		{ cx: 388.035, cy: 322.961, r: 31.332, hole: 13.256 },
		{ cx: 177.146, cy: 473.596, r: 36.152, hole: 15.666 },
		{ cx: 442.264, cy: 473.596, r: 36.152, hole: 15.666 }
	];
</script>

<svg
	class="crest {cls}"
	{style}
	width={size}
	height={size}
	viewBox="0 0 617 617"
	role="img"
	aria-label={title}
>
	<title>{title}</title>

	<defs>
		<filter id={haloId} x="-30%" y="-30%" width="160%" height="160%">
			<feGaussianBlur stdDeviation="14" />
		</filter>

		<!-- Holes for every node, punched through the whole mark at once. -->
		<mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="617" height="617">
			<rect width="617" height="617" fill="#fff" />
			{#each NODES as n (n.cx + ':' + n.cy)}
				<circle cx={n.cx} cy={n.cy} r={n.hole} fill="#000" />
			{/each}
		</mask>

		<g id={markId} mask="url(#{maskId})">
			<g fill="none" stroke={color} stroke-miterlimit="10">
				<path d={OUTER_SHIELD} stroke-width="20" />
				<path d={INNER_SHIELD} stroke-width="1" />
			</g>
			<path d={LETTER} fill="none" stroke={color} stroke-width="17" stroke-linecap="round" />
			{#if mesh}
				<path
					d={MESH}
					fill="none"
					stroke={meshStroke}
					stroke-opacity="0.85"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
				<circle cx="308.5" cy="412.906" r="8.436" fill={meshStroke} />
			{/if}
			{#each NODES as n (n.cx + ':' + n.cy)}
				<circle cx={n.cx} cy={n.cy} r={n.r} fill={color} />
			{/each}
		</g>
	</defs>

	{#if glow}
		<use href="#{markId}" filter="url(#{haloId})" opacity="0.5" />
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
