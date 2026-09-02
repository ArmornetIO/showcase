/**
 * Keeps the registry and the renderers honest about each other.
 *
 * Rendering is split two ways: `renderer/groups.ts` maps a registry id to a
 * render group, and that group's `.svelte` file holds the branch. Both halves
 * can drift, so this suite checks both — a component added to REGISTRY with
 * `placeable: true` fails here until it is routed to a group AND that group's
 * file actually renders it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { REGISTRY } from './registry.js';
import { RENDER_GROUPS, groupFor } from './renderer/groups.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sourceOf = (file: string) => readFileSync(join(__dirname, 'renderer', file), 'utf8');

/** Matches the branch a renderer uses to claim an id: `componentId === 'Foo'`. */
const branchFor = (id: string) => new RegExp(`componentId === ['"]${id}['"]`);

describe('renderer coverage', () => {
	it('routes every placeable registry component to a render group', () => {
		const missing = REGISTRY.filter((r) => r.placeable && !groupFor(r.id)).map((r) => r.id);

		expect(
			missing,
			`These placeable components are in no render group:\n  ${missing.join(', ')}\n\n` +
				`Fix: add the id to a group's \`ids\` in renderer/groups.ts.`
		).toHaveLength(0);
	});

	it('has a render branch in the group file that claims each id', () => {
		const missing: string[] = [];

		for (const group of RENDER_GROUPS) {
			const src = sourceOf(group.file);
			for (const id of group.ids) {
				if (!branchFor(id).test(src)) missing.push(`${id} (claimed by ${group.file})`);
			}
		}

		expect(
			missing,
			`These ids are routed to a group whose file never renders them:\n  ${missing.join('\n  ')}\n\n` +
				`Fix: add a matching {#if componentId === '...'} branch in that file.`
		).toHaveLength(0);
	});

	it('never claims the same component in two groups', () => {
		const seen = new Map<string, string>();
		const dupes: string[] = [];

		for (const group of RENDER_GROUPS) {
			for (const id of group.ids) {
				const owner = seen.get(id);
				if (owner) dupes.push(`${id} — ${owner} and ${group.id}`);
				else seen.set(id, group.id);
			}
		}

		expect(dupes, `These ids are claimed by two render groups:\n  ${dupes.join('\n  ')}`).toHaveLength(0);
	});

	it('only claims ids that exist in the registry', () => {
		const known = new Set(REGISTRY.map((r) => r.id));
		const unknown = RENDER_GROUPS.flatMap((g) =>
			g.ids.filter((id) => !known.has(id)).map((id) => `${id} (${g.id})`)
		);

		expect(
			unknown,
			`These render-group ids are not in REGISTRY — stale after a rename?\n  ${unknown.join('\n  ')}`
		).toHaveLength(0);
	});

	it('never renders an overlay component as a canvas item', () => {
		// Overlays (placeable: false) are opened BY a trigger — NodeDrawer and
		// Modal are used inside TriggerOverlays, which is correct. What must not
		// exist is a group claiming them as a droppable component.
		const overlays = REGISTRY.filter((r) => !r.placeable).map((r) => r.id);
		const wronglyRouted = overlays.filter((id) => groupFor(id));

		expect(
			wronglyRouted,
			`These overlay components are routed to a render group — they should only appear as triggered overlays:\n  ${wronglyRouted.join(', ')}`
		).toHaveLength(0);
	});
});
