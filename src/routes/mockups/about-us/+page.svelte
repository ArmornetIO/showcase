<script lang="ts">
	// About Us — the public "who we are" page.
	//
	// The mesh is the argument, not the decoration: the hero is a live globe of
	// agents around the crest (the same MeshStudio renderer the console uses), and
	// the "How it holds together" section shows a single mesh ring at rest so the
	// shape of the product is legible before any prose explains it.
	import { onMount } from 'svelte';
	import {
		Canvas,
		MeshStudio,
		GlobeFrame,
		Button,
		Chip,
		Icon,
		packSphere,
		packRing,
		spin,
		project,
		orbitIntroStart,
		playOrbitIntro
	} from '$lib/index.js';
	import type { StudioNode, StudioEdge, Vec3, OrbitIntroConfig, IconName } from '$lib/index.js';
	import { glyphForMode } from '$lib/icons/mode-tool-icons.js';

	// ── API stub ────────────────────────────────────────────────────────────────
	// GET /api/v1/about  →  { company, metrics, principles, milestones, people }
	//
	// data shapes (snake_case, as the server returns them):
	//   company    { legal_name, founded_year, headquarters, employee_count, remote_pct }
	//   metrics[]  { metric_key, label, value, unit }
	//   principles[] { principle_key, title, body }
	//   milestones[] { milestone_id, period, title, body, shipped }
	//   people[]   { user_id, display_name, role_title, location, focus_areas[], joined_at }

	const company = {
		legal_name: 'Armornet, Inc.',
		founded_year: 2024,
		headquarters: 'Denver, CO',
		employee_count: 23,
		remote_pct: 78
	};

	const metrics = [
		{ metric_key: 'agents_online', label: 'Agents in the mesh', value: '14,200', unit: '' },
		{ metric_key: 'orgs', label: 'Organizations', value: '380', unit: '' },
		{ metric_key: 'verdicts_daily', label: 'Verdicts / day', value: '61.4', unit: 'M' },
		{ metric_key: 'median_verdict_ms', label: 'Median verdict', value: '3.2', unit: 'ms' }
	];

	const principles = [
		{
			principle_key: 'edge_first',
			title: 'Decide at the edge',
			body: 'A verdict that arrives after the request is a report, not a control. Every agent carries enough of the mesh to answer on its own, and reconciles after.'
		},
		{
			principle_key: 'no_plaintext',
			title: 'Assume the database leaks',
			body: 'Anything that links an organization or a person to its attributes is encrypted at rest. Not because the data is secret — because correlation is the actual threat.'
		},
		{
			principle_key: 'legible',
			title: 'Show the whole graph',
			body: 'Security tools fail quietly when nobody can see them. If it runs in your mesh, it renders on the canvas, with its state and its last decision attached.'
		},
		{
			principle_key: 'boring_deps',
			title: 'Own the dependency',
			body: 'One binary, embedded UI, no runtime it did not ship with. The supply chain we ask you to trust is the one we keep small on purpose.'
		}
	];

	const milestones = [
		{
			milestone_id: 'ms_01',
			period: '2024 · Q2',
			title: 'One binary',
			body: 'First build: control plane, API and UI compiled into a single artifact you could actually run on a laptop.',
			shipped: true
		},
		{
			milestone_id: 'ms_02',
			period: '2024 · Q4',
			title: 'The mesh gets a shape',
			body: 'Agents stopped being rows in a table. The canvas landed, and with it the idea that topology is the interface.',
			shipped: true
		},
		{
			milestone_id: 'ms_03',
			period: '2025 · Q2',
			title: 'Interception, unified',
			body: 'DNS blocks and package verdicts collapsed into one decision record, so a threat reads the same wherever it was caught.',
			shipped: true
		},
		{
			milestone_id: 'ms_04',
			period: '2025 · Q4',
			title: 'Supply chain + trust center',
			body: 'Codebase analysis, vendor assessments and a customer-facing trust surface, sharing one evidence store.',
			shipped: true
		},
		{
			milestone_id: 'ms_05',
			period: '2026 · now',
			title: 'Federated mesh',
			body: 'Independent meshes peer with each other and gossip agent presence — no central broker, no single mesh to lose.',
			shipped: false
		}
	];

	const people = [
		{
			user_id: 'u_8f21',
			display_name: 'Tony Ramos',
			role_title: 'Founder · Engineering',
			location: 'Denver, CO',
			focus_areas: ['Control plane', 'Mesh protocol'],
			joined_at: '2024-03-01'
		},
		{
			user_id: 'u_3c07',
			display_name: 'Priya Raghunathan',
			role_title: 'Principal Engineer',
			location: 'Bengaluru, IN',
			focus_areas: ['Store layer', 'Encryption at rest'],
			joined_at: '2024-06-14'
		},
		{
			user_id: 'u_1d94',
			display_name: 'Marcus Oyelaran',
			role_title: 'Head of Security Research',
			location: 'Lisbon, PT',
			focus_areas: ['Threat intel', 'Supply chain'],
			joined_at: '2024-09-02'
		},
		{
			user_id: 'u_5b62',
			display_name: 'Hana Kobayashi',
			role_title: 'Design Lead',
			location: 'Kyoto, JP',
			focus_areas: ['Canvas', 'Design system'],
			joined_at: '2025-01-20'
		},
		{
			user_id: 'u_7a48',
			display_name: 'Dani Ferreira',
			role_title: 'Staff Engineer · GRC',
			location: 'São Paulo, BR',
			focus_areas: ['Assessments', 'Risk register'],
			joined_at: '2025-04-11'
		},
		{
			user_id: 'u_2e35',
			display_name: 'Sam Whitfield',
			role_title: 'Customer Engineering',
			location: 'Manchester, UK',
			focus_areas: ['Onboarding', 'Deployments'],
			joined_at: '2025-08-05'
		}
	];

	const pillars: { icon: IconName; title: string; body: string }[] = [
		{
			icon: 'share-2',
			title: 'The mesh',
			body: 'Every agent holds a link to the control plane and to its peers. Enrollment is a handshake, not a ticket — a new node is answering queries within seconds of coming up.'
		},
		{
			icon: 'shield',
			title: 'The verdict',
			body: 'DNS lookups, package installs, vendor questionnaires — all of it resolves to one decision record with the evidence that produced it still attached.'
		},
		{
			icon: 'layers',
			title: 'The canvas',
			body: 'Topology, health and traffic on one surface. Drawing a line between two nodes is how you configure the relationship, not how you document it after.'
		}
	];

	// ── Hero globe ──────────────────────────────────────────────────────────────
	const MODES = ['dns_proxy', 'supply_chain_proxy', 'github_runner', 'vendor_risk', 'hello_world'];
	const HUB = 'hub';
	const HUB_R = 48;
	const NODE_R = 30;
	const COUNT = 26;

	// Canvas maps these coordinates raw from the stage's top-left (fitOnLoad is off),
	// so the globe has to be placed against the measured stage — otherwise it sits
	// dead centre and the headline lands on top of it.
	let stageW = $state(1200);
	let stageH = $state(800);
	// Wide: the globe sits to the right of the copy. Narrow: there is no "beside",
	// so it drops below it and the wash turns vertical to match.
	const narrow = $derived(stageW < 900);
	const CX = $derived(stageW * (narrow ? 0.5 : 0.68));
	const CY = $derived(stageH * (narrow ? 0.72 : 0.5));
	// Shrink the whole sphere on narrow stages rather than letting it run off-canvas.
	const fit = $derived(Math.max(0.55, Math.min(1, stageW / 1250)));

	// Resting pose, then a slow drift — the hero should breathe, not perform.
	const REST = { yaw: 0.6, pitch: 0.32, viewDistance: 3.1 };
	const orbit: OrbitIntroConfig = { rest: REST };
	const START = orbitIntroStart(orbit);

	let yaw = $state(START.yaw);
	let pitch = $state(START.pitch);
	let viewDistance = $state(START.viewDistance);

	const sphere = packSphere(Array(COUNT).fill(NODE_R + 18), { margin: 10 });
	const baseRadius = Math.max(sphere.radius, HUB_R + 36 + NODE_R);
	const radius = $derived(baseRadius * fit);

	const heroNodes = $derived.by((): StudioNode[] => {
		const out: StudioNode[] = [
			{
				id: HUB,
				type: 'control-plane',
				state: 'healthy',
				label: 'armornet',
				x: CX,
				y: CY,
				r: HUB_R * fit,
				glyphAsBody: true
			}
		];
		sphere.dirs.forEach((d: Vec3, i) => {
			const p = project(spin(d, yaw, pitch), radius, viewDistance);
			const mode = MODES[i % MODES.length];
			out.push({
				id: `n${i}`,
				type: 'agentic',
				state: i % 11 === 0 ? 'degraded' : 'healthy',
				// Twenty-six labels on a sphere is noise. The far side is already
				// faded and blurred to read as distance — naming it undoes that.
				label: p.front ? mode : '',
				x: CX + p.x,
				y: CY + p.y,
				r: NODE_R * fit * p.scale,
				inert: !p.front,
				opacity: p.front ? 1 : 1 + p.depth * 0.86,
				blur: p.front ? 0 : -p.depth * 2.4,
				iconMarkup: glyphForMode(mode),
				iconKey: `glyph-${mode}`
			});
		});
		// Painter's algorithm: MeshStudio draws in array order, so sorting by depth
		// is the hidden-surface pass. The crest sits at 0, splitting the halves.
		const depth = new Map<string, number>([[HUB, 0]]);
		sphere.dirs.forEach((d: Vec3, i) => depth.set(`n${i}`, spin(d, yaw, pitch).z));
		return out.sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);
	});

	const heroEdges = $derived.by((): StudioEdge[] =>
		heroNodes
			.filter((n) => n.id !== HUB)
			.map((n) => ({
				id: `e-${n.id}`,
				from: HUB,
				to: n.id,
				dataType: 'lifecycle',
				style: n.state === 'degraded' ? ('degraded' as const) : ('energy' as const),
				sig: 0.55
			}))
	);

	let drag: { x: number; y: number; yaw: number; pitch: number } | null = $state(null);
	const MAX_PITCH = (80 * Math.PI) / 180;

	function down(e: PointerEvent) {
		stopIntro();
		drag = { x: e.clientX, y: e.clientY, yaw, pitch };
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
		pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, drag.pitch + (e.clientY - drag.y) * 0.008));
	}
	function up() {
		drag = null;
	}

	let cancelIntro: (() => void) | null = null;
	function stopIntro() {
		cancelIntro?.();
		cancelIntro = null;
	}

	onMount(() => {
		let raf = 0;
		let spinning = false;

		// Hand the camera off from the fly-in to a drift slow enough that you notice
		// it only if you stop and watch. Dragging wins over both.
		const drift = () => {
			raf = requestAnimationFrame(drift);
			if (!drag) yaw += 0.0011;
		};

		cancelIntro = playOrbitIntro(
			orbit,
			(p) => {
				if (drag) return;
				yaw = p.yaw;
				pitch = p.pitch;
				viewDistance = p.viewDistance;
			},
			() => {
				spinning = true;
				drift();
			}
		);

		return () => {
			stopIntro();
			if (spinning) cancelAnimationFrame(raf);
		};
	});

	// ── Section diagram: one mesh at rest ───────────────────────────────────────
	// A ring rather than a sphere: this one is a legend, so nothing should move or
	// overlap. Same renderer, so the hero and the explanation agree.
	const RING_R = 28;
	const ring = packRing(Array(MODES.length).fill(RING_R + 22), { margin: 12 });

	// Same raw-coordinate rule as the hero: measure the box, then place into it, or
	// the ring hangs off the right edge at any width but the one it was written for.
	let ringW = $state(440);
	let ringH = $state(380);
	// The labels sit outside the discs, so the ring has to leave room for them.
	const ringFit = $derived(
		Math.max(0.5, Math.min(1.6, Math.min(ringW, ringH) / (2 * (ring.radius + RING_R + 34))))
	);

	const ringNodes = $derived.by((): StudioNode[] => [
		{
			id: HUB,
			type: 'control-plane',
			state: 'healthy',
			label: 'armornet',
			x: ringW / 2,
			y: ringH / 2,
			r: 40 * ringFit,
			glyphAsBody: true
		},
		...MODES.map((mode, i) => ({
			id: `r${i}`,
			type: 'agentic' as const,
			state: 'healthy' as const,
			label: mode,
			x: ringW / 2 + ring.points[i].x * ringFit,
			y: ringH / 2 + ring.points[i].y * ringFit,
			r: RING_R * ringFit,
			iconMarkup: glyphForMode(mode),
			iconKey: `ring-${mode}`
		}))
	]);

	const ringEdges: StudioEdge[] = MODES.map((_, i) => ({
		id: `re-${i}`,
		from: HUB,
		to: `r${i}`,
		dataType: 'lifecycle',
		style: 'energy' as const,
		sig: 0.5
	}));

	function initials(name: string) {
		return name
			.split(' ')
			.map((w) => w[0])
			.slice(0, 2)
			.join('');
	}
</script>

<div class="page">
	<!-- ── Hero ─────────────────────────────────────────────────────────────── -->
	<section class="hero" class:narrow>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="hero-stage"
			class:grabbing={!!drag}
			bind:clientWidth={stageW}
			bind:clientHeight={stageH}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointerleave={up}
		>
			<Canvas allowPan={false}>
				<GlobeFrame
					cx={CX}
					cy={CY}
					{radius}
					{yaw}
					{pitch}
					{viewDistance}
					surface={0.62}
				/>
				<MeshStudio
					concept="instrument"
					edgeCurve="line"
					nodes={heroNodes}
					edges={heroEdges}
					allowNodeDrag={false}
					allowLinkDraw={false}
					depthSortedParticles
				/>
			</Canvas>
		</div>

		<div class="hero-copy">
			<Chip look="ghost" color="accent">About Armornet</Chip>
			<h1>
				We build the mesh<br />
				your security<br />
				<em>actually runs on.</em>
			</h1>
			<p>
				Armornet is one binary and a mesh of agents. It resolves DNS, screens what your
				developers install, and answers for your vendors — from inside your network, on your
				hardware, with the graph visible the whole time.
			</p>
			<div class="hero-actions">
				<Button variant="primary" size="md">Read the architecture</Button>
				<Button variant="ghost" size="md">Open positions</Button>
			</div>
			<p class="hero-hint">
				<Icon name="rotate-ccw" size={12} /> Drag the mesh to turn it.
			</p>
		</div>

		<div class="hero-wash"></div>
		<div class="hero-fade"></div>
	</section>

	<!-- ── Metrics ──────────────────────────────────────────────────────────── -->
	<section class="metrics">
		{#each metrics as m (m.metric_key)}
			<div class="metric">
				<span class="metric-value">{m.value}<i>{m.unit}</i></span>
				<span class="metric-label">{m.label}</span>
			</div>
		{/each}
	</section>

	<!-- ── Why we exist ─────────────────────────────────────────────────────── -->
	<section class="band">
		<header class="band-head">
			<span class="eyebrow">Why we exist</span>
			<h2>Most security tooling watches. Ours decides.</h2>
		</header>
		<div class="prose">
			<p>
				We started Armornet in {company.founded_year} after enough years of the same shape of
				incident: the evidence was all there, in four consoles, and nobody had put it together
				until the following Tuesday. The problem was never collection. It was that the decision
				lived somewhere other than the traffic.
			</p>
			<p>
				So we moved it. An Armornet agent runs where the request is made — in the resolver path,
				in the package install, in the CI runner — and it holds enough of the mesh to answer on
				its own. The control plane keeps the graph honest; it is not in the critical path of the
				answer.
			</p>
			<p>
				What that buys you is not just latency. It is that the same verdict, with the same
				evidence, is what your engineers see in the console, what your auditors see in the risk
				register, and what your customers see in your trust center. One decision record,
				rendered three ways.
			</p>
		</div>
		<blockquote>
			<p>“If it runs in your mesh, you should be able to point at it on a canvas.”</p>
			<cite>— the rule we design against</cite>
		</blockquote>
	</section>

	<!-- ── How it holds together ───────────────────────────────────────────── -->
	<section class="band split">
		<div class="split-copy">
			<span class="eyebrow">How it holds together</span>
			<h2>Three parts, one graph.</h2>
			<div class="pillars">
				{#each pillars as p (p.title)}
					<article class="pillar">
						<span class="pillar-icon"><Icon name={p.icon} size={16} /></span>
						<div>
							<h3>{p.title}</h3>
							<p>{p.body}</p>
						</div>
					</article>
				{/each}
			</div>
		</div>

		<figure class="diagram">
			<div class="diagram-stage" bind:clientWidth={ringW} bind:clientHeight={ringH}>
				<Canvas allowPan={false} allowZoom={false}>
					<MeshStudio
						concept="instrument"
						edgeCurve="line"
						nodes={ringNodes}
						edges={ringEdges}
						allowNodeDrag={false}
						allowLinkDraw={false}
					/>
				</Canvas>
			</div>
			<figcaption>
				One control plane, five modes, every link live. The console draws the same mesh —
				this is not an illustration of it.
			</figcaption>
		</figure>
	</section>

	<!-- ── Principles ───────────────────────────────────────────────────────── -->
	<section class="band">
		<header class="band-head">
			<span class="eyebrow">How we build</span>
			<h2>Four things we refuse to trade away.</h2>
		</header>
		<div class="principles">
			{#each principles as p, i (p.principle_key)}
				<article class="principle">
					<span class="principle-n">{String(i + 1).padStart(2, '0')}</span>
					<h3>{p.title}</h3>
					<p>{p.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<!-- ── Timeline ─────────────────────────────────────────────────────────── -->
	<section class="band">
		<header class="band-head">
			<span class="eyebrow">Where we've been</span>
			<h2>Shipped, in order.</h2>
		</header>
		<ol class="timeline">
			{#each milestones as m (m.milestone_id)}
				<li class="milestone" class:pending={!m.shipped}>
					<span class="dot"></span>
					<span class="period">{m.period}</span>
					<h3>
						{m.title}
						{#if !m.shipped}<Chip look="ghost" color="cyan">in flight</Chip>{/if}
					</h3>
					<p>{m.body}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- ── People ───────────────────────────────────────────────────────────── -->
	<section class="band">
		<header class="band-head">
			<span class="eyebrow">Who's here</span>
			<h2>{company.employee_count} people, {company.remote_pct}% of them remote.</h2>
		</header>
		<div class="people">
			{#each people as p (p.user_id)}
				<article class="person">
					<span class="avatar">{initials(p.display_name)}</span>
					<h3>{p.display_name}</h3>
					<span class="role">{p.role_title}</span>
					<span class="loc"><Icon name="globe" size={11} /> {p.location}</span>
					<div class="focus">
						{#each p.focus_areas as f (f)}
							<Chip look="ghost" color="default">{f}</Chip>
						{/each}
					</div>
				</article>
			{/each}
		</div>
	</section>

	<!-- ── CTA ──────────────────────────────────────────────────────────────── -->
	<section class="cta">
		<h2>Come build the rest of it.</h2>
		<p>
			We are hiring across the control plane, the store layer and the canvas. Remote-first,
			headquartered in {company.headquarters}.
		</p>
		<div class="cta-actions">
			<Button variant="primary" size="lg">See open roles</Button>
			<Button variant="ghost" size="lg">Talk to us</Button>
		</div>
		<span class="legal">{company.legal_name} · founded {company.founded_year}</span>
	</section>
</div>

<style>
	.page {
		background: var(--bg);
		color: var(--fg);
	}

	/* ── Hero ───────────────────────────────────────────────────────────────── */
	.hero {
		position: relative;
		min-height: 92vh;
		display: flex;
		align-items: center;
		overflow: hidden;
	}
	.hero-stage {
		position: absolute;
		inset: 0;
		cursor: grab;
	}
	.hero-stage.grabbing {
		cursor: grabbing;
	}
	/* The globe is the backdrop; the copy has to sit clear of it without a slab of
	   opaque panel killing the depth. A one-sided wash does it. */
	/* The globe is the backdrop, so the copy needs contrast without a panel — a
	   one-sided wash keeps the near edge of the sphere legible and still lets the
	   far side recede into the page. */
	.hero-wash {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background: linear-gradient(
			to right,
			var(--bg) 0%,
			var(--bg) 26%,
			color-mix(in srgb, var(--bg) 70%, transparent) 44%,
			transparent 62%
		);
	}
	.hero-copy {
		position: relative;
		z-index: 2;
		max-width: 540px;
		padding: 0 clamp(24px, 5vw, 76px);
		pointer-events: none;
	}
	.hero-copy :global(a),
	.hero-copy :global(button) {
		pointer-events: auto;
	}
	.hero-copy h1 {
		margin: 18px 0 20px;
		font-size: clamp(32px, 3.9vw, 54px);
		line-height: 1.08;
		letter-spacing: -0.03em;
		font-weight: 600;
	}
	.hero-copy h1 em {
		font-style: normal;
		color: var(--accent);
	}
	.hero-copy > p {
		font-size: 16px;
		line-height: 1.65;
		color: var(--fg-dim);
		max-width: 46ch;
	}
	.hero-actions {
		display: flex;
		gap: 12px;
		margin-top: 30px;
	}
	.hero-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 34px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.7;
	}
	.hero-fade {
		position: absolute;
		inset: auto 0 0 0;
		height: 160px;
		background: linear-gradient(to bottom, transparent, var(--bg));
		pointer-events: none;
		z-index: 1;
	}

	/* ── Metrics ────────────────────────────────────────────────────────────── */
	.metrics {
		position: relative;
		z-index: 2;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		border-block: 1px solid var(--border);
		background: var(--surface);
	}
	.metric {
		padding: 26px clamp(20px, 4vw, 44px);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.metric + .metric {
		border-left: 1px solid var(--border);
	}
	.metric-value {
		font-size: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.metric-value i {
		font-style: normal;
		font-size: 16px;
		color: var(--accent);
		margin-left: 2px;
	}
	.metric-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	/* ── Bands ──────────────────────────────────────────────────────────────── */
	.band {
		max-width: 1160px;
		margin: 0 auto;
		padding: clamp(64px, 9vw, 120px) clamp(24px, 6vw, 64px);
	}
	.band + .band {
		border-top: 1px solid var(--border);
	}
	.band-head {
		max-width: 720px;
		margin-bottom: 44px;
	}
	.eyebrow {
		display: block;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 14px;
	}
	h2 {
		font-size: clamp(26px, 3.4vw, 40px);
		line-height: 1.15;
		letter-spacing: -0.02em;
		font-weight: 600;
	}

	.prose {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 28px 44px;
	}
	.prose p {
		font-size: 15px;
		line-height: 1.75;
		color: var(--fg-dim);
	}
	blockquote {
		margin-top: 52px;
		padding-left: 26px;
		border-left: 2px solid var(--accent);
	}
	blockquote p {
		font-size: clamp(19px, 2.2vw, 26px);
		line-height: 1.4;
		letter-spacing: -0.01em;
	}
	cite {
		display: block;
		margin-top: 12px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		font-style: normal;
		color: var(--fg-dim);
	}

	/* ── Split: pillars + diagram ───────────────────────────────────────────── */
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
		gap: clamp(32px, 5vw, 72px);
		align-items: center;
	}
	.split h2 {
		margin-bottom: 34px;
	}
	.pillars {
		display: flex;
		flex-direction: column;
		gap: 26px;
	}
	.pillar {
		display: flex;
		gap: 16px;
	}
	.pillar-icon {
		flex-shrink: 0;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--accent);
		background: var(--surface);
	}
	.pillar h3 {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.pillar p {
		font-size: 14px;
		line-height: 1.65;
		color: var(--fg-dim);
	}
	.diagram-stage {
		position: relative;
		height: 380px;
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
		background: var(--surface);
	}
	figcaption {
		margin-top: 14px;
		font-size: 12px;
		line-height: 1.6;
		color: var(--fg-dim);
	}

	/* ── Principles ─────────────────────────────────────────────────────────── */
	.principles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1px;
		background: var(--border);
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}
	.principle {
		background: var(--bg);
		padding: 28px 26px 32px;
	}
	.principle-n {
		display: block;
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		letter-spacing: 0.16em;
		color: var(--accent);
		margin-bottom: 16px;
	}
	.principle h3 {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 10px;
	}
	.principle p {
		font-size: 13.5px;
		line-height: 1.7;
		color: var(--fg-dim);
	}

	/* ── Timeline ───────────────────────────────────────────────────────────── */
	.timeline {
		list-style: none;
		position: relative;
		padding-left: 26px;
		border-left: 1px solid var(--border);
	}
	.milestone {
		position: relative;
		padding: 0 0 34px 0;
	}
	.milestone:last-child {
		padding-bottom: 0;
	}
	.dot {
		position: absolute;
		left: -31px;
		top: 5px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 4px var(--bg);
	}
	.milestone.pending .dot {
		background: var(--bg);
		border: 1px solid var(--accent);
	}
	.period {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.milestone h3 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 16px;
		font-weight: 600;
		margin: 6px 0 8px;
	}
	.milestone p {
		font-size: 14px;
		line-height: 1.65;
		color: var(--fg-dim);
		max-width: 62ch;
	}

	/* ── People ─────────────────────────────────────────────────────────────── */
	.people {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 18px;
	}
	.person {
		padding: 22px 20px 20px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		transition: border-color 140ms ease;
	}
	.person:hover {
		border-color: var(--accent);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 1px solid var(--border);
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
		letter-spacing: 0.06em;
		color: var(--accent);
		margin-bottom: 14px;
	}
	.person h3 {
		font-size: 14px;
		font-weight: 600;
	}
	.role {
		display: block;
		font-size: 12.5px;
		color: var(--fg-dim);
		margin-top: 3px;
	}
	.loc {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 8px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.8;
	}
	.focus {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 14px;
	}

	/* ── CTA ────────────────────────────────────────────────────────────────── */
	.cta {
		border-top: 1px solid var(--border);
		padding: clamp(64px, 9vw, 110px) clamp(24px, 6vw, 64px);
		text-align: center;
		background: var(--surface);
	}
	.cta p {
		margin: 16px auto 0;
		max-width: 52ch;
		font-size: 15px;
		line-height: 1.7;
		color: var(--fg-dim);
	}
	.cta-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
		margin-top: 32px;
	}
	.legal {
		display: block;
		margin-top: 46px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.6;
	}

	/* Keyed off the measured STAGE, not the viewport — the two disagree wherever
	   something else (here, the showcase sidebar) eats horizontal room, and the
	   wash has to flip on the same threshold that moves the globe. */
	.hero.narrow {
		min-height: 96vh;
		align-items: flex-start;
		padding-top: 10vh;
	}
	.hero.narrow .hero-wash {
		background: linear-gradient(
			to bottom,
			var(--bg) 0%,
			var(--bg) 42%,
			color-mix(in srgb, var(--bg) 70%, transparent) 56%,
			transparent 74%
		);
	}
	.hero.narrow .hero-copy {
		max-width: none;
	}

	@media (max-width: 900px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
</style>
