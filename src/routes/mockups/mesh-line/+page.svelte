<script lang="ts">
	// ── /mockups/mesh-line ─────────────────────────────────────────────────────
	// Two globes, one crest, two lines. Left globe = the software supply chain,
	// right globe = the customer's environment, crest = the armornet server. An
	// agent stands on the near face of each globe; the encrypted line between
	// each agent and the crest is the only thing joining the two worlds.
	//
	// Same parts as /mockups/mesh-globe, run twice: Canvas owns the camera,
	// GlobeFrame draws the wireframe under MeshStudio, physics/sphere places and
	// projects. No API surface.
	import { Canvas, MeshStudio, GlobeFrame, packSphere, spin, project } from '$lib/index.js';
	import type { StudioNode, StudioEdge, Vec3 } from '$lib/index.js';
	import { DEFAULT_TUNING } from '$lib/mesh-studio/layout/mesh-tuning.js';
	import { ECOSYSTEMS, PACKAGE_GLYPH, HUB_GLYPH } from '$lib/icons/supply-chain-glyphs.js';

	// 24×24, single-stroke, `currentColor` — the glyph contract from
	// `supply-chain-glyphs.ts`, so each inherits its node's colour.
	const G = {
		crate: `<rect x="3" y="5" width="18" height="14" rx="1.4"/><path d="M3 9.5h18M3 14.5h18M8.5 5v14M15.5 5v14"/>`,
		gem: `<path d="M7.5 3h9l4.5 6-9 12L3 9z"/><path d="M3 9h18M7.5 3l4.5 18M16.5 3 12 21M7.5 3 12 9l4.5-6"/>`,
		maven: `<path d="M4 19V5l4 7 4-7 4 7 4-7v14"/>`,
		nuget: `<path d="M12 2.6 20.4 7.3v9.4L12 21.4 3.6 16.7V7.3z"/><circle cx="9.4" cy="12.4" r="2.1"/><circle cx="15.4" cy="9.6" r="1.3"/>`,
		extension: `<path d="M4 4h6.4v2a1.9 1.9 0 1 0 3.8 0V4H20v6.2h-2.1a1.9 1.9 0 1 0 0 3.8H20V20H4z"/>`,
		layers: `<path d="M12 2.8 2.8 7.4 12 12l9.2-4.6z"/><path d="m2.8 12 9.2 4.6L21.2 12M2.8 16.6 12 21.2l9.2-4.6"/>`,
		sbom: `<path d="M6 2.6h8l4.4 4.4V21.4H6z"/><path d="M14 2.6V7h4.4"/><path d="M9 12h7M9 15.4h7M9 18.4h4"/>`,
		advisory: `<path d="M12 3.4 22 20.6H2z"/><path d="M12 9.6v4.8"/><circle cx="12" cy="17.6" r=".9" fill="currentColor" stroke="none"/>`,
		feed: `<circle cx="4.6" cy="18.2" r="1.5" fill="currentColor" stroke="none"/><path d="M4.5 10.4A9.1 9.1 0 0 1 13.6 19.5M4.5 4.2A15.3 15.3 0 0 1 19.8 19.5"/>`,
		model: `<rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/><circle cx="12" cy="12" r="2.2"/><path d="M9.8 3.2v3.3M14.2 3.2v3.3M9.8 17.5v3.3M14.2 17.5v3.3M3.2 9.8h3.3M3.2 14.2h3.3M17.5 9.8h3.3M17.5 14.2h3.3"/>`,
		chart: `<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.6v6M12 14.4v6M3.6 12h6M14.4 12h6M6.4 6.4l4.2 4.2M13.4 13.4l4.2 4.2M17.6 6.4l-4.2 4.2M10.6 13.4l-4.2 4.2"/>`,
		build: `<path d="M15.4 3.4a5.4 5.4 0 0 0-6.8 6.8L3.4 15.4l5.2 5.2 5.2-5.2a5.4 5.4 0 0 0 6.8-6.8l-3.4 3.4-3.2-.6-.6-3.2z"/>`,

		// The customer's world.
		laptop: `<rect x="4" y="4.4" width="16" height="10.2" rx="1.2"/><path d="M2 18.6 4 14.6h16l2 4z"/>`,
		monitor: `<rect x="2.6" y="4" width="18.8" height="12" rx="1.6"/><path d="M12 16v4M9 20h6"/>`,
		server: `<rect x="3" y="3.4" width="18" height="7" rx="1.2"/><rect x="3" y="13.6" width="18" height="7" rx="1.2"/><circle cx="6.6" cy="6.9" r=".9" fill="currentColor" stroke="none"/><circle cx="6.6" cy="17.1" r=".9" fill="currentColor" stroke="none"/><path d="M10 6.9h7.4M10 17.1h7.4"/>`,
		phone: `<rect x="7" y="2.4" width="10" height="19.2" rx="2.2"/><path d="M10.6 5.4h2.8M10.4 18.6h3.2"/>`,
		k8s: `<path d="M12 2.6 20.4 7v10L12 21.4 3.6 17V7z"/><circle cx="12" cy="12" r="2.4"/><path d="M12 9.6V5.6M14.1 13.4l3.3 2.3M9.9 13.4l-3.3 2.3"/>`,
		cloud: `<path d="M7.4 19.2h10.2a4.3 4.3 0 0 0 .4-8.6 5.7 5.7 0 0 0-10.9-2 4.3 4.3 0 0 0 .3 10.6z"/>`,
		database: `<ellipse cx="12" cy="6" rx="7.5" ry="3.2"/><path d="M4.5 6v12c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2V6"/><path d="M4.5 12c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2"/>`,
		dev: `<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.6a7.2 7.2 0 0 1 14.4 0"/>`,
		browser: `<rect x="2.6" y="4" width="18.8" height="16" rx="1.6"/><path d="M2.6 8.6h18.8"/><circle cx="5.8" cy="6.3" r=".8" fill="currentColor" stroke="none"/><circle cx="8.4" cy="6.3" r=".8" fill="currentColor" stroke="none"/>`,
		terminal: `<rect x="2.6" y="4" width="18.8" height="16" rx="1.6"/><path d="m6.6 9.4 3.2 2.8-3.2 2.8M12.6 15.6h5"/>`,
		network: `<rect x="2.6" y="14" width="18.8" height="6" rx="1.4"/><path d="M12 14V9M12 9H6.4V5M12 9h5.6V5"/><circle cx="6.4" cy="17" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/><circle cx="17.6" cy="17" r=".9" fill="currentColor" stroke="none"/>`,
		pipeline: `<circle cx="5.6" cy="6" r="2.3"/><circle cx="12" cy="18" r="2.3"/><circle cx="18.4" cy="6" r="2.3"/><path d="M5.6 8.3v3.4a2.4 2.4 0 0 0 2.4 2.4h1.7M18.4 8.3v3.4a2.4 2.4 0 0 1-2.4 2.4h-1.7"/>`,
		repo: `<circle cx="7" cy="5.6" r="2.2"/><circle cx="7" cy="18.4" r="2.2"/><circle cx="17" cy="8.6" r="2.2"/><path d="M7 7.8v8.4M17 10.8c0 4.2-4.2 3.4-6.8 5.6"/>`,
		code: `<path d="m8.4 8-4.6 4 4.6 4M15.6 8l4.6 4-4.6 4M13.8 5.2l-3.6 13.6"/>`,
		badge: `<path d="M12 2.6 20 5.8v5.4c0 5-3.4 8.6-8 10.2-4.6-1.6-8-5.2-8-10.2V5.8z"/><path d="m8.8 12 2.4 2.4 4.4-4.6"/>`
	};

	interface Territory {
		key: string;
		label: string;
		sub: string;
		color: string;
		glyph: string;
	}

	// Left globe. The five real registry proxies lead — those are intercepts
	// armornet actually performs today.
	const SUPPLY: Territory[] = [
		...ECOSYSTEMS.map((e) => ({
			key: e.key,
			label: e.label,
			sub: e.host,
			color: e.color,
			glyph: e.glyph
		})),
		{ key: 'maven', label: 'Maven', sub: 'repo1.maven.org', color: '#E8A05F', glyph: G.maven },
		{ key: 'cargo', label: 'crates.io', sub: 'static.crates.io', color: '#D89A6A', glyph: G.crate },
		{ key: 'gems', label: 'RubyGems', sub: 'rubygems.org', color: '#E8737A', glyph: G.gem },
		{ key: 'nuget', label: 'NuGet', sub: 'nuget.org', color: '#8FA8F0', glyph: G.nuget },
		{ key: 'ext', label: 'Extensions', sub: 'marketplace', color: '#7FD8A8', glyph: G.extension },
		{ key: 'images', label: 'Base images', sub: 'ghcr.io', color: '#6FBEE8', glyph: G.layers },
		{ key: 'models', label: 'Models', sub: 'hf.co', color: '#F0C05A', glyph: G.model },
		{ key: 'charts', label: 'Charts', sub: 'oci helm', color: '#5FC9C0', glyph: G.chart },
		{ key: 'build', label: 'Build tools', sub: 'toolchain', color: '#B49AE0', glyph: G.build },
		{ key: 'sbom', label: 'SBOM', sub: 'attestation', color: '#9FB4C8', glyph: G.sbom },
		{ key: 'cve', label: 'Advisories', sub: 'osv · nvd', color: '#E8815F', glyph: G.advisory },
		{ key: 'feeds', label: 'Threat feeds', sub: 'intel', color: '#E0A25F', glyph: G.feed },
		{ key: 'dep1', label: 'transitive', sub: 'depth 4', color: '#7E8CA0', glyph: PACKAGE_GLYPH },
		{ key: 'dep2', label: 'transitive', sub: 'depth 7', color: '#7E8CA0', glyph: PACKAGE_GLYPH },
		{ key: 'dep3', label: 'transitive', sub: 'depth 9', color: '#7E8CA0', glyph: PACKAGE_GLYPH }
	];

	// Right globe: the org's own estate.
	const ESTATE: Territory[] = [
		{ key: 'laptop-1', label: 'Workstations', sub: '412 endpoints', color: '#8FD6F0', glyph: G.laptop },
		{ key: 'laptop-2', label: 'Contractors', sub: '38 endpoints', color: '#8FD6F0', glyph: G.laptop },
		{ key: 'dev', label: 'Developers', sub: '96 seats', color: '#C4A8FF', glyph: G.dev },
		{ key: 'repo', label: 'Repositories', sub: '214 repos', color: '#E8975F', glyph: G.repo },
		{ key: 'ci', label: 'CI runners', sub: 'self-hosted', color: '#7FD8A8', glyph: G.pipeline },
		{ key: 'k8s', label: 'Clusters', sub: '6 clusters', color: '#6FBEE8', glyph: G.k8s },
		{ key: 'servers', label: 'Build fleet', sub: 'linux/amd64', color: '#9FB4C8', glyph: G.server },
		{ key: 'db', label: 'Data stores', sub: 'postgres', color: '#5FC9C0', glyph: G.database },
		{ key: 'cloud', label: 'Cloud accts', sub: '3 orgs', color: '#8FA8F0', glyph: G.cloud },
		{ key: 'net', label: 'Egress', sub: 'dns · proxy', color: '#5FEAD5', glyph: G.network },
		{ key: 'ide', label: 'IDE agents', sub: 'mcp · copilot', color: '#B49AE0', glyph: G.code },
		{ key: 'term', label: 'Shells', sub: 'jump hosts', color: '#9FB4C8', glyph: G.terminal },
		{ key: 'browser', label: 'Browsers', sub: 'extensions', color: '#E0A25F', glyph: G.browser },
		{ key: 'mobile', label: 'Mobile', sub: 'mdm', color: '#8FD6F0', glyph: G.phone },
		{ key: 'compliance', label: 'Controls', sub: 'soc2 · iso', color: '#7FD8A8', glyph: G.badge },
		{ key: 'desk', label: 'Kiosks', sub: 'unmanaged', color: '#9FB4C8', glyph: G.monitor }
	];

	// Canvas world coords are screen coords here (no pan, zoom 1), so the layout
	// is measured off the stage rather than hard-coded. The target frame is a
	// slide's whitespace — roughly a third of the width and three-quarters of the
	// height — so the composition has to survive a NARROW, tallish box, and every
	// size below is solved from the box rather than tuned for a wide viewport.
	let stageW = $state(560);
	let stageH = $state(760);

	const PAD = 10; // breathing room at the stage edge
	// Clear air between a globe's rim and the crest. Wide enough for the crest's
	// caption, which hangs below it and would otherwise land inside a globe.
	const AIR = 44;

	// Globe · crest · globe is a one-dimensional composition, so it runs along the
	// box's LONG side: side by side in a landscape frame, stacked in the portrait
	// one a slide's whitespace actually is. Laying it out across the short side
	// instead is what makes the globes collapse to nothing.
	const vertical = $derived(stageH >= stageW);
	const along = $derived(vertical ? stageH : stageW);
	const across = $derived(vertical ? stageW : stageH);

	const midX = $derived(stageW * 0.5);
	const midY = $derived(stageH * 0.5);
	// Sized off the box's short side, NOT off boxRadius — boxRadius is solved from
	// a budget that already has the crest subtracted from it, so deriving the
	// crest from it in turn would be a cycle. The coefficient is what keeps the
	// crest reading as the centre of the composition rather than as a third node.
	const HUB_R = $derived(Math.max(20, Math.min(46, across * 0.15)));

	// Along the axis: pad · globe · air · crest · air · globe · pad. Across it, a
	// globe just has to fit. Whichever binds first wins.
	//
	// What has to fit is not the sphere but its ENVELOPE: node discs sit ON the
	// rim, so each globe occupies r + nodeR. Solving for r alone is what pushed
	// the top and bottom of the composition off the screen. FILL then backs the
	// result off that limit so the frame isn't packed edge to edge.
	// The spheres are a third the size the icons are scaled against — that ratio is
	// the whole look, so it is fixed here and everything else is solved around it.
	const GLOBE_SCALE = 1 / 3;
	const ICON_SCALE = 0.092; // icon radius as a share of boxRadius
	const LABEL = 22; // room reserved at each end for a globe's caption
	const FILL = 0.94;

	// `boxRadius` is the reference the crest and icons are sized from; the spheres
	// then take a third of it. Solved from what is ACTUALLY drawn — the globe plus
	// its icon overhang — rather than from the sphere alone. Solving for the
	// sphere and then shrinking it is what left the assembly floating in the
	// middle of a mostly empty frame.
	const boxRadius = $derived(
		Math.max(
			40,
			FILL *
				Math.min(
					(across - 2 * PAD) / (2 * (GLOBE_SCALE + ICON_SCALE)),
					(along - 2 * PAD - 2 * AIR - 2 * LABEL - 2 * HUB_R) /
						(4 * (GLOBE_SCALE + ICON_SCALE))
				)
		)
	);

	const radius = $derived(boxRadius * GLOBE_SCALE);
	const nodeR = $derived(Math.max(6, boxRadius * ICON_SCALE));

	const gap = $derived(radius + nodeR + AIR + HUB_R);

	// The two globe centres, as offsets from the crest along the chosen axis.
	const aX = $derived(vertical ? midX : midX - gap);
	const aY = $derived(vertical ? midY - gap : midY);
	const bX = $derived(vertical ? midX : midX + gap);
	const bY = $derived(vertical ? midY + gap : midY);

	// Each globe's caption, on the side facing AWAY from the crest — the space
	// between the globes belongs to the line and to `armornet`, and a caption in
	// there would read as belonging to the crest rather than to a globe.
	const capA = $derived({ x: aX, y: aY - (radius + nodeR) - LABEL });
	const capB = $derived(
		vertical
			? { x: bX, y: bY + (radius + nodeR) + LABEL * 0.5 }
			: { x: bX, y: bY - (radius + nodeR) - LABEL }
	);

	// Strip the studio's editing chrome: the per-link rings and orbit dots outside
	// each rim, arrowheads, link pills, and the outline energy trace. All of it is
	// instrumentation for an operator working the canvas, and none of it survives
	// being shrunk to slide size — it just turns every node into a smudge.
	const TUNING = {
		...DEFAULT_TUNING,
		connArcs: false,
		arrowheads: false,
		edgeLabels: false,
		trace: false,
		popIn: false
	};

	const PITCH = 0.32;
	const VIEW_D = 2.7;
	// Turned by hand, not on a timer. An idle spin and hand-placed nodes are
	// incompatible: every unplaced node would keep drifting out from under an
	// arrangement being built around it. Drag the background to turn a globe until
	// the icons you want are facing front, then drag the icons themselves.
	let yawL = $state(-0.5);
	let yawR = $state(0.4);

	// How many same-size icons a sphere this small can actually carry. Derived
	// rather than picked: `packSphere` already answers "how big must the sphere be
	// for n discs of radius r not to collide", so walk n up until the answer stops
	// fitting. Change GLOBE_SCALE and the casts re-trim themselves instead of
	// silently overlapping — which is what a hard-coded count would do.
	// Clearance between neighbouring icons. Generous on purpose: `capacity` packs
	// the sphere as tight as this allows, and a tightly packed third-size globe is
	// a ball of icons with no visible sphere under it. The gaps are what let the
	// wireframe read as a globe at all.
	const SEP = $derived(nodeR * 0.9);
	function fits(n: number): boolean {
		if (n < 2) return true;
		return packSphere(Array(n).fill(nodeR), { margin: SEP }).radius <= radius;
	}
	function capacity(max: number): number {
		let n = 1;
		while (n < max && fits(n + 1)) n++;
		return n;
	}

	// Casts are ordered most-representative first, so trimming takes the tail: the
	// registries armornet actually proxies survive, the long tail is what goes.
	const castL = $derived(SUPPLY.slice(0, capacity(SUPPLY.length)));
	const castR = $derived(ESTATE.slice(0, capacity(ESTATE.length)));

	// Placement is computed once per cast size and then only re-projected — the
	// sphere IS the state, x/y is a view of it.
	const packL = $derived(packSphere(Array(castL.length).fill(nodeR), { margin: SEP }));
	const packR = $derived(packSphere(Array(castR.length).fill(nodeR), { margin: SEP }));

	interface Face {
		nodes: StudioNode[];
		depth: Map<string, number>;
	}

	/** Project one cast onto one globe. Returns nodes plus the depth map, because
	 *  paint order is the only hidden-surface pass this renderer has. */
	function faceOf(
		cast: Territory[],
		dirs: Vec3[],
		cx: number,
		cyc: number,
		yaw: number,
		prefix: string,
		type: 'proxy' | 'daemon'
	): Face {
		const nodes: StudioNode[] = [];
		const depth = new Map<string, number>();
		cast.forEach((t, i) => {
			const d = spin(dirs[i], yaw, PITCH);
			const p = project(d, radius, VIEW_D);
			const id = `${prefix}-${t.key}`;
			depth.set(id, d.z);
			nodes.push({
				id,
				type,
				state: 'healthy',
				// Wordless by design: at slide size a caption under every node is
				// unreadable AND doubles the space each node occupies. The glyph is
				// the whole payload; `armornet` on the crest is the only text here.
				label: '',
				// No port controls. They are link-drag handles for an operator
				// wiring the canvas; on a read-only frame they are just a ring of
				// dots around every icon. Edges fall back to a boundary ray-cast.
				ports: [],
				x: cx + p.x,
				y: cyc + p.y,
				// Perspective scale is most of what reads as roundness.
				r: nodeR * p.scale,
				// Visible through the surface, not reachable through it.
				inert: !p.front,
				opacity: p.front ? 1 : 1 + p.depth * 0.88,
				blur: p.front ? 0 : -p.depth * 2.6,
				strokeColor: t.color,
				iconMarkup: t.glyph,
				iconKey: `gl-${prefix}-${t.key}`
			});
		});
		return { nodes, depth };
	}

	// Each line terminates at its globe's centre rather than on a node stuck to
	// the surface: a surface node sits in FRONT of the sphere and reads as one
	// more icon, where the point is that the line reaches the whole world.
	//
	// The anchor is invisible — `opacity: 0` rather than a hidden node, because
	// the edge still has to ray-cast to something. Drawing it would also drag in
	// the type caption the renderer puts above every icon-less node.
	const anchor = (id: string, x: number, y: number): StudioNode => ({
		id,
		type: 'proxy',
		state: 'healthy',
		label: '',
		x,
		y,
		r: Math.max(3, nodeR * 0.35),
		ports: [],
		inert: true,
		opacity: 0
	});

	const coreL = $derived(anchor('core-supply', aX, aY));
	const coreR = $derived(anchor('core-estate', bX, bY));

	const hub = $derived<StudioNode>({
		id: 'hub',
		type: 'control-plane',
		state: 'healthy',
		// The only word on the canvas.
		label: 'armornet',
		x: midX,
		y: midY,
		r: HUB_R,
		ports: [],
		// The crest is a container mark — its outline carries meaning, so it earns
		// its own silhouette and the lines terminate on the shield itself.
		glyphAsBody: true,
		iconMarkup: HUB_GLYPH,
		iconKey: 'gl-hub'
	});

	const left = $derived(faceOf(castL, packL.dirs, aX, aY, yawL, 'sc', 'proxy'));
	const right = $derived(faceOf(castR, packR.dirs, bX, bY, yawR, 'env', 'daemon'));

	// ── Live nodes: a projection you can then overrule by hand ────────────────
	//
	// The layout above is a pure function of the spheres, which is what a node
	// CANNOT be if you're allowed to drag it: the next recompute would put it
	// straight back. So the projection is copied into real state, MeshStudio
	// mutates that state when you drag, and a node whose position no longer
	// matches what we last wrote is taken as hand-placed and left alone from then
	// on. Nothing has to report the drag — the divergence IS the signal.
	// Seeded, NOT empty. An edge whose endpoints don't exist yet draws no path, and
	// the particle stream's `animateMotion` binds its path by id exactly once — so
	// a first frame with no nodes leaves every particle parked at the canvas
	// origin for the life of the page. `compose` is a function declaration, so it
	// is hoisted and callable here.
	let live = $state<StudioNode[]>(compose());
	const placed = new Set<string>();
	const written = new Map<string, { x: number; y: number }>();

	/** The full cast in paint order: cores first, so each line disappears under
	 *  its globe's near face rather than crossing over it — that occlusion is what
	 *  makes a line read as reaching INTO a world instead of pointing at it. Then
	 *  each globe back to front, then the crest on top of both. */
	function compose(): StudioNode[] {
		const l = [...left.nodes].sort((a, b) => left.depth.get(a.id)! - left.depth.get(b.id)!);
		const r = [...right.nodes].sort((a, b) => right.depth.get(a.id)! - right.depth.get(b.id)!);
		return [coreL, coreR, ...l, ...r, hub];
	}

	function sync() {
		const next = compose();
		const byId = new Map(live.map((n) => [n.id, n]));

		// Cast or geometry changed shape → start over, hand placements included.
		// Keeping them would scatter positions that were chosen against a layout
		// that no longer exists.
		if (next.length !== live.length || next.some((n) => !byId.has(n.id))) {
			placed.clear();
			written.clear();
			live = next;
			for (const n of live) written.set(n.id, { x: n.x, y: n.y });
			return;
		}

		for (const n of next) {
			const cur = byId.get(n.id)!;
			const w = written.get(n.id);
			// Moved by something other than us since the last frame → it's yours.
			if (w && (Math.abs(cur.x - w.x) > 0.01 || Math.abs(cur.y - w.y) > 0.01)) {
				placed.add(n.id);
			}
			if (!placed.has(n.id)) {
				cur.x = n.x;
				cur.y = n.y;
				written.set(n.id, { x: n.x, y: n.y });
			}
			// Depth treatment keeps tracking the globe even for a placed node: it
			// still belongs to that sphere, it just isn't where the sphere put it.
			cur.r = n.r;
			cur.inert = placed.has(n.id) ? false : n.inert;
			cur.opacity = n.opacity;
			cur.blur = n.blur;
		}

		// Paint order is array order, so re-sorting IS the hidden-surface pass.
		const order = new Map(next.map((n, i) => [n.id, i]));
		live.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
	}

	// Drive it from the same clock as the spin, so a frame is projected, synced
	// and painted once rather than re-entering on every dependency.
	$effect(() => {
		void left;
		void right;
		void hub;
		sync();
	});

	// ── The lines ─────────────────────────────────────────────────────────────
	// One channel per world, drawn as a counter-flowing PAIR: `energy` particles
	// run from → to, so a single edge only ever shows traffic in one direction and
	// the thing being described is a two-way session. The pair shares endpoints,
	// so it reads as one line carrying both streams rather than as two links.
	// Colour splits the directions: cyan out to the world, green back with the
	// verdict.
	const edges: StudioEdge[] = [
		{ id: 'line-supply-out', from: 'hub', to: 'core-supply', dataType: 'query', style: 'energy', sig: 1 },
		{ id: 'line-supply-in', from: 'core-supply', to: 'hub', dataType: 'verdict', style: 'energy', sig: 1 },
		{ id: 'line-estate-out', from: 'hub', to: 'core-estate', dataType: 'query', style: 'energy', sig: 1 },
		{ id: 'line-estate-in', from: 'core-estate', to: 'hub', dataType: 'verdict', style: 'energy', sig: 1 }
	];

	// Whichever half of the stage you grab is the globe you turn; grabbing either
	// halts the idle spin on both, so the frame never drifts under your hand.
	let drag: { x: number; side: 'l' | 'r'; yaw: number } | null = $state(null);

	function down(e: PointerEvent) {
		// Measured off the stage, not the window — the stage is a box inside it —
		// and split along whichever axis the globes are actually arranged on.
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const side = vertical
			? e.clientY < box.top + box.height / 2
				? 'l'
				: 'r'
			: e.clientX < box.left + box.width / 2
				? 'l'
				: 'r';
		drag = { x: e.clientX, side, yaw: side === 'l' ? yawL : yawR };
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const next = drag.yaw + (e.clientX - drag.x) * 0.008;
		if (drag.side === 'l') yawL = next;
		else yawR = next;
	}
	function up() {
		drag = null;
	}
</script>

<svelte:head>
	<title>The Line — armornet</title>
</svelte:head>

<div class="frame">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="stage"
		class:grabbing={!!drag}
		bind:clientWidth={stageW}
		bind:clientHeight={stageH}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={up}
	>
		<Canvas allowPan={false} allowZoom={false}>
			<!-- Wireframes first, so each web sits behind the nodes it carries. -->
			<GlobeFrame
				cx={aX}
				cy={aY}
				{radius}
				yaw={yawL}
				pitch={PITCH}
				viewDistance={VIEW_D}
				color="#38BDF8"
				surface={0.7}
			/>
			<GlobeFrame
				cx={bX}
				cy={bY}
				{radius}
				yaw={yawR}
				pitch={PITCH}
				viewDistance={VIEW_D}
				color="#C4A8FF"
				surface={0.7}
			/>
			<MeshStudio
				concept="instrument"
				edgeCurve="line"
				bind:nodes={live}
				{edges}
				tuning={TUNING}
				showGrid={false}
				allowLinkDraw={false}
				depthSortedParticles
			/>
		</Canvas>

		<!-- Globe captions. HTML rather than canvas nodes: they name a whole world,
		     so they must not scale with the sphere, rotate with it, or be draggable
		     the way anything inside MeshStudio is. -->
		<p class="cap" style="left: {capA.x}px; top: {capA.y}px; color: #38BDF8">Supply Chain</p>
		<p class="cap" style="left: {capB.x}px; top: {capB.y}px; color: #C4A8FF">
			Customer Environments
		</p>
	</div>
</div>

<style>
	/* The slide's whitespace: a portrait box roughly a third as wide as it is
	   tall, centred in whatever room the page has.
	   Sized by ASPECT + fit, not by vh: viewport units don't know about the
	   showcase's own header, so a 75vh box inside a shell that already spent 50px
	   on chrome overflows the screen — which is exactly what it did. */
	.frame {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: var(--bg, #05070c);
	}
	/* Capped in ABSOLUTE px, not just as a share of the window. Sized only by
	   percentage the box grew with the display, so the same composition that
	   looked right on a laptop was enormous on a bigger screen. The cap is the
	   one number to change if it wants to be bigger or smaller — everything
	   inside is solved from the box. */
	.stage {
		aspect-ratio: 33 / 75;
		height: min(100%, 560px);
		max-width: 100%;
		position: relative;
		overflow: hidden;
		background:
			radial-gradient(120% 80% at 50% 50%, rgba(95, 234, 213, 0.06), transparent 62%),
			var(--bg, #05070c);
		cursor: grab;
	}
	.stage.grabbing {
		cursor: grabbing;
	}

	/* Centred on its globe and translated off its own width, so the anchor stays
	   the globe's centre line however long the wording gets. */
	.cap {
		position: absolute;
		transform: translate(-50%, -50%);
		white-space: nowrap;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		letter-spacing: 0.14em;
		pointer-events: none;
	}
</style>
