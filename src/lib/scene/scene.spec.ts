import { describe, it, expect } from 'vitest';
import {
	sceneStateAt,
	beatIndexAt,
	beatEnd,
	beatProgressAt,
	cueAt,
	resolveTargets,
	spinElapsedAt,
	ease,
} from './state.js';
import { resolvePlacement, planPlacement, placementAt, globePoseAt } from './place.js';
import { spin, project } from '../physics/sphere.js';
import { serializeScene, sceneBrief } from './serialize.js';
import { SAMPLE_SCENE } from './sample-scene.js';
import { CHANNELS, BURSTS, vocabularyFor, channelById } from './vocabulary.js';
import {
	COMPONENT_CHANNELS,
	channelsForComponent,
	componentChannelStats,
} from './component-channels.js';
import { REGISTRY } from '../builder/registry.js';
import { validateScene } from './validate.js';
import type { Scene, SceneObject } from './types.js';

const S = SAMPLE_SCENE;
const nodeIn = (objs: SceneObject[], id: string) => objs.find((o) => o.id === id)!;

describe('the purity invariant', () => {
	it('returns an identical picture for the same time, every time', () => {
		// The whole tool rests on this. If evaluating twice can differ, scrubbing
		// is a guess and the timeline lies.
		for (const t of [0, 1234, 7000, 12500, 19999]) {
			const a = sceneStateAt(S, t);
			const b = sceneStateAt(S, t);
			expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		}
	});

	it('does not depend on how you got there', () => {
		// Walk the whole run at frame cadence, then evaluate the target time. If
		// anything accumulated between calls, the walked answer would differ from
		// the jumped one — which is exactly the bug that made the old score's
		// frame-counted spin unscrubbale.
		const direct = sceneStateAt(S, 14000);
		for (let t = 0; t < 14000; t += 33) sceneStateAt(S, t);
		const stepped = sceneStateAt(S, 14000);
		expect(JSON.stringify(stepped)).toBe(JSON.stringify(direct));
	});

	it('never mutates the scene it is given', () => {
		// Asserted against KNOWN values, not against a snapshot taken inside this
		// test. A self-comparison passes vacuously if an earlier evaluation already
		// corrupted the scene — which is exactly how a shallow copy of
		// `component.props` hid until a cue finally addressed a nested container.
		const card = () => S.objects.find((o) => o.id === 'verdict')!.component!;
		const agent = () => S.objects.find((o) => o.id === 'agent-04')!.node!;
		expect(card().props.title).toBe('REROUTED');
		expect(card().opacity).toBe(0);
		expect(agent().state).toBe('healthy');

		for (let t = 0; t < S.runMs; t += 250) sceneStateAt(S, t);

		expect(card().props.title, 'nested props leaked').toBe('REROUTED');
		expect(card().opacity).toBe(0);
		expect(agent().state).toBe('healthy');
	});
});

describe('beats', () => {
	it('covers the whole run with no gap', () => {
		for (let t = 0; t < S.runMs; t += 100) {
			expect(sceneStateAt(S, t).beat, `t=${t}`).toBeDefined();
		}
	});

	it('ends each beat where the next begins', () => {
		S.beats.forEach((b, i) => {
			expect(beatEnd(S, i)).toBe(i + 1 < S.beats.length ? S.beats[i + 1].at : S.runMs);
			expect(beatEnd(S, i)).toBeGreaterThan(b.at);
		});
	});

	it('runs beat progress 0 → 1 inside each beat', () => {
		S.beats.forEach((b, i) => {
			expect(beatProgressAt(S, b.at)).toBe(0);
			expect(beatProgressAt(S, beatEnd(S, i) - 1)).toBeGreaterThan(0.9);
		});
	});

	it('clamps outside the run', () => {
		expect(beatIndexAt(S, -5000)).toBe(0);
		expect(beatProgressAt(S, S.runMs * 2)).toBe(1);
	});
});

describe('cue anchoring', () => {
	it('moves an anchored cue when its beat is retimed', () => {
		// This is what makes a timeline survivable to edit: drag a boundary and
		// the cues inside travel with it instead of being orphaned mid-sentence.
		const cue = S.cues.find((c) => c.anchor)!;
		const before = cueAt(S, cue);
		const shifted: Scene = {
			...S,
			beats: S.beats.map((b) => (b.id === cue.anchor!.beatId ? { ...b, at: b.at + 1500 } : b)),
		};
		expect(cueAt(shifted, cue)).toBe(before + 1500);
	});

	it('leaves an absolute cue where it is', () => {
		const abs = { ...S.cues[0], id: 'abs', anchor: undefined, at: 4321 };
		const shifted: Scene = { ...S, beats: S.beats.map((b) => ({ ...b, at: b.at + 1500 })) };
		expect(cueAt(shifted, abs)).toBe(4321);
	});
});

describe('selectors', () => {
	it('expands a tag to every member', () => {
		const hit = resolveTargets(S, 'tag:agent');
		expect(hit.length).toBe(6);
		expect(hit.every((o) => o.kind === 'mesh.node')).toBe(true);
	});

	it('expands a kind', () => {
		expect(resolveTargets(S, 'kind:mesh.edge').length).toBe(
			S.objects.filter((o) => o.kind === 'mesh.edge').length,
		);
	});

	it('resolves a plain id to exactly one object, and an unknown id to none', () => {
		expect(resolveTargets(S, 'agent-04')).toHaveLength(1);
		expect(resolveTargets(S, 'nope')).toHaveLength(0);
	});

	it('staggers a set so the members do not all fire together', () => {
		const cue = S.cues.find((c) => c.stagger)!;
		const base = cueAt(S, cue);
		// Just after onset only the first target has begun moving.
		const early = sceneStateAt(S, base + 10).objects;
		const late = sceneStateAt(S, base + cue.stagger! * 5 + 400).objects;
		const first = nodeIn(early, 'agent-01').node!.flow;
		const firstLate = nodeIn(late, 'agent-01').node!.flow;
		expect(firstLate).toBeGreaterThan(first);
	});
});

describe('channels', () => {
	it('holds a step value from its onset onward', () => {
		const cue = S.cues.find((c) => c.channel === 'node.state')!;
		const at = cueAt(S, cue);
		expect(nodeIn(sceneStateAt(S, at - 50).objects, 'agent-04').node!.state).toBe('healthy');
		expect(nodeIn(sceneStateAt(S, at + 50).objects, 'agent-04').node!.state).toBe('offline');
		// …and still holds much later. A channel is total: there is no `t` at
		// which its value is undefined.
		expect(nodeIn(sceneStateAt(S, S.runMs - 1).objects, 'agent-04').node!.state).toBe('offline');
	});

	it('interpolates a lerp across its span and pins the endpoints', () => {
		const cue = S.cues.find((c) => c.id === 'c2')!;
		const at = cueAt(S, cue);
		const start = nodeIn(sceneStateAt(S, at).objects, 'agent-04').node!.flow;
		const mid = nodeIn(sceneStateAt(S, at + cue.dur / 2).objects, 'agent-04').node!.flow;
		const end = nodeIn(sceneStateAt(S, at + cue.dur).objects, 'agent-04').node!.flow;
		expect(start).toBeCloseTo(0.4, 5);
		expect(end).toBeCloseTo(0, 5);
		expect(mid).toBeLessThan(start);
		expect(mid).toBeGreaterThan(end);
	});

	it('leaves an object at its declared value before any cue touches it', () => {
		expect(nodeIn(sceneStateAt(S, 0).objects, 'agent-04').node!.flow).toBeCloseTo(0.4, 5);
		expect(sceneStateAt(S, 0).objects.find((o) => o.id === 'verdict')!.component!.opacity).toBe(0);
	});

	it('coerces a boolean step channel out of its string form', () => {
		const cue = S.cues.find((c) => c.channel === 'edge.active')!;
		const after = sceneStateAt(S, cueAt(S, cue) + 100).objects;
		expect(after.find((o) => o.id === 'e-04')!.edge!.active).toBe(false);
	});
});

describe('bursts', () => {
	it('is alight only inside its span', () => {
		const cue = S.cues.find((c) => c.burst)!;
		const at = cueAt(S, cue);
		expect(sceneStateAt(S, at - 50).bursts).toHaveLength(0);
		expect(sceneStateAt(S, at + 50).bursts).toHaveLength(1);
		expect(sceneStateAt(S, at + cue.dur + 50).bursts).toHaveLength(0);
	});

	it('reports progress so the renderer can draw it mid-flight', () => {
		const cue = S.cues.find((c) => c.burst)!;
		const b = sceneStateAt(S, cueAt(S, cue) + cue.dur / 2).bursts[0];
		expect(b.progress).toBeGreaterThan(0.4);
		expect(b.progress).toBeLessThan(0.6);
	});

	it('is capped short — a burst may never carry the story', () => {
		// Scrubbing INTO a burst restarts it rather than showing it mid-flight.
		// That lie is only tolerable while bursts are brief and decorative.
		for (const b of BURSTS) expect(b.maxMs, b.id).toBeLessThanOrEqual(1200);
	});
});

describe('placement', () => {
	it('places every node and component', () => {
		const p = resolvePlacement(S);
		for (const o of S.objects) {
			if (o.kind === 'mesh.edge') continue;
			expect(p.has(o.id), o.id).toBe(true);
		}
	});

	it('leaves a pinned node exactly where it was put', () => {
		const p = resolvePlacement(S);
		const pinnedObj = S.objects.find((o) => o.place.mode === 'pinned')!;
		expect(p.get(pinnedObj.id)!.x).toBeCloseTo(pinnedObj.place.x!, 6);
		expect(p.get(pinnedObj.id)!.y).toBeCloseTo(pinnedObj.place.y!, 6);
	});

	it('leaves a hand-placed component exactly where it was put', () => {
		const p = resolvePlacement(S);
		const fixed = S.objects.find((o) => o.place.mode === 'fixed')!;
		expect(p.get(fixed.id)!.x).toBeCloseTo(fixed.place.x!, 6);
		expect(p.get(fixed.id)!.y).toBeCloseTo(fixed.place.y!, 6);
	});

	it('keeps solved nodes clear of each other', () => {
		const p = resolvePlacement(S);
		const nodes = S.objects.filter((o) => o.kind === 'mesh.node');
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const a = p.get(nodes[i].id)!;
				const b = p.get(nodes[j].id)!;
				const gap = Math.hypot(a.x - b.x, a.y - b.y) - nodes[i].node!.r - nodes[j].node!.r;
				expect(gap, `${nodes[i].id} ↔ ${nodes[j].id}`).toBeGreaterThan(-1);
			}
		}
	});

	it('is deterministic', () => {
		const a = resolvePlacement(S);
		const b = resolvePlacement(S);
		for (const [k, v] of a) {
			expect(b.get(k)!.x).toBeCloseTo(v.x, 6);
			expect(b.get(k)!.y).toBeCloseTo(v.y, 6);
		}
	});

	it('packs solved nodes around a pinned obstacle rather than through it', () => {
		// The claim the whole placement model rests on: a hand-placed thing is an
		// immovable body in the SAME solve, not a separate system.
		const p = resolvePlacement(S);
		const proxy = p.get('proxy-1')!;
		const proxyR = S.objects.find((o) => o.id === 'proxy-1')!.node!.r;
		for (const o of S.objects.filter((x) => x.kind === 'mesh.node' && x.id !== 'proxy-1')) {
			const q = p.get(o.id)!;
			expect(Math.hypot(q.x - proxy.x, q.y - proxy.y)).toBeGreaterThan(proxyR);
		}
	});
});

describe('globe layout', () => {
	const G: Scene = {
		...S,
		layout: 'globe',
		beats: S.beats.map((b, i) => ({ ...b, spin: i >= 1 })),
	};

	it('plans directions rather than coordinates', () => {
		const plan = planPlacement(G);
		expect(plan.mode).toBe('globe');
		expect(plan.globe!.radius).toBeGreaterThan(G.hub.r);
		// Every mesh node gets a bearing; a globe node has no stored x/y.
		for (const o of G.objects.filter((x) => x.kind === 'mesh.node')) {
			expect(plan.globe!.dirs.has(o.id), o.id).toBe(true);
		}
	});

	it('puts every direction on the unit sphere', () => {
		const plan = planPlacement(G);
		for (const [id, d] of plan.globe!.dirs) {
			expect(Math.hypot(d.x, d.y, d.z), id).toBeCloseTo(1, 6);
		}
	});

	it('projects to different positions as the globe turns', () => {
		const plan = planPlacement(G);
		const a = placementAt(G, plan, G.beats[1].at);
		const b = placementAt(G, plan, G.beats[1].at + 3000);
		const id = [...plan.globe!.dirs.keys()][0];
		expect(a.get(id)!.x).not.toBeCloseTo(b.get(id)!.x, 3);
	});

	it('holds still through a beat that does not spin', () => {
		const plan = planPlacement(G);
		const id = [...plan.globe!.dirs.keys()][0];
		// Beat 0 has spin off, so nothing may drift inside it.
		const a = placementAt(G, plan, 100);
		const b = placementAt(G, plan, G.beats[1].at - 100);
		expect(a.get(id)!.x).toBeCloseTo(b.get(id)!.x, 6);
	});

	it('reaches the same orientation by scrub as by playback', () => {
		// The property the whole timeline depends on, now for the globe too.
		const plan = planPlacement(G);
		const id = [...plan.globe!.dirs.keys()][0];
		const direct = placementAt(G, plan, 12000).get(id)!;
		for (let t = 0; t < 12000; t += 17) placementAt(G, plan, t);
		const walked = placementAt(G, plan, 12000).get(id)!;
		expect(walked.x).toBeCloseTo(direct.x, 9);
		expect(walked.y).toBeCloseTo(direct.y, 9);
	});

	it('carries perspective scale, depth and facing for the renderer', () => {
		const plan = planPlacement(G);
		const at = placementAt(G, plan, 6000);
		let sawFront = false;
		let sawBack = false;
		for (const [, p] of at) {
			if (p.scale === undefined) continue;
			expect(p.scale).toBeGreaterThan(0);
			if (p.front) sawFront = true;
			else sawBack = true;
		}
		// A sphere with 7 bodies must have both faces occupied, or it is a ring.
		expect(sawFront && sawBack).toBe(true);
	});

	it('turns the wireframe with the same pose the nodes project through', () => {
		const pose = globePoseAt(G, 9000);
		const plan = planPlacement(G);
		const id = [...plan.globe!.dirs.keys()][0];
		const dir = plan.globe!.dirs.get(id)!;
		const p = project(spin(dir, pose.yaw, pose.pitch), plan.globe!.radius, pose.viewDistance);
		expect(placementAt(G, plan, 9000).get(id)!.x).toBeCloseTo(G.hub.x + p.x, 9);
	});

	it('leaves hand-placed components off the shell', () => {
		const plan = planPlacement(G);
		const fixed = G.objects.find((o) => o.place.mode === 'fixed')!;
		const at = placementAt(G, plan, 8000);
		expect(at.get(fixed.id)!.x).toBeCloseTo(fixed.place.x!, 6);
		expect(at.get(fixed.id)!.scale).toBeUndefined();
	});

	it('does not run the planar solver for a globe scene', () => {
		// resolvePlacement bails on globe — the sphere is not its job, and running
		// it would produce x/y that nothing reads and that would drift from the
		// projection.
		expect(resolvePlacement(G).size).toBe(0);
	});
});

describe('vocabulary', () => {
	it('gives every channel and burst a unique id', () => {
		const ids = [...CHANNELS.map((c) => c.id), ...BURSTS.map((b) => b.id)];
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('scopes the picker to what the selection can actually do', () => {
		const forEdge = vocabularyFor('mesh.edge');
		expect(forEdge.channels.every((c) => c.kinds.includes('mesh.edge'))).toBe(true);
		expect(forEdge.channels.some((c) => c.id.startsWith('node.'))).toBe(false);
	});

	it('gives every step channel its legal options, and every lerp a range', () => {
		for (const c of CHANNELS) {
			if (c.type === 'lerp') expect(c.range, c.id).toBeDefined();
		}
	});

	it('only references channels that exist, from the sample scene', () => {
		for (const c of S.cues) {
			if (c.channel) expect(channelById(c.channel), c.channel).toBeDefined();
			if (c.burst) expect(BURSTS.some((b) => b.id === c.burst), c.burst).toBe(true);
		}
	});
});

describe('component channels generated from the builder registry', () => {
	it('covers a large share of the library without anyone authoring a list', () => {
		const stats = componentChannelStats();
		// The whole point: reach comes from derivation, not from hand-maintenance.
		expect(stats.components).toBeGreaterThan(40);
		expect(stats.channels).toBeGreaterThan(200);
	});

	it('derives interpolation from PropDef.kind', () => {
		const card = REGISTRY.find((r) => r.id === 'Card')!;
		for (const [key, def] of Object.entries(card.props)) {
			if (key.startsWith('__')) continue;
			const ch = COMPONENT_CHANNELS.get(`props.Card.${key}`);
			if (def.kind === 'textarea') {
				// Prose is not swapped mid-scene; that reads as a glitch.
				expect(ch, key).toBeUndefined();
			} else if (def.kind === 'number') {
				expect(ch?.type, key).toBe('lerp');
			} else {
				expect(ch?.type, key).toBe('step');
			}
		}
	});

	it('carries a range for every lerp and options for every enum', () => {
		for (const ch of COMPONENT_CHANNELS.values()) {
			if (ch.type === 'lerp') expect(ch.range, ch.id).toBeDefined();
		}
		const type = COMPONENT_CHANNELS.get('props.Card.type')!;
		expect(type.options).toContain('stat');
		expect(type.options).toContain('hud');
	});

	it('gives booleans their two legal steps', () => {
		const boolCh = [...COMPONENT_CHANNELS.values()].find(
			(c) => c.options?.length === 2 && c.options.includes('true') && c.options.includes('false'),
		);
		expect(boolCh).toBeDefined();
	});

	it('never exposes builder-internal plumbing as a channel', () => {
		for (const id of COMPONENT_CHANNELS.keys()) {
			expect(id.split('.').slice(2).join('.').startsWith('__'), id).toBe(false);
		}
	});

	it('scopes channel ids by component, so two `title` props cannot collide', () => {
		const withTitle = REGISTRY.filter((r) => 'title' in r.props).map((r) => r.id);
		expect(withTitle.length).toBeGreaterThan(1);
		for (const id of withTitle) {
			// Present only if `title` is animatable for that component; when it is,
			// the id must be component-scoped.
			const ch = COMPONENT_CHANNELS.get(`props.${id}.title`);
			if (ch) expect(ch.path).toBe('component.props.title');
		}
		expect(new Set(withTitle.map((id) => `props.${id}.title`)).size).toBe(withTitle.length);
	});

	it('hides a prop the component’s current configuration does not render', () => {
		// Card.title is showWhen type ∈ [composite, article, data-input, doc, hud].
		// Offering a cue that drives a title a 'stat' Card never draws would be a
		// trap, not a vocabulary.
		const asHud = channelsForComponent('Card', { type: 'hud' }).map((c) => c.id);
		const asStat = channelsForComponent('Card', { type: 'stat' }).map((c) => c.id);
		expect(asHud).toContain('props.Card.title');
		expect(asStat).not.toContain('props.Card.title');
	});

	it('falls back to the controlling prop’s default when the instance never set it', () => {
		// Card's `type` defaults to 'stat', so an untouched instance behaves as one.
		const untouched = channelsForComponent('Card', {}).map((c) => c.id);
		const asStat = channelsForComponent('Card', { type: 'stat' }).map((c) => c.id);
		expect(untouched).toEqual(asStat);
	});

	it('resolves a generated channel through the same lookup as a hand-written one', () => {
		expect(channelById('node.state')).toBeDefined();
		expect(channelById('props.Card.title')).toBeDefined();
		expect(channelById('props.Card.nope')).toBeUndefined();
	});

	it('offers generated props alongside the wrapper channels for a component', () => {
		const v = vocabularyFor('component', 'Card', { type: 'hud' });
		expect(v.channels.some((c) => c.id === 'component.opacity')).toBe(true);
		expect(v.channels.some((c) => c.id === 'props.Card.title')).toBe(true);
		// …and never leaks them onto a mesh node.
		expect(vocabularyFor('mesh.node').channels.some((c) => c.id.startsWith('props.'))).toBe(false);
	});

	it('drives a real registry prop end to end', () => {
		// The sample scene sets Card's `title` through a generated channel. If the
		// path or the lookup were wrong this is where it shows.
		const cue = S.cues.find((c) => c.channel === 'props.Card.title')!;
		const at = cueAt(S, cue);
		const before = sceneStateAt(S, at - 50).objects.find((o) => o.id === 'verdict')!;
		const after = sceneStateAt(S, at + 50).objects.find((o) => o.id === 'verdict')!;
		expect(before.component!.props.title).toBe('REROUTED');
		expect(after.component!.props.title).toBe('HEALTHY');
	});

	it('honours an explicit PropDef.animate override where one is set', () => {
		// None are set today — the defaults are meant to be right. This asserts the
		// override path exists and is wired, so the escape hatch is real.
		for (const meta of REGISTRY) {
			for (const [key, def] of Object.entries(meta.props)) {
				if (def.animate !== 'none') continue;
				expect(COMPONENT_CHANNELS.has(`props.${meta.id}.${key}`), `${meta.id}.${key}`).toBe(false);
			}
		}
	});
});

describe('scene integrity', () => {
	it('gives every object, beat and cue a unique id', () => {
		for (const list of [S.objects, S.beats, S.cues]) {
			const ids = list.map((x) => x.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('never targets a cue at something that is not there', () => {
		for (const c of S.cues) {
			expect(resolveTargets(S, c.target).length, c.target).toBeGreaterThan(0);
		}
	});

	it('wires every edge between real endpoints', () => {
		const ids = new Set([...S.objects.map((o) => o.id), '__hub__']);
		for (const o of S.objects) {
			if (!o.edge) continue;
			expect(ids.has(o.edge.from), o.edge.from).toBe(true);
			expect(ids.has(o.edge.to), o.edge.to).toBe(true);
		}
	});

	it('keeps every cue inside the run', () => {
		for (const c of S.cues) expect(cueAt(S, c) + c.dur).toBeLessThanOrEqual(S.runMs);
	});

	it('points every flyTo at a real object', () => {
		const ids = new Set(S.objects.map((o) => o.id));
		for (const b of S.beats) {
			if (b.camera.kind === 'flyTo') expect(ids.has(b.camera.target), b.camera.target).toBe(true);
		}
	});
});

describe('validateScene', () => {
	it('passes the shipped sample', () => {
		// The sample is the tool's own showcase — it shipping with a dead beat is
		// exactly what this function exists to prevent.
		expect(validateScene(S).filter((i) => i.severity === 'error')).toEqual([]);
	});

	it('catches a prop the component’s configuration hides', () => {
		// The real defect: Card only renders `title` for composite/article/
		// data-input/doc/hud, and defaults to 'stat'. Setting title on a stat Card
		// renders nothing and makes any cue on it a silent no-op.
		const bad: Scene = {
			...S,
			objects: S.objects.map((o) =>
				o.id === 'verdict'
					? { ...o, component: { ...o.component!, props: { type: 'stat', title: 'X' } } }
					: o,
			),
		};
		const hit = validateScene(bad).find((i) => i.message.includes('only renders it when'));
		expect(hit).toBeDefined();
		expect(hit!.where).toBe('verdict');
	});

	it('catches a cue pointing at a channel that does not exist', () => {
		const bad: Scene = { ...S, cues: [{ ...S.cues[0], channel: 'node.nope' }] };
		expect(validateScene(bad).some((i) => i.message.includes('unknown channel'))).toBe(true);
	});

	it('catches a cue targeting nothing', () => {
		const bad: Scene = { ...S, cues: [{ ...S.cues[0], target: 'ghost' }] };
		expect(validateScene(bad).some((i) => i.message.includes('matches nothing'))).toBe(true);
	});

	it('catches an edge wired to a missing endpoint', () => {
		const bad: Scene = {
			...S,
			objects: S.objects.map((o) =>
				o.id === 'e-01' ? { ...o, edge: { ...o.edge!, to: 'gone' } } : o,
			),
		};
		expect(validateScene(bad).some((i) => i.message.includes('which is missing'))).toBe(true);
	});

	it('catches a camera flying to something that is not there', () => {
		const bad: Scene = {
			...S,
			beats: S.beats.map((b, i) =>
				i === 1 ? { ...b, camera: { kind: 'flyTo' as const, target: 'nobody' } } : b,
			),
		};
		expect(validateScene(bad).some((i) => i.message.includes('not in the scene'))).toBe(true);
	});

	it('accepts the hub as a legal reference even though it is not an object', () => {
		// Every edge in the sample starts at __hub__; flagging that would make the
		// validator useless on day one.
		expect(validateScene(S).some((i) => i.message.includes('__hub__'))).toBe(false);
	});

	it('warns when a burst outruns its cap', () => {
		const b = S.cues.find((c) => c.burst)!;
		const bad: Scene = { ...S, cues: [{ ...b, dur: 9000 }] };
		expect(validateScene(bad).some((i) => i.message.includes('capped at'))).toBe(true);
	});

	it('warns when a lerp cue has no numeric target', () => {
		const c = S.cues.find((x) => x.channel === 'node.flow')!;
		const bad: Scene = { ...S, cues: [{ ...c, to: 'loads' }] };
		expect(validateScene(bad).some((i) => i.message.includes('is a lerp'))).toBe(true);
	});

	it('catches duplicate ids', () => {
		const bad: Scene = { ...S, objects: [...S.objects, S.objects[0]] };
		expect(validateScene(bad).some((i) => i.message.includes('duplicate object id'))).toBe(true);
	});
});

describe('serialisation', () => {
	it('emits a literal carrying every beat, object and cue', () => {
		const src = serializeScene(S);
		expect(src).toContain('export const SCENE: Scene');
		for (const o of S.objects) expect(src).toContain(`'${o.id}'`);
		for (const c of S.cues) expect(src).toContain(`'${c.id}'`);
		expect(src).toContain(`runMs: ${S.runMs}`);
	});

	it('escapes quotes in authored prose rather than producing broken source', () => {
		const tricky: Scene = {
			...S,
			beats: [{ ...S.beats[0], caption: "it's a 'quoted' caption" }],
		};
		const src = serializeScene(tricky);
		expect(src).toContain("\\'");
		expect(src).not.toContain("caption: 'it's");
	});

	it('puts the legal vocabulary in the AI brief', () => {
		// An assistant that knows 'blocked' is legal and 'severed' is not writes a
		// patch that applies on the first try.
		const brief = sceneBrief(S, 'tighten the reroute', ['edge.style (step: blocked|energy)']);
		expect(brief).toContain('edge.style');
		expect(brief).toContain('tighten the reroute');
		expect(brief).toContain('preserving any explanatory comments');
	});
});

describe('easing', () => {
	it('pins both ends and stays inside them', () => {
		for (const id of ['linear', 'in', 'out', 'inOut'] as const) {
			expect(ease(id, 0)).toBeCloseTo(0, 6);
			expect(ease(id, 1)).toBeCloseTo(1, 6);
			expect(ease(id, 0.5)).toBeGreaterThan(0);
			expect(ease(id, 0.5)).toBeLessThan(1);
		}
	});

	it('clamps out-of-range input', () => {
		expect(ease('out', -1)).toBe(0);
		expect(ease('out', 2)).toBe(1);
	});
});

describe('spin', () => {
	it('banks nothing while every beat holds still', () => {
		// The sample scene is planar, so nothing spins — and the integral must say
		// so rather than quietly accumulating.
		expect(spinElapsedAt(S, S.runMs)).toBe(0);
	});

	it('accumulates only spin-enabled time, monotonically', () => {
		const spun: Scene = { ...S, beats: S.beats.map((b, i) => ({ ...b, spin: i === 1 })) };
		expect(spinElapsedAt(spun, spun.beats[1].at)).toBe(0);
		expect(spinElapsedAt(spun, beatEnd(spun, 1))).toBe(beatEnd(spun, 1) - spun.beats[1].at);
		// Beat 2 does not spin, so the total stops growing.
		expect(spinElapsedAt(spun, spun.runMs)).toBe(beatEnd(spun, 1) - spun.beats[1].at);
	});
});
