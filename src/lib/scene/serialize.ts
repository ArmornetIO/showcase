// ── Serialisation — out to TypeScript, never in from JSON ──────────────────
// Asymmetric on purpose. READ is `import` — typed, checked by `npm run check`,
// zero machinery. WRITE is a clipboard-bound TypeScript literal that a human or
// an assistant pastes.
//
// Not a file write, and not JSON. A scene file carries commented rationale
// ("this beat holds the globe still because flyTo needs a stationary target"),
// and an emitter that overwrites the file eats all of it silently. Putting the
// literal in front of a person is what preserves the prose.

import type { Scene } from './types.js';

function q(s: string): string {
	return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function lit(v: unknown): string {
	if (typeof v === 'string') return q(v);
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (v === null || v === undefined) return 'undefined';
	if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
	const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
	return `{ ${entries.map(([k, x]) => `${k}: ${lit(x)}`).join(', ')} }`;
}

export function serializeScene(scene: Scene): string {
	const beats = scene.beats
		.map(
			(b) =>
				`\t\t{ id: ${q(b.id)}, at: ${b.at}, caption: ${q(b.caption)},${b.sub ? ` sub: ${q(b.sub)},` : ''} spin: ${b.spin}, camera: ${lit(b.camera)} },`,
		)
		.join('\n');

	const objects = scene.objects
		.map((o) => {
			const parts = [
				`id: ${q(o.id)}`,
				`name: ${q(o.name)}`,
				`kind: ${q(o.kind)}`,
				`place: ${lit(o.place)}`,
			];
			if (o.tags?.length) parts.push(`tags: ${lit(o.tags)}`);
			// `iconMarkup` was being stripped here — silent data loss on any node
			// given a glyph, in an export whose whole justification is fidelity.
			if (o.node) parts.push(`node: ${lit(o.node)}`);
			if (o.edge) parts.push(`edge: ${lit(o.edge)}`);
			if (o.component) parts.push(`component: ${lit(o.component)}`);
			return `\t\t{ ${parts.join(', ')} },`;
		})
		.join('\n');

	const cues = scene.cues
		.map((c) => {
			const parts = [`id: ${q(c.id)}`, `target: ${q(c.target)}`];
			if (c.channel) parts.push(`channel: ${q(c.channel)}`);
			if (c.burst) parts.push(`burst: ${q(c.burst)}`);
			if (c.anchor) parts.push(`anchor: ${lit(c.anchor)}`);
			else parts.push(`at: ${c.at}`);
			parts.push(`dur: ${c.dur}`);
			if (c.from !== undefined) parts.push(`from: ${lit(c.from)}`);
			if (c.to !== undefined) parts.push(`to: ${lit(c.to)}`);
			if (c.ease) parts.push(`ease: ${q(c.ease)}`);
			if (c.stagger) parts.push(`stagger: ${c.stagger}`);
			// An anchored cue still carries `at` in the type; emit 0 so the literal
			// type-checks, and let `cueAt()` derive the real onset from the anchor.
			if (c.anchor) parts.push('at: 0');
			return `\t\t{ ${parts.join(', ')} },`;
		})
		.join('\n');

	return `import type { Scene } from '$lib/scene/types.js';

export const SCENE: Scene = {
	id: ${q(scene.id)},
	label: ${q(scene.label)},
	runMs: ${scene.runMs},
	layout: ${q(scene.layout)},
	hub: ${lit(scene.hub)},
	beats: [
${beats}
	],
	objects: [
${objects}
	],
	cues: [
${cues}
	],
};
`;
}

/**
 * The AI seam. Emits the scene plus what an assistant needs to produce a patch
 * that actually applies: the legal vocabulary, and the instruction to preserve
 * comments. An assistant that knows `'blocked'` is a legal edge style and
 * `'severed'` is not writes a usable patch on the first try — enumerating the
 * vocabulary is the single highest-return thing in this string.
 */
export function sceneBrief(scene: Scene, ask: string, vocabulary: string[]): string {
	return `I am editing a scene for the armornet scene builder (showcase/src/lib/scene/).

WHAT I WANT:
${ask.trim() || '(describe the change)'}

RULES:
- Reply with the full \`SCENE\` literal, preserving any explanatory comments already in the file.
- Object ids are stable — reference them, do not renumber.
- Cues anchored to a beat use \`anchor: { beatId, offset }\`; absolute cues use \`at\`.
- A channel cue needs \`channel\` + \`to\` (+ \`from\` for lerps). A burst cue needs \`burst\`.
- Only these channel/burst ids are legal:
${vocabulary.map((v) => `    ${v}`).join('\n')}

CURRENT SCENE:
\`\`\`ts
${serializeScene(scene)}\`\`\`
`;
}
