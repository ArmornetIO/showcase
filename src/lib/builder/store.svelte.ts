import { readJson, writeJson } from '$lib/storage.js';
import { REGISTRY_MAP } from './registry.js';
import type { BuilderTemplate } from './templates.js';
import type { TourStep } from '$lib/primitives/canvas/canvas-camera.js';

const STORAGE_KEY = 'armornet-builder-v2';
const LEGACY_KEY = 'armornet-builder-v1';
export const GRID = 20;

/** Undo depth. 100 steps is the doc's number and about a session's worth. */
const HISTORY_MAX = 100;
/** Edits sharing a coalesce key within this window collapse into one step. */
const COALESCE_MS = 600;
/** Offset a duplicate/paste lands at, so it never hides under its original. */
const CLONE_OFFSET = 20;

export interface CanvasItem {
	id: string;
	componentId: string;
	name?: string;
	x: number;
	y: number;
	w: number; // 0 = natural/auto
	h: number; // 0 = natural/auto
	props: Record<string, unknown>;
	zIndex: number;
	visible: boolean;
	locked: boolean;
	groupId?: string;
	/** CSS custom property overrides applied to this item's wrapper (from Theme Studio). */
	styleOverrides?: Record<string, string>;
}

export interface Group {
	id: string;
	name: string;
	visible: boolean;
	locked: boolean;
}

/** Viewport presets a frame can take. `custom` is whatever it was resized to. */
export const FRAME_PRESETS = {
	'desktop-1440': { label: 'Desktop 1440', w: 1440, h: 900 },
	'desktop-1280': { label: 'Desktop 1280', w: 1280, h: 800 },
	'tablet-768': { label: 'Tablet 768', w: 768, h: 1024 },
	'mobile-390': { label: 'Mobile 390', w: 390, h: 844 },
	custom: { label: 'Custom', w: 0, h: 0 }
} as const;

export type FramePreset = keyof typeof FRAME_PRESETS;

/**
 * A named bounded region standing in for a screen.
 *
 * Frames are NOT items: they sit in their own layer under everything, they are
 * never dropped from the palette, and membership is positional — an item is "in"
 * a frame when it sits inside its rect, so moving either one re-decides it. That
 * is deliberately weaker than a parent/child model: the alternative is
 * re-parenting on every drag, and the only thing that actually needs the
 * relationship is "move the frame, move its contents with it".
 */
export interface CanvasFrame {
	id: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
	preset: FramePreset;
	/** Clip content to the frame's bounds — a real viewport rather than a label. */
	clip: boolean;
	visible: boolean;
	locked: boolean;
}

/** How a cluster decides where its members sit. */
export type ClusterLayout = 'free' | 'stack';
export type StackDirection = 'vertical' | 'horizontal';

/**
 * A cluster — a bounded region that holds a composition together.
 *
 * Membership is positional, exactly as it is for a frame, and for the same
 * reason: re-parenting on every drag buys nothing that "is it inside the rect"
 * does not already answer. The difference is what a cluster DOES with its
 * members. A frame is an artboard that carries its contents when it moves; a
 * cluster also has an opinion about where inside it they belong.
 *
 * `free` keeps each member's own x/y and merely offers snap targets — the
 * padding box and every sibling's edges and centres — so a composition can be
 * aligned without being surrendered. `stack` takes the position over: members
 * flow along `direction` at a fixed `gap`, and the cluster resizes to fit.
 *
 * Both exist because they answer different questions. A generated template
 * arrives carrying real measured coordinates, and a stack would throw them away
 * on arrival; a hand-built strip of tiles wants the arrangement maintained for
 * it. The mode is per cluster, so neither has to win globally.
 */
export interface CanvasCluster {
	id: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
	layout: ClusterLayout;
	/** Only read in `stack`; kept across a mode flip so toggling is not lossy. */
	direction: StackDirection;
	/** Inset from the cluster's edge to its content box. */
	padding: number;
	/** Space between members in `stack`, and the spacing guide in `free`. */
	gap: number;
	visible: boolean;
	locked: boolean;
}

/**
 * What a plain left-drag does.
 *
 * `select` is the drawing-tool default: drag an item to move it, drag the
 * background to rubber-band. That leaves no gesture for panning, which is why
 * the canvas has always reserved middle-drag, space-drag and modifier-drag for
 * it — and why panning is the thing nobody finds. `pan` makes the ordinary drag
 * the ordinary thing instead, and is the reason the tool switch exists.
 */
export type CanvasTool = 'select' | 'pan';

/** An alignment line shown while dragging, in canvas coordinates. */
export interface SnapGuide {
	axis: 'x' | 'y';
	/** Position along `axis` — a vertical guide has an x, a horizontal one a y. */
	at: number;
	/** Extent along the other axis, so a guide spans only what it relates. */
	from: number;
	to: number;
	kind: 'padding' | 'edge' | 'center';
}

/** Line styles a connector can draw itself in. */
export type ConnectorStyle = 'solid' | 'dashed' | 'dotted';
export type ArrowHead = 'none' | 'arrow' | 'open';

/**
 * An arrow between two items (or two fixed points).
 *
 * Endpoints are stored as item ids wherever possible so the path re-routes when
 * either end moves — a connector pinned to coordinates is a drawing, not a
 * relationship, and goes stale the first time anything is nudged.
 */
export interface CanvasConnector {
	id: string;
	name?: string;
	fromId: string | { x: number; y: number };
	toId: string | { x: number; y: number };
	style: ConnectorStyle;
	color: string;
	label?: string;
	arrowHead: ArrowHead;
	visible: boolean;
	locked: boolean;
}

/**
 * One page's contents. Everything here is per-page; everything in
 * `BuilderSnapshot` outside `pages` is shared by all of them.
 *
 * The split is "what you drew" versus "how the workspace is set up": grid size,
 * canvas extent and saved tours are properties of the tool, and having them
 * differ per page would mean the same layout looks different depending on which
 * tab you drew it in.
 */
interface PageDoc {
	items: CanvasItem[];
	groups: Group[];
	frames: CanvasFrame[];
	clusters: CanvasCluster[];
	connectors: CanvasConnector[];
	nextZ: number;
	nextGroupN: number;
	nextFrameN: number;
	nextClusterN: number;
}

export interface BuilderPage {
	id: string;
	name: string;
}

/** The persisted document — everything a reload has to bring back. */
interface BuilderSnapshot {
	pages: BuilderPage[];
	activePageId: string;
	/** Contents by page id. The active page's entry is written on every save. */
	pageDocs: Record<string, PageDoc>;
	gridSize: number;
	gridVisible: boolean;
	snapToGrid: boolean;
	canvasW: number;
	canvasH: number;
	tours: Record<string, TourStep[]>;
}

/** A fresh blank page. A factory, not a shared constant: two pages handed the
 *  same arrays would be one page wearing two names the first time anything
 *  mutated in place. */
function emptyPage(): PageDoc {
	return {
		items: [],
		groups: [],
		frames: [],
		clusters: [],
		connectors: [],
		nextZ: 1,
		nextGroupN: 1,
		nextFrameN: 1,
		nextClusterN: 1
	};
}

const EMPTY_PAGE = emptyPage();

const FIRST_PAGE_ID = 'page-1';

const EMPTY: BuilderSnapshot = {
	pages: [{ id: FIRST_PAGE_ID, name: 'Page 1' }],
	activePageId: FIRST_PAGE_ID,
	pageDocs: { [FIRST_PAGE_ID]: EMPTY_PAGE },
	gridSize: GRID,
	gridVisible: true,
	snapToGrid: true,
	canvasW: 3200,
	canvasH: 2400,
	tours: {}
};

function snapTo(v: number, grid: number) {
	return Math.round(v / grid) * grid;
}

function uid() {
	return Math.random().toString(36).slice(2, 9);
}

/** Fill in a page's contents, defaulting fields that were added over time. */
function revivePage(parsed: unknown): PageDoc {
	const p = (parsed ?? {}) as Partial<PageDoc>;
	return {
		items: (p.items ?? []).map((item) => ({
			...item,
			visible: item.visible ?? true,
			locked: item.locked ?? false
		})),
		groups: p.groups ?? [],
		frames: p.frames ?? [],
		clusters: p.clusters ?? [],
		connectors: p.connectors ?? [],
		nextZ: p.nextZ ?? EMPTY_PAGE.nextZ,
		nextGroupN: p.nextGroupN ?? EMPTY_PAGE.nextGroupN,
		nextFrameN: p.nextFrameN ?? EMPTY_PAGE.nextFrameN,
		nextClusterN: p.nextClusterN ?? EMPTY_PAGE.nextClusterN
	};
}

/**
 * v1 and v2 stored ONE canvas at the top level; v3 stores a list of pages.
 * A stored document with no `pages` key is therefore a v2 document, and its
 * flat contents become the workspace's first page rather than being discarded —
 * the alternative is everyone losing their canvas on the upgrade.
 */
function revive(parsed: unknown): BuilderSnapshot {
	const p = (parsed ?? {}) as Partial<BuilderSnapshot> & Partial<PageDoc>;
	const settings = {
		gridSize: p.gridSize ?? EMPTY.gridSize,
		gridVisible: p.gridVisible ?? EMPTY.gridVisible,
		snapToGrid: p.snapToGrid ?? EMPTY.snapToGrid,
		canvasW: p.canvasW ?? EMPTY.canvasW,
		canvasH: p.canvasH ?? EMPTY.canvasH,
		tours: p.tours ?? EMPTY.tours
	};

	if (!p.pages?.length) {
		return {
			pages: [{ id: FIRST_PAGE_ID, name: 'Page 1' }],
			activePageId: FIRST_PAGE_ID,
			pageDocs: { [FIRST_PAGE_ID]: revivePage(p) },
			...settings
		};
	}

	const pageDocs: Record<string, PageDoc> = {};
	for (const page of p.pages) pageDocs[page.id] = revivePage(p.pageDocs?.[page.id]);
	const active = p.pages.some((pg) => pg.id === p.activePageId)
		? p.activePageId!
		: p.pages[0].id;
	return { pages: p.pages, activePageId: active, pageDocs, ...settings };
}

/**
 * The mockup builder's document: what is on the canvas, how it is grouped, what
 * is selected, and the canvas settings around it.
 *
 * Reads are properties; every mutation is a method that persists. Drag paths are
 * the deliberate exception — `setItemRect` and `setGroupPositions` fire on every
 * pointer move and would otherwise write to storage a hundred times a second, so
 * they skip persistence and the matching `snapItem`/`snapGroup` commits at the
 * end of the gesture.
 */
class BuilderStore {
	#items = $state<CanvasItem[]>([]);
	#groups = $state<Group[]>([]);
	#frames = $state<CanvasFrame[]>([]);
	#clusters = $state<CanvasCluster[]>([]);
	#connectors = $state<CanvasConnector[]>([]);
	#selectedId = $state<string | null>(null);
	#selectedGroupId = $state<string | null>(null);
	#selectedFrameId = $state<string | null>(null);
	#selectedClusterId = $state<string | null>(null);
	#selectedConnectorId = $state<string | null>(null);
	#multiSelectedIds = $state<string[]>([]);
	// Live only for the duration of a drag, and deliberately not part of PageDoc:
	// a guide is feedback about a gesture, not something the document contains.
	#guides = $state<SnapGuide[]>([]);
	// Not persisted either, and for the same kind of reason: which tool your hand
	// is on is a fact about right now, not about the drawing. Reopening the
	// builder stuck in pan mode would read as the canvas being broken.
	#tool = $state<CanvasTool>('select');
	#nextZ = $state(EMPTY_PAGE.nextZ);
	#nextGroupN = $state(EMPTY_PAGE.nextGroupN);
	#nextFrameN = $state(EMPTY_PAGE.nextFrameN);
	#nextClusterN = $state(EMPTY_PAGE.nextClusterN);
	#tours = $state<Record<string, TourStep[]>>({});

	// ── Pages ──────────────────────────────────────────────────────────────────
	// The fields above ARE the active page — the store keeps one page live and
	// the rest parked as serialised docs, rather than indexing every read through
	// `pages[active].items`. That keeps ~40 mutation methods untouched by the
	// existence of pages, and switching is the same load/save the history stack
	// already does.
	#pages = $state<BuilderPage[]>([{ id: FIRST_PAGE_ID, name: 'Page 1' }]);
	#activePageId = $state(FIRST_PAGE_ID);
	#parked: Record<string, PageDoc> = {};

	#gridSize = $state(EMPTY.gridSize);
	#gridVisible = $state(EMPTY.gridVisible);
	#snapToGrid = $state(EMPTY.snapToGrid);
	#canvasW = $state(EMPTY.canvasW);
	#canvasH = $state(EMPTY.canvasH);

	#hydrated = false;

	// ── History ────────────────────────────────────────────────────────────────
	// Snapshots, not deltas: every mutation already funnels through `#persist`,
	// so serialising the document there is the whole implementation, and a delta
	// log would need a matching inverse for each of ~25 mutations to buy memory
	// nobody is short of (100 canvases of a few dozen items is well under a MB).
	//
	// `#history` holds serialised documents oldest → newest and `#cursor` points
	// at the one on screen, so redo is simply "walk forward" and a fresh mutation
	// truncates whatever was ahead.
	#history: string[] = [];
	#cursor = $state(-1);
	#historyLen = $state(0);
	/** True while undo/redo is writing state back, so the write doesn't re-record. */
	#restoring = false;
	/** Coalescing: same key inside the window replaces the top entry. */
	#lastKey: string | null = null;
	#lastAt = 0;

	/** Items lifted by copy — a canvas-local clipboard, not the OS one. */
	#clipboard: CanvasItem[] = [];

	// ── Reads ──────────────────────────────────────────────────────────────────
	get items(): CanvasItem[] {
		return this.#items;
	}

	get groups(): Group[] {
		return this.#groups;
	}

	get frames(): CanvasFrame[] {
		return this.#frames;
	}

	get connectors(): CanvasConnector[] {
		return this.#connectors;
	}

	get selectedFrameId(): string | null {
		return this.#selectedFrameId;
	}

	get selectedFrame(): CanvasFrame | null {
		return this.#frames.find((f) => f.id === this.#selectedFrameId) ?? null;
	}

	get selectedConnectorId(): string | null {
		return this.#selectedConnectorId;
	}

	get selectedConnector(): CanvasConnector | null {
		return this.#connectors.find((c) => c.id === this.#selectedConnectorId) ?? null;
	}

	get selectedId(): string | null {
		return this.#selectedId;
	}

	get selectedGroupId(): string | null {
		return this.#selectedGroupId;
	}

	get multiSelectedIds(): string[] {
		return this.#multiSelectedIds;
	}

	readonly selected: CanvasItem | null = $derived(
		this.#items.find((i) => i.id === this.#selectedId) ?? null
	);

	readonly selectedGroup: Group | null = $derived(
		this.#groups.find((g) => g.id === this.#selectedGroupId) ?? null
	);

	readonly selectionMode:
		| 'none'
		| 'item'
		| 'group'
		| 'multi'
		| 'frame'
		| 'cluster'
		| 'connector' = $derived.by(() => {
		if (this.#multiSelectedIds.length >= 2) return 'multi';
		if (this.#selectedGroupId) return 'group';
		if (this.#selectedId) return 'item';
		if (this.#selectedFrameId) return 'frame';
		if (this.#selectedClusterId) return 'cluster';
		if (this.#selectedConnectorId) return 'connector';
		return 'none';
	});

	get gridSize(): number {
		return this.#gridSize;
	}

	get gridVisible(): boolean {
		return this.#gridVisible;
	}

	get snapToGrid(): boolean {
		return this.#snapToGrid;
	}

	get canvasW(): number {
		return this.#canvasW;
	}

	get canvasH(): number {
		return this.#canvasH;
	}

	get tours(): Record<string, TourStep[]> {
		return this.#tours;
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────────
	/**
	 * Restore the saved canvas. Call from the builder page on mount; idempotent.
	 * Reading storage at module scope is what this replaces — importing the store
	 * now costs nothing and needs no environment guard.
	 */
	hydrate(): void {
		if (this.#hydrated) return;
		this.#hydrated = true;

		// `null` means the key is absent (or unreadable), which is what makes the
		// v1 fallback safe: a v2 canvas the user emptied on purpose stays empty
		// instead of resurrecting whatever was there before the schema bump.
		const snapshot =
			readJson<BuilderSnapshot | null>(STORAGE_KEY, null, revive) ??
			readJson<BuilderSnapshot | null>(LEGACY_KEY, null, revive) ??
			EMPTY;

		this.#pages = snapshot.pages;
		this.#activePageId = snapshot.activePageId;
		this.#parked = { ...snapshot.pageDocs };
		this.#loadPage(snapshot.pageDocs[snapshot.activePageId] ?? emptyPage());
		this.#gridSize = snapshot.gridSize;
		this.#gridVisible = snapshot.gridVisible;
		this.#snapToGrid = snapshot.snapToGrid;
		this.#canvasW = snapshot.canvasW;
		this.#canvasH = snapshot.canvasH;
		this.#tours = snapshot.tours;
		this.#seedHistory();
	}

	/** The live page's contents, as a plain value. */
	#pageDoc(): PageDoc {
		return {
			items: this.#items,
			groups: this.#groups,
			frames: this.#frames,
			clusters: this.#clusters,
			connectors: this.#connectors,
			nextZ: this.#nextZ,
			nextGroupN: this.#nextGroupN,
			nextFrameN: this.#nextFrameN,
			nextClusterN: this.#nextClusterN
		};
	}

	#loadPage(doc: PageDoc): void {
		this.#items = doc.items;
		this.#groups = doc.groups;
		this.#frames = doc.frames;
		this.#clusters = doc.clusters;
		this.#connectors = doc.connectors;
		this.#nextZ = doc.nextZ;
		this.#nextGroupN = doc.nextGroupN;
		this.#nextFrameN = doc.nextFrameN;
		this.#nextClusterN = doc.nextClusterN;
	}

	#doc(): BuilderSnapshot {
		return {
			pages: this.#pages,
			activePageId: this.#activePageId,
			// The live page is authoritative over whatever is parked under its id.
			pageDocs: { ...this.#parked, [this.#activePageId]: this.#pageDoc() },
			gridSize: this.#gridSize,
			gridVisible: this.#gridVisible,
			snapToGrid: this.#snapToGrid,
			canvasW: this.#canvasW,
			canvasH: this.#canvasH,
			tours: this.#tours
		};
	}

	/**
	 * Save, and remember. `coalesceKey` folds a burst of the same edit into one
	 * undo step — typing a label is one keystroke per `updateProp` call, and an
	 * undo stack that walks back through "Labe", "Lab", "La" is a stack nobody
	 * can use. Omit it for discrete actions (add, delete, group), where every
	 * call deserves its own step.
	 */
	#persist(coalesceKey?: string): void {
		writeJson(STORAGE_KEY, this.#doc() satisfies BuilderSnapshot);
		if (this.#restoring) return;

		// History records the PAGE, not the workspace: undo should walk back
		// through what you drew on this page, not silently switch tabs or revert
		// a change you made on another one. Switching pages reseeds it.
		const json = JSON.stringify(this.#pageDoc());
		if (this.#history[this.#cursor] === json) return;

		const now = Date.now();
		const coalesce =
			coalesceKey !== undefined &&
			coalesceKey === this.#lastKey &&
			now - this.#lastAt < COALESCE_MS &&
			this.#cursor >= 0;

		if (coalesce) {
			this.#history[this.#cursor] = json;
		} else {
			this.#history = [...this.#history.slice(0, this.#cursor + 1), json];
			if (this.#history.length > HISTORY_MAX) this.#history = this.#history.slice(-HISTORY_MAX);
			this.#cursor = this.#history.length - 1;
			this.#historyLen = this.#history.length;
		}
		this.#lastKey = coalesceKey ?? null;
		this.#lastAt = now;
	}

	/** Seed the stack with the page as loaded, so the first undo has a floor. */
	#seedHistory(): void {
		this.#history = [JSON.stringify(this.#pageDoc())];
		this.#cursor = 0;
		this.#historyLen = 1;
		this.#lastKey = null;
	}

	get canUndo(): boolean {
		return this.#cursor > 0;
	}

	get canRedo(): boolean {
		return this.#cursor < this.#historyLen - 1;
	}

	undo(): void {
		if (!this.canUndo) return;
		this.#cursor -= 1;
		this.#restore(this.#history[this.#cursor]);
	}

	redo(): void {
		if (!this.canRedo) return;
		this.#cursor += 1;
		this.#restore(this.#history[this.#cursor]);
	}

	#restore(json: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(json);
		} catch {
			return;
		}
		this.#restoring = true;
		this.#loadPage(revivePage(parsed));
		// Selection is not part of the document, so a step that deleted the
		// selected item leaves a dangling id behind. Drop what no longer exists
		// rather than leaving the props panel pointed at a ghost.
		const ids = new Set(this.#items.map((i) => i.id));
		if (this.#selectedId && !ids.has(this.#selectedId)) this.#selectedId = null;
		this.#multiSelectedIds = this.#multiSelectedIds.filter((id) => ids.has(id));
		const groupIds = new Set(this.#groups.map((g) => g.id));
		if (this.#selectedGroupId && !groupIds.has(this.#selectedGroupId)) this.#selectedGroupId = null;
		if (this.#selectedFrameId && !this.#frames.some((f) => f.id === this.#selectedFrameId))
			this.#selectedFrameId = null;
		if (this.#selectedClusterId && !this.#clusters.some((c) => c.id === this.#selectedClusterId))
			this.#selectedClusterId = null;
		if (
			this.#selectedConnectorId &&
			!this.#connectors.some((c) => c.id === this.#selectedConnectorId)
		)
			this.#selectedConnectorId = null;
		this.#persist();
		this.#restoring = false;
		this.#lastKey = null;
	}

	// ── Templates ──────────────────────────────────────────────────────────────
	/**
	 * Place a template's contents at a point, as ordinary items.
	 *
	 * They land grouped, under the template's name: the group is what makes a
	 * dropped layout one thing you can move, and it is also the only trace the
	 * template leaves — there is no instance, no link, and nothing to detach.
	 * Ungroup it and the arrangement is simply yours.
	 */
	/**
	 * Drop a template onto the canvas.
	 *
	 * Returns the world-space box it occupies — including its frame, which is
	 * usually the biggest part of it — so the caller can put the camera on it.
	 * Fitting is the caller's job rather than the store's: the store has no idea
	 * how much of the viewport the panels are covering, and a document that moves
	 * the camera is a document that fights whoever else is moving it.
	 */
	applyTemplate(
		template: BuilderTemplate,
		atX: number,
		atY: number
	): { minX: number; minY: number; maxX: number; maxY: number } | null {
		const g = this.#gridSize;
		const originX = Math.max(0, snapTo(atX, g));
		const originY = Math.max(0, snapTo(atY, g));

		// A framed template puts its contents inside the frame, so the coordinates
		// the template author wrote are relative to the frame's own top-left.
		let offsetX = originX;
		let offsetY = originY;
		// The frame is part of what got placed, and usually the largest part — a
		// fit that only saw the items would crop the artboard they sit on.
		let frameBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
		if (template.frame) {
			const frame = this.addFrame(template.frame.preset, originX, originY);
			if (template.frame.name) this.updateFrame(frame.id, { name: template.frame.name });
			offsetX = frame.x;
			offsetY = frame.y;
			frameBox = {
				minX: frame.x,
				minY: frame.y,
				maxX: frame.x + frame.w,
				maxY: frame.y + frame.h
			};
		}

		const placed: CanvasItem[] = [];
		for (const spec of template.items) {
			const meta = REGISTRY_MAP.get(spec.componentId);
			if (!meta) continue;
			placed.push({
				id: uid(),
				componentId: spec.componentId,
				x: Math.max(0, snapTo(offsetX + spec.x, g)),
				y: Math.max(0, snapTo(offsetY + spec.y, g)),
				w: spec.w ?? meta.defaultW,
				h: spec.h ?? meta.defaultH,
				props: {
					...Object.fromEntries(Object.entries(meta.props).map(([k, d]) => [k, d.default])),
					...spec.props
				},
				zIndex: this.#nextZ++,
				visible: true,
				locked: false
			});
		}
		if (!placed.length) return frameBox;

		/** The frame, if there is one, unioned with whatever was laid on it. */
		const box = (x: number, y: number, w: number, h: number) => ({
			minX: Math.min(frameBox?.minX ?? x, x),
			minY: Math.min(frameBox?.minY ?? y, y),
			maxX: Math.max(frameBox?.maxX ?? x + w, x + w),
			maxY: Math.max(frameBox?.maxY ?? y + h, y + h)
		});

		// A template arrives as a composition, not a pile, so it lands inside a
		// cluster by default — that is what makes the arrangement survive being
		// nudged. `free`, because the coordinates were authored (or measured) and
		// a stack would discard them on arrival; the cluster is here to hold the
		// layout together, not to invent a new one.
		//
		// A clustered template is deliberately NOT also grouped. Both bind the same
		// items together, and a group binds them harder: dragging one member moves
		// the whole group, which is exactly the gesture the cluster exists to make
		// useful. Doing both means the snapping can only be reached by ungrouping
		// first, so the cluster replaces the group rather than joining it.
		if (template.cluster === false) {
			const group: Group = {
				id: uid(),
				name: template.name,
				visible: true,
				locked: false
			};
			this.#groups = [...this.#groups, group];
			this.#items = [...this.#items, ...placed.map((i) => ({ ...i, groupId: group.id }))];
			this.selectGroup(group.id);
			this.#persist();
			const l = Math.min(...placed.map((i) => i.x));
			const t = Math.min(...placed.map((i) => i.y));
			const r = Math.max(...placed.map((i) => i.x + (i.w || this.#extent(i).w)));
			const bm = Math.max(...placed.map((i) => i.y + (i.h || this.#extent(i).h)));
			return box(l, t, r - l, bm - t);
		}

		this.#items = [...this.#items, ...placed];
		const spec = template.cluster ?? {};
		const pad = spec.padding ?? 20;
		const left = Math.min(...placed.map((i) => i.x));
		const top = Math.min(...placed.map((i) => i.y));
		const right = Math.max(...placed.map((i) => i.x + (i.w || this.#extent(i).w)));
		const bottom = Math.max(...placed.map((i) => i.y + (i.h || this.#extent(i).h)));
		const cluster = this.addCluster(
			left - pad,
			top - pad,
			right - left + pad * 2,
			bottom - top + pad * 2
		);
		this.updateCluster(cluster.id, {
			name: template.name,
			padding: pad,
			gap: spec.gap ?? 20,
			layout: spec.layout ?? 'free'
		});
		// addCluster already selected it, which is the right selection to land on:
		// the thing you just placed is the cluster, not any one component in it.
		this.#persist();
		const c = this.#clusters.find((cl) => cl.id === cluster.id) ?? cluster;
		return box(c.x, c.y, c.w, c.h);
	}

	// ── Pages ──────────────────────────────────────────────────────────────────
	get pages(): BuilderPage[] {
		return this.#pages;
	}

	get activePageId(): string {
		return this.#activePageId;
	}

	readonly activePage: BuilderPage | null = $derived(
		this.#pages.find((p) => p.id === this.#activePageId) ?? null
	);

	/** How many items each page holds, for the tab strip's counts. Reads the
	 *  live page for the active tab and the parked doc for the others. */
	pageItemCount(id: string): number {
		if (id === this.#activePageId) return this.#items.length;
		return this.#parked[id]?.items.length ?? 0;
	}

	addPage(name?: string): BuilderPage {
		const page: BuilderPage = { id: uid(), name: name || `Page ${this.#pages.length + 1}` };
		this.#pages = [...this.#pages, page];
		this.#parked[page.id] = emptyPage();
		this.switchPage(page.id);
		return page;
	}

	/** Copy a page and everything on it. Ids are regenerated so the copy is its
	 *  own document — sharing item ids across pages would make connectors and
	 *  selection ambiguous the moment you switched. */
	duplicatePage(id: string): BuilderPage | null {
		const source = this.#pages.find((p) => p.id === id);
		if (!source) return null;
		const doc = id === this.#activePageId ? this.#pageDoc() : this.#parked[id];
		if (!doc) return null;

		const itemIds = new Map<string, string>();
		const groupIds = new Map<string, string>();
		for (const item of doc.items) itemIds.set(item.id, uid());
		for (const group of doc.groups) groupIds.set(group.id, uid());

		const copy: PageDoc = {
			items: doc.items.map((i) => ({
				...i,
				id: itemIds.get(i.id)!,
				props: { ...i.props },
				groupId: i.groupId ? groupIds.get(i.groupId) : undefined
			})),
			groups: doc.groups.map((g) => ({ ...g, id: groupIds.get(g.id)! })),
			frames: doc.frames.map((f) => ({ ...f, id: uid() })),
			// Cluster membership is positional, so the copies need no id remapping —
			// the copied items land inside the copied rects by construction.
			clusters: doc.clusters.map((c) => ({ ...c, id: uid() })),
			connectors: doc.connectors
				.map((c) => ({
					...c,
					id: uid(),
					fromId: typeof c.fromId === 'string' ? (itemIds.get(c.fromId) ?? c.fromId) : c.fromId,
					toId: typeof c.toId === 'string' ? (itemIds.get(c.toId) ?? c.toId) : c.toId
				}))
				// A connector whose endpoint didn't come across would dangle.
				.filter(
					(c) =>
						(typeof c.fromId !== 'string' || doc.items.some((i) => itemIds.get(i.id) === c.fromId)) &&
						(typeof c.toId !== 'string' || doc.items.some((i) => itemIds.get(i.id) === c.toId))
				),
			nextZ: doc.nextZ,
			nextGroupN: doc.nextGroupN,
			nextFrameN: doc.nextFrameN,
			nextClusterN: doc.nextClusterN
		};

		const page: BuilderPage = { id: uid(), name: `${source.name} copy` };
		const at = this.#pages.findIndex((p) => p.id === id) + 1;
		this.#pages = [...this.#pages.slice(0, at), page, ...this.#pages.slice(at)];
		this.#parked[page.id] = copy;
		this.switchPage(page.id);
		return page;
	}

	renamePage(id: string, name: string): void {
		this.#pages = this.#pages.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
		this.#persist(`page:${id}`);
	}

	/**
	 * Park the live page, bring up another. Undo history is per page and is
	 * reseeded here: an undo stack that spanned pages would let ⌘Z change a page
	 * you are not looking at.
	 */
	switchPage(id: string): void {
		if (!this.#pages.some((p) => p.id === id)) return;
		if (id === this.#activePageId) return;
		this.#parked[this.#activePageId] = this.#pageDoc();
		this.#activePageId = id;
		this.#loadPage(this.#parked[id] ?? emptyPage());
		this.clearSelection();
		this.#persist();
		this.#seedHistory();
	}

	/** The last page is never deleted — a workspace with no page has nowhere to
	 *  draw, and "delete then re-add" is a worse way to say "clear". */
	deletePage(id: string): void {
		if (this.#pages.length <= 1) return;
		const at = this.#pages.findIndex((p) => p.id === id);
		if (at === -1) return;
		this.#pages = this.#pages.filter((p) => p.id !== id);
		delete this.#parked[id];
		if (id === this.#activePageId) {
			const next = this.#pages[Math.min(at, this.#pages.length - 1)];
			this.#activePageId = next.id;
			this.#loadPage(this.#parked[next.id] ?? emptyPage());
			this.clearSelection();
			this.#seedHistory();
		}
		this.#persist();
	}

	// ── Canvas settings ────────────────────────────────────────────────────────
	setGridSize(v: number): void {
		this.#gridSize = Math.max(4, Math.min(80, v));
		this.#persist();
	}

	setGridVisible(v: boolean): void {
		this.#gridVisible = v;
		this.#persist();
	}

	setSnapToGrid(v: boolean): void {
		this.#snapToGrid = v;
		this.#persist();
	}

	setCanvasSize(w: number, h: number): void {
		this.#canvasW = Math.max(400, w);
		this.#canvasH = Math.max(400, h);
		this.#persist();
	}

	// ── Item CRUD ──────────────────────────────────────────────────────────────
	addItem(componentId: string, rawX: number, rawY: number): void {
		const meta = REGISTRY_MAP.get(componentId);
		if (!meta) return;
		const g = this.#gridSize;
		const item: CanvasItem = {
			id: uid(),
			componentId,
			x: snapTo(Math.max(0, rawX), g),
			y: snapTo(Math.max(0, rawY), g),
			w: meta.defaultW,
			h: meta.defaultH,
			props: Object.fromEntries(Object.entries(meta.props).map(([k, d]) => [k, d.default])),
			zIndex: this.#nextZ++,
			visible: true,
			locked: false
		};
		this.#items = [...this.#items, item];
		this.select(item.id);
		this.#persist();
	}

	/**
	 * Place a dropped image. Its own method rather than `addItem` + a prop write
	 * because an image arrives already knowing its source and its natural
	 * aspect — two facts the registry defaults cannot supply, and writing them
	 * afterwards would put a source-less placeholder in the undo stack first.
	 *
	 * `name` is the filename, which is the only human-readable handle the layers
	 * panel will ever have for it.
	 */
	addImage(src: string, name: string, rawX: number, rawY: number, w: number, h: number): void {
		const meta = REGISTRY_MAP.get('Image');
		if (!meta) return;
		const g = this.#gridSize;
		const item: CanvasItem = {
			id: uid(),
			componentId: 'Image',
			name,
			x: snapTo(Math.max(0, rawX), g),
			y: snapTo(Math.max(0, rawY), g),
			w,
			h,
			props: {
				...Object.fromEntries(Object.entries(meta.props).map(([k, d]) => [k, d.default])),
				src,
				alt: name
			},
			zIndex: this.#nextZ++,
			visible: true,
			locked: false
		};
		this.#items = [...this.#items, item];
		this.select(item.id);
		this.#persist();
	}

	/** Update raw position/size during drag — does NOT snap or persist. */
	setItemRect(id: string, x: number, y: number, w: number, h: number): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? { ...item, x: Math.max(0, x), y: Math.max(0, y), w, h } : item
		);
	}

	/** Snap to grid and persist — call on drag/resize end. */
	snapItem(id: string): void {
		// An axis that just aligned to a guide keeps that alignment: rounding it to
		// the grid afterwards is what makes a snap visibly not take, and the guide
		// is the more specific intent of the two.
		const held = new Set(this.#guides.map((g) => g.axis));
		this.#items = this.#items.map((item) =>
			item.id === id ? this.#snapped(item, held) : item
		);
		this.#guides = [];
		// A member landing in a stack decides its order by where it was dropped.
		const cluster = this.#clusters.find(
			(c) => c.layout === 'stack' && this.clusterMembers(c.id).some((i) => i.id === id)
		);
		if (cluster) this.#reflow(cluster.id);
		this.#persist();
	}

	/** Snap all group members to grid and persist. */
	snapGroup(groupId: string): void {
		this.#items = this.#items.map((item) =>
			item.groupId === groupId ? this.#snapped(item) : item
		);
		this.#persist();
	}

	#snapped(item: CanvasItem, held?: Set<'x' | 'y'>): CanvasItem {
		const g = this.#gridSize;
		return {
			...item,
			x: held?.has('x') ? Math.max(0, item.x) : snapTo(Math.max(0, item.x), g),
			y: held?.has('y') ? Math.max(0, item.y) : snapTo(Math.max(0, item.y), g),
			// 0 means "size yourself", so it must survive the snap untouched.
			w: item.w > 0 ? Math.max(g * 2, snapTo(item.w, g)) : 0,
			h: item.h > 0 ? Math.max(g, snapTo(item.h, g)) : 0
		};
	}

	/** Move all group members by origPositions + delta. Does not persist (call snapGroup after). */
	setGroupPositions(
		origPositions: { id: string; x: number; y: number }[],
		dx: number,
		dy: number
	): void {
		this.#items = this.#items.map((item) => {
			const orig = origPositions.find((p) => p.id === item.id);
			if (!orig) return item;
			return { ...item, x: Math.max(0, orig.x + dx), y: Math.max(0, orig.y + dy) };
		});
	}

	updateProp(id: string, key: string, value: unknown): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? { ...item, props: { ...item.props, [key]: value } } : item
		);
		this.#persist(`prop:${id}:${key}`);
	}

	setItemProps(id: string, props: Record<string, unknown>): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? { ...item, props: { ...item.props, ...props } } : item
		);
		this.#persist(`props:${id}`);
	}

	setStyleOverrides(id: string, overrides: Record<string, string>): void {
		this.#items = this.#items.map((item) =>
			item.id === id
				? {
						...item,
						styleOverrides: Object.keys(overrides).length ? overrides : undefined
					}
				: item
		);
		this.#persist(`style:${id}`);
	}

	renameItem(id: string, name: string): void {
		this.#items = this.#items.map((i) =>
			i.id === id ? { ...i, name: name.trim() || undefined } : i
		);
		this.#persist(`rename:${id}`);
	}

	deleteItem(id: string): void {
		this.deleteItems([id]);
	}

	deleteItems(ids: string[]): void {
		this.#items = this.#items.filter((i) => !ids.includes(i.id));
		// A connector whose endpoint is gone has nothing to route between, so it
		// goes with it rather than snapping back to the origin.
		this.#connectors = this.#connectors.filter(
			(c) =>
				!(typeof c.fromId === 'string' && ids.includes(c.fromId)) &&
				!(typeof c.toId === 'string' && ids.includes(c.toId))
		);
		if (this.#selectedId && ids.includes(this.#selectedId)) this.#selectedId = null;
		this.#multiSelectedIds = this.#multiSelectedIds.filter((i) => !ids.includes(i));
		this.#persist();
	}

	/** Whatever the current selection means: one item, a multi-selection, or
	 *  every member of the selected group. The three selection modes all end up
	 *  here so callers (shortcuts, context menu, toolbar) don't each re-derive
	 *  it and disagree at the edges. */
	selectionItems(): CanvasItem[] {
		if (this.#multiSelectedIds.length) {
			const set = new Set(this.#multiSelectedIds);
			return this.#items.filter((i) => set.has(i.id));
		}
		if (this.#selectedGroupId) {
			return this.#items.filter((i) => i.groupId === this.#selectedGroupId);
		}
		if (this.#selectedId) {
			const item = this.#items.find((i) => i.id === this.#selectedId);
			return item ? [item] : [];
		}
		return [];
	}

	/**
	 * Clone items with fresh ids, offset so the copy is visibly its own thing.
	 * A cloned set that spanned groups keeps its grouping by remapping group ids
	 * to NEW groups — pasting into the original group would silently grow it,
	 * which is not what "duplicate" means anywhere else.
	 */
	#clone(source: CanvasItem[], dx: number, dy: number): CanvasItem[] {
		const groupMap = new Map<string, string>();
		for (const item of source) {
			if (item.groupId && !groupMap.has(item.groupId)) {
				const origin = this.#groups.find((g) => g.id === item.groupId);
				const id = uid();
				groupMap.set(item.groupId, id);
				this.#groups = [
					...this.#groups,
					{
						id,
						name: origin ? `${origin.name} copy` : `Group ${this.#nextGroupN++}`,
						visible: origin?.visible ?? true,
						locked: false
					}
				];
			}
		}
		return source.map((item) => ({
			...item,
			id: uid(),
			props: { ...item.props },
			styleOverrides: item.styleOverrides ? { ...item.styleOverrides } : undefined,
			groupId: item.groupId ? groupMap.get(item.groupId) : undefined,
			x: Math.max(0, item.x + dx),
			y: Math.max(0, item.y + dy),
			zIndex: this.#nextZ++,
			locked: false
		}));
	}

	/** Duplicate the current selection in place, and select the copy — the copy
	 *  is what you want to move next, and leaving the original selected makes
	 *  the second Cmd+D duplicate the original again. */
	duplicateSelection(): void {
		const source = this.selectionItems();
		if (!source.length) return;
		const clones = this.#clone(source, CLONE_OFFSET, CLONE_OFFSET);
		this.#items = [...this.#items, ...clones];
		this.#selectAfterClone(clones);
		this.#persist();
	}

	copySelection(): void {
		const source = this.selectionItems();
		if (!source.length) return;
		// Snapshot by value: the clipboard must survive edits (and deletion) of
		// what it was taken from.
		this.#clipboard = source.map((i) => ({ ...i, props: { ...i.props } }));
	}

	get hasClipboard(): boolean {
		return this.#clipboard.length > 0;
	}

	paste(): void {
		if (!this.#clipboard.length) return;
		const clones = this.#clone(this.#clipboard, CLONE_OFFSET, CLONE_OFFSET);
		this.#items = [...this.#items, ...clones];
		// Successive pastes step further out rather than stacking on one spot.
		this.#clipboard = this.#clipboard.map((i) => ({
			...i,
			x: i.x + CLONE_OFFSET,
			y: i.y + CLONE_OFFSET
		}));
		this.#selectAfterClone(clones);
		this.#persist();
	}

	#selectAfterClone(clones: CanvasItem[]): void {
		if (clones.length === 1) {
			this.#selectedId = clones[0].id;
			this.#selectedGroupId = null;
			this.#multiSelectedIds = [];
		} else {
			this.#selectedId = null;
			this.#selectedGroupId = null;
			this.#multiSelectedIds = clones.map((c) => c.id);
		}
	}

	// ── Frames (artboards) ─────────────────────────────────────────────────────
	addFrame(preset: FramePreset = 'desktop-1440', x = 0, y = 0): CanvasFrame {
		const spec = FRAME_PRESETS[preset];
		const frame: CanvasFrame = {
			id: uid(),
			name: `${spec.label} ${this.#nextFrameN++}`,
			x: Math.max(0, snapTo(x, this.#gridSize)),
			y: Math.max(0, snapTo(y, this.#gridSize)),
			w: spec.w || 1200,
			h: spec.h || 800,
			preset,
			clip: false,
			visible: true,
			locked: false
		};
		this.#frames = [...this.#frames, frame];
		this.selectFrame(frame.id);
		this.#persist();
		return frame;
	}

	updateFrame(id: string, patch: Partial<Omit<CanvasFrame, 'id'>>): void {
		this.#frames = this.#frames.map((f) => (f.id === id ? { ...f, ...patch } : f));
		this.#persist(`frame:${id}`);
	}

	/** Switching preset resizes; `custom` keeps whatever size it has. */
	setFramePreset(id: string, preset: FramePreset): void {
		const spec = FRAME_PRESETS[preset];
		this.updateFrame(id, preset === 'custom' ? { preset } : { preset, w: spec.w, h: spec.h });
	}

	/** Items whose top-left sits inside the frame. Membership is positional —
	 *  see `CanvasFrame` for why there is no parent pointer. */
	frameMembers(id: string): CanvasItem[] {
		const f = this.#frames.find((fr) => fr.id === id);
		if (!f) return [];
		return this.#items.filter(
			(i) => i.x >= f.x && i.y >= f.y && i.x <= f.x + f.w && i.y <= f.y + f.h
		);
	}

	/** Move a frame and carry its contents. Does not persist — the drag's
	 *  `snapFrame` commits, matching how item drags work. */
	setFrameRect(id: string, x: number, y: number, w: number, h: number): void {
		const frame = this.#frames.find((f) => f.id === id);
		if (!frame) return;
		const dx = x - frame.x;
		const dy = y - frame.y;
		const moving = dx !== 0 || dy !== 0;
		const members = moving ? new Set(this.frameMembers(id).map((i) => i.id)) : null;
		this.#frames = this.#frames.map((f) =>
			f.id === id
				? { ...f, x: Math.max(0, x), y: Math.max(0, y), w: Math.max(120, w), h: Math.max(80, h) }
				: f
		);
		if (members?.size) {
			this.#items = this.#items.map((i) =>
				members.has(i.id) && !i.locked
					? { ...i, x: Math.max(0, i.x + dx), y: Math.max(0, i.y + dy) }
					: i
			);
		}
	}

	snapFrame(id: string): void {
		const g = this.#gridSize;
		this.#frames = this.#frames.map((f) =>
			f.id === id
				? {
						...f,
						x: snapTo(f.x, g),
						y: snapTo(f.y, g),
						// Position snaps, but a named viewport's SIZE does not: 390×844
						// rounded to the grid is 400×840, and a frame labelled
						// "Mobile 390" that is 400 wide is lying about the only thing
						// it exists to tell you. Custom frames snap both.
						w: f.preset === 'custom' ? Math.max(g * 4, snapTo(f.w, g)) : f.w,
						h: f.preset === 'custom' ? Math.max(g * 4, snapTo(f.h, g)) : f.h
					}
				: f
		);
		// Only what travelled with the frame re-snaps — snapping the whole canvas
		// because one frame moved would quietly re-align items nobody touched.
		const members = new Set(this.frameMembers(id).map((i) => i.id));
		this.#items = this.#items.map((i) => (members.has(i.id) ? this.#snapped(i) : i));
		this.#persist();
	}

	deleteFrame(id: string, withContents = false): void {
		if (withContents) {
			const ids = this.frameMembers(id).map((i) => i.id);
			this.#items = this.#items.filter((i) => !ids.includes(i.id));
		}
		this.#frames = this.#frames.filter((f) => f.id !== id);
		if (this.#selectedFrameId === id) this.#selectedFrameId = null;
		this.#persist();
	}

	toggleFrameVisible(id: string): void {
		this.#frames = this.#frames.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f));
		this.#persist();
	}

	toggleFrameLocked(id: string): void {
		this.#frames = this.#frames.map((f) => (f.id === id ? { ...f, locked: !f.locked } : f));
		this.#persist();
	}

	selectFrame(id: string | null): void {
		this.#selectedFrameId = id;
		this.#selectedClusterId = null;
		this.#selectedConnectorId = null;
		this.#selectedId = null;
		this.#selectedGroupId = null;
		this.#multiSelectedIds = [];
	}

	// ── Clusters ───────────────────────────────────────────────────────────────

	get clusters(): CanvasCluster[] {
		return this.#clusters;
	}

	get selectedClusterId(): string | null {
		return this.#selectedClusterId;
	}

	get selectedCluster(): CanvasCluster | null {
		return this.#clusters.find((c) => c.id === this.#selectedClusterId) ?? null;
	}

	/** Alignment lines for the drag in progress. Empty when nothing is dragging. */
	get guides(): SnapGuide[] {
		return this.#guides;
	}

	get tool(): CanvasTool {
		return this.#tool;
	}

	setTool(tool: CanvasTool): void {
		this.#tool = tool;
		// Nothing can be mid-drag across a tool change, and a guide left on screen
		// would be pointing at a gesture that no longer exists.
		this.#guides = [];
	}

	clusterMembers(id: string): CanvasItem[] {
		const c = this.#clusters.find((cl) => cl.id === id);
		if (!c) return [];
		return this.#items.filter(
			(i) => i.x >= c.x && i.y >= c.y && i.x <= c.x + c.w && i.y <= c.y + c.h
		);
	}

	/** The smallest cluster containing a point — smallest so a nested cluster
	 *  wins over the one it sits in, which is the one you meant. */
	clusterAt(x: number, y: number): CanvasCluster | null {
		let best: CanvasCluster | null = null;
		for (const c of this.#clusters) {
			if (!c.visible || c.locked) continue;
			if (x < c.x || y < c.y || x > c.x + c.w || y > c.y + c.h) continue;
			if (!best || c.w * c.h < best.w * best.h) best = c;
		}
		return best;
	}

	addCluster(x = 0, y = 0, w = 480, h = 320): CanvasCluster {
		const cluster: CanvasCluster = {
			id: uid(),
			name: `Cluster ${this.#nextClusterN++}`,
			x: snapTo(Math.max(0, x), this.#gridSize),
			y: snapTo(Math.max(0, y), this.#gridSize),
			w,
			h,
			layout: 'free',
			direction: 'vertical',
			padding: 20,
			gap: 20,
			visible: true,
			locked: false
		};
		this.#clusters = [...this.#clusters, cluster];
		this.selectCluster(cluster.id);
		this.#persist();
		return cluster;
	}

	updateCluster(id: string, patch: Partial<CanvasCluster>): void {
		this.#clusters = this.#clusters.map((c) => (c.id === id ? { ...c, ...patch } : c));
		// Switching to `stack`, or changing what a stack means, has to take effect
		// now — a layout you can set but not see is indistinguishable from one
		// that did not apply.
		if (this.#clusters.find((c) => c.id === id)?.layout === 'stack') this.#reflow(id);
		this.#persist();
	}

	/** Move a cluster and carry its contents, mirroring `setFrameRect`. Does not
	 *  persist — the drag's `snapCluster` commits. */
	setClusterRect(id: string, x: number, y: number, w: number, h: number): void {
		const cluster = this.#clusters.find((c) => c.id === id);
		if (!cluster) return;
		const dx = x - cluster.x;
		const dy = y - cluster.y;
		const members = dx !== 0 || dy !== 0 ? new Set(this.clusterMembers(id).map((i) => i.id)) : null;
		this.#clusters = this.#clusters.map((c) =>
			c.id === id
				? { ...c, x: Math.max(0, x), y: Math.max(0, y), w: Math.max(120, w), h: Math.max(80, h) }
				: c
		);
		if (members?.size) {
			this.#items = this.#items.map((i) =>
				members.has(i.id) && !i.locked
					? { ...i, x: Math.max(0, i.x + dx), y: Math.max(0, i.y + dy) }
					: i
			);
		}
	}

	snapCluster(id: string): void {
		const g = this.#gridSize;
		this.#clusters = this.#clusters.map((c) =>
			c.id === id
				? { ...c, x: snapTo(c.x, g), y: snapTo(c.y, g), w: snapTo(c.w, g), h: snapTo(c.h, g) }
				: c
		);
		const cluster = this.#clusters.find((c) => c.id === id);
		if (cluster?.layout === 'stack') {
			this.#reflow(id);
		} else {
			// Only what travelled re-snaps; snapping the canvas because one cluster
			// moved would re-align items nobody touched.
			const members = new Set(this.clusterMembers(id).map((i) => i.id));
			this.#items = this.#items.map((i) => (members.has(i.id) ? this.#snapped(i) : i));
		}
		this.#persist();
	}

	deleteCluster(id: string, withContents = false): void {
		if (withContents) {
			const ids = new Set(this.clusterMembers(id).map((i) => i.id));
			this.#items = this.#items.filter((i) => !ids.has(i.id));
		}
		this.#clusters = this.#clusters.filter((c) => c.id !== id);
		if (this.#selectedClusterId === id) this.#selectedClusterId = null;
		this.#persist();
	}

	toggleClusterVisible(id: string): void {
		this.#clusters = this.#clusters.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c));
		this.#persist();
	}

	toggleClusterLocked(id: string): void {
		this.#clusters = this.#clusters.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c));
		this.#persist();
	}

	selectCluster(id: string | null): void {
		this.#selectedClusterId = id;
		this.#selectedFrameId = null;
		this.#selectedConnectorId = null;
		this.#selectedId = null;
		this.#selectedGroupId = null;
		this.#multiSelectedIds = [];
	}

	/** Re-run a stacked cluster's layout. Called wherever its membership,
	 *  geometry or layout settings can have changed. */
	reflowCluster(id: string): void {
		this.#reflow(id);
		this.#persist();
	}

	/**
	 * A rendered size for layout maths. `0` means "size yourself", which is
	 * unknowable outside the DOM — the registry's placement default is the same
	 * number the palette would have dropped it at, so it is the honest stand-in.
	 *
	 * `||` and not `??`: a registry default of `0` means the component sizes
	 * itself there too, so it is exactly as unusable as a missing one. With `??`
	 * a self-sizing component stacks at zero height and its neighbours pile up
	 * one gap apart, which looks like the layout ignoring the items entirely.
	 */
	#extent(item: CanvasItem): { w: number; h: number } {
		const meta = REGISTRY_MAP.get(item.componentId);
		return {
			w: item.w > 0 ? item.w : meta?.defaultW || 200,
			h: item.h > 0 ? item.h : meta?.defaultH || 80
		};
	}

	#reflow(id: string): void {
		const c = this.#clusters.find((cl) => cl.id === id);
		if (!c || c.layout !== 'stack') return;
		const vertical = c.direction === 'vertical';
		// Current position decides the order, so dragging a member past its
		// neighbour reorders the stack — the only reordering gesture there is.
		const members = this.clusterMembers(id)
			.filter((i) => !i.locked)
			.sort((a, b) => (vertical ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));
		if (!members.length) return;

		const placed = new Map<string, { x: number; y: number }>();
		let cursor = c.padding;
		let cross = 0;
		for (const m of members) {
			const { w, h } = this.#extent(m);
			placed.set(m.id, {
				x: vertical ? c.x + c.padding : c.x + cursor,
				y: vertical ? c.y + cursor : c.y + c.padding
			});
			cursor += (vertical ? h : w) + c.gap;
			cross = Math.max(cross, vertical ? w : h);
		}
		const along = cursor - c.gap + c.padding;
		this.#items = this.#items.map((i) => {
			const p = placed.get(i.id);
			return p ? { ...i, x: p.x, y: p.y } : i;
		});
		this.#clusters = this.#clusters.map((cl) =>
			cl.id === id
				? {
						...cl,
						w: vertical ? Math.max(cl.w, cross + c.padding * 2) : along,
						h: vertical ? along : Math.max(cl.h, cross + c.padding * 2)
					}
				: cl
		);
	}

	/**
	 * Move an item during a drag, honouring whichever cluster it is over.
	 *
	 * This is `setItemRect` with the cluster's opinion applied, and it exists so
	 * the compositor does not have to know there are layout modes: it reports
	 * where the pointer went, and the document decides what that means.
	 */
	dragItemTo(itemId: string, x: number, y: number, w: number, h: number): void {
		const cluster = this.clusterAt(x, y);
		if (!cluster || cluster.layout !== 'free') {
			this.#guides = [];
			this.setItemRect(itemId, x, y, w, h);
			return;
		}
		const { x: sx, y: sy, guides } = this.#alignToCluster(itemId, cluster, x, y, w, h);
		this.#guides = guides;
		this.setItemRect(itemId, sx, sy, w, h);
	}

	/** Guides are gesture feedback; nothing outside a drag should see them. */
	clearGuides(): void {
		this.#guides = [];
	}

	#alignToCluster(
		itemId: string,
		c: CanvasCluster,
		x: number,
		y: number,
		w: number,
		h: number
	): { x: number; y: number; guides: SnapGuide[] } {
		const SNAP = 8;
		// The dragged item may be auto-sized, and an auto-sized rect still has to
		// align by its right edge and centre — so fall back to the same registry
		// extent every sibling is measured with.
		const dragged = this.#items.find((i) => i.id === itemId);
		const self = dragged ? this.#extent(dragged) : { w: 200, h: 80 };
		const dw = w > 0 ? w : self.w;
		const dh = h > 0 ? h : self.h;

		const siblings = this.clusterMembers(c.id).filter((i) => i.id !== itemId && i.visible);
		const guides: SnapGuide[] = [];

		// Targets are (line, kind, and the span the line should be drawn over).
		const xTargets: { at: number; kind: SnapGuide['kind']; from: number; to: number }[] = [
			{ at: c.x + c.padding, kind: 'padding', from: c.y, to: c.y + c.h },
			{ at: c.x + c.w - c.padding, kind: 'padding', from: c.y, to: c.y + c.h },
			{ at: c.x + c.w / 2, kind: 'center', from: c.y, to: c.y + c.h }
		];
		const yTargets: { at: number; kind: SnapGuide['kind']; from: number; to: number }[] = [
			{ at: c.y + c.padding, kind: 'padding', from: c.x, to: c.x + c.w },
			{ at: c.y + c.h - c.padding, kind: 'padding', from: c.x, to: c.x + c.w },
			{ at: c.y + c.h / 2, kind: 'center', from: c.x, to: c.x + c.h }
		];
		for (const s of siblings) {
			const e = this.#extent(s);
			const span = { from: Math.min(s.y, y), to: Math.max(s.y + e.h, y + dh) };
			xTargets.push(
				{ at: s.x, kind: 'edge', ...span },
				{ at: s.x + e.w, kind: 'edge', ...span },
				{ at: s.x + e.w / 2, kind: 'center', ...span }
			);
			const hspan = { from: Math.min(s.x, x), to: Math.max(s.x + e.w, x + dw) };
			yTargets.push(
				{ at: s.y, kind: 'edge', ...hspan },
				{ at: s.y + e.h, kind: 'edge', ...hspan },
				{ at: s.y + e.h / 2, kind: 'center', ...hspan }
			);
		}

		// Anchors are the dragged rect's own lines — left/centre/right so an item
		// can align by whichever of its edges is nearest, not only its origin.
		const pick = (
			targets: { at: number; kind: SnapGuide['kind']; from: number; to: number }[],
			anchors: number[]
		) => {
			let best: { delta: number; t: (typeof targets)[number] } | null = null;
			for (const t of targets) {
				for (const a of anchors) {
					const delta = t.at - a;
					if (Math.abs(delta) <= SNAP && (!best || Math.abs(delta) < Math.abs(best.delta))) {
						best = { delta, t };
					}
				}
			}
			return best;
		};

		const bx = pick(xTargets, [x, x + dw / 2, x + dw]);
		const by = pick(yTargets, [y, y + dh / 2, y + dh]);
		if (bx) guides.push({ axis: 'x', at: bx.t.at, from: bx.t.from, to: bx.t.to, kind: bx.t.kind });
		if (by) guides.push({ axis: 'y', at: by.t.at, from: by.t.from, to: by.t.to, kind: by.t.kind });

		return { x: x + (bx?.delta ?? 0), y: y + (by?.delta ?? 0), guides };
	}

	// ── Connectors ─────────────────────────────────────────────────────────────
	addConnector(
		fromId: string | { x: number; y: number },
		toId: string | { x: number; y: number }
	): CanvasConnector {
		const conn: CanvasConnector = {
			id: uid(),
			fromId,
			toId,
			style: 'solid',
			color: 'var(--accent)',
			arrowHead: 'arrow',
			visible: true,
			locked: false
		};
		this.#connectors = [...this.#connectors, conn];
		this.selectConnector(conn.id);
		this.#persist();
		return conn;
	}

	updateConnector(id: string, patch: Partial<Omit<CanvasConnector, 'id'>>): void {
		this.#connectors = this.#connectors.map((c) => (c.id === id ? { ...c, ...patch } : c));
		this.#persist(`conn:${id}`);
	}

	deleteConnector(id: string): void {
		this.#connectors = this.#connectors.filter((c) => c.id !== id);
		if (this.#selectedConnectorId === id) this.#selectedConnectorId = null;
		this.#persist();
	}

	selectConnector(id: string | null): void {
		this.#selectedConnectorId = id;
		this.#selectedFrameId = null;
		this.#selectedClusterId = null;
		this.#selectedId = null;
		this.#selectedGroupId = null;
		this.#multiSelectedIds = [];
	}

	/** Arrow-key nudge. Deliberately does NOT snap: the point of a 1px nudge is
	 *  to sit off the grid, and snapping would swallow it whole. */
	nudgeSelection(dx: number, dy: number): void {
		const ids = new Set(this.selectionItems().map((i) => i.id));
		if (!ids.size) return;
		this.#items = this.#items.map((item) =>
			ids.has(item.id) && !item.locked
				? { ...item, x: Math.max(0, item.x + dx), y: Math.max(0, item.y + dy) }
				: item
		);
		this.#persist('nudge');
	}

	// ── Z-order ────────────────────────────────────────────────────────────────
	bringToFront(id: string): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? { ...item, zIndex: this.#nextZ++ } : item
		);
		this.#persist();
	}

	bringForward(id: string): void {
		const item = this.#items.find((i) => i.id === id);
		if (!item) return;
		const above = this.#items
			.filter((i) => i.zIndex > item.zIndex)
			.sort((a, b) => a.zIndex - b.zIndex)[0];
		if (above) this.swapZIndex(id, above.id);
	}

	sendBack(id: string): void {
		const item = this.#items.find((i) => i.id === id);
		if (!item) return;
		const below = this.#items
			.filter((i) => i.zIndex < item.zIndex)
			.sort((a, b) => b.zIndex - a.zIndex)[0];
		if (below) this.swapZIndex(id, below.id);
	}

	swapZIndex(id1: string, id2: string): void {
		const a = this.#items.find((i) => i.id === id1);
		const b = this.#items.find((i) => i.id === id2);
		if (!a || !b) return;
		this.#items = this.#items.map((i) => {
			if (i.id === id1) return { ...i, zIndex: b.zIndex };
			if (i.id === id2) return { ...i, zIndex: a.zIndex };
			return i;
		});
		this.#persist();
	}

	toggleItemVisible(id: string): void {
		this.#items = this.#items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i));
		this.#persist();
	}

	toggleItemLocked(id: string): void {
		this.#items = this.#items.map((i) => (i.id === id ? { ...i, locked: !i.locked } : i));
		this.#persist();
	}

	// ── Group CRUD ─────────────────────────────────────────────────────────────
	createGroup(name?: string, itemIds: string[] = []): Group {
		const group: Group = {
			id: uid(),
			name: name ?? `Group ${this.#nextGroupN++}`,
			visible: true,
			locked: false
		};
		this.#groups = [...this.#groups, group];
		if (itemIds.length > 0) {
			this.#items = this.#items.map((item) =>
				itemIds.includes(item.id) ? { ...item, groupId: group.id } : item
			);
		}
		this.selectGroup(group.id);
		this.#persist();
		return group;
	}

	renameGroup(id: string, name: string): void {
		this.#groups = this.#groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g));
		this.#persist();
	}

	deleteGroup(id: string): void {
		this.#groups = this.#groups.filter((g) => g.id !== id);
		// The members outlive the group — ungroup them rather than deleting.
		this.#items = this.#items.map((item) =>
			item.groupId === id ? { ...item, groupId: undefined } : item
		);
		if (this.#selectedGroupId === id) this.#selectedGroupId = null;
		this.#persist();
	}

	addToGroup(itemId: string, groupId: string): void {
		this.#items = this.#items.map((item) => (item.id === itemId ? { ...item, groupId } : item));
		this.#persist();
	}

	removeFromGroup(itemId: string): void {
		this.#items = this.#items.map((item) =>
			item.id === itemId ? { ...item, groupId: undefined } : item
		);
		this.#persist();
	}

	toggleGroupVisible(id: string): void {
		const group = this.#groups.find((g) => g.id === id);
		if (!group) return;
		const v = !group.visible;
		this.#groups = this.#groups.map((g) => (g.id === id ? { ...g, visible: v } : g));
		this.#items = this.#items.map((i) => (i.groupId === id ? { ...i, visible: v } : i));
		this.#persist();
	}

	toggleGroupLocked(id: string): void {
		const group = this.#groups.find((g) => g.id === id);
		if (!group) return;
		const lk = !group.locked;
		this.#groups = this.#groups.map((g) => (g.id === id ? { ...g, locked: lk } : g));
		this.#items = this.#items.map((i) => (i.groupId === id ? { ...i, locked: lk } : i));
		this.#persist();
	}

	// ── Selection ──────────────────────────────────────────────────────────────
	// The three selection kinds are mutually exclusive: picking one clears the
	// others, so `selectionMode` can never be ambiguous.
	select(id: string | null): void {
		this.#selectedId = id;
		this.#selectedGroupId = null;
		this.#selectedFrameId = null;
		this.#selectedClusterId = null;
		this.#selectedConnectorId = null;
		this.#multiSelectedIds = [];
	}

	selectGroup(id: string | null): void {
		this.#selectedGroupId = id;
		this.#selectedId = null;
		this.#selectedFrameId = null;
		this.#selectedClusterId = null;
		this.#selectedConnectorId = null;
		this.#multiSelectedIds = [];
	}

	toggleMultiSelect(id: string): void {
		this.#selectedId = null;
		this.#selectedGroupId = null;
		if (this.#multiSelectedIds.includes(id)) {
			const next = this.#multiSelectedIds.filter((i) => i !== id);
			// Dropping to one leaves a plain single selection, not a multi of one.
			if (next.length === 1) {
				this.#selectedId = next[0];
				this.#multiSelectedIds = [];
			} else {
				this.#multiSelectedIds = next;
			}
		} else {
			this.#multiSelectedIds = [...this.#multiSelectedIds, id];
		}
	}

	/** Replace the multi-selection wholesale — what a marquee sweep produces.
	 *  One hit collapses to a plain single selection, matching what dropping to
	 *  one via `toggleMultiSelect` does; zero hits clears. */
	setMultiSelect(ids: string[]): void {
		if (ids.length === 0) return this.clearSelection();
		if (ids.length === 1) return this.select(ids[0]);
		this.#selectedId = null;
		this.#selectedGroupId = null;
		this.#multiSelectedIds = [...ids];
	}

	clearSelection(): void {
		this.select(null);
	}

	// ── Alignment (multi-select) ───────────────────────────────────────────────
	// Items with w/h of 0 size themselves, so alignment falls back to a nominal
	// box rather than treating them as zero-width.
	alignItems(axis: 'left' | 'right' | 'top' | 'bottom' | 'h-center' | 'v-center'): void {
		const ids = this.#multiSelectedIds;
		if (ids.length < 2) return;
		const sel = this.#items.filter((i) => ids.includes(i.id));
		const minX = Math.min(...sel.map((i) => i.x));
		const maxX = Math.max(...sel.map((i) => i.x + Math.max(i.w, 40)));
		const minY = Math.min(...sel.map((i) => i.y));
		const maxY = Math.max(...sel.map((i) => i.y + Math.max(i.h, 20)));

		this.#items = this.#items.map((item) => {
			if (!ids.includes(item.id)) return item;
			const w = Math.max(item.w, 40);
			const h = Math.max(item.h, 20);
			switch (axis) {
				case 'left':
					return { ...item, x: minX };
				case 'right':
					return { ...item, x: maxX - w };
				case 'top':
					return { ...item, y: minY };
				case 'bottom':
					return { ...item, y: maxY - h };
				case 'h-center':
					return { ...item, x: Math.round((minX + maxX) / 2 - w / 2) };
				case 'v-center':
					return { ...item, y: Math.round((minY + maxY) / 2 - h / 2) };
				default:
					return item;
			}
		});
		this.#persist();
	}

	distributeItems(axis: 'horizontal' | 'vertical'): void {
		const ids = this.#multiSelectedIds;
		// Two items are already evenly spaced; three is the first real case.
		if (ids.length < 3) return;
		const sel = [...this.#items.filter((i) => ids.includes(i.id))];

		if (axis === 'horizontal') {
			sel.sort((a, b) => a.x - b.x);
			const first = sel[0];
			const last = sel[sel.length - 1];
			const totalW = sel.reduce((s, i) => s + Math.max(i.w, 40), 0);
			const span = last.x + Math.max(last.w, 40) - first.x;
			const gap = (span - totalW) / (sel.length - 1);
			let x = first.x;
			const positions = new Map(
				sel.map((item, idx) => {
					const pos = idx === 0 ? item.x : x;
					x = pos + Math.max(item.w, 40) + gap;
					return [item.id, pos];
				})
			);
			this.#items = this.#items.map((i) =>
				ids.includes(i.id) ? { ...i, x: Math.round(positions.get(i.id) ?? i.x) } : i
			);
		} else {
			sel.sort((a, b) => a.y - b.y);
			const first = sel[0];
			const last = sel[sel.length - 1];
			const totalH = sel.reduce((s, i) => s + Math.max(i.h, 20), 0);
			const span = last.y + Math.max(last.h, 20) - first.y;
			const gap = (span - totalH) / (sel.length - 1);
			let y = first.y;
			const positions = new Map(
				sel.map((item, idx) => {
					const pos = idx === 0 ? item.y : y;
					y = pos + Math.max(item.h, 20) + gap;
					return [item.id, pos];
				})
			);
			this.#items = this.#items.map((i) =>
				ids.includes(i.id) ? { ...i, y: Math.round(positions.get(i.id) ?? i.y) } : i
			);
		}
		this.#persist();
	}

	// ── Tours ──────────────────────────────────────────────────────────────────
	saveTour(name: string, steps: TourStep[]): void {
		this.#tours = { ...this.#tours, [name]: steps };
		this.#persist();
	}

	deleteTour(name: string): void {
		const next = { ...this.#tours };
		delete next[name];
		this.#tours = next;
		this.#persist();
	}

	// ── Canvas reset ───────────────────────────────────────────────────────────
	/** Empties the ACTIVE page only. Other pages are a separate document each,
	 *  and "clear" has never meant "clear everything I have ever drawn". */
	clearCanvas(): void {
		this.#loadPage(emptyPage());
		this.clearSelection();
		this.#persist();
	}
}

export const builder = new BuilderStore();
