export const CANVAS_CTX = Symbol('canvas');

export interface TourStep {
	target: string | { x: number; y: number } | 'fit-all';
	duration?: number;
	easing?: string;
	holdMs?: number;
	label?: string;
}

export interface TourController {
	play(): void;
	pause(): void;
	stop(): void;
	next(): void;
	prev(): void;
	readonly currentStep: number;
	readonly isPlaying: boolean;
	onUpdate?: (currentStep: number, isPlaying: boolean) => void;
}

export interface CanvasCamera {
	flyTo(
		target: string | { x: number; y: number },
		opts?: { duration?: number; easing?: string; zoom?: number },
	): Promise<void>;
	fitAll(opts?: {
		padding?: number;
		duration?: number;
		fill?: number;
		insets?: { top?: number; right?: number; bottom?: number; left?: number };
	}): void;
	/** Fit an explicit world-space rectangle, rather than the union of whatever
	 *  bounds happen to be registered. For content whose measured extent moves on
	 *  its own — a spinning globe's bodies crowd the limb and disappear round the
	 *  back — where fitting the measurement makes the camera chase it. */
	fitRect(
		rect: { minX: number; minY: number; maxX: number; maxY: number },
		opts?: {
			padding?: number;
			duration?: number;
			fill?: number;
			insets?: { top?: number; right?: number; bottom?: number; left?: number };
		},
	): void;
	cut(target: string | { x: number; y: number }): void;
	playTour(steps: TourStep[]): TourController;
	readonly transform: { tx: number; ty: number; scale: number };
	zoomIn(): void;
	zoomOut(): void;
}

export interface SelectionHandler {
	onStart(canvasPos: { x: number; y: number }): void;
	onMove(canvasPos: { x: number; y: number }): void;
	onEnd(): void;
}

export interface CanvasContextValue {
	transform: { tx: number; ty: number; tk: number };
	svgSize: { w: number; h: number };
	nodePositions: Map<string, () => { x: number; y: number } | null>;
	boundsRegistry: Map<symbol | string, () => { minX: number; minY: number; maxX: number; maxY: number } | null>;
	camera: CanvasCamera;
	getRoot: () => HTMLElement | undefined;
	selectionHandler: { current?: SelectionHandler };
	onSelectionChange?: (ids: string[]) => void;
	screenToCanvas: (sx: number, sy: number) => { x: number; y: number };
}

function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function animate(
	from: { tx: number; ty: number; tk: number },
	to: { tx: number; ty: number; tk: number },
	duration: number,
	onUpdate: (tx: number, ty: number, tk: number) => void,
	onDone?: () => void,
): () => void {
	const start = performance.now();
	let rafId: number;

	function step(now: number) {
		const t = Math.min((now - start) / duration, 1);
		const e = easeInOut(t);
		onUpdate(
			from.tx + (to.tx - from.tx) * e,
			from.ty + (to.ty - from.ty) * e,
			from.tk + (to.tk - from.tk) * e,
		);
		if (t < 1) {
			rafId = requestAnimationFrame(step);
		} else {
			onDone?.();
		}
	}

	rafId = requestAnimationFrame(step);
	return () => cancelAnimationFrame(rafId);
}

class TourControllerImpl implements TourController {
	currentStep = 0;
	isPlaying = false;
	onUpdate?: (currentStep: number, isPlaying: boolean) => void;

	private readonly _steps: TourStep[];
	private readonly _camera: CanvasCameraImpl;
	private _session = 0;
	private _pendingResolve?: () => void;
	private _pendingTimer?: ReturnType<typeof setTimeout>;

	constructor(steps: TourStep[], camera: CanvasCameraImpl) {
		this._steps = steps;
		this._camera = camera;
	}

	private _notify(): void {
		this.onUpdate?.(this.currentStep, this.isPlaying);
	}

	play(): void {
		if (this.isPlaying || this._steps.length === 0) return;
		this.isPlaying = true;
		this._notify();
		const session = ++this._session;
		void this._runFrom(this.currentStep, session);
	}

	pause(): void {
		this.isPlaying = false;
		this._notify();
		// Let pending timers fire naturally; session / isPlaying checks prevent auto-advance
	}

	stop(): void {
		this._session++;
		this.isPlaying = false;
		this._resolvePending();
		this.currentStep = 0;
		this._notify();
	}

	next(): void {
		const session = ++this._session;
		this._resolvePending();
		if (this.currentStep < this._steps.length - 1) {
			this.currentStep++;
			this._notify();
			if (this.isPlaying) {
				void this._runFrom(this.currentStep, session);
			} else {
				void this._navigateTo(this.currentStep);
			}
		} else {
			this.isPlaying = false;
			this._notify();
		}
	}

	prev(): void {
		const session = ++this._session;
		this._resolvePending();
		if (this.currentStep > 0) {
			this.currentStep--;
			this._notify();
			if (this.isPlaying) {
				void this._runFrom(this.currentStep, session);
			} else {
				void this._navigateTo(this.currentStep);
			}
		}
	}

	private _navigateTo(idx: number): Promise<void> {
		const step = this._steps[idx];
		if (!step) return Promise.resolve();
		const duration = step.duration ?? 600;
		const target = step.target;
		if (target === 'fit-all') {
			this._camera.fitAll({ duration });
		} else {
			void this._camera.flyTo(target, { duration });
		}
		return new Promise<void>((resolve) => {
			this._pendingResolve = resolve;
			this._pendingTimer = setTimeout(() => {
				this._pendingTimer = undefined;
				this._pendingResolve = undefined;
				resolve();
			}, duration);
		});
	}

	private _holdFor(ms: number): Promise<void> {
		return new Promise<void>((resolve) => {
			this._pendingResolve = resolve;
			this._pendingTimer = setTimeout(() => {
				this._pendingTimer = undefined;
				this._pendingResolve = undefined;
				resolve();
			}, ms);
		});
	}

	private _resolvePending(): void {
		clearTimeout(this._pendingTimer);
		this._pendingTimer = undefined;
		const r = this._pendingResolve;
		this._pendingResolve = undefined;
		r?.();
	}

	private async _runFrom(startIdx: number, session: number): Promise<void> {
		let idx = startIdx;
		while (idx < this._steps.length) {
			if (session !== this._session || !this.isPlaying) return;
			this.currentStep = idx;
			this._notify();
			await this._navigateTo(idx);
			if (session !== this._session || !this.isPlaying) return;
			const holdMs = this._steps[idx]?.holdMs ?? 0;
			if (holdMs <= 0) return; // manual step — stay here until next() is called
			await this._holdFor(holdMs);
			if (session !== this._session || !this.isPlaying) return;
			idx++;
		}
		this.isPlaying = false;
		this._notify();
	}
}

export class CanvasCameraImpl implements CanvasCamera {
	private readonly _t: { tx: number; ty: number; tk: number };
	private readonly _s: { w: number; h: number };
	private readonly _nodes: Map<string, () => { x: number; y: number } | null>;
	private readonly _bounds: Map<symbol | string, () => { minX: number; minY: number; maxX: number; maxY: number } | null>;
	private readonly _minZoom: number;
	private readonly _maxZoom: number;
	private _cancelAnim?: () => void;

	constructor(
		transform: { tx: number; ty: number; tk: number },
		svgSize: { w: number; h: number },
		nodePositions: Map<string, () => { x: number; y: number } | null>,
		boundsRegistry: Map<symbol | string, () => { minX: number; minY: number; maxX: number; maxY: number } | null>,
		minZoom: number,
		maxZoom: number,
	) {
		this._t = transform;
		this._s = svgSize;
		this._nodes = nodePositions;
		this._bounds = boundsRegistry;
		this._minZoom = minZoom;
		this._maxZoom = maxZoom;
	}

	get transform(): { tx: number; ty: number; scale: number } {
		return { tx: this._t.tx, ty: this._t.ty, scale: this._t.tk };
	}

	private _clamp(z: number): number {
		return Math.max(this._minZoom, Math.min(this._maxZoom, z));
	}

	private _resolve(target: string | { x: number; y: number }): { x: number; y: number } | null {
		return typeof target === 'string' ? (this._nodes.get(target)?.() ?? null) : target;
	}

	private _centerOn(pos: { x: number; y: number }, zoom?: number): { tx: number; ty: number; tk: number } {
		const tk = zoom ?? this._t.tk;
		return {
			tx: this._s.w / 2 - pos.x * tk,
			ty: this._s.h / 2 - pos.y * tk,
			tk,
		};
	}

	async flyTo(
		target: string | { x: number; y: number },
		opts?: { duration?: number; easing?: string; zoom?: number },
	): Promise<void> {
		const pos = this._resolve(target);
		if (!pos) return;
		this._cancelAnim?.();
		const to = this._centerOn(pos, opts?.zoom !== undefined ? this._clamp(opts.zoom) : undefined);
		return new Promise<void>((resolve) => {
			this._cancelAnim = animate(
				{ ...this._t },
				to,
				opts?.duration ?? 600,
				(tx, ty, tk) => {
					this._t.tx = tx;
					this._t.ty = ty;
					this._t.tk = this._clamp(tk);
				},
				resolve,
			);
		});
	}

	fitAll(opts?: {
		padding?: number;
		duration?: number;
		fill?: number;
		insets?: { top?: number; right?: number; bottom?: number; left?: number };
	}): void {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		let any = false;

		for (const get of this._bounds.values()) {
			const b = get();
			if (!b) continue;
			any = true;
			if (b.minX < minX) minX = b.minX;
			if (b.minY < minY) minY = b.minY;
			if (b.maxX > maxX) maxX = b.maxX;
			if (b.maxY > maxY) maxY = b.maxY;
		}

		if (!any) return;
		this._fitBox(minX, minY, maxX, maxY, opts);
	}

	fitRect(
		rect: { minX: number; minY: number; maxX: number; maxY: number },
		opts?: {
			padding?: number;
			duration?: number;
			fill?: number;
			insets?: { top?: number; right?: number; bottom?: number; left?: number };
		},
	): void {
		if (!(rect.maxX > rect.minX) || !(rect.maxY > rect.minY)) return;
		this._fitBox(rect.minX, rect.minY, rect.maxX, rect.maxY, opts);
	}

	/** The shared fit. Split out so `fitRect` can hand it a box the caller KNOWS
	 *  rather than one measured from whatever happens to be registered.
	 *
	 *  That distinction matters for anything that moves. Fitting the union of the
	 *  registered bounds is right for a static diagram, and wrong for a globe: its
	 *  bodies crowd toward the limb and vanish round the back as it turns, so the
	 *  measured box breathes every frame and the camera chases it. A sphere has a
	 *  known silhouette that does not depend on which of its contents are facing
	 *  you — fit that, and the view stops rescaling when nothing has changed size. */
	private _fitBox(
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
		opts?: {
			padding?: number;
			duration?: number;
			fill?: number;
			insets?: { top?: number; right?: number; bottom?: number; left?: number };
		},
	): void {
		const padding = opts?.padding ?? 60;
		const fill = opts?.fill ?? 1;
		const ins = opts?.insets;
		const insT = ins?.top ?? 0;
		const insR = ins?.right ?? 0;
		const insB = ins?.bottom ?? 0;
		const insL = ins?.left ?? 0;
		const { w, h } = this._s;
		// The clear rectangle: viewport minus the insets, minus padding on each side.
		// Never let it collapse — chrome wider than the canvas would otherwise invert it.
		const availW = Math.max(1, w - insL - insR - padding * 2);
		const availH = Math.max(1, h - insT - insB - padding * 2);
		const scaleX = availW / (maxX - minX);
		const scaleY = availH / (maxY - minY);
		const tk = this._clamp(Math.min(scaleX, scaleY) * fill);
		const cx = (minX + maxX) / 2;
		const cy = (minY + maxY) / 2;
		// Centre of the clear rectangle — NOT of the viewport, or the content would
		// sit under the chrome by exactly half the difference between the two.
		const fitCx = insL + padding + availW / 2;
		const fitCy = insT + padding + availH / 2;

		const to = { tx: fitCx - cx * tk, ty: fitCy - cy * tk, tk };
		const duration = opts?.duration ?? 500;

		this._cancelAnim?.();
		// Duration 0 applies it on the spot, with no tween of its own.
		//
		// That is the mode a caller uses when it is driving the motion itself: a
		// camera that owns a private easing cannot be fused with anything else, so
		// two systems animating at once always read as two moves however carefully
		// their timings are matched. Handing over per-frame control is the only way
		// a pose change and a camera change become one gesture.
		if (duration <= 0) {
			this._t.tx = to.tx;
			this._t.ty = to.ty;
			this._t.tk = this._clamp(to.tk);
			return;
		}
		this._cancelAnim = animate({ ...this._t }, to, duration, (tx, ty, k) => {
			this._t.tx = tx;
			this._t.ty = ty;
			this._t.tk = this._clamp(k);
		});
	}

	cut(target: string | { x: number; y: number }): void {
		this._cancelAnim?.();
		const pos = this._resolve(target);
		if (!pos) return;
		const to = this._centerOn(pos);
		this._t.tx = to.tx;
		this._t.ty = to.ty;
		this._t.tk = this._clamp(to.tk);
	}

	zoomIn(): void {
		this._cancelAnim?.();
		const { tx, ty, tk } = this._t;
		const { w, h } = this._s;
		const newTk = this._clamp(tk * 1.2);
		this._t.tx = w / 2 - (w / 2 - tx) * (newTk / tk);
		this._t.ty = h / 2 - (h / 2 - ty) * (newTk / tk);
		this._t.tk = newTk;
	}

	zoomOut(): void {
		this._cancelAnim?.();
		const { tx, ty, tk } = this._t;
		const { w, h } = this._s;
		const newTk = this._clamp(tk * 0.83);
		this._t.tx = w / 2 - (w / 2 - tx) * (newTk / tk);
		this._t.ty = h / 2 - (h / 2 - ty) * (newTk / tk);
		this._t.tk = newTk;
	}

	playTour(steps: TourStep[]): TourController {
		return new TourControllerImpl(steps, this);
	}
}
