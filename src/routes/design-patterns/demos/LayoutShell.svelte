<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';

	export type ShellRegion = 'org' | 'nav' | 'you' | 'page' | 'eyebrow' | 'hero' | 'trail';

	interface Props {
		/** Verdict tint. Rings, tags and the caption all take this colour. */
		tone?: 'correct' | 'incorrect';
		/** Regions this pattern is about. Everything else recedes. */
		highlight?: ShellRegion[];
		/** Caption under the shell, in the verdict colour. */
		note?: string;
		/** Where person-scope items (inbox, docs) live. */
		person?: 'footer' | 'in-list';
		/** Page region: zoned controls|actions, or a filled slab on the edge. */
		actions?: 'zoned' | 'slab';
		/** Hero: opens from the eyebrow, or is permanently on the page. */
		hero?: 'collapsed' | 'permanent';
		/** Ancestors: absent, on the eyebrow row, or a bar of their own above it. */
		trail?: 'none' | 'inline' | 'bar';
	}

	let {
		tone = 'correct',
		highlight = [],
		note,
		person = 'footer',
		actions = 'zoned',
		hero = 'collapsed',
		trail = 'none'
	}: Props = $props();

	// The one piece of state a reader can move: the hero the eyebrow owns. A
	// permanent hero has no toggle, so it is open regardless.
	let open = $state(false);

	const showHero = $derived(open || hero === 'permanent');
	const deep = $derived(trail !== 'none');
	const lit = (r: ShellRegion) => highlight.includes(r);

	const destinations = [
		{ label: 'Vendors', icon: 'users' as const, active: true },
		{ label: 'Mesh', icon: 'mesh' as const },
		{ label: 'Agents', icon: 'cpu' as const },
		{ label: 'Threats', icon: 'shield-alert' as const },
		{ label: 'Risk register', icon: 'clipboard-list' as const }
	];

	const rows = $derived(
		deep
			? ['Statement', 'Blast radius', 'Assessment', 'Treatment']
			: [
					'R-014 · Vendor key rotation',
					'R-021 · Unscoped API token',
					'R-033 · Backup restore untested',
					'R-047 · Shadow SaaS in finance'
				]
	);
</script>

<div class="wrap">
	<div class="shell" class:incorrect={tone === 'incorrect'}>
		<div class="frame">
			<aside class="side">
				<div class="zone" class:on={lit('org')}>
					{#if lit('org')}<span class="tag">org</span>{/if}
					<div class="brand"><span class="mark">▣</span> ARMORNET</div>
					<span class="row"><Icon name="search" size={11} /> Search <kbd>⌘K</kbd></span>
					<span class="row"><Icon name="layout-grid" size={11} /> Overview</span>
				</div>

				<div class="mid zone-plain" class:on={lit('nav')}>
					{#if lit('nav')}<span class="tag tag-mid">scrolls</span>{/if}
					<span class="row active"><Icon name="users" size={11} /> Vendors</span>
					{#if person === 'in-list'}
						<span class="row flagged">
							<Icon name="bell" size={11} /> Inbox <span class="badge">3</span>
						</span>
						<span class="row flagged"><Icon name="file-text" size={11} /> Docs</span>
					{/if}
					{#each destinations.slice(1) as d}
						<span class="row"><Icon name={d.icon} size={11} /> {d.label}</span>
					{/each}
					<span class="fade" aria-hidden="true"></span>
				</div>

				<div class="zone" class:on={lit('you')} class:hollow={person === 'in-list'}>
					{#if lit('you')}<span class="tag">you</span>{/if}
					{#if person === 'footer'}
						<span class="row"
							><Icon name="bell" size={11} /> Inbox <span class="badge">3</span></span
						>
						<span class="row"><Icon name="file-text" size={11} /> Docs</span>
					{/if}
					<span class="row"><span class="avatar">TR</span> Account</span>
				</div>
			</aside>

			<main class="main">
				{#if trail === 'bar'}
					<div class="strip" class:on={lit('trail')}>
						{#if lit('trail')}<span class="tag tag-strip">trail</span>{/if}
						<span class="crumb">Risk register</span>
						<span class="sep">/</span>
						<span class="crumb now">RSK-014</span>
					</div>
				{/if}

				<div class="head">
					<div class="head-left">
						{#if trail === 'inline'}
							<span class="crumbs" class:on={lit('trail')}>
								{#if lit('trail')}<span class="tag tag-crumbs">trail</span>{/if}
								<span class="crumb">Risk register</span>
								<span class="sep">/</span>
							</span>
						{/if}
						<button
							class="eyebrow"
							class:on={lit('eyebrow')}
							type="button"
							disabled={hero === 'permanent'}
							onclick={() => (open = !open)}
						>
							{#if lit('eyebrow')}<span class="tag tag-eyebrow">eyebrow</span>{/if}
							{#if hero !== 'permanent'}
								<Icon name={open ? 'chevron-down' : 'chevron-right'} size={10} />
							{/if}
							<span class="eyebrow-text">// {deep ? 'RSK-014' : 'risk · register'}</span>
						</button>
					</div>

					<div class="ctx" class:on={lit('page')} class:slab={actions === 'slab'}>
						{#if lit('page')}<span class="tag tag-ctx">page</span>{/if}
						<span class="ghost"><Icon name="filter" size={10} /> Filter</span>
						{#if actions === 'zoned'}<span class="rule" aria-hidden="true"></span>{/if}
						<span class="ghost">Builder</span>
						<span class="primary" class:filled={actions === 'slab'}>
							<Icon name="plus" size={10} /> New
						</span>
					</div>
				</div>

				{#if showHero}
					<div class="hero" class:on={lit('hero')}>
						{#if lit('hero')}<span class="tag tag-hero">hero</span>{/if}
						<h4>Risk register.</h4>
						<p>
							Track inherent and residual exposure with NIST SP 800-30 scoring, route treatments
							against your risk appetite, and hold acceptances to an expiry.
						</p>
					</div>
				{/if}

				<div class="rows">
					{#each rows as row (row)}
						<div class="line"><span>{row}</span><span class="cell"></span></div>
					{/each}
					{#if hero === 'permanent'}
						<span class="fold" aria-hidden="true">fold</span>
					{/if}
				</div>
			</main>
		</div>
	</div>

	{#if note}
		<p class="note" class:incorrect={tone === 'incorrect'}>{note}</p>
	{/if}
</div>

<style>
	/* PatternSpec's demo cell is a centring flex row; without a column wrapper the
	   caption sits beside the shell and squeezes it until the page region clips. */
	.wrap {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
	}

	/* Every internal dimension is in em against a container-sized root, so the
	   shell shrinks to fit its column instead of clipping at the panel edge. */
	.shell {
		container-type: inline-size;
		width: 100%;
		font-size: clamp(8.5px, 3.1cqw, 12px);
		--ring: var(--palette-emerald);
		--ring-bg: rgba(52, 211, 153, 0.06);
		--ring-line: rgba(52, 211, 153, 0.4);
	}
	.shell.incorrect {
		--ring: var(--palette-red);
		--ring-bg: rgba(252, 165, 165, 0.06);
		--ring-line: rgba(252, 165, 165, 0.4);
	}

	.frame {
		display: flex;
		width: 100%;
		min-height: 19em;
		border: 1px solid var(--border);
		border-radius: 0.6em;
		overflow: hidden;
		background: var(--bg);
	}

	.side {
		display: flex;
		flex-direction: column;
		width: 10.5em;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		background: var(--bg-elev);
	}

	/* A region is either the subject of the pattern or scenery. Scenery still
	   renders — the map is only legible whole — but it stops competing. */
	.zone,
	.zone-plain,
	.ctx,
	.eyebrow,
	.hero,
	.crumbs,
	.strip {
		position: relative;
		border: 1px solid transparent;
		border-radius: 0.5em;
		transition:
			opacity 0.15s,
			border-color 0.15s,
			background 0.15s;
	}

	.zone,
	.ctx,
	.hero,
	.strip,
	.crumbs,
	.eyebrow,
	.zone-plain {
		opacity: 0.55;
	}
	.on {
		opacity: 1;
		border-color: var(--ring-line);
		background: var(--ring-bg);
	}

	.tag {
		position: absolute;
		top: -0.55em;
		right: 0.4em;
		font-family: var(--mono);
		font-size: 0.5em;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ring);
		background: var(--bg-elev);
		padding: 0 0.3em;
		white-space: nowrap;
	}
	.tag-ctx,
	.tag-eyebrow,
	.tag-crumbs,
	.tag-hero,
	.tag-strip {
		background: var(--bg);
	}

	.zone {
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		padding: 0.45em 0.35em;
		margin: 0.35em;
	}
	/* The frame clips, so the top zone has to leave the tag its own band. */
	.side .zone:first-child {
		margin-top: 0.85em;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.3em;
		font-family: var(--sans);
		font-size: 0.52em;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--fg-muted);
		padding: 0.1em 0.55em 0.5em;
	}
	.mark {
		color: var(--accent);
		font-size: 1.3em;
	}

	.mid {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		padding: 0.25em 0.3em;
		margin: 0 0.35em;
		overflow: hidden;
	}
	/* This region clips its own overflow for the scroll fade, so its tag has to
	   sit inside — bottom-right, over the fade, clear of the first row. */
	.tag-mid {
		top: auto;
		bottom: 0.15em;
		background: transparent;
		z-index: 1;
	}

	.fade {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1.6em;
		background: linear-gradient(to top, var(--bg-elev), transparent);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.35em;
		font-family: var(--mono);
		font-size: 0.58em;
		color: var(--fg-muted);
		padding: 0.28em 0.4em;
		border-radius: 0.35em;
		white-space: nowrap;
	}
	.row.active {
		color: var(--accent);
		background: var(--accent-faint);
	}
	/* The defect itself: person-scope rows adrift in the scrolling list. */
	.row.flagged {
		outline: 1px dashed rgba(252, 165, 165, 0.55);
		color: var(--palette-red);
	}

	.hollow {
		border-style: dashed;
	}

	kbd {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.8em;
		color: var(--fg-dim);
	}

	.badge {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.75em;
		font-weight: 700;
		line-height: 1;
		color: var(--bg);
		background: var(--accent);
		border-radius: 999px;
		padding: 0.15em 0.35em;
	}

	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5em;
		height: 1.5em;
		border-radius: 999px;
		font-size: 0.7em;
		font-weight: 600;
		color: var(--accent);
		background: var(--accent-faint-strong);
		border: 1px solid var(--border-accent);
	}

	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 0.55em 0.6em;
		gap: 0.5em;
	}

	.strip {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.25em 0.3em;
		margin-left: -0.25em;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5em;
		min-width: 0;
	}

	.head-left {
		display: flex;
		align-items: center;
		gap: 0.35em;
		min-width: 0;
	}

	.crumbs {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.2em 0.3em;
	}

	.crumb {
		font-family: var(--mono);
		font-size: 0.56em;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.crumb.now {
		color: var(--fg-muted);
	}
	.sep {
		font-family: var(--mono);
		font-size: 0.56em;
		color: var(--border-strong, var(--fg-dim));
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		padding: 0.2em 0.35em;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		min-width: 0;
	}
	.eyebrow:disabled {
		cursor: default;
	}
	.eyebrow-text {
		font-family: var(--mono);
		font-size: 0.58em;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.ctx {
		display: flex;
		align-items: center;
		gap: 0.2em;
		padding: 0.25em 0.3em;
		flex-shrink: 0;
	}
	.ctx.slab {
		gap: 0.35em;
	}

	.rule {
		width: 1px;
		height: 1.1em;
		background: var(--border-strong, var(--border));
		margin: 0 0.15em;
	}

	.ghost,
	.primary {
		display: inline-flex;
		align-items: center;
		gap: 0.22em;
		font-family: var(--mono);
		font-size: 0.56em;
		height: 2.1em;
		padding: 0 0.55em;
		border-radius: 0.35em;
		white-space: nowrap;
		color: var(--fg-muted);
	}
	.primary {
		font-weight: 600;
		border: 1px solid rgba(94, 234, 212, 0.45);
		background: var(--accent-faint-strong);
		color: var(--accent);
	}
	.primary.filled {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--bg);
	}

	.hero {
		padding: 0.5em 0.55em;
	}
	.hero h4 {
		font-size: 0.8em;
		font-weight: 600;
		color: var(--fg);
		margin: 0 0 0.4em;
	}
	.hero p {
		font-size: 0.58em;
		line-height: 1.6;
		color: var(--fg-dim);
		margin: 0;
		max-width: 46ch;
	}

	.rows {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2em;
		padding-top: 0.2em;
	}

	.line {
		display: flex;
		align-items: center;
		gap: 0.5em;
		height: 1.7em;
		padding: 0 0.5em;
		border-radius: 0.3em;
		background: var(--surface-raised, rgba(255, 255, 255, 0.02));
		font-family: var(--mono);
		font-size: 0.56em;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
	}
	.cell {
		flex: 1;
	}

	.fold {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -0.1em;
		border-top: 1px dashed rgba(252, 165, 165, 0.45);
		font-family: var(--mono);
		font-size: 0.5em;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--palette-red);
		text-align: right;
	}

	.note {
		margin: 0.7rem 0 0;
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.6;
		color: var(--palette-emerald);
	}
	.note.incorrect {
		color: var(--palette-red);
	}
</style>
