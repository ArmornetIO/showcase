import { readJson, writeJson } from '$lib/storage.js';
import { REGISTRY_MAP } from './registry.js';
import type { TourStep } from '$lib/primitives/canvas-camera.js';

const STORAGE_KEY = 'armornet-builder-v2';
const LEGACY_KEY = 'armornet-builder-v1';
export const GRID = 20;

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

/** The persisted document — everything a reload has to bring back. */
interface BuilderSnapshot {
	items: CanvasItem[];
	groups: Group[];
	nextZ: number;
	nextGroupN: number;
	gridSize: number;
	gridVisible: boolean;
	snapToGrid: boolean;
	canvasW: number;
	canvasH: number;
	tours: Record<string, TourStep[]>;
}

const EMPTY: BuilderSnapshot = {
	items: [],
	groups: [],
	nextZ: 1,
	nextGroupN: 1,
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

/** v1 and v2 share a shape; the fields below were added over time, hence the defaults. */
function revive(parsed: unknown): BuilderSnapshot {
	const p = (parsed ?? {}) as Partial<BuilderSnapshot>;
	return {
		items: (p.items ?? []).map((item) => ({
			...item,
			visible: item.visible ?? true,
			locked: item.locked ?? false
		})),
		groups: p.groups ?? EMPTY.groups,
		nextZ: p.nextZ ?? EMPTY.nextZ,
		nextGroupN: p.nextGroupN ?? EMPTY.nextGroupN,
		gridSize: p.gridSize ?? EMPTY.gridSize,
		gridVisible: p.gridVisible ?? EMPTY.gridVisible,
		snapToGrid: p.snapToGrid ?? EMPTY.snapToGrid,
		canvasW: p.canvasW ?? EMPTY.canvasW,
		canvasH: p.canvasH ?? EMPTY.canvasH,
		tours: p.tours ?? EMPTY.tours
	};
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
	#selectedId = $state<string | null>(null);
	#selectedGroupId = $state<string | null>(null);
	#multiSelectedIds = $state<string[]>([]);
	#nextZ = $state(EMPTY.nextZ);
	#nextGroupN = $state(EMPTY.nextGroupN);
	#tours = $state<Record<string, TourStep[]>>({});

	#gridSize = $state(EMPTY.gridSize);
	#gridVisible = $state(EMPTY.gridVisible);
	#snapToGrid = $state(EMPTY.snapToGrid);
	#canvasW = $state(EMPTY.canvasW);
	#canvasH = $state(EMPTY.canvasH);

	#hydrated = false;

	// ── Reads ──────────────────────────────────────────────────────────────────
	get items(): CanvasItem[] {
		return this.#items;
	}

	get groups(): Group[] {
		return this.#groups;
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

	readonly selectionMode: 'none' | 'item' | 'group' | 'multi' = $derived.by(() => {
		if (this.#multiSelectedIds.length >= 2) return 'multi';
		if (this.#selectedGroupId) return 'group';
		if (this.#selectedId) return 'item';
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

		this.#items = snapshot.items;
		this.#groups = snapshot.groups;
		this.#nextZ = snapshot.nextZ;
		this.#nextGroupN = snapshot.nextGroupN;
		this.#gridSize = snapshot.gridSize;
		this.#gridVisible = snapshot.gridVisible;
		this.#snapToGrid = snapshot.snapToGrid;
		this.#canvasW = snapshot.canvasW;
		this.#canvasH = snapshot.canvasH;
		this.#tours = snapshot.tours;
	}

	#persist(): void {
		writeJson(STORAGE_KEY, {
			items: this.#items,
			groups: this.#groups,
			nextZ: this.#nextZ,
			nextGroupN: this.#nextGroupN,
			gridSize: this.#gridSize,
			gridVisible: this.#gridVisible,
			snapToGrid: this.#snapToGrid,
			canvasW: this.#canvasW,
			canvasH: this.#canvasH,
			tours: this.#tours
		} satisfies BuilderSnapshot);
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

	/** Update raw position/size during drag — does NOT snap or persist. */
	setItemRect(id: string, x: number, y: number, w: number, h: number): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? { ...item, x: Math.max(0, x), y: Math.max(0, y), w, h } : item
		);
	}

	/** Snap to grid and persist — call on drag/resize end. */
	snapItem(id: string): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? this.#snapped(item) : item
		);
		this.#persist();
	}

	/** Snap all group members to grid and persist. */
	snapGroup(groupId: string): void {
		this.#items = this.#items.map((item) =>
			item.groupId === groupId ? this.#snapped(item) : item
		);
		this.#persist();
	}

	#snapped(item: CanvasItem): CanvasItem {
		const g = this.#gridSize;
		return {
			...item,
			x: snapTo(Math.max(0, item.x), g),
			y: snapTo(Math.max(0, item.y), g),
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
		this.#persist();
	}

	setItemProps(id: string, props: Record<string, unknown>): void {
		this.#items = this.#items.map((item) =>
			item.id === id ? { ...item, props: { ...item.props, ...props } } : item
		);
		this.#persist();
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
		this.#persist();
	}

	renameItem(id: string, name: string): void {
		this.#items = this.#items.map((i) =>
			i.id === id ? { ...i, name: name.trim() || undefined } : i
		);
		this.#persist();
	}

	deleteItem(id: string): void {
		this.deleteItems([id]);
	}

	deleteItems(ids: string[]): void {
		this.#items = this.#items.filter((i) => !ids.includes(i.id));
		if (this.#selectedId && ids.includes(this.#selectedId)) this.#selectedId = null;
		this.#multiSelectedIds = this.#multiSelectedIds.filter((i) => !ids.includes(i));
		this.#persist();
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
		this.#multiSelectedIds = [];
	}

	selectGroup(id: string | null): void {
		this.#selectedGroupId = id;
		this.#selectedId = null;
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
	clearCanvas(): void {
		this.#items = [];
		this.#groups = [];
		this.#nextZ = EMPTY.nextZ;
		this.#nextGroupN = EMPTY.nextGroupN;
		this.clearSelection();
		this.#persist();
	}
}

export const builder = new BuilderStore();
