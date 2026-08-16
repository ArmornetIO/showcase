// ── validateScene — the check that makes editing safe ──────────────────────
// Written because the sample scene shipped with a dead beat: a Card left at its
// default `type: 'stat'` carried a `title` prop that Card only renders for
// composite/article/data-input/doc/hud, so the cue driving that title was a
// permanent no-op and nothing said a word.
//
// It matters most for the AI seam. An assistant returning a patch can invent a
// channel id, target something that isn't there, or set a prop the component's
// configuration hides. Running this on the way in is what makes accepting a
// patch safe rather than hopeful.

import type { Scene } from './types.js';
import { cueAt, resolveTargets, beatEnd } from './state.js';
import { channelById, burstById } from './vocabulary.js';
import { REGISTRY } from '../builder/registry.js';

export type Severity = 'error' | 'warn';

export interface Issue {
	severity: Severity;
	/** What it's about, for selecting the offender. */
	where: string;
	message: string;
}

export function validateScene(scene: Scene): Issue[] {
	const out: Issue[] = [];
	const err = (where: string, message: string) => out.push({ severity: 'error', where, message });
	const warn = (where: string, message: string) => out.push({ severity: 'warn', where, message });

	// ── Identity ───────────────────────────────────────────────────────────
	const seen = new Set<string>();
	for (const o of scene.objects) {
		if (seen.has(o.id)) err(o.id, `duplicate object id "${o.id}"`);
		seen.add(o.id);
	}
	const beatIds = new Set<string>();
	for (const b of scene.beats) {
		if (beatIds.has(b.id)) err(b.id, `duplicate beat id "${b.id}"`);
		beatIds.add(b.id);
	}

	/** `__hub__` is a legal reference everywhere even though it is not an object:
	 *  the crest is scene-level, and edges and cameras both address it. */
	const ids = new Set([...scene.objects.map((o) => o.id), '__hub__']);

	// ── Spine ──────────────────────────────────────────────────────────────
	if (!scene.beats.length) err('scene', 'a scene needs at least one beat');
	if (scene.beats[0] && scene.beats[0].at !== 0) warn(scene.beats[0].id, 'the first beat should start at 0');
	scene.beats.forEach((b, i) => {
		if (i && b.at <= scene.beats[i - 1].at) err(b.id, `beat ${i + 1} starts before the one before it`);
		if (beatEnd(scene, i) - b.at < 600) warn(b.id, `beat ${i + 1} is under 600ms — too short to read`);
		if (!b.caption.trim()) warn(b.id, `beat ${i + 1} has no caption`);
		const cam = b.camera;
		if (cam.kind === 'flyTo' && !ids.has(cam.target)) {
			err(b.id, `beat ${i + 1} flies to "${cam.target}", which is not in the scene`);
		}
	});

	// ── Wiring ─────────────────────────────────────────────────────────────
	for (const o of scene.objects) {
		if (!o.edge) continue;
		if (!ids.has(o.edge.from)) err(o.id, `edge "${o.name}" starts at "${o.edge.from}", which is missing`);
		if (!ids.has(o.edge.to)) err(o.id, `edge "${o.name}" ends at "${o.edge.to}", which is missing`);
	}

	// ── Components ─────────────────────────────────────────────────────────
	for (const o of scene.objects) {
		if (!o.component) continue;
		const meta = REGISTRY.find((r) => r.id === o.component!.componentId);
		if (!meta) {
			err(o.id, `"${o.component.componentId}" is not in the component registry`);
			continue;
		}
		// The bug this file exists for: a prop set while the component's own
		// configuration hides it renders nothing, and any cue on it is dead.
		for (const [key, def] of Object.entries(meta.props)) {
			if (!def.showWhen) continue;
			if (o.component.props[key] === undefined) continue;
			const ctrl = o.component.props[def.showWhen.key] ?? meta.props[def.showWhen.key]?.default ?? '';
			if (!def.showWhen.values.includes(String(ctrl))) {
				warn(
					o.id,
					`"${o.name}" sets ${key}, but ${meta.id} only renders it when ${def.showWhen.key} is one of ${def.showWhen.values.join('/')} (it is "${ctrl}")`,
				);
			}
		}
	}

	// ── Cues ───────────────────────────────────────────────────────────────
	for (const c of scene.cues) {
		if (!c.channel && !c.burst) err(c.id, 'cue has neither a channel nor a burst');
		if (c.channel && c.burst) err(c.id, 'cue has both a channel and a burst');
		if (c.channel && !channelById(c.channel)) err(c.id, `unknown channel "${c.channel}"`);
		if (c.burst) {
			const b = burstById(c.burst);
			if (!b) err(c.id, `unknown burst "${c.burst}"`);
			else if (c.dur > b.maxMs) {
				warn(c.id, `burst runs ${c.dur}ms but ${b.id} is capped at ${b.maxMs}ms — bursts must not carry the story`);
			}
		}
		if (!resolveTargets(scene, c.target).length) err(c.id, `targets "${c.target}", which matches nothing`);
		if (c.anchor && !beatIds.has(c.anchor.beatId)) err(c.id, `anchored to missing beat "${c.anchor.beatId}"`);
		const at = cueAt(scene, c);
		if (at < 0) err(c.id, 'starts before the run does');
		if (at + c.dur > scene.runMs) {
			warn(c.id, `ends at ${((at + c.dur) / 1000).toFixed(1)}s, past the ${(scene.runMs / 1000).toFixed(1)}s run`);
		}
		// A lerp with no numbers interpolates from a value to itself.
		const ch = c.channel ? channelById(c.channel) : undefined;
		if (ch?.type === 'lerp' && typeof c.to !== 'number') {
			warn(c.id, `${ch.id} is a lerp but "to" is not a number — it will hold instead of move`);
		}
	}

	return out;
}
