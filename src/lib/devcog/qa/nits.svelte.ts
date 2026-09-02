// Reactive owner of the QA "nits" workflow.
//
// `nits.ts` next door is the pure, node-testable half — parse, persist, build a
// selector, render the AI prompt. This file is the stateful half: the batch
// currently on screen, the inspector's live hover, the capture awaiting a note,
// and the viewport rects the annotation overlays are drawn at.
//
// It lives in one class so the drawer, the overlays, and the note popup all read
// and drive the SAME state without DevCog.svelte having to thread a dozen props
// (and their setters) through three levels of markup.

import {
	type Nit,
	type NitConfig,
	DEFAULT_NIT_CONFIG,
	loadNits,
	saveNits,
	getCssPath,
	buildAIPrompt
} from './nits.js';

/** Marker attribute every DevCog-owned element carries so the inspector can
 *  skip its own UI instead of letting you annotate the annotator. */
export const DEVCOG_ATTR = 'data-devcog';

const DEVCOG_SELECTOR = `[${DEVCOG_ATTR}]`;

/** An element the inspector has grabbed, held until the user writes a note. */
export interface NitCapture {
	selector: string;
	rect: DOMRect;
	outerHTML: string;
	textContent: string;
}

/** How long the "copied" confirmation stays lit, in ms. */
const COPIED_MS = 2000;

export class NitsController {
	/** The persisted batch. */
	nits = $state<Nit[]>([]);
	/** Inspector armed — pointer is picking an element. */
	inspecting = $state(false);
	/** Rect under the pointer while inspecting. */
	hoverRect = $state<DOMRect | null>(null);
	/** Clicked element awaiting a note. */
	capture = $state<NitCapture | null>(null);
	/** Draft note bound to the popup input. */
	note = $state('');
	/** Clipboard confirmation for the batch action. */
	copied = $state(false);
	/**
	 * Ticked nits. Empty means "no selection", which the copy actions read as
	 * the whole batch — so the zero-effort path stays one click.
	 */
	selected = $state<string[]>([]);
	/** Nit whose own copy button just fired, so only that card flashes. */
	copiedId = $state<string | null>(null);
	/** Live viewport rect per saved nit — null when its element is gone. */
	positions = $state<Record<string, DOMRect | null>>({});

	#config: NitConfig;
	#copyTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Set while a host tool has borrowed the inspector for a single pick. The
	 * next click goes to this instead of opening the note popup — one armed
	 * picker in the cog, not one per tool that needs an element.
	 */
	#pickOnce: ((el: Element) => void) | null = null;

	constructor(config: NitConfig = DEFAULT_NIT_CONFIG) {
		this.#config = config;
	}

	get count(): number {
		return this.nits.length;
	}

	/** Rehydrate from storage. Call once the component is mounted. */
	load(): void {
		this.nits = loadNits(this.#config);
	}

	#persist(): void {
		saveNits(this.#config, this.nits);
	}

	// ── Inspector ────────────────────────────────────────────────────────────

	toggleInspect(): void {
		if (this.inspecting) this.stopInspect();
		else {
			// An explicit arm is always the nit flow — a borrowed pick that was
			// never spent must not hijack it.
			this.#pickOnce = null;
			this.inspecting = true;
		}
	}

	stopInspect(): void {
		this.inspecting = false;
		this.capture = null;
		this.hoverRect = null;
		this.#pickOnce = null;
	}

	/**
	 * Borrow the inspector for one pick: the next click hands its element to
	 * `handler` and disarms, with no nit captured.
	 *
	 * This exists so a host tool that needs "which element" — a shape switcher, a
	 * style probe — reuses the one picker in the cog rather than shipping a
	 * second armed-click mode that fights it for the same clicks. `pickOnce` is
	 * the whole extension: what the tool DOES with the element stays the tool's
	 * business, and this package never learns what a card is.
	 */
	pickOnce(handler: (el: Element) => void): void {
		this.#pickOnce = handler;
		this.capture = null;
		this.inspecting = true;
	}

	/** True while a host tool holds the pick, so UI can say what it is arming for. */
	get borrowed(): boolean {
		return this.#pickOnce !== null;
	}

	/**
	 * attachInspector wires the capture-phase pointer listeners that turn the
	 * whole page into a pick target, and returns their teardown. Capture phase
	 * matters: it beats the host app's own click handlers, so picking an
	 * element never also navigates or submits.
	 */
	attachInspector(): () => void {
		const onMove = (e: MouseEvent) => {
			const t = e.target as Element | null;
			if (!t || t.closest(DEVCOG_SELECTOR)) return;
			this.hoverRect = t.getBoundingClientRect();
		};

		const onClick = (e: MouseEvent) => {
			const t = e.target as Element | null;
			if (!t || t.closest(DEVCOG_SELECTOR)) return;
			e.preventDefault();
			e.stopPropagation();
			const borrowed = this.#pickOnce;
			if (borrowed) {
				this.#pickOnce = null;
				this.inspecting = false;
				this.hoverRect = null;
				borrowed(t);
				return;
			}
			this.capture = {
				selector: getCssPath(t),
				rect: t.getBoundingClientRect(),
				outerHTML: t.outerHTML.slice(0, 300),
				textContent: (t.textContent ?? '').slice(0, 120).trim()
			};
			this.hoverRect = null;
		};

		document.addEventListener('mousemove', onMove, true);
		document.addEventListener('click', onClick, true);
		document.body.style.cursor = 'crosshair';

		return () => {
			document.removeEventListener('mousemove', onMove, true);
			document.removeEventListener('click', onClick, true);
			document.body.style.cursor = '';
			this.hoverRect = null;
		};
	}

	// ── Annotation overlays ──────────────────────────────────────────────────

	/** Re-measure every saved nit's element against the current viewport. */
	resolvePositions(): void {
		if (typeof document === 'undefined') return;
		const resolved: Record<string, DOMRect | null> = {};
		for (const nit of this.nits) {
			try {
				const el = document.querySelector(nit.selector);
				resolved[nit.id] = el ? el.getBoundingClientRect() : null;
			} catch {
				// A stored selector can go invalid if the markup moved on.
				resolved[nit.id] = null;
			}
		}
		this.positions = resolved;
	}

	/**
	 * trackPositions keeps the overlays pinned while the page scrolls or
	 * resizes, and returns their teardown. Overlays are position:fixed, so
	 * every viewport change invalidates every rect.
	 */
	trackPositions(): () => void {
		const resolve = () => this.resolvePositions();
		resolve();
		window.addEventListener('scroll', resolve, { passive: true });
		window.addEventListener('resize', resolve, { passive: true });
		return () => {
			window.removeEventListener('scroll', resolve);
			window.removeEventListener('resize', resolve);
		};
	}

	clearPositions(): void {
		this.positions = {};
	}

	// ── Batch ────────────────────────────────────────────────────────────────

	/** Commit the pending capture plus its note to the batch. */
	save(): void {
		if (!this.capture) return;
		const nit: Nit = {
			id: crypto.randomUUID(),
			selector: this.capture.selector,
			outerHTML: this.capture.outerHTML,
			textContent: this.capture.textContent,
			note: this.note.trim() || '(no note)',
			url: window.location.pathname,
			ts: Date.now()
		};
		this.nits = [...this.nits, nit];
		this.#persist();
		this.capture = null;
		this.note = '';
		this.resolvePositions();
	}

	/** Drop the pending capture without saving. */
	cancel(): void {
		this.capture = null;
		this.note = '';
	}

	remove(id: string): void {
		this.nits = this.nits.filter((n) => n.id !== id);
		this.selected = this.selected.filter((s) => s !== id);
		this.#persist();
		this.resolvePositions();
	}

	clear(): void {
		this.nits = [];
		this.selected = [];
		this.#persist();
		this.clearPositions();
	}

	// ── Selection ────────────────────────────────────────────────────────────

	get selectedCount(): number {
		return this.selected.length;
	}

	isSelected(id: string): boolean {
		return this.selected.includes(id);
	}

	toggleSelect(id: string): void {
		this.selected = this.isSelected(id)
			? this.selected.filter((s) => s !== id)
			: [...this.selected, id];
	}

	selectAll(): void {
		this.selected = this.nits.map((n) => n.id);
	}

	clearSelection(): void {
		this.selected = [];
	}

	/** The nits a copy action would emit: the ticked ones, else the whole batch. */
	get copyTargets(): Nit[] {
		if (this.selected.length === 0) return this.nits;
		// Batch order, not click order — the prompt should read top-to-bottom.
		return this.nits.filter((n) => this.isSelected(n.id));
	}

	// ── Clipboard ────────────────────────────────────────────────────────────

	/** Copy the current selection (or the whole batch) as an AI fix-prompt. */
	async copyPrompt(): Promise<void> {
		await this.#copy(this.copyTargets, null);
	}

	/** Copy exactly one nit, ignoring whatever is ticked. */
	async copyOne(id: string): Promise<void> {
		const nit = this.nits.find((n) => n.id === id);
		if (!nit) return;
		await this.#copy([nit], id);
	}

	async #copy(nits: Nit[], flashId: string | null): Promise<void> {
		if (nits.length === 0) return;
		await navigator.clipboard.writeText(buildAIPrompt(nits, this.#config));
		this.copied = flashId === null;
		this.copiedId = flashId;
		if (this.#copyTimer) clearTimeout(this.#copyTimer);
		this.#copyTimer = setTimeout(() => {
			this.copied = false;
			this.copiedId = null;
		}, COPIED_MS);
	}

	/**
	 * escape unwinds the deepest open thing — pending note, then inspector, then
	 * a nit selection — and reports whether it consumed the key, so the host can
	 * fall through to closing its panels.
	 */
	escape(): boolean {
		if (this.capture) {
			this.cancel();
			return true;
		}
		if (this.inspecting) {
			this.stopInspect();
			return true;
		}
		if (this.selected.length > 0) {
			this.clearSelection();
			return true;
		}
		return false;
	}
}
