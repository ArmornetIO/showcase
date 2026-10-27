import { readJson, writeJson } from '../storage.js';
import { REGISTRY_MAP } from './registry.js';
import { builder, type CanvasItem } from './store.svelte.js';

// Its own key rather than a field of the builder document: a storyboard spans
// pages, so it belongs to none of them, and the canvas document's undo history
// (which is per page) has no business stepping through stage edits.
const STORAGE_KEY = 'armornet-builder-storyboards-v1';

/** How long replay rests on a stage that does not say. */
export const DEFAULT_HOLD_MS = 2500;

/**
 * One beat of a storyboard: a page, and what on it the camera frames.
 *
 * `target` is a frame id (the whole screen) or an item id (one part of it, such
 * as an open modal). A reference, not a copy, so editing the screen edits the
 * stage. A stage whose target was deleted resolves to null and shows as
 * missing rather than being pruned, so undoing the delete brings it back.
 */
export interface Stage {
	id: string;
	pageId: string;
	target: string;
	label?: string;
	holdMs?: number;
}

/** Screens of one flow, in replay order. A flow crosses pages: you close the
 *  modal on one and land on the next. */
export interface Storyboard {
	id: string;
	name: string;
	stages: Stage[];
}

export interface Box {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** A stage as it stands on its page right now. */
export interface ResolvedStage {
	kind: 'frame' | 'item';
	name: string;
	pageName: string;
	box: Box;
	/** Boxes of what sits inside the target, relative to its top-left — enough
	 *  to tell screens apart in the strip without rendering them. */
	contents: { x: number; y: number; w: number; h: number }[];
}

interface Doc {
	boards: Storyboard[];
	activeId: string | null;
}

function uid() {
	return Math.random().toString(36).slice(2, 9);
}

function itemName(item: CanvasItem): string {
	return item.name || REGISTRY_MAP.get(item.componentId)?.label || item.componentId;
}

class StoryboardStore {
	#boards = $state<Storyboard[]>([]);
	#activeId = $state<string | null>(null);
	// Where "add" inserts and what the strip highlights. Not persisted: it is
	// where you are, not what you made.
	#currentStageId = $state<string | null>(null);
	#hydrated = false;

	get boards(): Storyboard[] {
		return this.#boards;
	}

	get currentStageId(): string | null {
		return this.#currentStageId;
	}

	readonly active: Storyboard | null = $derived(
		this.#boards.find((b) => b.id === this.#activeId) ?? null
	);

	/** Stage numbers (1-based) in the active storyboard, keyed `pageId:target`,
	 *  so the canvas can badge a screen with where it falls in the flow. One
	 *  target can hold several: the same screen before and after a zoom. */
	readonly steps: Map<string, number[]> = $derived.by(() => {
		const map = new Map<string, number[]>();
		this.active?.stages.forEach((s, i) => {
			const key = `${s.pageId}:${s.target}`;
			map.set(key, [...(map.get(key) ?? []), i + 1]);
		});
		return map;
	});

	hydrate(): void {
		if (this.#hydrated) return;
		this.#hydrated = true;
		const doc = readJson<Doc>(STORAGE_KEY, { boards: [], activeId: null }, (parsed) => {
			const p = (parsed ?? {}) as Partial<Doc>;
			const boards = (p.boards ?? []).map((b) => ({ ...b, stages: b.stages ?? [] }));
			return { boards, activeId: p.activeId ?? boards[0]?.id ?? null };
		});
		this.#boards = doc.boards;
		this.#activeId = doc.activeId;
	}

	#save(): void {
		writeJson(STORAGE_KEY, { boards: this.#boards, activeId: this.#activeId } satisfies Doc);
	}

	create(name?: string): Storyboard {
		const board: Storyboard = {
			id: uid(),
			name: name || `Storyboard ${this.#boards.length + 1}`,
			stages: []
		};
		this.#boards = [...this.#boards, board];
		this.#activeId = board.id;
		this.#currentStageId = null;
		this.#save();
		return board;
	}

	select(id: string): void {
		if (!this.#boards.some((b) => b.id === id)) return;
		this.#activeId = id;
		this.#currentStageId = null;
		this.#save();
	}

	rename(id: string, name: string): void {
		const trimmed = name.trim();
		if (!trimmed) return;
		this.#boards = this.#boards.map((b) => (b.id === id ? { ...b, name: trimmed } : b));
		this.#save();
	}

	remove(id: string): void {
		this.#boards = this.#boards.filter((b) => b.id !== id);
		if (this.#activeId === id) this.#activeId = this.#boards[0]?.id ?? null;
		this.#currentStageId = null;
		this.#save();
	}

	#setStages(stages: Stage[]): void {
		const id = this.#activeId;
		this.#boards = this.#boards.map((b) => (b.id === id ? { ...b, stages } : b));
		this.#save();
	}

	/** Insert after the current stage (the end when there is none) and make the
	 *  new one current, so successive adds read in the order they were made. */
	addStage(pageId: string, target: string): Stage {
		const board = this.active ?? this.create();
		const stage: Stage = { id: uid(), pageId, target };
		const at = board.stages.findIndex((s) => s.id === this.#currentStageId);
		const stages = [...board.stages];
		stages.splice(at === -1 ? stages.length : at + 1, 0, stage);
		this.#setStages(stages);
		this.#currentStageId = stage.id;
		return stage;
	}

	updateStage(id: string, patch: Partial<Pick<Stage, 'label' | 'holdMs'>>): void {
		this.#setStages((this.active?.stages ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)));
	}

	removeStage(id: string): void {
		this.#setStages((this.active?.stages ?? []).filter((s) => s.id !== id));
		if (this.#currentStageId === id) this.#currentStageId = null;
	}

	moveStage(id: string, to: number): void {
		const stages = [...(this.active?.stages ?? [])];
		const from = stages.findIndex((s) => s.id === id);
		if (from === -1) return;
		const [stage] = stages.splice(from, 1);
		stages.splice(Math.max(0, Math.min(to, stages.length)), 0, stage);
		this.#setStages(stages);
	}

	setCurrent(id: string | null): void {
		this.#currentStageId = id;
	}

	/** Add whatever is selected on the canvas — a frame or one item — as a stage. */
	addSelection(): Stage | null {
		const target = builder.selectedFrame?.id ?? builder.selectedId;
		return target ? this.addStage(builder.activePageId, target) : null;
	}

	/**
	 * The next screen: copy the selected frame beside itself and add the copy
	 * as the stage after it. The source joins the storyboard first if it is not
	 * in it yet, so "next" from a fresh frame yields both beats.
	 */
	nextScreen(): Stage | null {
		const frame = builder.selectedFrame;
		if (!frame) return null;
		const pageId = builder.activePageId;
		const existing = this.active?.stages.find((s) => s.pageId === pageId && s.target === frame.id);
		if (existing) this.#currentStageId = existing.id;
		else this.addStage(pageId, frame.id);
		const copy = builder.copyFrame(frame.id);
		return copy ? this.addStage(pageId, copy.id) : null;
	}

	resolve(stage: Stage): ResolvedStage | null {
		const page = builder.pages.find((p) => p.id === stage.pageId);
		if (!page) return null;
		const { frames, items } = builder.pageContents(stage.pageId);
		const contentsOf = (x: number, y: number, w: number, h: number) =>
			items
				.filter((i) => i.visible && i.x >= x && i.y >= y && i.x <= x + w && i.y <= y + h)
				.map((i) => ({ x: i.x - x, y: i.y - y, ...builder.extent(i) }));

		const frame = frames.find((f) => f.id === stage.target);
		if (frame) {
			return {
				kind: 'frame',
				name: frame.name,
				pageName: page.name,
				box: { minX: frame.x, minY: frame.y, maxX: frame.x + frame.w, maxY: frame.y + frame.h },
				contents: contentsOf(frame.x, frame.y, frame.w, frame.h)
			};
		}
		const item = items.find((i) => i.id === stage.target);
		if (!item) return null;
		const { w, h } = builder.extent(item);
		return {
			kind: 'item',
			name: itemName(item),
			pageName: page.name,
			box: { minX: item.x, minY: item.y, maxX: item.x + w, maxY: item.y + h },
			contents: [{ x: 0, y: 0, w, h }]
		};
	}
}

export const storyboard = new StoryboardStore();
