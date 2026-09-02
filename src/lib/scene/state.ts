// ── sceneStateAt — the whole runtime, as one pure function ─────────────────
// Given a scene and a time, produce everything the renderer needs. No clock is
// read here, no state accumulates between calls, and calling it twice with the
// same `t` returns the same answer. That is the property the editor's scrubbing
// depends on, and it is the reason this file has no Svelte in it.

import type {
	Scene,
	SceneObject,
	Beat,
	Cue,
	EaseId,
	ActiveBurst,
	NodePayload,
	EdgePayload,
	ComponentPayload,
} from './types.js';
import { channelById } from './vocabulary.js';

// ── Easing ─────────────────────────────────────────────────────────────────
export function ease(id: EaseId | undefined, t: number): number {
	const x = Math.max(0, Math.min(1, t));
	switch (id) {
		case 'in':
			return x * x;
		case 'out':
			return 1 - (1 - x) * (1 - x);
		case 'inOut':
			return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
		default:
			return x;
	}
}

// ── Beats ──────────────────────────────────────────────────────────────────
export function beatIndexAt(scene: Scene, t: number): number {
	let idx = 0;
	for (let i = 0; i < scene.beats.length; i++) {
		if (t >= scene.beats[i].at) idx = i;
		else break;
	}
	return idx;
}

export function beatEnd(scene: Scene, i: number): number {
	return i + 1 < scene.beats.length ? scene.beats[i + 1].at : scene.runMs;
}

export function beatProgressAt(scene: Scene, t: number): number {
	const i = beatIndexAt(scene, t);
	const start = scene.beats[i].at;
	const span = Math.max(1, beatEnd(scene, i) - start);
	return Math.max(0, Math.min(1, (t - start) / span));
}

/**
 * Absolute onset of a cue. A beat-anchored cue is resolved against its beat's
 * CURRENT `at`, so retiming the spine carries its cues along instead of
 * orphaning them — which is what makes a timeline survivable to edit.
 */
export function cueAt(scene: Scene, cue: Cue): number {
	if (!cue.anchor) return cue.at;
	const b = scene.beats.find((x) => x.id === cue.anchor!.beatId);
	return (b ? b.at : 0) + cue.anchor.offset;
}

// ── Selectors ──────────────────────────────────────────────────────────────
/**
 * Resolve a cue's target to concrete objects. Selectors are what let one cue
 * say "every registry, staggered" — without them, that is a `.filter()` inside
 * a Svelte component, which is exactly the coupling that made the old score
 * unauthorable without writing markup.
 */
export function resolveTargets(scene: Scene, target: string): SceneObject[] {
	if (target.startsWith('tag:')) {
		const tag = target.slice(4);
		return scene.objects.filter((o) => o.tags?.includes(tag));
	}
	if (target.startsWith('kind:')) {
		const kind = target.slice(5);
		return scene.objects.filter((o) => o.kind === kind);
	}
	const one = scene.objects.find((o) => o.id === target);
	return one ? [one] : [];
}

// ── Channel application ────────────────────────────────────────────────────
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
	const parts = path.split('.');
	let cur: Record<string, unknown> = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const next = cur[parts[i]];
		if (typeof next !== 'object' || next === null) return;
		cur = next as Record<string, unknown>;
	}
	cur[parts[parts.length - 1]] = value;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
	return path.split('.').reduce<unknown>((acc, k) => {
		if (typeof acc !== 'object' || acc === null) return undefined;
		return (acc as Record<string, unknown>)[k];
	}, obj);
}

function coerceStep(raw: unknown): unknown {
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return raw;
}

export interface SceneState {
	t: number;
	beat: Beat;
	beatIndex: number;
	beatProgress: number;
	/** Deep-copied objects with every channel applied. Safe to hand to a renderer. */
	objects: SceneObject[];
	bursts: ActiveBurst[];
}

/**
 * The one entry point. Copies the cast, walks the cues in onset order applying
 * every channel whose span has started, and collects the bursts currently
 * alight.
 *
 * Cues are applied in onset order so that two cues on the same channel compose
 * predictably: the later one wins once it starts, and holds after it ends. That
 * "hold the last value" rule is what makes a channel total — there is no `t`
 * for which the value is undefined.
 */
export function sceneStateAt(scene: Scene, t: number): SceneState {
	const objects: SceneObject[] = scene.objects.map((o) => ({
		...o,
		place: { ...o.place },
		tags: o.tags ? [...o.tags] : undefined,
		node: o.node ? ({ ...o.node } as NodePayload) : undefined,
		edge: o.edge ? ({ ...o.edge } as EdgePayload) : undefined,
		// `props` must be copied too, not just the payload around it. A shallow
		// copy leaves it sharing a reference with the scene, so applying a
		// generated `props.*` channel would write THROUGH to the source — and the
		// evaluator would be mutating the thing it is meant to be a pure function
		// of. Every nested container a channel can address has to be cloned here.
		component: o.component
			? ({ ...o.component, props: { ...o.component.props } } as ComponentPayload)
			: undefined,
	}));
	const byId = new Map(objects.map((o) => [o.id, o]));
	const bursts: ActiveBurst[] = [];

	const ordered = [...scene.cues].sort((a, b) => cueAt(scene, a) - cueAt(scene, b));

	for (const cue of ordered) {
		const base = cueAt(scene, cue);
		const targets = resolveTargets(scene, cue.target);

		targets.forEach((target, i) => {
			// A staggered set fans out from the cue's onset; index 0 is on time.
			const at = base + (cue.stagger ?? 0) * i;
			const dur = Math.max(1, cue.dur);
			const raw = (t - at) / dur;

			if (cue.burst) {
				// Bursts exist only while alight. Scrubbing INTO the middle of one
				// restarts it rather than showing it mid-flight — an accepted lie,
				// and the reason bursts are capped short and never load-bearing.
				if (raw >= 0 && raw < 1) {
					bursts.push({
						cueId: cue.id,
						objectId: target.id,
						burst: cue.burst,
						progress: raw,
					});
				}
				return;
			}

			const ch = cue.channel ? channelById(cue.channel) : undefined;
			if (!ch) return;
			if (t < at) return; // not started — the object keeps its declared value

			const live = byId.get(target.id);
			if (!live) return;
			const p = ease(cue.ease, Math.min(1, raw));

			if (ch.type === 'lerp') {
				const from =
					typeof cue.from === 'number'
						? cue.from
						: ((getPath(live as unknown as Record<string, unknown>, ch.path) as number) ?? 0);
				const to = typeof cue.to === 'number' ? cue.to : from;
				setPath(live as unknown as Record<string, unknown>, ch.path, from + (to - from) * p);
			} else {
				// A step lands at the START of its span, not the end: the span is how
				// long the change is *legible for*, not how long it takes to happen.
				setPath(live as unknown as Record<string, unknown>, ch.path, coerceStep(cue.to));
			}
		});
	}

	const beatIndex = beatIndexAt(scene, t);
	return {
		t,
		beat: scene.beats[beatIndex],
		beatIndex,
		beatProgress: beatProgressAt(scene, t),
		objects,
		bursts,
	};
}

/** Total spin-enabled time by `t` — the same integral the supply-chain score
 *  uses, generalised. Rotation must be a function of time, never a per-frame
 *  accumulator, or scrubbing lands on a different orientation than playback. */
export function spinElapsedAt(scene: Scene, t: number): number {
	let acc = 0;
	for (let i = 0; i < scene.beats.length; i++) {
		const start = scene.beats[i].at;
		if (t <= start) break;
		if (scene.beats[i].spin) acc += Math.min(t, beatEnd(scene, i)) - start;
	}
	return acc;
}
