<script lang="ts">
	/**
	 * Roadmap — a month-by-month Gantt. Rows are pillars, cards are items, and
	 * one release train (Major / Minor / Maintenance) runs across them. A host
	 * that passes extra tracks also gets a Business & Marketing view.
	 *
	 * Everything drawn comes from `rm`; nothing is hardcoded here. See README.md.
	 */
	import { untrack } from 'svelte';
	import {
		SectionBar,
		LayoutHeader,
		PageContextMenu,
		type CtxChip,
		type CtxFilterGroup,
		Panel,
		Collapsible,
		Chip,
		type ChipColor,
		Tooltip,
		EmptyState,
		SheetDrawer,
		ReleaseEntry
	} from 'showcase';
	import {
		checks,
		shownStatus,
		dayOf,
		checklist,
		gateChecklist,
		type ChecklistItem,
		fmtDate,
		isMonthOnly,
		pillarRows,
		placeOf,
		windowLabel,
		DAY,
		type Area,
		type Capability,
		type Post,
		type Release,
		type Shipped,
		type Status,
		type Roadmap,
		type Track
	} from './model.js';

	const props: { rm: Roadmap; todayISO: string } = $props();
	// The roadmap is built once by the host and never changes, so it is read once.
	const { rm, todayISO } = untrack(() => props);
	const today = dayOf(todayISO)!;
	const hasTracks = rm.areas.some((a) => a.track !== 'product');
	const allChecks = checks(rm, today);
	const caps = [...rm.byId.values()];

	// Colour carries status, not area: the row already names the area, and one hue
	// per area made the chart a rainbow where nothing stood out.
	const STATUS_TONE: Record<Status, string> = {
		missing: 'var(--fg-muted)',
		partial: 'var(--palette-amber)',
		complete: 'var(--palette-emerald)',
		shipped: 'var(--palette-emerald)'
	};
	const toneOf = (c: Capability) => STATUS_TONE[shownStatus(c)];
	const areaOf = (id: string) => rm.areas.find((a) => a.id === id);

	// ── View state ──────────────────────────────────────────────────────────
	let view = $state<'product' | 'bizmkt'>('product');
	let sub = $state<'all' | 'business' | 'marketing'>('all');
	let scope = $state<'all' | 'ga' | 'post'>('all');
	let horizon = $state<'ga' | 'y2027' | 'y2028'>('ga');
	let rowsBy = $state<'area' | 'pillar'>('pillar');
	const byPillar = pillarRows(rm);
	const pillarName = (id: string | null) => rm.pillars.find((p) => p.id === id)?.name ?? null;
	const groupedByPillar = $derived(view === 'product' && rowsBy === 'pillar');

	type Drawer =
		| { kind: 'cap'; cap: Capability }
		| { kind: 'post'; post: Post }
		| { kind: 'release'; release: Release }
		| { kind: 'shipped'; title: string; eyebrow: string; items: Shipped[] }
		| null;
	// Raw: drawer holds references into the roadmap, which must not be proxied.
	let drawer = $state.raw<Drawer>(null);
	const openCap = (c: Capability) => (drawer = { kind: 'cap', cap: c });

	// "To 1.0" runs to the end of the month after GA, so it follows the date when GA moves.
	const gaAt = new Date(dayOf(rm.ga?.date ?? null) ?? today);
	const gaEnd = new Date(Date.UTC(gaAt.getUTCFullYear(), gaAt.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
	const HORIZONS = {
		ga: { label: 'To 1.0', start: '2026-09-01', end: gaEnd },
		y2027: { label: 'Through 2027', start: '2026-09-01', end: '2027-12-31' },
		y2028: { label: 'Through 2028', start: '2026-09-01', end: '2028-12-31' }
	} as const;

	const range = $derived({ start: dayOf(HORIZONS[horizon].start)!, end: dayOf(HORIZONS[horizon].end)! + DAY });
	const pct = (t: number) => Math.min(100, Math.max(0, ((t - range.start) / (range.end - range.start)) * 100));

	const tracksShown = $derived<Track[]>(view === 'product' ? ['product'] : sub === 'all' ? ['business', 'marketing'] : [sub]);
	const inScope = (c: Capability) => scope === 'all' || (scope === 'ga' ? c.ga_required : !c.ga_required);

	const months = $derived.by(() => {
		const out: { key: number; label: string; left: number; width: number }[] = [];
		const d = new Date(range.start);
		while (d.getTime() < range.end) {
			const s = d.getTime();
			const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
			out.push({
				key: s,
				label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
				left: pct(s),
				width: pct(Math.min(next, range.end)) - pct(s)
			});
			d.setTime(next);
		}
		return out;
	});

	const gaDay = dayOf(rm.ga?.date ?? null);
	const betaRelease = rm.releases.find((r) => r.phase === 'beta' && dayOf(r.date) !== null) ?? null;
	const betaDay = dayOf(betaRelease?.date ?? null);

	const phases = $derived(
		[
			{ id: 'alpha', label: 'Alpha · 0.0.x', start: range.start, end: betaDay ?? gaDay ?? range.end },
			...(betaDay !== null ? [{ id: 'beta', label: `Beta · 0.x.x${betaRelease?.proposed ? ' · proposed start' : ''}`, start: betaDay, end: gaDay ?? range.end }] : []),
			...(gaDay !== null ? [{ id: 'ga', label: 'GA · 1.x.x', start: gaDay, end: range.end }] : [])
		].filter((p) => p.end > range.start && p.start < range.end)
	);

	// ── Release gates ───────────────────────────────────────────────────────
	const gateDays = rm.releases
		.filter((r) => r.bump !== 'maintenance')
		.map((r) => dayOf(r.date))
		.filter((d): d is number => d !== null)
		.sort((a, b) => a - b);
	const gateBefore = (t: number) => gateDays.filter((d) => d < t).at(-1) ?? -Infinity;
	const isDone = (c: Capability) => shownStatus(c) === 'complete' || shownStatus(c) === 'shipped';
	/** The cards each release waits on, in the current view. */
	const dueBy = $derived.by(() => {
		const m = new Map<string, Capability[]>();
		for (const c of caps) {
			if (!tracksShown.includes(c.track) || !inScope(c)) continue;
			const p = placeOf(c, rm, today);
			if (p.type === 'due') m.set(p.release, [...(m.get(p.release) ?? []), c]);
		}
		return m;
	});
	/** The release whose set is lit: hovering a release or any card due by it. */
	let hot = $state<string | null>(null);

	// ── Rows ────────────────────────────────────────────────────────────────
	interface Placed {
		key: string;
		cap: Capability | null;
		post: Post | null;
		start: number;
		end: number;
		point: boolean;
		openStart: boolean;
		clipped: boolean;
		reach: number;
		/** Undated, but must land by this release: drawn across that release's band. */
		due: string | null;
		/** Shipped work on this row, one month of it, drawn as a single bar. */
		done?: Shipped[];
	}
	interface Row {
		area: Area;
		lanes: Placed[][];
		later: { cap: Capability; why: string }[];
		atLaunch: Shipped[];
	}

	const shippedIn = (area: Area) =>
		rm.shipped.filter((s) => (groupedByPillar ? s.pillar === area.id : s.area_id === area.id));
	const monthOf = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
	const openShipped = (title: string, eyebrow: string, items: Shipped[]) => (drawer = { kind: 'shipped', title, eyebrow, items });
	const launchDay = dayOf(rm.launch?.date ?? null);
	const dated = rm.shipped.filter((s) => s.date);
	const sinceLaunch = dated.filter((s) => launchDay === null || dayOf(s.date)! >= launchDay);

	// A bar narrower than this cannot hold a two-line name, so it is drawn this
	// wide and the part past its real end is shaded off. A point reserves room
	// for its label the same way.
	// Under a release band (about a month), so cards in neighbouring bands share a lane.
	const MIN_BAR_PX = 120;
	const POINT_PX = 230;
	let trackW = $state(0);
	const minBar = $derived(trackW ? (MIN_BAR_PX / trackW) * 100 : 20);

	const rows = $derived.by((): Row[] => {
		const span = range.end - range.start;
		const out: Row[] = [];
		for (const area of groupedByPillar ? byPillar : rm.areas) {
			if (!tracksShown.includes(area.track)) continue;
			const areaCaps = area.capabilities.filter(inScope);
			const posts = scope === 'ga' ? [] : rm.posts.filter((p) => p.area_id === area.id);
			// Done work is existing work, so it belongs to every view but After 1.0.
			const done = scope === 'post' ? [] : shippedIn(area);
			if (!areaCaps.length && !posts.length && !done.length) continue;

			const placed: Placed[] = [];
			const later: Row['later'] = [];
			const inRange = (s: Shipped) => {
				const at = dayOf(s.date);
				return at !== null && at >= range.start && at < range.end;
			};
			for (const c of areaCaps) {
				const p = placeOf(c, rm, today);
				if (p.type === 'bar' || p.type === 'point') {
					const s = p.type === 'bar' ? p.start : p.at;
					const e = p.type === 'bar' ? p.end : p.at;
					if (s >= range.end) {
						later.push({ cap: c, why: windowLabel(c) });
						continue;
					}
					const point = p.type === 'point' || e < range.start;
					placed.push({
						key: c.id,
						cap: c,
						post: null,
						start: Math.max(s, range.start),
						end: Math.min(e, range.end),
						point,
						openStart: p.type === 'bar' && p.openStart,
						clipped: s < range.start || e > range.end,
						reach: 0,
						due: null
					});
				} else if (p.type === 'due' && p.by < range.end) {
					// Undated work occupies its release's band, from the release before it, so a
					// column reads as the set that must finish before that version is cut. Work
					// already shipped on the card stays history, in the done cards left of today.
					const gate = gateBefore(p.by);
					placed.push({ key: c.id, cap: c, post: null, start: Math.max(today, gate, range.start), end: p.by, point: false, openStart: gate <= today, clipped: false, reach: 0, due: p.release });
				} else {
					later.push({ cap: c, why: p.type === 'due' ? `ships in ${p.release}` : 'unscheduled' });
				}
			}
			for (const post of posts) {
				const at = dayOf(post.date);
				if (at === null || at >= range.end) continue;
				placed.push({ key: post.id, cap: null, post, start: Math.max(at, range.start), end: at, point: true, openStart: false, clipped: at < range.start, reach: 0, due: null });
			}
			const byMonth = new Map<number, Shipped[]>();
			for (const s of done) {
				if (!inRange(s)) continue;
				const d = new Date(dayOf(s.date)!);
				const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
				byMonth.set(m, [...(byMonth.get(m) ?? []), s]);
			}
			for (const [m, items] of byMonth) {
				const days = items.map((s) => dayOf(s.date)!);
				placed.push({ key: `done-${m}`, cap: null, post: null, start: Math.min(...days), end: Math.max(...days) + DAY, point: false, openStart: false, clipped: false, reach: 0, due: null, done: items });
			}

			// Greedy lane packing; a point reserves room for its label, a bar its minimum width.
			placed.sort((a, b) => a.start - b.start || a.end - b.end);
			const lanes: Placed[][] = [];
			for (const it of placed) {
				it.reach = it.point ? it.start + (span * POINT_PX) / (trackW || 1000) : Math.max(it.end, it.start + (span * minBar) / 100);
				const lane = lanes.find((l) => l[l.length - 1].reach <= it.start);
				if (lane) lane.push(it);
				else lanes.push([it]);
			}
			out.push({ area, lanes, later, atLaunch: done.filter((s) => !s.date) });
		}
		return out;
	});

	const drawnRows = $derived(rows.filter((r) => r.lanes.length));
	const laneCount = $derived(drawnRows.reduce((n, r) => n + r.lanes.length, 0));
	const laterRows = $derived(rows.filter((r) => r.later.length));
	const laterReleases = $derived(rm.releases.filter((r) => (dayOf(r.date) ?? 0) >= range.end));

	// ── Summary ─────────────────────────────────────────────────────────────
	const checkCount = (id: string) => allChecks.find((c) => c.id === id)?.items.length ?? 0;
	const gaCaps = caps.filter((c) => c.track === 'product' && c.ga_required);
	const gaDone = gaCaps.filter((c) => c.status === 'complete' || c.status === 'shipped').length;
	const conflicts = checkCount('conflicts');

	// ── Filters (the house PageContextMenu) ─────────────────────────────────
	// The menu re-sends 'all' when a selected option is clicked again, meaning
	// "clear this facet"; groups with no 'all' option keep their value instead.
	const keep = <T extends string>(v: string, set: (v: T) => void) => v !== 'all' && set(v as T);
	const SUB_LABEL = { all: 'Both', business: 'Business', marketing: 'Marketing' } as const;
	const scopeLabel = $derived({ all: 'All', ga: view === 'product' ? '1.0 scope' : 'Needed for launch', post: 'After 1.0' } as const);
	const filterGroups = $derived<CtxFilterGroup[]>([
		...(hasTracks
			? [
					{
						title: 'View',
						options: [
							{ v: 'product', l: 'Product' },
							{ v: 'bizmkt', l: 'Business & Marketing' }
						],
						current: view,
						set: (v: string) => keep(v, (x: typeof view) => (view = x))
					}
				]
			: []),
		view === 'product'
			? {
					title: 'Rows',
					options: [
						{ v: 'pillar', l: 'By pillar' },
						{ v: 'area', l: 'By area' }
					],
					current: rowsBy,
					set: (v) => keep(v, (x: typeof rowsBy) => (rowsBy = x))
				}
			: { title: 'Track', options: Object.entries(SUB_LABEL).map(([v, l]) => ({ v, l })), current: sub, set: (v) => (sub = v as typeof sub) },
		{ title: 'Scope', options: Object.entries(scopeLabel).map(([v, l]) => ({ v, l })), current: scope, set: (v) => (scope = v as typeof scope) },
		{
			title: 'Horizon',
			options: Object.entries(HORIZONS).map(([v, h]) => ({ v, l: h.label })),
			current: horizon,
			set: (v) => keep(v, (x: typeof horizon) => (horizon = x))
		}
	]);
	const chips = $derived<CtxChip[]>([
		...(view === 'bizmkt' ? [{ label: 'Business & Marketing', remove: () => (view = 'product') }] : []),
		...(view === 'product' && rowsBy === 'area' ? [{ label: 'By area', remove: () => (rowsBy = 'pillar') }] : []),
		...(view === 'bizmkt' && sub !== 'all' ? [{ label: SUB_LABEL[sub], remove: () => (sub = 'all') }] : []),
		...(scope !== 'all' ? [{ label: scopeLabel[scope], remove: () => (scope = 'all') }] : []),
		...(horizon !== 'ga' ? [{ label: HORIZONS[horizon].label, remove: () => (horizon = 'ga') }] : [])
	]);
	function resetFilters() {
		view = 'product';
		rowsBy = 'pillar';
		sub = 'all';
		scope = 'all';
		horizon = 'ga';
	}

	const trainReleases = rm.releases.filter((r) => r.bump !== 'maintenance');
	const groupByArea = (list: Capability[]) => {
		const m = new Map<string, Capability[]>();
		for (const c of list) m.set(c.area_id, [...(m.get(c.area_id) ?? []), c]);
		return [...m].map(([id, cs]) => ({ area: areaOf(id), caps: cs }));
	};

	// ── Presentation maps ───────────────────────────────────────────────────
	const GLYPH: Record<Status, string> = { missing: '○', partial: '◐', complete: '●', shipped: '✓' };
	const CHECK_COLOR: Record<string, ChipColor> = { bad: 'error', warn: 'warn', info: 'default' };
	const TRIAGE_LABEL = { now: 'Now · alpha', next: 'Next · beta', later: 'Later · after 1.0' } as const;
	const kindLabel = (c: Capability) => (c.kind === 'new' ? 'Net-new' : c.kind === 'hardening' ? 'Hardening' : 'Completion');
	const flagged = (c: Capability) => c.open_questions.some((q) => q.startsWith('CONFLICT') || q.startsWith('SCOPE'));

	const drawerTitle = $derived(
		drawer?.kind === 'cap'
			? drawer.cap.name
			: drawer?.kind === 'shipped'
				? drawer.title
				: drawer?.kind === 'post'
					? drawer.post.title
					: drawer?.kind === 'release'
						? `${drawer.release.version} · ${drawer.release.title}`
						: ''
	);
	const drawerEyebrow = $derived(
		drawer?.kind === 'shipped'
			? drawer.eyebrow
			: drawer?.kind === 'cap'
			? `${areaOf(drawer.cap.area_id)?.name ?? drawer.cap.area_id} · ${drawer.cap.track}`
			: drawer?.kind === 'post'
				? `Blog post · ${fmtDate(drawer.post.date)}`
				: drawer?.kind === 'release'
					? `${drawer.release.bump} · ${fmtDate(drawer.release.date)}${drawer.release.proposed ? ' · proposed' : ''}`
					: ''
	);
</script>

{#snippet badges(c: Capability)}
	<!-- Plain open-question counts are on nearly every card, so they live in the drawer; only a flag earns a mark. -->
	{#if flagged(c)}<span class="badge bad" title="Has a conflict or scope flag">!</span>{/if}
{/snippet}

{#snippet shippedList(items: Shipped[], linkCap: boolean)}
	<ul class="list shipped-list">
		{#each items as s (s.id)}
			{@const c = linkCap && s.capability ? rm.byId.get(s.capability) : undefined}
			<li>
				<span class="glyph ok">✓</span>
				<span class="shipped-body">
					<span><strong>{s.name}</strong> <span class="muted mono">{s.date ? fmtDate(s.date) : 'live'}</span></span>
					{#if s.summary}<span>{s.summary}</span>{/if}
					{#each s.evidence as e, ei (ei)}<span class="muted mono small">{e}</span>{/each}
					{#if c}<span><Chip size="sm" onclick={() => openCap(c)}>{c.name}</Chip></span>{/if}
				</span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet task(it: ChecklistItem)}
	<li class:done={it.done} class:sub={it.sub}><span class="box" aria-hidden="true">{it.done ? '☑' : '☐'}</span><span>{it.text}</span></li>
{/snippet}

{#snippet tipCard(title: string, body: string | null, meta: string)}
	<span class="tip">
		<strong class="tip-title">{title}</strong>
		<span class="tip-body">{body ?? 'No summary recorded yet.'}</span>
		<span class="tip-meta">{meta}</span>
		<span class="tip-more">Open for the checklist ›</span>
	</span>
{/snippet}

{#snippet mini(c: Capability, why: string | null)}
	<Tooltip delay={250}>
		{#snippet tip()}{@render tipCard(c.name, c.summary, `${shownStatus(c)} · ${why ?? windowLabel(c)}`)}{/snippet}
		<button class="mini st-{shownStatus(c)} k-{c.kind}" style:--tone={toneOf(c)} onclick={() => openCap(c)}>
			<span class="glyph">{GLYPH[shownStatus(c)]}</span>
			<span class="mname">{c.name}</span>
			{#if why}<em class="why">{why}</em>{/if}
			{@render badges(c)}
			<span class="chev" aria-hidden="true">›</span>
		</button>
	</Tooltip>
{/snippet}

<LayoutHeader eyebrow="// roadmap" sub="armornet" startExpanded>
	{#snippet eyebrowActions()}
		<PageContextMenu {chips} {filterGroups} onClear={resetFilters} />
	{/snippet}
	{#snippet title()}Roadmap{/snippet}
	{#snippet lede()}
		Through <strong>1.0.0</strong> we finish what already exists — code- and feature-complete on every current area —
		and open-source everything. Net-new work starts at <strong>1.1.0</strong>.
	{/snippet}
	{#snippet meta()}
		<span class="asof">
			Product data as of {rm.as_of.product ?? '—'}{#if hasTracks}
				· business and marketing {rm.as_of.tracks ?? '—'}{/if} · today {todayISO}
		</span>
	{/snippet}
</LayoutHeader>

<div class="page">
	<header class="bar">
		<ol class="milestones">
			<li class="now"><b>{rm.current_version}</b> now</li>
			<li class="beta"><b>{betaRelease?.version ?? '—'}</b> beta · {betaRelease ? fmtDate(betaRelease.date) : 'undated'}{betaRelease?.proposed ? ' (proposed)' : ''}</li>
			<li class="ga"><b>{rm.ga?.version ?? '1.0.0'}</b> GA · {fmtDate(rm.ga?.date ?? null)}</li>
		</ol>
		<p class="progress">
			<b class="ok">✓ {rm.shipped.length}</b> live · <b>{gaDone}/{gaCaps.length}</b> items built before 1.0
			{#if conflicts}· <b class="warn">{conflicts}</b> conflicts{/if}
		</p>
		<Tooltip placement="bottom">
			{#snippet tip()}
				<span class="key">
					<span class="legend">
						{#each ['missing', 'partial', 'complete'] as Status[] as s (s)}
							<span class="legend-v" style:color={STATUS_TONE[s]}>{GLYPH[s]} {s}</span>
						{/each}
					</span>
					<span class="legend"><span class="swatch done"></span><span class="legend-v">✓ n shipped: done work on this row, per month</span></span>
					<span class="legend-v">Each release is cut when the cards in the band before it land; the footer counts them done/total. Hover a release or a card to light its set.</span>
					<span class="legend"><span class="launch-tag">✓ n live</span><span class="legend-v">what a customer can already do on this row</span></span>
					<span class="legend"><span class="swatch dashed"></span><span class="legend-v">net-new</span></span>
					<span class="legend"><span class="swatch fade"></span><span class="legend-v">no start date, drawn from today</span></span>
					<span class="legend"><span class="swatch rule-launch"></span><span class="legend-v">launch · {fmtDate(rm.launch?.date ?? null)}</span></span>
					<span class="legend"><span class="swatch phase-key"></span><span class="legend-v">axis tint: alpha, beta, GA</span></span>
					<span class="legend"><span class="badge bad">!</span><span class="legend-v">conflict or scope flag</span></span>
					<span class="legend-v">Hover or focus a card for its summary; › opens the full record.</span>
				</span>
			{/snippet}
			<button class="key-btn">Key</button>
		</Tooltip>
	</header>

	{#if rm.errors.length}
		<EmptyState variant="card" message="Data problems" sub={rm.errors.join(' · ')} />
	{/if}

	<Panel padding="none" allowOverflow>
		{#if rows.length === 0}
			<EmptyState message="Nothing in this view" sub="Try All, or a longer horizon." />
		{:else}
			<div class="scroll">
			<div class="gantt" class:linking={hot !== null} style:--months={months.length} style:--lane-count={laneCount} style:--row-count={drawnRows.length}>
				<div class="label head">{groupedByPillar ? 'Pillar' : 'Area'}</div>
				<div class="track head" bind:clientWidth={trackW}>
					{#each months as m (m.key)}
						<div class="month" style:left="{m.left}%" style:width="{m.width}%">{m.label}</div>
					{/each}
				</div>

				{#snippet releaseAxis()}
					{#each phases as p (p.id)}
						<div class="phase phase-{p.id}" style:left="{pct(p.start)}%" style:width="{pct(p.end) - pct(p.start)}%" title={p.label}></div>
					{/each}
					{#each rm.releases as r (r.version)}
						{@const d = dayOf(r.date)}
						{@const tag = r.current ? 'today' : r === betaRelease ? 'beta' : r.version === rm.ga?.version ? 'GA' : ''}
						<!-- Unlabelled maintenance releases were dots that said nothing; the release list carries them. -->
						{#if d !== null && d >= range.start && d < range.end && (r.bump !== 'maintenance' || r.current)}
							{@const set = dueBy.get(r.version) ?? []}
							<button
								class="release bump-{r.bump}"
								class:proposed={r.proposed}
								class:current={r.current}
								class:hot={hot === r.version}
								style:left="{pct(d)}%"
								onclick={() => (drawer = { kind: 'release', release: r })}
								onmouseenter={() => (hot = r.version)}
								onmouseleave={() => (hot = null)}
								onfocus={() => (hot = r.version)}
								onblur={() => (hot = null)}
							>
								<Tooltip content="{r.version} · {r.title} · {fmtDate(r.date)}{r.proposed ? ' · proposed' : ''}{set.length ? ` · cut when ${set.length} cards land` : ''}">
									<span class="diamond"></span>
									<span class="rv">
										{r.version}{#if tag}<em>{tag}</em>{/if}
										{#if set.length}<b class="rc">{set.filter(isDone).length}/{set.length}</b>{/if}
									</span>
								</Tooltip>
							</button>
						{/if}
					{/each}
				{/snippet}

				{#each drawnRows as row (row.area.id)}
					<div class="label area">
						<span class="aname" title={row.area.description ?? undefined}>{row.area.name}</span>
						{#if view === 'bizmkt' && sub === 'all'}<span class="track-tag">{row.area.track === 'business' ? 'biz' : 'mkt'}</span>{/if}
						{#if rm.exceptions.includes(row.area.id)}<span class="track-tag ex" title="Net-new allowed before 1.0">1.0 exception</span>{/if}
						{#if row.atLaunch.length}
							<button class="launch-tag" title="What a customer can already do; not placed on the timeline" onclick={() => openShipped(`${row.area.name} · live`, 'A customer can already', row.atLaunch)}>✓ {row.atLaunch.length} live</button>
						{/if}
					</div>
					<div class="track row-track">
						<div class="lanes" style:--lanes={row.lanes.length}>
								{#each row.lanes as lane, li (li)}
									{#each lane as it (it.key)}
										{#if it.done}
											{@const items = it.done}
											{@const span = pct(it.end) - pct(it.start)}
											{@const width = Math.max(span, minBar)}
											{@const month = monthOf(it.start)}
											<Tooltip delay={250}>
												{#snippet tip()}{@render tipCard(`${items.length} shipped · ${month}`, items.map((s) => s.name).join(' · '), `${row.area.name} · ${fmtDate(items[0].date)} → ${fmtDate(items[items.length - 1].date)}`)}{/snippet}
												<button
													class="card done"
													class:overhang={span < width}
													style:--tone="var(--palette-emerald)"
													style:--fill="{(span / width) * 100}%"
													style:left="{pct(it.start)}%"
													style:width="{width}%"
													style:top="calc({li} * (var(--card-h) + var(--lane-gap)) + var(--lane-gap))"
													onclick={() => openShipped(`${row.area.name} · ${month}`, `Shipped · ${items.length}`, items)}
												>
													<span class="card-top">
														<span class="glyph">✓</span>
														<span class="card-title">{items.length} shipped</span>
														<span class="chev" aria-hidden="true">›</span>
													</span>
													<span class="card-meta">{items.map((s) => s.name).join(' · ')}</span>
												</button>
											</Tooltip>
										{:else if it.cap && !it.point}
											{@const c = it.cap}
											{@const span = pct(it.end) - pct(it.start)}
											{@const width = Math.max(span, minBar)}
											{@const when = it.due ? `Due by ${it.due}` : windowLabel(c)}
											<Tooltip delay={250}>
												{#snippet tip()}{@render tipCard(c.name, c.summary, `${shownStatus(c)} · ${kindLabel(c)} · ${when}`)}{/snippet}
												<button
													class="card st-{shownStatus(c)} k-{c.kind}"
													class:open-start={it.openStart}
													class:overhang={span < width}
													class:hot={it.due !== null && hot === it.due}
													style:--tone={toneOf(c)}
													style:--fill="{(span / width) * 100}%"
													style:left="{pct(it.start)}%"
													style:width="calc({width}% - 3px)"
													style:top="calc({li} * (var(--card-h) + var(--lane-gap)) + var(--lane-gap))"
													onclick={() => openCap(c)}
													onmouseenter={() => (hot = it.due)}
													onmouseleave={() => (hot = null)}
													onfocus={() => (hot = it.due)}
													onblur={() => (hot = null)}
												>
													<span class="card-top">
														<span class="glyph">{GLYPH[shownStatus(c)]}</span>
														<span class="card-title">{c.name}</span>
														{@render badges(c)}
														<span class="chev" aria-hidden="true">›</span>
													</span>
													<!-- A banded card's column already names its release. -->
													<span class="card-meta">{it.due ? '' : `${when} · `}{kindLabel(c)}{c.owner ? ` · ${c.owner}` : ''}</span>
												</button>
											</Tooltip>
										{:else}
											{@const label = it.cap?.name ?? it.post?.title ?? ''}
											{@const date = it.post ? `${it.post.status} · ${fmtDate(it.post.date)}` : fmtDate(it.cap?.window.start ?? it.cap?.window.end ?? null)}
											<Tooltip delay={250}>
												{#snippet tip()}{@render tipCard(label, it.cap ? it.cap.summary : (it.post?.note ?? null), it.cap ? `${shownStatus(it.cap)} · ${date}` : `Blog post · ${date}`)}{/snippet}
												<button
													class="point"
													class:post={!!it.post}
													class:draft={it.post?.status === 'draft'}
													class:clipped={it.clipped}
													style:--tone={it.cap ? toneOf(it.cap) : 'var(--accent)'}
													style:left="{pct(it.start)}%"
													style:top="calc({li} * (var(--card-h) + var(--lane-gap)) + var(--lane-gap))"
													onclick={() => (it.cap ? openCap(it.cap) : it.post && (drawer = { kind: 'post', post: it.post }))}
												>
													<span class="pmark"></span>
													<span class="ptext">
														<span class="plabel">{it.clipped ? '◂ ' : ''}{label}<span class="chev" aria-hidden="true"> ›</span></span>
														<span class="pdate">{date}</span>
													</span>
												</button>
											</Tooltip>
										{/if}
									{/each}
								{/each}
						</div>
					</div>
				{/each}

				<!-- Releases sit in a footer so the top axis is months alone; phase is a tint
				     here with no label, since the release that opens it names it. -->
				<div class="label head foot">Release</div>
				<div class="track foot">{@render releaseAxis()}</div>

				<div class="overlay">
					<!-- Lines at the release gates, not the months: the bands between them are what the cards fill. -->
					{#each gateDays.filter((d) => d > range.start && d < range.end && d !== gaDay) as d (d)}
						<span class="gridline" style:left="{pct(d)}%"></span>
					{/each}
					{#if launchDay !== null && launchDay >= range.start && launchDay < range.end}
						<span class="rule launch" style:left="{pct(launchDay)}%"></span>
					{/if}
					{#if today >= range.start && today < range.end}
						<span class="rule today" style:left="{pct(today)}%"></span>
					{/if}
					<!-- Rules are unlabelled: the current release reads "today", the Key names launch, 1.0.0 names GA. -->
					{#if gaDay !== null && gaDay < range.end}
						<span class="rule ga" style:left="{pct(gaDay)}%"></span>
					{/if}
				</div>
			</div>
			</div>
		{/if}
	</Panel>

	{#if laterRows.length || laterReleases.length}
		<SectionBar label="Later · past this horizon or unscheduled" />
		<div class="later-list">
			{#if laterReleases.length}
				<div class="later-group">
					<span class="later-k">Releases</span>
					<div class="later-items">
						{#each laterReleases as r (r.version)}
							<button class="later-rel" onclick={() => (drawer = { kind: 'release', release: r })}>{r.version} · {r.title}</button>
						{/each}
					</div>
				</div>
			{/if}
			{#each laterRows as row (row.area.id)}
				<div class="later-group">
					<span class="later-k">{row.area.name}</span>
					<div class="later-items">
						{#each row.later as l (l.cap.id)}{@render mini(l.cap, l.why === 'unscheduled' ? null : l.why)}{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if view === 'product' && rm.parked.length}
		<SectionBar label="Parked · {rm.parked.length}, off the train until scheduled" />
		<div class="later-list">
			<div class="later-group">
				<span class="later-k">Backlog</span>
				<div class="later-items">
					{#each rm.parked as c (c.id)}{@render mini(c, 'parked')}{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if rm.rules.length}
		<SectionBar label="How this roadmap works" />
		<dl class="rules">
			{#each rm.rules as r (r.title)}<dt>{r.title}</dt><dd>{r.detail}</dd>{/each}
		</dl>
	{/if}

	<section>
			<SectionBar label="Checks" />
			<div class="checks">
				{#each allChecks as ch (ch.id)}
					<Collapsible>
						{#snippet trigger({ open, toggle })}
							<button class="check-head" onclick={toggle} aria-expanded={open}>
								<Chip size="sm" color={ch.items.length ? CHECK_COLOR[ch.tone] : 'success'}>{ch.items.length}</Chip>
								<span class="check-title">{ch.title}</span>
								<span class="check-hint">{ch.hint}</span>
								<span class="caret">{open ? '−' : '+'}</span>
							</button>
						{/snippet}
						<ul class="check-items">
							{#each ch.items as item, i (i)}
								<li>
									{#if item.cap}
										{@const c = item.cap}
										<button class="linkish" onclick={() => openCap(c)}>{c.name}</button>
										{#if item.text !== c.name}<span class="muted"> — {item.text}</span>{/if}
									{:else}
										<span>{item.text}</span>
									{/if}
								</li>
							{:else}
								<li class="muted">Nothing to report.</li>
							{/each}
						</ul>
					</Collapsible>
				{/each}
			</div>
	</section>

	<SectionBar label="Release train" />
	<div class="train-list">
		{#each trainReleases as r (r.version)}
			{@const targeted = caps.filter((c) => c.target_release === r.version)}
			{@const posts = rm.posts.filter((p) => p.version === r.version)}
			<ReleaseEntry
				version={r.version}
				date={r.date && !isMonthOnly(r.date) ? r.date : undefined}
				title={isMonthOnly(r.date) ? `${r.title} · ${fmtDate(r.date)}` : r.title}
			>
				<div class="chips">
					<Chip size="sm" cut="shield" color={r.bump === 'major' ? 'accent' : r.bump === 'minor' ? 'cyan' : 'default'}>{r.bump}</Chip>
					<Chip size="sm">{r.phase}</Chip>
					{#if r.proposed}<Chip size="sm" color="warn">proposed, not decided</Chip>{/if}
					<Chip size="sm">{targeted.length} cards</Chip>
					{#if r.gates.length}<Chip size="sm">{r.gates.length} gates</Chip>{/if}
				</div>
				{#each groupByArea(targeted) as g (g.area?.id)}
					<p class="train-line">
						<strong>{g.area?.name}</strong>
						{#each g.caps as c, i (c.id)}
							<button class="linkish" onclick={() => openCap(c)}>{c.name}</button>{#if i < g.caps.length - 1}<span class="muted"> · </span>{/if}
						{/each}
					</p>
				{:else}
					<p class="muted">No capability targets this release yet.</p>
				{/each}
				{#each posts as p (p.id)}
					<p class="train-line"><span class="muted">Changelog:</span> <button class="linkish" onclick={() => (drawer = { kind: 'post', post: p })}>{p.title}</button></p>
				{/each}
			</ReleaseEntry>
		{/each}
	</div>
</div>

<SheetDrawer open={drawer !== null} title={drawerTitle} eyebrow={drawerEyebrow} size="lg" onclose={() => (drawer = null)}>
	{#if drawer?.kind === 'cap'}
		{@const c = drawer.cap}
		{@const area = areaOf(c.area_id)}
		{@const neededBy = caps.filter((x) => x.depends_on.includes(c.id))}
		{@const items = checklist(c)}
		{@const rel = rm.releases.find((r) => r.version === c.target_release)}
		{@const shipped = rm.shipped.filter((s) => s.capability === c.id)}
		<!-- Shaped like a card imported from Trello or Jira: list, labels, due, description, checklist, links. -->
		<div class="drawer">
			<dl class="facts">
				{#if c.triage}
					<dt>List</dt>
					<dd>{TRIAGE_LABEL[c.triage.lane]}</dd>
				{/if}
				{#if c.surfaces.length}
					<dt>Lives in</dt>
					<dd>{c.surfaces.join(', ')}</dd>
				{/if}
				<dt>Due</dt>
				<dd>{rel ? `${rel.version} · ${fmtDate(rel.date)}` : windowLabel(c)}</dd>
				{#if c.owner ?? area?.owner}
					<dt>Owner</dt>
					<dd>{c.owner ?? area?.owner}</dd>
				{/if}
			</dl>

			<div class="chips">
				{#if c.pillar}<Chip color="cyan">{pillarName(c.pillar)}</Chip>{/if}
				<Chip color={c.kind === 'new' ? 'warn' : 'default'}>{kindLabel(c)}</Chip>
			</div>

			{#if c.summary}<p class="summary">{c.summary}</p>{/if}
			{#if c.description}<p class="muted">{c.description}</p>{/if}

			{#if shipped.length}
				<SectionBar label="Shipped · {shipped.length}" />
				{@render shippedList(shipped, false)}
			{/if}

			<SectionBar label="Checklist · {items.length} open" />
			{#if items.length}
				<ul class="list checklist">
					{#each items as it, ii (ii)}{@render task(it)}{/each}
				</ul>
			{:else}
				<p class="muted">No tasks yet.</p>
			{/if}

			{#if c.depends_on.length || neededBy.length}
				<SectionBar label="Links" />
				<div class="deps">
					{#if c.depends_on.length}
						<span class="legend-k">Blocked by</span>
						{#each c.depends_on as id (id)}
							{@const d = rm.byId.get(id)}
							{#if d}<Chip size="sm" onclick={() => openCap(d)}>{d.name}</Chip>{/if}
						{/each}
					{/if}
					{#if neededBy.length}
						<span class="legend-k">Blocks</span>
						{#each neededBy as d (d.id)}<Chip size="sm" onclick={() => openCap(d)}>{d.name}</Chip>{/each}
					{/if}
				</div>
			{/if}
		</div>
	{:else if drawer?.kind === 'shipped'}
		<div class="drawer">{@render shippedList(drawer.items, true)}</div>
	{:else if drawer?.kind === 'post'}
		{@const p = drawer.post}
		<div class="drawer">
			<div class="chips">
				<Chip color={p.status === 'published' ? 'success' : p.status === 'draft' ? 'warn' : 'default'} lead="dot">{p.status}</Chip>
				{#if p.tag}<Chip>{p.tag}</Chip>{/if}
				{#if p.version}<Chip cut="shield" color="cyan">announces {p.version}</Chip>{/if}
			</div>
			<dl class="facts">
				<dt>Date</dt>
				<dd>{fmtDate(p.date)}</dd>
				<dt>File</dt>
				<dd class="mono">{p.path ?? '—'}</dd>
			</dl>
			{#if p.note}<p class="summary">{p.note}</p>{/if}
		</div>
	{:else if drawer?.kind === 'release'}
		{@const r = drawer.release}
		{@const targeted = caps.filter((c) => c.target_release === r.version)}
		{@const gates = gateChecklist(r)}
		<div class="drawer">
			<div class="chips">
				<Chip cut="shield" color={r.bump === 'major' ? 'accent' : r.bump === 'minor' ? 'cyan' : 'default'}>{r.bump}</Chip>
				<Chip>{r.phase}</Chip>
				{#if r.proposed}<Chip color="warn">proposed cadence, not decided</Chip>{/if}
				{#if r.current}<Chip color="success" lead="dot" pulse>current version</Chip>{/if}
			</div>
			{#if r.bump !== 'maintenance' && targeted.length}
				<p class="summary">Each card below ships as its own patch release. {r.version} is cut when the last one lands.</p>
			{/if}
			<SectionBar label="Cards · {targeted.length}" />
			<div class="list">
				{#each targeted as c (c.id)}{@render mini(c, null)}{:else}<p class="muted">Nothing targets {r.version} by version yet.</p>{/each}
			</div>
			{#if gates.length}
				<SectionBar label="Release gates · {gates.filter((g) => g.done).length}/{gates.length}" />
				<ul class="list checklist">
					{#each gates as it, ii (ii)}{@render task(it)}{/each}
				</ul>
			{/if}
		</div>
	{/if}
</SheetDrawer>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: var(--sp-4) var(--sp-6) var(--sp-6);
	}
	.asof {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-muted);
	}

	/* ── Header bar ────────────────────────────────────── */
	.bar {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		flex-wrap: wrap;
		padding-bottom: var(--sp-4);
		border-bottom: 1px solid var(--border);
	}
	.milestones {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg-muted);
	}
	.milestones li + li::before {
		content: '→';
		margin-right: var(--sp-2);
		color: var(--border-strong);
	}
	.milestones b,
	.progress b {
		color: var(--fg);
		font-weight: 700;
	}
	.milestones .now b {
		color: var(--palette-rose);
	}
	.milestones .beta b,
	.progress .warn {
		color: var(--palette-amber);
	}
	.milestones .ga b {
		color: var(--accent);
	}
	.progress {
		margin: 0;
		padding-left: var(--sp-5);
		border-left: 1px solid var(--border);
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg-muted);
	}
	.key-btn {
		margin-left: auto;
		padding: 2px 8px;
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-hairline);
		cursor: help;
	}
	.key-btn:hover,
	.key-btn:focus-visible {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.key {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.legend-k {
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
		margin-left: var(--sp-2);
	}
	.legend-v {
		font-size: var(--t-small);
		color: var(--fg-muted);
	}
	.swatch {
		width: 18px;
		height: 10px;
		border: 1px solid var(--accent);
		background: var(--accent-faint);
	}
	.swatch.dashed {
		border-style: dashed;
		background: transparent;
	}
	.swatch.fade {
		width: 28px;
		mask-image: linear-gradient(to right, transparent 0, black 18px);
	}

	/* ── Gantt ─────────────────────────────────────────── */
	.scroll {
		overflow-x: auto;
	}
	/* A month never gets narrower than --month-w: a long horizon scrolls rather
	   than squeezing every bar into a sliver. */
	/* Lanes share the viewport height so the whole chart fits on one screen: the
	   fixed rows (month, phase, releases) and each row's padding come off first.
	   Most cards are due-by bars starting today, so they overlap and packing
	   cannot save lanes; only the lane height can give. */
	.gantt {
		--label-w: 160px;
		--month-w: 120px;
		--lane-gap: 4px;
		--chrome: calc(58px + var(--row-count) * (2 * var(--lane-gap) + 1px) + 2 * var(--sp-4));
		--card-h: clamp(20px, calc((100dvh - var(--chrome)) / var(--lane-count) - var(--lane-gap)), 60px);
		scroll-margin-top: var(--sp-4);
		position: relative;
		display: grid;
		grid-template-columns: var(--label-w) minmax(0, 1fr);
		min-width: calc(var(--label-w) + var(--months) * var(--month-w));
	}
	.label {
		position: sticky;
		left: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		border-bottom: 1px solid var(--border);
		border-right: 1px solid var(--border);
		background: var(--bg);
		font-size: var(--t-body);
		color: var(--fg);
	}
	.label.head {
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
		display: flex;
		align-items: center;
	}
	.label.area {
		flex-wrap: wrap;
		align-content: flex-start;
		padding-top: var(--sp-3);
	}
	/* Full width, so a tag drops under the name instead of widening the column. */
	.aname {
		flex: 1 1 100%;
		min-width: 0;
	}
	.track-tag {
		font-family: var(--mono);
		font-size: var(--t-micro);
		text-transform: uppercase;
		color: var(--fg-muted);
		border: 1px solid var(--border);
		padding: 0 4px;
		white-space: nowrap;
	}
	.track-tag.ex {
		color: var(--accent);
		border-color: var(--border-accent);
	}
	.track {
		position: relative;
		border-bottom: 1px solid var(--border);
	}
	.track.head,
	.track.foot {
		height: 28px;
	}
	.label.foot,
	.track.foot {
		border-bottom: 0;
	}
	.month {
		position: absolute;
		top: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		padding-left: var(--sp-2);
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
		white-space: nowrap;
	}
	.phase {
		position: absolute;
		top: 0;
		bottom: 0;
	}
	.phase-beta,
	.swatch.phase-key {
		background: color-mix(in srgb, var(--palette-amber) 8%, transparent);
	}
	.phase-ga {
		background: var(--accent-faint);
	}
	.later-rel {
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg-muted);
		background: none;
		border: 1px solid var(--border);
		padding: 3px 8px;
		cursor: pointer;
	}
	/* Zero-width at the release date, with the diamond on the date and the label
	   reading leftward, under the band of cards this release waits on. */
	.release {
		--d: 8px;
		position: absolute;
		top: 0;
		bottom: 0;
		width: 0;
		display: flex;
		align-items: center;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		z-index: 3;
		white-space: nowrap;
	}
	.release :global(> *) {
		position: absolute;
		top: 50%;
		right: calc(var(--d) / -2);
		transform: translateY(-50%);
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		gap: 6px;
	}
	.rc {
		margin-left: 6px;
		font-weight: 400;
		color: var(--fg-muted);
	}
	.release.hot .rv {
		color: var(--fg);
	}
	/* Hovering a release, or a card due by one, lights that release's whole set. */
	.gantt.linking .card:not(.hot),
	.gantt.linking .point {
		opacity: 0.3;
	}
	.diamond {
		flex: none;
		width: var(--d);
		height: var(--d);
		transform: rotate(45deg);
		border: 1px solid var(--fg-muted);
		background: var(--bg);
	}
	.rv {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-muted);
	}
	.rv em {
		margin-left: 5px;
		font-style: normal;
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}
	.release.bump-minor {
		--d: 10px;
	}
	.release.bump-major {
		--d: 12px;
	}
	.release.bump-minor .diamond {
		border-color: var(--palette-cyan);
		background: color-mix(in srgb, var(--palette-cyan) 30%, var(--bg));
	}
	.release.bump-minor .rv {
		color: var(--palette-cyan);
	}
	.release.bump-major .diamond {
		border-color: var(--accent);
		background: var(--accent);
		box-shadow: 0 0 12px var(--accent);
	}
	.release.bump-major .rv {
		color: var(--accent);
		font-weight: 600;
	}
	.release.proposed .diamond {
		background: transparent;
		border-style: dashed;
		box-shadow: none;
	}
	.release.current .diamond {
		border-color: var(--palette-rose);
		background: var(--palette-rose);
	}
	.release.current .rv {
		color: var(--palette-rose);
	}

	.row-track {
		min-height: 56px;
		padding-bottom: var(--lane-gap);
	}
	.lanes {
		position: relative;
		height: calc(var(--lanes) * (var(--card-h) + var(--lane-gap)) + var(--lane-gap));
	}
	/* Size containers, so a card sheds its meta line and second title line when
	   its lane gets short; the tooltip still carries both. */
	.card,
	.point {
		container-type: size;
	}
	@container (max-height: 52px) {
		.card-title,
		.plabel {
			-webkit-line-clamp: 1;
			line-clamp: 1;
		}
	}
	@container (max-height: 40px) {
		.card-meta,
		.pdate {
			display: none;
		}
	}
	.card {
		position: absolute;
		height: var(--card-h);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		padding: 0 var(--sp-2);
		text-align: left;
		overflow: hidden;
		cursor: pointer;
		z-index: 2;
		color: var(--fg);
		background: color-mix(in srgb, var(--tone) 14%, var(--surface-raised));
		border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
		border-left: 3px solid var(--tone);
		border-radius: var(--radius-hairline);
		transition:
			border-color 120ms,
			box-shadow 120ms;
	}
	.card:hover,
	.card:focus-visible,
	.mini:hover,
	.mini:focus-visible,
	.point:hover .ptext,
	.point:focus-visible .ptext {
		border-color: var(--tone);
		box-shadow:
			0 0 0 1px var(--tone),
			0 0 16px color-mix(in srgb, var(--tone) 35%, transparent);
		z-index: 4;
	}
	.card.open-start {
		border-left-style: dotted;
		mask-image: linear-gradient(to right, transparent 0, black 18px);
	}
	.card.k-new,
	.mini.k-new {
		background: color-mix(in srgb, var(--tone) 6%, var(--bg));
		border-style: dashed;
	}
	.card.st-missing {
		background: var(--bg);
	}
	/* Shades the part of a minimum-width bar that runs past its real end; z-index
	   -1 keeps it above the card's fill and below its text. */
	.card.overhang::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--fill);
		right: 0;
		z-index: -1;
		border-left: 2px solid var(--tone);
		background: repeating-linear-gradient(-45deg, transparent 0 4px, color-mix(in srgb, var(--tone) 10%, transparent) 4px 5px), var(--bg);
		opacity: 0.85;
	}
	.card-top {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		min-width: 0;
	}
	/* Two lines, then clip: a single line truncated most names to nothing. */
	.card-title,
	.plabel,
	.mname {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
		line-height: 1.25;
	}
	.card-title {
		flex: 1;
		min-width: 0;
		font-size: var(--t-body);
		font-weight: 600;
	}
	.card-meta {
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chev {
		flex: none;
		color: var(--fg-muted);
		font-size: var(--t-body);
		line-height: 1.25;
	}
	.card:hover .chev,
	.card:focus-visible .chev,
	.mini:hover .chev,
	.mini:focus-visible .chev,
	.point:hover .chev,
	.point:focus-visible .chev {
		color: var(--tone);
	}
	.tip {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tip-title {
		font-weight: 600;
	}
	.tip-meta {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-muted);
	}
	.tip-more {
		color: var(--accent);
		font-size: var(--t-micro);
	}
	.glyph {
		flex: none;
		color: var(--tone);
		font-size: var(--t-small);
		line-height: 1;
	}
	.badge {
		flex: none;
		font-family: var(--mono);
		font-size: var(--t-micro);
		line-height: 1.4;
		padding: 0 4px;
		border: 1px solid var(--border-strong);
		color: var(--fg-muted);
	}
	.badge.bad {
		border-color: var(--palette-rose);
		color: var(--palette-rose);
	}
	.badge.founder {
		border-color: var(--palette-emerald);
		color: var(--palette-emerald);
	}

	/* Explicit width: as a size container it no longer sizes to its label. */
	.point {
		position: absolute;
		width: 218px;
		height: var(--card-h);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0;
		background: none;
		border: 0;
		cursor: pointer;
		z-index: 2;
		transform: translateX(-6px);
		color: var(--fg);
		text-align: left;
	}
	.pmark {
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: var(--r-pill);
		background: var(--tone);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 25%, transparent);
	}
	.point.post .pmark {
		border-radius: 0;
		width: 11px;
		height: 13px;
	}
	.point.draft .pmark {
		background: transparent;
		border: 1px dashed var(--tone);
	}
	.ptext {
		display: flex;
		flex-direction: column;
		max-width: 200px;
		padding: 2px 6px;
		border: 1px solid transparent;
		border-radius: var(--radius-hairline);
		background: color-mix(in srgb, var(--bg) 70%, transparent);
	}
	.plabel {
		font-size: var(--t-body);
	}
	.pdate {
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg-muted);
		white-space: nowrap;
	}

	.later-list {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border);
	}
	.later-group {
		display: grid;
		grid-template-columns: 160px minmax(0, 1fr);
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-2);
		border-bottom: 1px solid var(--border);
	}
	.later-k {
		padding-top: 3px;
		font-size: var(--t-body);
		color: var(--fg);
	}
	.later-items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	.mini {
		position: relative;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		max-width: 100%;
		padding: 3px 6px;
		font-size: var(--t-body);
		color: var(--fg);
		text-align: left;
		cursor: pointer;
		/* --surface-raised is translucent; the --bg underlay stops bracket edges showing through. */
		background: linear-gradient(var(--surface-raised) 0 0) var(--bg);
		border: 1px solid var(--border);
		border-left: 2px solid var(--tone);
		border-radius: var(--radius-hairline);
	}
	.mini.st-missing {
		background: var(--bg);
	}
	.mname {
		min-width: 0;
	}
	.why {
		flex: none;
		font-style: normal;
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-muted);
	}

	.overlay {
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--label-w);
		right: 0;
		pointer-events: none;
	}
	.gridline {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px solid var(--border);
	}
	/* Under the cards, so a line never runs through a name. */
	.rule {
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 1;
	}
	.rule.today {
		border-left: 1px solid var(--palette-rose);
	}
	.rule.ga {
		border-left: 2px solid var(--accent);
	}
	.rule.launch,
	.swatch.rule-launch {
		border-left: 1px dashed var(--palette-emerald);
	}
	.swatch.rule-launch {
		width: 0;
		height: 14px;
		border-top: 0;
		border-right: 0;
		border-bottom: 0;
		background: none;
		margin: 0 9px;
	}
	/* Done work is the loudest fill on the chart: it is the only part that is fact. */
	.card.done {
		background: color-mix(in srgb, var(--tone) 24%, var(--surface-raised));
	}
	.launch-tag {
		font-family: var(--mono);
		font-size: var(--t-micro);
		white-space: nowrap;
		color: var(--palette-emerald);
		background: none;
		border: 1px solid color-mix(in srgb, var(--palette-emerald) 50%, transparent);
		padding: 0 4px;
		cursor: pointer;
	}
	.launch-tag:hover,
	.launch-tag:focus-visible {
		border-color: var(--palette-emerald);
	}
	.progress .ok {
		color: var(--palette-emerald);
	}
	.swatch.done {
		border-color: var(--palette-emerald);
		background: color-mix(in srgb, var(--palette-emerald) 24%, transparent);
	}

	/* ── Below the chart ───────────────────────────────── */
	.rules {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--sp-2) var(--sp-4);
		margin: 0;
		font-size: var(--t-small);
	}
	.rules dt {
		font-weight: 600;
		color: var(--fg);
	}
	.rules dd {
		margin: 0;
		color: var(--fg-muted);
	}
	.checks {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border);
	}
	.check-head {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		width: 100%;
		padding: var(--sp-3) var(--sp-2);
		background: none;
		border: 0;
		border-bottom: 1px solid var(--border);
		color: var(--fg);
		text-align: left;
		cursor: pointer;
	}
	.check-title {
		font-weight: 600;
		font-size: var(--t-small);
		white-space: nowrap;
	}
	.check-hint {
		flex: 1;
		min-width: 0;
		font-size: var(--t-small);
		color: var(--fg-muted);
	}
	.caret {
		font-family: var(--mono);
		color: var(--fg-muted);
	}
	.check-items {
		margin: 0;
		padding: var(--sp-3) var(--sp-4);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--t-small);
		color: var(--fg-muted);
		list-style: none;
	}
	.linkish {
		background: none;
		border: 0;
		padding: 0;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
		text-align: left;
	}
	.linkish:hover {
		text-decoration: underline;
	}
	.muted {
		color: var(--fg-muted);
	}
	.bad {
		color: var(--palette-rose);
	}
	.train-list {
		display: flex;
		flex-direction: column;
	}
	.train-line {
		margin: var(--sp-2) 0 0;
		font-size: var(--t-small);
		color: var(--fg-muted);
		line-height: var(--lh-prose);
	}
	.train-line strong {
		color: var(--fg);
		margin-right: var(--sp-2);
	}

	/* ── Drawer ────────────────────────────────────────── */
	.drawer {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.chips {
		display: flex;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.summary {
		margin: 0;
		font-size: var(--t-body);
		line-height: var(--lh-prose);
		color: var(--fg);
	}
	.facts {
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: var(--sp-2) var(--sp-3);
		margin: 0;
		font-size: var(--t-small);
	}
	.facts dt {
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.facts dd {
		margin: 0;
		color: var(--fg);
	}
	.mono {
		font-family: var(--mono);
		font-size: var(--t-micro);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--t-small);
		color: var(--fg-muted);
		line-height: var(--lh-prose);
	}
	.list:not(.checklist) > li {
		padding-left: var(--sp-3);
		border-left: 2px solid var(--border-strong);
	}
	.list.shipped-list > li {
		display: flex;
		gap: var(--sp-2);
		align-items: baseline;
		color: var(--fg);
		border-left-color: var(--palette-emerald);
	}
	.shipped-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.list.shipped-list strong + .muted {
		margin-left: var(--sp-2);
	}
	.glyph.ok {
		color: var(--palette-emerald);
	}
	.small {
		font-size: var(--t-micro);
		margin: 0;
	}
	.checklist li {
		display: flex;
		gap: var(--sp-2);
		align-items: baseline;
		color: var(--fg);
	}
	.checklist li.done {
		color: var(--fg-muted);
		text-decoration: line-through;
	}
	.checklist li.sub {
		padding-left: var(--sp-5);
		font-size: var(--t-small);
	}
	.box {
		text-decoration: none;
		color: var(--fg-muted);
	}
	.deps {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
</style>
