<script lang="ts">
	import LayoutHeader from '$lib/primitives/chrome/LayoutHeader.svelte';
	import PatternSpec from './PatternSpec.svelte';
	import PatternSection from './PatternSection.svelte';
	import ControlCenterCorrect from './demos/ControlCenterCorrect.svelte';
	import ControlCenterIncorrect from './demos/ControlCenterIncorrect.svelte';
	import EyebrowCorrect from './demos/EyebrowCorrect.svelte';
	import EyebrowIncorrect from './demos/EyebrowIncorrect.svelte';
	import TrailCorrect from './demos/TrailCorrect.svelte';
	import TrailIncorrect from './demos/TrailIncorrect.svelte';

	// The TOC manifest, grouped by section. Every PatternSpec below has a matching
	// entry here in the same order — this is what the jump nav renders from.
	const sections: {
		id: string;
		name: string;
		blurb: string;
		patterns: { id: string; index: string; name: string }[];
	}[] = [
		{
			id: 'layout',
			name: 'Layout',
			blurb: 'Where things live, and what that placement promises.',
			patterns: [
				{ id: 'three-regions', index: '01', name: 'Scope decides region' },
				{ id: 'explaining-eyebrow', index: '02', name: 'The explaining eyebrow' },
				{ id: 'the-trail', index: '03', name: 'The trail, not a bar' }
			]
		}
	];

	const threeRegionsCorrect = `
	<!-- AppShell — three regions, three scopes. SidebarNav already models this:
	     brand + cluster pinned top, footer pinned bottom, only sections scroll. -->
	<SidebarNav {sections} {isActive}>
		{#snippet cluster()}
			<!-- Region 1 · ORG scope. Pinned. -->
			<SearchTrigger keybind="⌘K" />
			<a href={ROUTES.overview}>Overview</a>
		{/snippet}

		{#snippet footer()}
			<!-- Region 2 · PERSON scope. Pinned, so the unseen count is always on screen. -->
			<a href={ROUTES.inbox}>Inbox <Badge count={unseenCount} /></a>
			<a href={ROUTES.docs}>Docs</a>
			<AccountMenu user={session.user} />
		{/snippet}
	</SidebarNav>

	<!-- Region 3 · PAGE scope, and nothing else. -->
	<LayoutHeader>
		{#snippet eyebrowActions()}
			<PageContextMenu {filterGroups} {secondary} {primary} />
		{/snippet}
	</LayoutHeader>`;

	const threeRegionsCorrectStrip = `
	<!-- PageContextMenu — the page region, itself zoned:
	     controls (what you see) | actions (what you do). -->
	{#if hasControls && hasActions}
		<span class="w-px h-4 mx-1 bg-[var(--border-strong)]" aria-hidden="true"></span>
	{/if}

	<!-- Primary: the only accent-coloured item, still in the strip's weight class. -->
	{#if primary}
		<button
			class="h-7 px-2.5 rounded-md border border-[var(--accent)]/45
			       bg-[var(--accent-faint-strong)] text-[var(--accent)]
			       font-mono text-[0.68rem] font-semibold
			       hover:border-[var(--accent)] hover:bg-[var(--accent)]/20"
		>
			<Icon name={primary.icon ?? 'plus'} size={13} />
			{primary.label}
		</button>
	{/if}`;

	const threeRegionsIncorrect = `
	<!-- AppShell as shipped — Inbox and Docs are person-scope, but they are
	     rendered inline in the scrolling destination list, between the nav
	     groups. The footer region that exists to pin them holds only Account. -->
	<a href={ROUTES.inbox}>
		<Icon name="bell" size={16} />
		{#if unseenCount > 0}<span class="dot"></span>{/if}
		Inbox
		{#if unseenCount > 0}<span class="count">{unseenCount}</span>{/if}
	</a>

	{#if isEnabled('docs')}
		<a href={ROUTES.docs}><Icon name="file-text" size={16} /> Docs</a>
	{/if}

	{@render navGroup('Networking', networkingNavItems)}
	{@render navGroup('Org Admin', orgAdminNavItems)}

	<!-- …and in the page region, a filled slab hard against the right edge. -->
	<button class="bg-[var(--accent)] text-[var(--bg)] font-semibold">
		<Icon name="plus" size={13} /> New
	</button>`;

	const eyebrowCorrect = `
	<!-- The page opts in with a stable key. Collapsed for everyone who has been
	     here; opened once, automatically, for everyone who has not. -->
	<LayoutHeader
		eyebrow="// risk management · register"
		startExpanded={false}
		revealOnce="risk-register"
	>
		{#snippet title()}Risk <span class="accent">register.</span>{/snippet}
		{#snippet lede()}
			Track inherent and residual exposure with NIST SP 800-30 scoring, route
			treatments against your risk appetite, and hold acceptances to an expiry.
		{/snippet}
		{#snippet eyebrowActions()}
			<PageContextMenu {filterGroups} {secondary} {primary} />
		{/snippet}
	</LayoutHeader>

	<!-- LayoutHeader.svelte — reveal-once, client-side only, storage-safe. -->
	onMount(() => {
		if (!revealOnce) return;
		const key = \`armornet:header-seen:\${revealOnce}\`;
		try {
			if (localStorage.getItem(key)) {
				expanded = false;
			} else {
				expanded = true;
				localStorage.setItem(key, '1');
			}
		} catch {
			/* storage unavailable — keep startExpanded */
		}
	});`;

	const eyebrowIncorrect = `
	<!-- Permanent hero: paid for on every visit, forever, and the register
	     starts below the fold. No revealOnce, so no way to spend it once. -->
	<LayoutHeader eyebrow="// risk management · register">
		{#snippet title()}Risk <span class="accent">register.</span>{/snippet}
		{#snippet lede()}Track inherent and residual exposure…{/snippet}
	</LayoutHeader>`;

	const trailCorrect = `
	<!-- Ancestors only, nearest-last. The current page is the eyebrow, so the
	     trail never repeats it — and a page reached directly passes no crumbs
	     at all rather than a trail of one. -->
	<script>
		const crumbs: BreadcrumbItem[] = [
			{ label: 'Risk register', href: ROUTES.riskRegister }
		];
	<\/script>

	<LayoutHeader eyebrow={\`// \${risk.ref}\`} {crumbs} startExpanded={false}>
		{#snippet title()}{risk.title}{/snippet}
		{#snippet eyebrowActions()}
			<PageContextMenu {secondary} {primary} />
		{/snippet}
	</LayoutHeader>

	<!-- LayoutHeader.svelte — the trail renders in the eyebrow row, ahead of the
	     toggle and outside it: a link inside a disclosure button is two controls
	     wearing one hitbox. -->
	{#if crumbs.length > 0}
		<nav class="crumbs" aria-label="Breadcrumb">
			{#each crumbs as c, i (c.href ?? c.label)}
				{#if i > 0}<span class="crumb-sep" aria-hidden="true">/</span>{/if}
				<a class="crumb" class:crumb-far={i < crumbs.length - 1} href={c.href}>{c.label}</a>
			{/each}
			<span class="crumb-sep" aria-hidden="true">/</span>
		</nav>
	{/if}`;

	const trailIncorrect = `
	<!-- A bar of its own, above the header, in the page's measure instead of the
	     header's — so it sits flush left while everything below it is inset. And
	     the last crumb names the page the eyebrow underneath already names. -->
	<div class="mb-4">
		<Breadcrumbs
			items={[
				{ label: 'Risk register', href: ROUTES.riskRegister },
				{ label: risk.ref }
			]}
		/>
	</div>

	<LayoutHeader eyebrow="// risk management · edit">
		{#snippet title()}{risk.title}{/snippet}
	</LayoutHeader>`;
</script>

<svelte:head>
	<title>Design Patterns — Armornet UI</title>
</svelte:head>

<LayoutHeader eyebrow="// showcase · foundations">
	{#snippet title()}Design <span class="accent">patterns.</span>{/snippet}
	{#snippet lede()}
		The rules the interface is built on — each one built right and built wrong, side by side.
	{/snippet}
</LayoutHeader>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<div class="lead">
		<p>
			A component library says what exists; this says what to do with it. These are binding — a diff
			that violates one is wrong even if it renders. The incorrect column is always the version
			people reach for first.
		</p>
	</div>

	<nav class="toc" aria-label="Patterns">
		{#each sections as s}
			<div class="toc-group">
				<a href="#{s.id}" class="toc-section">{s.name}</a>
				<div class="toc-items">
					{#each s.patterns as t}
						<a href="#{t.id}" class="toc-item">
							<span class="toc-index">{t.index}</span>
							<span class="toc-name">{t.name}</span>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</nav>

	<PatternSection id="layout" name="Layout" blurb={sections[0].blurb}>
		<!-- ── 01 · Scope decides region ───────────────────────────────────── -->
		<PatternSpec
			id="three-regions"
			index="01"
			name="Scope decides region"
			intent="Three regions, three scopes: top-left the organization, bottom-left the person, top-right the page. Scope decides region — not frequency, not convenience."
			rules={[
				'Top-left, pinned: org scope — search, org switching, org-wide management.',
				'Bottom-left, pinned: person scope — inbox, docs, account, settings.',
				'Top-right: page scope, nothing else.',
				'Only the destinations between them scroll.',
				'A badge that can scroll away is not a notification.',
				'In the page region: controls left of a hairline, actions right of it.'
			]}
			correctCode={threeRegionsCorrect + '\n\n' + threeRegionsCorrectStrip}
			incorrectCode={threeRegionsIncorrect}
			trap="Inbox is a destination and the destination list is right there. Every misplacement is locally reasonable; they are only wrong against the map."
		>
			{#snippet why()}
				<p>
					The Linear model, and the inverse of most design systems: anchors live on the left —
					organization above, person below — which frees the top-right to be <em>entirely</em>
					contextual. Stability left, volatility right.
				</p>
				<p>
					That is what makes "context aware" coherent. The top-right may swap completely per route
					precisely because nothing a person needs for orientation is kept there. Move one global
					control in and it inherits the volatility around it.
				</p>
			{/snippet}

			{#snippet correct()}
				<ControlCenterCorrect />
			{/snippet}

			{#snippet incorrect()}
				<ControlCenterIncorrect />
			{/snippet}
		</PatternSpec>

		<!-- ── 02 · The explaining eyebrow ─────────────────────────────────── -->
		<PatternSpec
			id="explaining-eyebrow"
			index="02"
			name="The explaining eyebrow"
			intent="A collapsed eyebrow that opens to say what the page is for. Reveals itself once on first arrival, then stays shut. Optional — a page earns one only if it needs one."
			rules={[
				'The eyebrow row is always visible. Only the hero beneath it collapses.',
				'Open on first arrival, collapsed after. Pass revealOnce with a stable key.',
				'Collapsed is the default; always-expanded is the exception a page argues for.',
				'The eyebrow is the toggle — no separate "learn more".',
				'The lede says what this page is for, not what the product is.',
				'Expanding must not move the action strip.',
				'Optional means optional. No filler prose.'
			]}
			correctCode={eyebrowCorrect}
			incorrectCode={eyebrowIncorrect}
			trap="A permanent hero looks like care, and every design review rewards it. The cost is paid by the person on their four-hundredth visit, who is not in the room."
		>
			{#snippet why()}
				<p>
					An explanation has nearly all its value on one visit and nearly none on the rest. Both
					usual answers fail: leave it on the page and everyone pays rent forever; spend it in an
					onboarding modal and the page keeps no answer at all.
				</p>
				<p>
					Reveal-once is what makes it honest — starting collapsed never explains anything to the
					person who needs it, starting expanded explains it to everyone forever.
				</p>
			{/snippet}

			{#snippet correct()}
				<EyebrowCorrect />
			{/snippet}

			{#snippet incorrect()}
				<EyebrowIncorrect />
			{/snippet}
		</PatternSpec>

		<!-- ── 03 · The trail, not a bar ───────────────────────────────────── -->
		<PatternSpec
			id="the-trail"
			index="03"
			name="The trail, not a bar"
			intent="A page reached by traversal names its ancestors on the eyebrow row, ahead of the toggle. Optional — a destination has nothing to say, and says nothing."
			rules={[
				'Pass crumbs to LayoutHeader. Never render a breadcrumb bar beside it.',
				'Ancestors only. The current page is the eyebrow — a trail never repeats it.',
				'Reached directly, not traversed to? No crumbs. A trail of one is a decoration.',
				'Every crumb is a link. A crumb you cannot click is a label pretending.',
				'The trail is subordinate: same mono, dimmer, tighter tracking than the eyebrow.',
				'Narrow viewports keep the nearest ancestor only — it must never wrap to two lines.',
				'The trail does not toggle the hero; the eyebrow beside it still does.'
			]}
			correctCode={trailCorrect}
			incorrectCode={trailIncorrect}
			trap="Every breadcrumb component ships as a standalone bar, so the obvious move is to park one above the header. It lands in the page's measure rather than the header's, and its last crumb names the page the eyebrow already names — two misalignments that each look like nothing."
		>
			{#snippet why()}
				<p>
					Depth is the only thing a trail buys, and most pages have none. Treating it as chrome —
					always present, its own row — spends vertical space on every page to serve the few that
					are two levels down, and pushes the header the page is actually built around further from
					the top.
				</p>
				<p>
					Putting it on the eyebrow row instead makes it free: the row already exists, already has
					that measure, and already carries the page's name. The trail becomes a prefix to a
					sentence the header was already saying, which is exactly what it is.
				</p>
			{/snippet}

			{#snippet correct()}
				<TrailCorrect />
			{/snippet}

			{#snippet incorrect()}
				<TrailIncorrect />
			{/snippet}
		</PatternSpec>
	</PatternSection>
</div>

<style>
	:global(.accent) {
		color: var(--accent);
	}

	.lead {
		max-width: 74ch;
		margin-bottom: 1.75rem;
	}
	.lead p {
		font-size: 0.87rem;
		color: var(--fg-muted);
		line-height: 1.7;
		margin: 0;
	}

	.toc {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-bottom: 2rem;
	}

	.toc-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.toc-section {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim);
		text-decoration: none;
	}
	.toc-section:hover {
		color: var(--accent);
	}

	.toc-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.toc-item {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-elev);
		text-decoration: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.toc-item:hover {
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.toc-index {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
	}
	.toc-name {
		font-size: 0.78rem;
		color: var(--fg);
	}
</style>
