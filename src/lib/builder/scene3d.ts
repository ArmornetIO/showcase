// ── scene3d — a Builder 3D page, as a BREACH map ─────────────────────────────
// A 3D page is an ordinary Builder page whose items are `Object3D`s: one
// subject (a model, a globe building, a character) and where it stands. So it
// saves, undoes, copies and pages exactly like a UI page, and the inspector's
// number fields ARE the transform controls.
//
// `sceneMap` turns the page into a `MapDef`, the format the first-person maps
// are written in, so the stage draws it with `composeMap` and the same shaders
// the game walks — and an exported scene is a map the game can load.
import { ALL_PIECES } from '../mesh-studio/pieces/piece-catalogue.js';
import type { Solid } from '../mesh-studio/pieces/pieces.js';
import { CHARACTERS } from '../character/characters.js';
import { figureParts } from '../character/render.js';
import { MODELS } from '../model-studio/models.js';
import { PART_FILL } from '../model-studio/model-geometry.js';
import { ROOT, within, type MapDef, type MapFrame, type MapMaterial, type MapProp, type Put, type Tone } from '../game/map.js';
import type { Model } from '../model-studio/model-geometry.js';
import type { CanvasItem } from './store.svelte.js';

/** The registry id of a 3D page's items. */
export const OBJECT3D = 'Object3D';

/** The drag key the 3D stage reads; distinct from `component-id` so a 2D
 *  component cannot land on it. */
export const SUBJECT_KEY = 'subject-id';

/** `map` is a prop of a BREACH map: `map:<mapId>:<prop>`. */
export type SubjectKind = 'model' | 'piece' | 'character' | 'map';

/** Sorted, because `?piece=` links and the piece studio's arrows walk this order. */
export const PIECE_KEYS = Object.keys(ALL_PIECES).sort();

/** `kind:key`, an `Object3D`'s `subject`. Split at the FIRST colon: a map
 *  prop's key is itself `<mapId>:<prop>`. */
export function parseSubject(id: string): { kind: SubjectKind; key: string } | null {
	const at = id.indexOf(':');
	const kind = id.slice(0, at) as SubjectKind;
	const key = id.slice(at + 1);
	return at > 0 && ['model', 'piece', 'character', 'map'].includes(kind) ? { kind, key } : null;
}

// ── BREACH maps ─────────────────────────────────────────────────────────────
// Handed in by the route: `src/lib` may not import an example, and the maps
// live in `examples/breach/insider`.
const MAPS = new Map<string, MapDef>();
export function useMaps(maps: readonly MapDef[]) {
	for (const m of maps) MAPS.set(m.id, m);
}
export const knownMaps = () => [...MAPS.values()];

/** A map's props renamed into the scene's namespace — `map:<id>:<prop>`, their
 *  materials `<id>/<material>` — so two maps cannot collide on `wall`. Kinds
 *  are kept, so a desk's slots still fill from the same map's clutter. Cached
 *  per map, for `composeMap`'s per-prop mesh cache. */
const renamed = new Map<string, { props: Record<string, MapProp>; materials: Record<string, MapMaterial> }>();
function mapProps(mapId: string) {
	const hit = renamed.get(mapId);
	if (hit) return hit;
	const def = MAPS.get(mapId);
	if (!def) return null;
	const mat = (m: string) => `${mapId}/${m}`;
	const out = {
		props: Object.fromEntries(
			Object.entries(def.props).map(([k, p]) => [
				`map:${mapId}:${k}`,
				{ ...p, material: typeof p.material === 'string' ? mat(p.material) : p.material.map(mat) }
			])
		),
		materials: Object.fromEntries(Object.entries(def.materials).map(([k, m]) => [mat(k), m]))
	};
	renamed.set(mapId, out);
	return out;
}

/** Every prop of every known map, as palette cards under the map's name. */
export const mapSubjects = () =>
	knownMaps().flatMap((m) => Object.keys(m.props).map((k) => ({ id: `map:${m.id}:${k}`, label: k, category: m.label })));

/** A map's placements as `Object3D` props, chunks flattened with `composeMap`'s
 *  own frame math. Slot fills are not placements: they stay the map's, and
 *  fill again wherever their host prop goes. */
export function importMap(def: MapDef): Object3D[] {
	const out: Object3D[] = [];
	const walk = (puts: Put[], parent: MapFrame, depth: number) => {
		if (depth > 8) return;
		for (const p of puts) {
			const f = within(parent, p);
			if (p.chunk) walk(def.chunks?.[p.chunk] ?? [], f, depth + 1);
			if (p.prop)
				out.push({
					subject: `map:${def.id}:${p.prop}`,
					x: Math.round(f.x * 100) / 100,
					z: Math.round(f.z * 100) / 100,
					lift: Math.round(f.y * 100) / 100,
					yaw: Math.round(((f.yaw * 180) / Math.PI) * 10) / 10,
					scale: f.scale
				});
		}
	};
	walk(def.puts, ROOT, 0);
	return out;
}

export const SUBJECTS = [
	...MODELS.flatMap((m) => (m.tags ?? ['Models']).map((category) => ({ id: `model:${m.id}`, label: m.name, category }))),
	...PIECE_KEYS.map((k) => ({ id: `piece:${k}`, label: k, category: 'Buildings' })),
	...CHARACTERS.map((c) => ({ id: `character:${c.key}`, label: c.name.replace(/^The /, ''), category: 'Characters' }))
];

/** Metres per authored unit: buildings stand as they do on Main Street, a
 *  character is a person, a model is millimetres. */
const METRES: Record<SubjectKind, number> = { piece: 7, character: 1.25, model: 0.001, map: 1 };

/** One `Object3D`'s props, as the registry seeds them. */
export interface Object3D {
	subject: string;
	x: number;
	z: number;
	lift: number;
	/** Degrees, in the inspector's terms; a `Put` wants radians. */
	yaw: number;
	scale: number;
}

export const object3d = (item: CanvasItem) => item.props as unknown as Object3D;

/** A prop and the footprint it stands on, in metres at scale 1. */
interface Built {
	prop: MapProp;
	materials: Record<string, MapMaterial>;
	radius: number;
	tall: number;
	/** Footprint bounds in the prop's own (e, n). */
	box: { e0: number; e1: number; n0: number; n1: number };
}

/** A CSS colour as a map tone: `var(--x)` is the token `--x`. */
const tone = (css: string) => css.match(/^var\((--[\w-]+)\)$/)?.[1] ?? css;

function geometry(kind: SubjectKind, key: string): { solids: Solid[]; colors?: string[] } | null {
	if (kind === 'piece') return ALL_PIECES[key] ? { solids: ALL_PIECES[key] } : null;
	if (kind === 'character') {
		const c = CHARACTERS.find((x) => x.key === key);
		if (!c) return null;
		const painted = figureParts(c);
		return { solids: painted.map((p) => p.solid), colors: painted.map((p) => p.color) };
	}
	const m = MODELS.find((x) => x.id === key);
	const parts = m?.build({ exploded: false }, m.knobs ?? []) ?? [];
	return {
		solids: parts.flatMap((p) => p.solids),
		colors: parts.flatMap((p) => p.solids.map((_, i) => p.colors?.[i] ?? PART_FILL[p.kind]))
	};
}

// The same MapProp object every time, so `composeMap`'s mesh cache (a WeakMap
// on the prop) bakes each subject once rather than on every edit.
const cache = new Map<string, Built | null>();

/** The solids' bounds in their own frame, metres: the box the selection draws
 *  and the camera frames, and the footprint a click picks by. No floor beyond
 *  a millimetre — a printed figure is 15 cm and must not frame like a house. */
function extent(solids: Solid[]) {
	const vs = solids.flatMap((sol) => sol.verts);
	if (!vs.length) return { radius: 0.1, tall: 0.1, box: { e0: -0.05, e1: 0.05, n0: -0.05, n1: 0.05 } };
	const es = vs.map((v) => v.e);
	const ns = vs.map((v) => v.n);
	return {
		radius: Math.max(0.001, ...vs.map((v) => Math.hypot(v.e, v.n))),
		tall: Math.max(0.001, ...vs.map((v) => v.h)),
		box: { e0: Math.min(...es), e1: Math.max(...es), n0: Math.min(...ns), n1: Math.max(...ns) }
	};
}

export function subjectProp(subject: string): Built | null {
	if (cache.has(subject)) return cache.get(subject)!;
	const s = parseSubject(subject);
	if (s?.kind === 'map') {
		// Already a map prop in metres: renamed, not rebuilt.
		const mapId = s.key.slice(0, s.key.indexOf(':'));
		const set = mapProps(mapId);
		const prop = set?.props[subject];
		// Solids may be empty: a prop can be only a light (a candle's flame).
		const built = prop ? { prop, materials: set!.materials, ...extent(prop.solids) } : null;
		// Not cached while the maps are unknown: a page saved with a map's props
		// reloads before the route has handed the maps in.
		if (set) cache.set(subject, built);
		return built;
	}
	const g = s && geometry(s.kind, s.key);
	let built: Built | null = null;
	if (s && g?.solids.length) {
		const k = METRES[s.kind];
		const solids = g.solids.map((sol) => ({
			faces: sol.faces,
			verts: sol.verts.map((v) => ({ e: v.e * k, n: v.n * k, h: v.h * k }))
		}));
		const materials: Record<string, MapMaterial> = {};
		let material: string | string[];
		if (g.colors) {
			material = g.colors.map((c) => {
				const id = `c:${c}`;
				materials[id] ??= { face: tone(c) };
				return id;
			});
		} else {
			material = 'building';
			materials.building = { face: ['--border-strong', '--accent', 0.35], edge: '--accent' };
		}
		built = {
			// Models are cut and carved, so their solids need not be convex and
			// `composeMap` cannot hull them: walked through, like desk clutter.
			// ponytail: no collision on models or characters; split them into
			// convex pieces if a scene needs to be walked into them.
			prop: { solids, material, ghost: s.kind !== 'piece' },
			materials,
			...extent(solids)
		};
	}
	cache.set(subject, built);
	return built;
}

/** A map tone as CSS Model Studio can paint: a token, a colour, or a mix. */
function toneCss(t: Tone): string {
	const css = (s: string) => (s.startsWith('--') ? `var(${s})` : s);
	return typeof t === 'string' ? css(t) : `color-mix(in oklab, ${css(t[0])} ${Math.round((1 - t[2]) * 100)}%, ${css(t[1])})`;
}

/** A map prop as a Model, so Model Studio can show it on its own. Metres in,
 *  millimetres out — the studio's unit — and no floor grid, which is sized for
 *  a printed part rather than a desk. */
export function mapPropModel(subject: string): Model | undefined {
	const b = parseSubject(subject)?.kind === 'map' ? subjectProp(subject) : null;
	if (!b) return undefined;
	const ids = typeof b.prop.material === 'string' ? b.prop.solids.map(() => b.prop.material as string) : b.prop.material;
	const solids = b.prop.solids.map((s) => ({ faces: s.faces, verts: s.verts.map((v) => ({ e: v.e * 1000, n: v.n * 1000, h: v.h * 1000 })) }));
	const size = Math.max(b.box.e1 - b.box.e0, b.box.n1 - b.box.n0, b.tall) * 1000;
	const name = subject.slice(subject.lastIndexOf(':') + 1);
	return {
		id: subject,
		name,
		blurb: 'BREACH map prop',
		zoom: 230 / size,
		pivot: (b.tall * 1000) / 2,
		grid: 0,
		build: () => [
			{ id: name, label: name, kind: 'part', size: '', solids, colors: ids.map((m) => toneCss(b.materials[m]?.face ?? '--fg-dim')) }
		],
		stats: []
	};
}

/** Half-width of the ground, metres. */
export const SCENE_HALF = 60;

/** The page as a map: every visible object put where its props say, on a
 *  plain ground with a 1 m grid — or, for a page imported from a BREACH map
 *  (`base`), on that map's own floor, light, spawn and bounds, with all of its
 *  props along so their slots still fill. */
export function sceneMap(items: CanvasItem[], id = 'scene', label = 'Scene', base?: string): MapDef {
	const W = SCENE_HALF;
	const src = base ? MAPS.get(base) : undefined;
	const set = base ? mapProps(base) : null;
	const def: MapDef =
		src && set
			? {
					id,
					label,
					materials: { ...set.materials },
					props: { ...set.props },
					puts: [],
					floor: src.floor?.map((l) => ({ ...l, material: `${base}/${l.material}` })),
					grid: src.grid && { ...src.grid, material: `${base}/${src.grid.material}` },
					spawn: src.spawn,
					bounds: src.bounds,
					landmarks: src.landmarks,
					ambient: src.ambient
				}
			: {
					id,
					label,
					materials: { ground: { face: '--bg-elev', lit: 0 }, grid: { face: '--border', lit: 0 } },
					props: {},
					puts: [],
					floor: [{ material: 'ground', rects: [[-W, W, -W, W]] }],
					grid: { step: 1, material: 'grid' },
					spawn: { x: 0, y: 0, z: 8 },
					bounds: { x0: -W + 1, x1: W - 1, z0: -W + 1, z1: W - 1 }
				};
	for (const item of items) {
		if (item.componentId !== OBJECT3D || !item.visible) continue;
		const o = object3d(item);
		const b = subjectProp(o.subject);
		if (!b) continue;
		def.props[o.subject] = b.prop;
		Object.assign(def.materials, b.materials);
		def.puts.push({ prop: o.subject, x: o.x, y: o.lift, z: o.z, yaw: (o.yaw * Math.PI) / 180, scale: o.scale });
	}
	return def;
}

/** The visible object whose footprint holds this ground point, nearest first. */
export function pickAt(items: CanvasItem[], x: number, z: number): CanvasItem | null {
	let best: CanvasItem | null = null;
	let bestD = Infinity;
	for (const item of items) {
		if (item.componentId !== OBJECT3D || !item.visible) continue;
		const o = object3d(item);
		const b = subjectProp(o.subject);
		const d = Math.hypot(x - o.x, z - o.z);
		if (b && d <= b.radius * o.scale && d < bestD) {
			best = item;
			bestD = d;
		}
	}
	return best;
}
