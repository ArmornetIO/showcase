/**
 * The roadmap's data model: turn roadmap.gen.json into what the page draws —
 * where each card sits on the timeline, and which checks the plan fails.
 *
 * roadmap.gen.json is written by `go run ./cmd/roadmapgen` from docs/roadmap/,
 * a folder per pillar and a YAML file per item. Edit those, never the JSON.
 *
 * A host may pass extra tracks (business, marketing) with their own cards and
 * posts; the published app draws the product track alone.
 */

// ── The generated document ───────────────────────────────────────────────────
export interface DocProject {
	name: string;
	tasks?: string[];
}
export interface DocRelease {
	version: string;
	date?: string;
	bump: Bump;
	phase: string;
	title: string;
	proposed: boolean;
	target?: number;
	gates?: DocProject[];
}
export interface DocMode {
	mode: string;
	used_for: string;
	item?: string;
}
export interface DocPillar {
	id: string;
	name: string;
	ga_exception?: boolean;
	summary: string;
	description: string;
	modes?: DocMode[];
}
export interface DocItem {
	id: string;
	pillar: string;
	name: string;
	surface?: string;
	release: string;
	status: 'built' | 'partial' | 'missing';
	ga_exception?: boolean;
	depends_on?: string[];
	summary: string;
	description: string;
	shipped?: string[];
	checklist?: DocProject[];
}
export interface RoadmapDoc {
	as_of: string;
	current_version: string;
	launch: { date: string; title: string } | null;
	releases: DocRelease[];
	pillars: DocPillar[];
	items: DocItem[];
}

// ── The model ────────────────────────────────────────────────────────────────
export type Track = 'product' | 'business' | 'marketing';
export type Kind = 'completion' | 'hardening' | 'new';
export type Status = 'missing' | 'partial' | 'complete' | 'shipped';
export type Confidence = 'high' | 'medium' | 'low';
export type Bump = 'major' | 'minor' | 'maintenance';
/** Who wrote the record: a docs agent, or the founder (every product item). */
export type Origin = 'docs' | 'founder';

export interface Source {
	doc: string | null;
	heading: string | null;
}
export interface Gap {
	id: string;
	description: string;
	source: Source | null;
	status: string;
}
export interface Capability {
	id: string;
	name: string;
	summary: string | null;
	/** What it is and what it is for, in a few sentences. */
	description: string | null;
	surfaces: string[];
	ga_required: boolean;
	kind: Kind;
	status: Status;
	percent: number | null;
	evidence: string[];
	gaps: Gap[];
	target_release: string | null;
	window: { start: string | null; end: string | null };
	depends_on: string[];
	open_questions: string[];
	confidence: Confidence;
	owner: string | null;
	area_id: string;
	track: Track;
	origin: Origin;
	pillar: string | null;
	/** Extra tracks only: the founder's triage lane. */
	triage: { lane: TriageLane; rank: number } | null;
	/** Checklist projects: each is one line, its tasks indented under it. */
	folded: Capability[];
	/** Worked on the whole time: no section is cut on it, and it draws across the horizon. */
	continuous: boolean;
}
export type TriageLane = 'now' | 'next' | 'later';
export interface Pillar {
	id: string;
	name: string;
	summary: string | null;
	description: string | null;
}
export interface Area {
	id: string;
	name: string;
	owner: string | null;
	description: string | null;
	source_docs: string[];
	track: Track;
	origin: Origin;
	capabilities: Capability[];
}
export interface Release {
	version: string;
	date: string | null;
	bump: Bump;
	phase: string;
	title: string;
	/** A cadence suggestion, not a decision. */
	proposed: boolean;
	/** The running version, pinned to today when no date is recorded. */
	current: boolean;
	/** How many items the section should hold. */
	target: number | null;
	/** Work that gates the release but is no customer outcome (key rotation, hosting). */
	gates: Capability[];
}
export interface Post {
	id: string;
	title: string;
	date: string | null;
	status: 'published' | 'draft' | 'planned';
	tag: string | null;
	path: string | null;
	version: string | null;
	area_id: string;
	note: string | null;
}
/** Something a customer can already do, from an item's `shipped:` list. */
export interface Shipped {
	id: string;
	name: string;
	summary: string | null;
	date: string | null;
	capability: string | null;
	area_id: string;
	pillar: string | null;
	evidence: string[];
}
export interface Roadmap {
	current_version: string;
	as_of: Record<string, string | null>;
	releases: Release[];
	ga: Release | null;
	areas: Area[];
	pillars: Pillar[];
	posts: Post[];
	launch: { date: string; title: string } | null;
	shipped: Shipped[];
	/** Taken off the train on purpose (release: parked). */
	parked: Capability[];
	/** Pillars and items allowed net-new work before 1.0. */
	exceptions: string[];
	/** Items whose release is a version: a minor is cut on them. */
	sectioned: Set<string>;
	rules: { title: string; detail: string }[];
	byId: Map<string, Capability>;
	/** Google Doc id → display name. */
	docNames: Map<string, string>;
	/** Bad references. Shown on the page. */
	errors: string[];
}

/** What a host adds beside the product track. */
export interface Extra {
	areas: Area[];
	posts: Post[];
	rules: { title: string; detail: string }[];
	docNames: Map<string, string>;
	as_of: Record<string, string | null>;
	errors: string[];
}

/** The rules panel for the product track alone. A host with extra tracks passes its own. */
export const PRODUCT_RULES = [
	{ title: 'An item is an outcome', detail: 'Something a customer would notice: an Agent mode, a console page or a published package.' },
	{ title: 'An item is a patch, a section is a minor', detail: 'Each item ships as its own patch. The items naming a minor are its section, and the minor is cut when the last one lands.' },
	{ title: '1.0 finishes what exists', detail: 'Anything built or partly built lands before 1.0.0. Work with no code yet starts at 1.1.0, except open source and the Hardened CI runner.' },
	{ title: 'The Armory is a track', detail: 'The Armory Research Network is worked on the whole time and no minor is cut on it.' },
	{ title: 'Releases have gates', detail: 'Work a release needs that no customer would notice, such as key rotation, is a gate on that release, not an item.' }
];

export const shownStatus = (c: Capability): Status => c.status;

export function blank(id: string, name: string, area_id: string, track: Track, origin: Origin): Capability {
	return {
		id,
		name,
		summary: null,
		description: null,
		surfaces: [],
		ga_required: false,
		kind: 'completion',
		status: 'missing',
		percent: null,
		evidence: [],
		gaps: [],
		target_release: null,
		window: { start: null, end: null },
		depends_on: [],
		open_questions: [],
		confidence: 'low',
		owner: null,
		area_id,
		track,
		origin,
		pillar: null,
		triage: null,
		folded: [],
		continuous: false
	};
}

const ITEM_STATUS: Record<DocItem['status'], Status> = { built: 'complete', partial: 'partial', missing: 'missing' };

/** A checklist line. Always open — done work is a shipped line, not a ticked box. */
function toProject(p: DocProject, id: string, pillar: string): Capability {
	const c = blank(id, p.name, pillar, 'product', 'founder');
	c.pillar = pillar;
	c.gaps = (p.tasks ?? []).map((description, n) => ({ id: `${id}.${n}`, description, source: null, status: 'open' }));
	return c;
}

function toItem(it: DocItem): Capability {
	return {
		...blank(it.id, it.name, it.pillar, 'product', 'founder'),
		summary: it.summary,
		description: it.description,
		surfaces: it.surface ? [it.surface] : [],
		kind: it.status === 'missing' ? 'new' : 'completion',
		status: ITEM_STATUS[it.status],
		depends_on: it.depends_on ?? [],
		confidence: 'high',
		pillar: it.pillar,
		folded: (it.checklist ?? []).map((p, n) => toProject(p, `${it.id}#${n}`, it.pillar))
	};
}

// ── Dates ────────────────────────────────────────────────────────────────────
export const DAY = 86_400_000;

/** UTC ms for 'YYYY-MM-DD', or mid-month for a month-only 'YYYY-MM'. */
export function dayOf(d: string | null): number | null {
	const m = d ? /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d) : null;
	if (!m) return null;
	return Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 15);
}
export const isMonthOnly = (d: string | null) => !!d && /^\d{4}-\d{2}$/.test(d);

export function fmtDay(t: number | null): string {
	if (t === null) return '—';
	return new Date(t).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}
export function fmtMonth(t: number | null): string {
	if (t === null) return '—';
	return new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
/** A recorded date as written: month precision stays month precision. */
export const fmtDate = (d: string | null) => (isMonthOnly(d) ? fmtMonth(dayOf(d)) : fmtDay(dayOf(d)));

export function windowLabel(c: Capability): string {
	const { start, end } = c.window;
	if (start && end) return start === end ? fmtDate(start) : `${fmtDate(start)} → ${fmtDate(end)}`;
	if (end) return `by ${fmtDate(end)}`;
	if (start) return `from ${fmtDate(start)}`;
	if (c.continuous) return 'continuous';
	if (c.target_release) return `ships in ${c.target_release}, no dates`;
	return 'after 1.0, unscheduled';
}

// ── Build ────────────────────────────────────────────────────────────────────
export function buildRoadmap(doc: RoadmapDoc, todayISO: string, extra?: Extra): Roadmap {
	const errors = [...(extra?.errors ?? [])];
	const releases: Release[] = doc.releases.map((r) => {
		const current = r.version === doc.current_version;
		return {
			version: r.version,
			date: r.date ?? (current ? todayISO : null),
			bump: r.bump,
			phase: r.phase,
			title: r.title,
			proposed: r.proposed,
			current,
			target: r.target ?? null,
			gates: (r.gates ?? []).map((g, n) => toProject(g, `${r.version}.gate${n}`, ''))
		};
	});

	const pillars: Pillar[] = doc.pillars.map((p) => ({ id: p.id, name: p.name, summary: p.summary, description: p.description }));
	const exceptions = [...doc.pillars.filter((p) => p.ga_exception).map((p) => p.id), ...doc.items.filter((i) => i.ga_exception).map((i) => i.id)];
	const areas: Area[] = doc.pillars.map((p) => ({
		id: p.id,
		name: p.name,
		owner: null,
		description: p.description,
		source_docs: [],
		track: 'product',
		origin: 'founder',
		capabilities: []
	}));
	const parked: Capability[] = [];
	const shipped: Shipped[] = [];
	const sectioned = new Set<string>();
	const live = (id: string, name: string, pillar: string, cap: string | null, summary: string | null) =>
		shipped.push({ id, name, summary, date: null, capability: cap, area_id: pillar, pillar, evidence: [] });

	// The generator has already refused unknown releases, pillars and references.
	for (const it of doc.items) {
		const item = toItem(it);
		const lines = it.shipped ?? [];
		if (it.release === 'shipped') {
			if (lines.length) lines.forEach((l, n) => live(`${it.id}~${n}`, l, it.pillar, null, item.name));
			else live(it.id, item.name, it.pillar, null, item.summary);
			continue;
		}
		const onCard = it.release === 'parked' ? null : it.id;
		lines.forEach((l, n) => live(`${it.id}~${n}`, l, it.pillar, onCard, onCard ? null : item.name));
		if (it.release === 'parked') {
			parked.push(item);
			continue;
		}
		if (it.release === 'continuous') Object.assign(item, { continuous: true, ga_required: true });
		else if (it.release !== 'later') {
			const rel = releases.find((r) => r.version === it.release)!;
			item.target_release = it.release;
			item.ga_required = rel.phase !== 'ga' || rel.bump === 'major';
			sectioned.add(it.id);
		}
		areas.find((a) => a.id === it.pillar)!.capabilities.push(item);
	}

	const posts = extra?.posts ?? [];
	const all = [...areas, ...(extra?.areas ?? [])];
	const shown = all.filter((a) => a.capabilities.length > 0 || a.track === 'product' || posts.some((p) => p.area_id === a.id));
	const byId = new Map<string, Capability>();
	for (const a of shown) for (const c of a.capabilities) byId.set(c.id, c);
	releases.sort((a, b) => (dayOf(a.date) ?? Infinity) - (dayOf(b.date) ?? Infinity));

	return {
		current_version: doc.current_version,
		as_of: { product: doc.as_of, ...(extra?.as_of ?? {}) },
		releases,
		ga: releases.find((r) => r.bump === 'major') ?? null,
		areas: shown,
		pillars,
		posts,
		launch: doc.launch,
		shipped,
		parked,
		exceptions,
		sectioned,
		rules: extra?.rules ?? PRODUCT_RULES,
		byId,
		docNames: extra?.docNames ?? new Map(),
		errors
	};
}

/**
 * A card's remaining work as one checklist, the shape a Trello or Jira card
 * carries: its own gaps, then each project with its tasks indented under it.
 */
export interface ChecklistItem {
	text: string;
	done: boolean;
	sub: boolean;
}
export function checklist(c: Capability): ChecklistItem[] {
	return [...tasks(c, false), ...c.folded.flatMap(line)].filter((t) => !t.done);
}
/** A release's gates, in the same shape as a card's checklist. */
export const gateChecklist = (r: Release): ChecklistItem[] => r.gates.flatMap(line);

function tasks(c: Capability, sub: boolean): ChecklistItem[] {
	return c.gaps.filter((g) => g.status !== 'dropped').map((g) => ({ text: g.description, done: g.status === 'done', sub }));
}
const isBuilt = (c: Capability) => c.status === 'complete' || c.status === 'shipped';
function line(f: Capability): ChecklistItem[] {
	return [{ text: f.name, done: false, sub: false }, ...tasks(f, true)];
}

/** Product items as one row per pillar, in the pillars' declared order. */
export function pillarRows(rm: Roadmap): Area[] {
	return rm.areas.filter((a) => a.track === 'product');
}

// ── Placement ────────────────────────────────────────────────────────────────
/**
 * Where a capability goes, in order of how much the data actually says:
 *   bar   a start and an end (no start → from today, drawn with an open edge)
 *   point a single date, or start === end
 *   due   no dates, but a dated target release (or 1.0 scope) it must land by
 *   unscheduled  nothing to place it with
 * Nothing is ever given a date the data does not have.
 */
export type Placement =
	| { type: 'bar'; start: number; end: number; openStart: boolean }
	| { type: 'point'; at: number }
	| { type: 'due'; by: number; release: string }
	| { type: 'unscheduled' };

export function placeOf(c: Capability, rm: Roadmap, today: number): Placement {
	if (c.continuous) return { type: 'bar', start: today, end: Infinity, openStart: true };
	const s = dayOf(c.window.start);
	const e = dayOf(c.window.end);
	if (s !== null && e !== null) return s === e ? { type: 'point', at: s } : { type: 'bar', start: s, end: e, openStart: false };
	if (e !== null) return e <= today ? { type: 'point', at: e } : { type: 'bar', start: today, end: e, openStart: true };
	if (s !== null) return { type: 'point', at: s };
	const rel = c.target_release ? rm.releases.find((r) => r.version === c.target_release) : undefined;
	const relDay = dayOf(rel?.date ?? null);
	if (rel && relDay !== null && relDay > today) return { type: 'due', by: relDay, release: rel.version };
	const gaDay = dayOf(rm.ga?.date ?? null);
	if (c.ga_required && rm.ga && gaDay !== null && gaDay > today) return { type: 'due', by: gaDay, release: rm.ga.version };
	return { type: 'unscheduled' };
}

// ── Checks ───────────────────────────────────────────────────────────────────
export interface CheckItem {
	cap: Capability | null;
	text: string;
}
export interface Check {
	id: string;
	title: string;
	hint: string;
	tone: 'bad' | 'warn' | 'info';
	items: CheckItem[];
}

export function checks(rm: Roadmap, today: number): Check[] {
	const caps = [...rm.byId.values()];
	const product = caps.filter((c) => c.track === 'product');
	const other = caps.filter((c) => c.track !== 'product');
	const questionsStarting = (prefix: string) =>
		caps.flatMap((c) => c.open_questions.filter((q) => q.startsWith(prefix)).map((q) => ({ cap: c, text: q })));
	const inSection = (v: string) => product.filter((c) => c.target_release === v).length;

	const releaseChecks: CheckItem[] = [];
	if (rm.posts.length)
		for (const r of rm.releases) {
			if ((r.bump === 'minor' || r.bump === 'major') && r.phase !== 'alpha' && !rm.posts.some((p) => p.version === r.version)) {
				releaseChecks.push({ cap: null, text: `${r.version} (${r.title}) has no changelog post planned.` });
			}
		}
	for (const p of rm.posts) {
		if (!p.version || p.status !== 'published') continue;
		const rel = rm.releases.find((r) => r.version === p.version);
		const relDay = dayOf(rel?.date ?? null);
		const postDay = dayOf(p.date);
		if (!rel) releaseChecks.push({ cap: null, text: `"${p.title}" announces ${p.version}, which is not on the release train.` });
		else if (relDay !== null && postDay !== null && postDay < relDay) {
			releaseChecks.push({
				cap: null,
				text: `"${p.title}" was published ${fmtDate(p.date)}, but ${p.version} is ${rel.proposed ? 'proposed' : 'planned'} for ${fmtDate(rel.date)} and the product is ${rm.current_version}.`
			});
		}
	}

	return [
		{
			id: 'scope',
			title: 'Net-new before 1.0',
			hint: 'Items with no code yet, due before 1.0, outside the 1.0 exceptions. Should be zero.',
			tone: 'bad',
			items: product
				.filter((c) => c.kind === 'new' && c.ga_required && !rm.exceptions.includes(c.area_id) && !rm.exceptions.includes(c.id))
				.map((c) => ({ cap: c, text: c.name }))
		},
		{
			id: 'capacity',
			title: 'Section over capacity',
			hint: 'A minor holding more items than its target, about one per working week before the cut.',
			tone: 'warn',
			items: rm.releases
				.filter((r) => r.target !== null && inSection(r.version) > r.target)
				.map((r) => ({ cap: null, text: `${r.version}: ${inSection(r.version)} items, target ${r.target}` }))
		},
		{
			id: 'conflicts',
			title: 'Conflicts',
			hint: 'Sources disagree with each other or with engineering. Each needs a decision.',
			tone: 'bad',
			items: questionsStarting('CONFLICT')
		},
		{
			id: 'finished-card',
			title: 'Finished but still on the train',
			hint: 'Built, with nothing left on the checklist. Set its release to shipped.',
			tone: 'warn',
			items: product.filter((c) => !c.continuous && isBuilt(c) && !checklist(c).length).map((c) => ({ cap: c, text: c.name }))
		},
		{
			id: 'no-requirements',
			title: 'No requirements',
			hint: 'Not built, and nothing on the checklist says what done means. Needs its projects written.',
			tone: 'warn',
			items: product.filter((c) => !isBuilt(c) && !checklist(c).length).map((c) => ({ cap: c, text: c.name }))
		},
		{
			id: 'untriaged',
			title: 'Not triaged',
			hint: 'Cards on the extra tracks in no triage lane yet.',
			tone: 'info',
			items: other.filter((c) => !c.triage).map((c) => ({ cap: c, text: c.name }))
		},
		{ id: 'releases', title: 'Release train', hint: 'Every beta and GA release gets a changelog post, and no post runs ahead of its release.', tone: 'warn', items: releaseChecks },
		{
			id: 'scope-flags',
			title: 'Scope flags',
			hint: 'Open questions about scope, each needing a decision.',
			tone: 'warn',
			items: questionsStarting('SCOPE')
		},
		{
			id: 'unsourced',
			title: 'No evidence',
			hint: 'Cards on the extra tracks with nothing behind their status.',
			tone: 'warn',
			items: other.filter((c) => c.evidence.length === 0).map((c) => ({ cap: c, text: c.name }))
		},
		{
			id: 'undated',
			title: 'Undated',
			hint: 'No window yet. Placed by their target release, or listed as unscheduled.',
			tone: 'info',
			items: caps
				.filter((c) => ['due', 'unscheduled'].includes(placeOf(c, rm, today).type))
				.map((c) => ({ cap: c, text: `${c.name} — ${windowLabel(c)}` }))
		}
	];
}
