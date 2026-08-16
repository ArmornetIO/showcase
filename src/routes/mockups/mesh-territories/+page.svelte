<script lang="ts">
	// ── /mockups/mesh-territories ──────────────────────────────────────────────
	// A globe divided into TERRITORIES — one region per area of the supply chain —
	// rather than sown evenly. Exercises `packSphereClusters` + MeshCanvas's
	// `globeTerritories` against the real renderer: the maths has tests, but only
	// this shows whether four regions on one sphere read AS four regions.
	//
	// Same shape the console's overview uses, so a change that ruins the grouping
	// is visible here first.
	import {
		MeshCanvas,
		NodeDrawer,
		MODES,
		glyphForMode,
		ICONS,
		MODE_PIECES,
		makeTerrain
	} from '$lib/index.js';
	import type { StudioNode, StudioEdge, MeshLayoutId, TerritoryStyle } from '$lib/index.js';

	const HUB = 'core';

	// Which part of the chain each mode defends. Mirrors the console's own map.
	const AREA: Record<string, string> = {
		codebase_analysis: 'develop',
		dep_analysis: 'develop',
		vscode_enforcement: 'develop',
		hello_world: 'develop',
		harness: 'develop',
		github_runner: 'build',
		hardened_agent: 'build',
		supply_chain_proxy: 'build',
		dns_proxy: 'runtime',
		control_plane_management: 'runtime',
		posture: 'runtime',
		momus: 'runtime',
		vendor_management: 'third-party',
		vendor_identification: 'third-party',
		intelligence: 'third-party',
		feed_content_analysis: 'third-party',
		language: 'third-party'
	};

	// Each region gets its own GROUND, not just its own tint — see `shapeTerrain`.
	// Four tinted copies of one landscape are one landscape; the biome puts the
	// difference in contour spacing, which is what actually reads as terrain and is
	// the only version of the difference that survives a collapsed palette.
	const TERRITORIES: Record<string, TerritoryStyle> = {
		// Open plains: the ground before anything has been built on it.
		develop: { name: 'Development', color: '#34D399', glow: '#6EE7B7', biome: 'rolling' },
		// Terraces and cliffs — cut, stepped, industrial. Where source becomes an
		// artifact is the most MADE place on the globe, and it should look it.
		build: { name: 'Build & Registry', color: '#38BDF8', glow: '#7DD3FC', biome: 'terraced' },
		// Ridgelines. The running estate is the high, exposed ground.
		runtime: { name: 'Runtime & Network', color: '#818CF8', glow: '#A5B4FC', biome: 'ridged' },
		// An archipelago: separate peaks with empty ground between them, which is
		// exactly what a set of third parties is.
		'third-party': { name: 'Third Parties', color: '#FB923C', glow: '#FDBA74', biome: 'scattered' }
	};

	// A handful of vendors, so the third-party region has the population the real
	// one does — the caps are sized by member count, so this changes the picture.
	const VENDORS = ['Stripe', 'Datadog', 'Okta', 'Cloudflare', 'Twilio', 'Snowflake'];

	/** The same ground the console's overview stands on.
	 *
	 *  Frequency 9 and not the default 3, because the frequency is set against a
	 *  TERRITORY rather than against the globe: a region is a good 70° across, so a
	 *  wave crossing the whole sphere three times gives one region less than a
	 *  single bump — a dome, which has nothing for a contour to describe. */
	const terrain = makeTerrain({ seed: 20260809, octaves: 4, frequency: 9, gain: 0.5 });

	let layout = $state<MeshLayoutId>('globe');
	let selectedId = $state<string | null>(null);
	let territories = $state(true);

	const nodes = $derived.by((): StudioNode[] => [
		{
			id: HUB,
			type: 'control-plane',
			state: 'healthy',
			label: 'PROTECTED CORE',
			value: String(MODES.length),
			valueLabel: 'agents',
			iconMarkup: ICONS.crestlink,
			iconKey: 'crestlink',
			glyphAsBody: true,
			x: 0,
			y: 0,
			r: 42
		},
		...MODES.map((m, i) => {
			const glyph = glyphForMode(m.key);
			return {
				id: `mode-${m.key}`,
				type: 'agentic' as const,
				state: (i % 5 === 0 ? 'offline' : 'healthy') as StudioNode['state'],
				label: m.label,
				value: String(i % 5 === 0 ? 0 : 1 + (i % 4)),
				valueLabel: 'agents',
				strokeColor: m.color,
				...(glyph ? { iconMarkup: glyph, iconKey: `mode-${m.key}` } : {}),
				// Every mode stands as a building, exactly as the console's overview
				// does. Without this the mockup shows discs and quietly stops being a
				// preview of the thing it is named after.
				piece: MODE_PIECES[m.key],
				x: 0,
				y: 0,
				r: 27
			};
		}),
		...VENDORS.map((v, i) => ({
			id: `vendor-${v}`,
			type: 'proxy' as const,
			state: (i % 3 === 0 ? 'degraded' : 'healthy') as StudioNode['state'],
			label: v,
			x: 0,
			y: 0,
			r: 22
		}))
	]);

	const edges = $derived.by((): StudioEdge[] =>
		nodes
			.filter((n) => n.id !== HUB)
			.map((n) => ({
				id: `e-${n.id}`,
				from: HUB,
				to: n.id,
				dataType: 'lifecycle' as const,
				style: (n.state === 'offline' ? 'latent' : 'energy') as StudioEdge['style'],
				active: n.state !== 'offline',
				sig: n.state === 'offline' ? 0.12 : 0.6
			}))
	);

	const areaOf = (n: StudioNode) =>
		n.id.startsWith('mode-') ? (AREA[n.id.slice(5)] ?? 'runtime') : 'third-party';

	// ── The drawer ──────────────────────────────────────────────────────────────
	// Selecting a node opens it, and the globe turns to put that node under the eye
	// (MeshCanvas `focusOnSelect`). The two are one gesture: a camera move with
	// nothing to read at the end of it is the globe wandering off, and a drawer
	// about a node you cannot see is a panel about nothing.
	const DRAWER_W = 460;
	const selected = $derived(nodes.find((n) => n.id === selectedId) ?? null);

	/** Fed straight back to the canvas as a right-hand inset.
	 *
	 *  This is the whole of "keep it on screen". `fitAll` already fits the globe to
	 *  the region left over after insets, so the drawer's width is not a special
	 *  case to code around — it is the same quantity the HUD panels already report,
	 *  and MeshCanvas already refits when it moves. Sliding the canvas sideways or
	 *  scaling it by hand would fight that machinery instead of using it. */
	const insets = $derived({ right: selectedId ? DRAWER_W + 24 : 0 });
</script>

<svelte:head>
	<title>Mesh Territories — armornet showcase</title>
</svelte:head>

<div class="page">
	<header>
		<h1>Mesh territories</h1>
		<p>
			One region per area of the supply chain. The nodes are packed into spherical caps rather than
			spread evenly, so a region's members land together and the empty border between regions is
			what makes each read as a region. Pick a node to bloom its territory.
		</p>
		<label>
			<input type="checkbox" bind:checked={territories} />
			cluster into territories
		</label>
	</header>

	<div class="stage">
		<MeshCanvas
			{nodes}
			{edges}
			bind:layout
			hubId={HUB}
			globeControls
			layoutPicker
			globeLabel="Territories"
			globeFill={1.06}
			radiusOf={(n) => (n.r ?? 22) + 10}
			autoRotate
			autoRotateSpeed={0.0022}
			axialTilt={(23 * Math.PI) / 180}
			insetLeafLabels
			glPieces
			globeIntro
			bind:selectedId
			groupKeyOf={areaOf}
			globeTerritories={territories}
			territoryOf={(k) => TERRITORIES[k] ?? null}
			{terrain}
			focusOnSelect
			hudInsets={insets}
		/>

		<NodeDrawer
			open={!!selected}
			position="right"
			drawerWidth={DRAWER_W}
			type={selected?.type ?? 'agentic'}
			icon="globe"
			title={selected?.label ?? ''}
			nodeId={selected?.id ?? ''}
			nodeState={selected?.state ?? 'healthy'}
			hideTabs
			onclose={() => (selectedId = null)}
		>
			{#snippet overview()}
				<div class="drawer-body">
					<p>
						{selected?.state === 'offline'
							? 'Offline. The beacon over this structure is the only saturated thing on its part of the globe — which is the entire reason the palette collapsed.'
							: selected?.state === 'degraded'
								? 'Degraded. Amber, and rare enough to find without hunting.'
								: 'Healthy. Identity here is carried by the silhouette, not the colour.'}
					</p>
					<dl>
						<div><dt>Region</dt><dd>{TERRITORIES[areaOf(selected ?? nodes[0])]?.name ?? '—'}</dd></div>
						<div><dt>Ground</dt><dd>{TERRITORIES[areaOf(selected ?? nodes[0])]?.biome ?? '—'}</dd></div>
						<div><dt>Structure</dt><dd>{selected?.piece ?? 'disc — no building yet'}</dd></div>
						<div><dt>Agents</dt><dd>{selected?.value ?? '0'}</dd></div>
					</dl>
				</div>
			{/snippet}
		</NodeDrawer>
	</div>
</div>

<style>
	.drawer-body {
		display: flex;
		flex-direction: column;
		gap: 20px;
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-dim, #8fa3b0);
	}

	.drawer-body p {
		margin: 0;
		max-width: 46ch;
	}

	.drawer-body dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.drawer-body dl div {
		display: grid;
		grid-template-columns: 110px 1fr;
		gap: 12px;
		padding: 9px 0;
		border-bottom: 1px solid var(--border, #1c2733);
	}

	.drawer-body dt {
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-faint, #5b6f7c);
	}

	.drawer-body dd {
		margin: 0;
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--text, #cbdae2);
	}

	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		padding: 1.5rem;
		gap: 1rem;
	}
	header {
		max-width: 60ch;
	}
	h1 {
		margin: 0 0 0.4rem;
		font-size: 1.3rem;
	}
	p {
		margin: 0 0 0.6rem;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--fg-dim, #94a3b8);
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--fg-dim, #94a3b8);
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		border: 1px solid var(--border, #1e293b);
		border-radius: 10px;
		overflow: hidden;
	}
</style>
