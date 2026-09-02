<script lang="ts">
	/**
	 * Armornet crest, hub-and-spoke cut — the server/node icon resolved into an A.
	 *
	 * The server glyph (`<Icon name="crestlink" />`) is a filled hub with spokes
	 * out to ringed satellites. Move those satellites onto the five points of a
	 * letter A — apex, two bar joints, two feet — and wire the outer edges as legs
	 * and bar, and the same mesh language spells the letter.
	 *
	 * Two rules keep it readable:
	 *
	 * · LETTER vs MESH. The legs and bar are the letter and carry the mark's
	 *   weight; the hub spokes and the tethers are mesh and stay hairline. Cut at
	 *   one weight throughout, the A drowns in its own wiring — see `look`.
	 * · The mesh is TIED to the shield, and traced, not drawn. Each tether leaves
	 *   its node square or at 45°, jogs once, and lands at an arbitrary point on
	 *   the wall — never a vertex, never a mirror of its opposite. Real mesh
	 *   routing is orthogonal and a bit chaotic; five tidy radial spokes read as
	 *   decoration.
	 *
	 * Geometry (24-unit box), letter symmetric on x=12:
	 *   shield — the crestlink outline: crown 12,3 · shoulders 4,6 and 20,6 ·
	 *     flanks down to y=11 · base vertex 12,21
	 *   apex 12,6.6 · feet 8,17 and 16,17
	 *   bar y=12.6, meeting the legs at x=9.69 / 14.31 · hub 12,12.6
	 *
	 * Sibling mark: ArmornetCrest.svelte — the outlined, deliberately imperfect
	 * cut on the peaked shield.
	 */
	interface CrestHubProps {
		size?: number;
		color?: string;
		/**
		 * How the letter separates itself from the mesh:
		 *   'hollow' — members stroked wide with their core cut out (default)
		 *   'weight' — one solid weight, heavier than the mesh
		 *   'plated' — solid members over a soft wide underplate
		 * 'plated' leans on opacity; prefer 'hollow' or 'weight' for one-colour
		 * reproduction.
		 */
		look?: 'hollow' | 'weight' | 'plated';
		/**
		 * Which spokes leave the hub, on top of the bar it always sits on:
		 *   'full' — stem up to the apex and down to both feet (default)
		 *   'stem' — stem only
		 *   'bar'  — none, so the A's counter stays open
		 */
		spokes?: 'full' | 'stem' | 'bar';
		/** The tethers binding the A to the shield wall. Drop them below ~32px. */
		tethers?: boolean;
		/** Blurred underlay behind the mark — atmosphere, not structure. */
		glow?: boolean;
		title?: string;
		class?: string;
		style?: string;
	}

	let {
		size = 64,
		color = 'var(--accent)',
		look = 'hollow',
		spokes = 'full',
		tethers = true,
		glow = true,
		title = 'Armornet',
		class: cls = '',
		style = ''
	}: CrestHubProps = $props();

	const uid = $props.id();
	const haloId = `hub-halo-${uid}`;
	const markId = `hub-mark-${uid}`;
	const cutId = `hub-cut-${uid}`;

	const SHIELD = 'M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z';

	// The letter: legs run apex → bar joint → foot as one polyline so the joint
	// carries a round join, plus the bar across.
	const LETTER =
		'M12 6.6 L9.69 12.6 L8 17 M12 6.6 L14.31 12.6 L16 17 M9.69 12.6 L14.31 12.6';

	const SPOKES = $derived(
		[
			...(spokes !== 'bar' ? ['M12 12.6 L12 6.6'] : []),
			...(spokes === 'full' ? ['M12 12.6 L8 17', 'M12 12.6 L16 17'] : [])
		].join(' ')
	);

	// Traced, not drawn — each is a jog and a landing, and no two are alike:
	// up-then-45 to the crown edge; left-then-45 to the flank; 45-then-out to the
	// far flank; 45-then-left onto the lower curve; and one bare horizontal run.
	const TETHER_TRACES = [
		'M12 6.6 L12 5 L13.45 3.55',
		'M9.69 12.6 L6.39 12.6 L4 10.21',
		'M14.31 12.6 L16.31 10.6 L20 10.6',
		'M8 17 L7.1 16.1 L5.43 16.1',
		'M16 17 L17.94 17'
	].join(' ');

	const LANDINGS = [
		[13.45, 3.55],
		[4, 10.21],
		[20, 10.6],
		[5.43, 16.1],
		[17.94, 17]
	];

	const SATELLITES = [
		[12, 6.6],
		[9.69, 12.6],
		[14.31, 12.6],
		[8, 17],
		[16, 17]
	];

	// The mesh sits back far enough to read as wiring, but not so far that it
	// drops out in print.
	const MESH_OPACITY = $derived(look === 'weight' ? 0.5 : look === 'plated' ? 0.65 : 0.75);
</script>

<svg
	class="crest {cls}"
	{style}
	width={size}
	height={size}
	viewBox="-1 -1 26 26"
	role="img"
	aria-label={title}
>
	<title>{title}</title>

	<defs>
		<filter id={haloId} x="-45%" y="-45%" width="190%" height="190%">
			<feGaussianBlur stdDeviation="0.7" />
		</filter>

		{#if look === 'hollow'}
			<!-- Hollows the letter: white keeps, black cuts. The satellite interiors
			     are cut too, so each node opens into the members' channel instead of
			     being crossed by it. -->
			<mask id={cutId} maskUnits="userSpaceOnUse" x="-1" y="-1" width="26" height="26">
				<rect x="-1" y="-1" width="26" height="26" fill="#fff" />
				<g stroke="#000" fill="#000" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">
					<path d={LETTER} fill="none" stroke-width="0.5" />
					{#each SATELLITES as [cx, cy]}
						<circle {cx} {cy} r="0.45" />
					{/each}
				</g>
			</mask>
		{/if}

		<g id={markId} fill="none" stroke={color} stroke-linecap="round" stroke-linejoin="round">
			<path d={SHIELD} stroke-width="0.5" stroke-linejoin="round" />

			<!-- Mesh: hub spokes and tethers, one hairline weight. -->
			<g stroke-opacity={MESH_OPACITY} stroke-width="0.28">
				{#if tethers}
					<path d={TETHER_TRACES} />
				{/if}
				{#if SPOKES}
					<path d={SPOKES} />
				{/if}
			</g>
			{#if tethers}
				{#each LANDINGS as [cx, cy]}
					<circle {cx} {cy} r="0.3" fill={color} fill-opacity={MESH_OPACITY} stroke="none" />
				{/each}
			{/if}

			<!-- Letter. -->
			{#if look === 'plated'}
				<path d={LETTER} stroke-width="1.8" stroke-opacity="0.18" />
				<path d={LETTER} stroke-width="0.5" />
			{:else if look === 'hollow'}
				<path d={LETTER} mask="url(#{cutId})" stroke-width="1.15" />
			{:else}
				<path d={LETTER} stroke-width="0.62" />
			{/if}

			<!-- Satellites are rings, not discs: an edge terminating in a node
			     rather than a dot on a stick. -->
			{#each SATELLITES as [cx, cy]}
				<circle {cx} {cy} r="0.62" stroke-width="0.3" />
			{/each}
			<circle cx="12" cy="12.6" r="0.78" fill={color} stroke="none" />
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
