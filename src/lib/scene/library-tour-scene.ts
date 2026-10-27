// ── Library tour — "a component is a thing you can script" ────────────────
// The README's hero GIF (scripts/record-scenes.mjs films it). It acts out the
// agentic-layer claim in four beats: place a registry component, drive a
// number over time, step an enum on a cue, and run mesh nodes on the same
// timeline. Every prop cue below names a channel nobody wrote by hand —
// `props.<Component>.<prop>` is generated from the builder registry.
//
// The camera fits the mesh nodes, so the two agents and the hub mark the
// frame's corners and every component is placed inside them.

import type { Scene } from './types.js';

const ease = 'out' as const;

export const LIBRARY_TOUR_SCENE: Scene = {
	id: 'library-tour',
	label: 'A component is a thing you can script',
	runMs: 15000,
	layout: 'radial',
	hub: { x: 480, y: 120, r: 40 },

	beats: [
		{ id: 'b1', at: 0, caption: 'Put a component on the stage.', sub: 'StatTile, by its registry id', spin: false, camera: { kind: 'fit' } },
		{ id: 'b2', at: 3500, caption: 'Drive a number over time.', sub: 'RadialProgress.value 0 → 94, eased', spin: false, camera: { kind: 'fit' } },
		{ id: 'b3', at: 7500, caption: 'Step an enum on a cue.', sub: 'StatTile.subVariant up → down', spin: false, camera: { kind: 'fit' } },
		{ id: 'b4', at: 11000, caption: 'Nodes and components, one timeline.', sub: 'Scrub it, and every frame is exact', spin: false, camera: { kind: 'fit' } },
	],

	objects: [
		...(['west', 'east'] as const).map((side, i) => ({
			id: `agent-${side}`,
			name: `agent-${side}`,
			kind: 'mesh.node' as const,
			place: { mode: 'pinned' as const, x: i ? 820 : 140, y: 120 },
			tags: ['agent'],
			node: { type: 'agentic' as const, state: 'dormant' as const, label: side, r: 34, flow: 0, opacity: 1 },
		})),
		...(['west', 'east'] as const).map((side) => ({
			id: `e-${side}`,
			name: `hub → agent-${side}`,
			kind: 'mesh.edge' as const,
			place: { mode: 'solved' as const },
			tags: ['link'],
			edge: { from: '__hub__', to: `agent-${side}`, dataType: 'lifecycle' as const, style: 'latent' as const, sig: 0.2, active: false },
		})),
		{
			id: 'tile',
			name: 'StatTile',
			kind: 'component',
			place: { mode: 'fixed', x: 210, y: 300 },
			tags: ['stage'],
			component: {
				componentId: 'StatTile',
				props: { label: 'FINDINGS', value: '412', sub: '↑ 12% vs last week', subVariant: 'up' },
				w: 220,
				opacity: 0,
			},
		},
		{
			id: 'ring',
			name: 'RadialProgress',
			kind: 'component',
			place: { mode: 'fixed', x: 480, y: 300 },
			tags: ['stage'],
			component: { componentId: 'RadialProgress', props: { value: 0, size: 120, label: 'COVERAGE' }, w: 140, opacity: 0 },
		},
		{
			id: 'bar',
			name: 'ProgressBar',
			kind: 'component',
			place: { mode: 'fixed', x: 750, y: 300 },
			tags: ['stage'],
			component: { componentId: 'ProgressBar', props: { value: 0, label: 'Triaged', size: 'md' }, w: 240, opacity: 0 },
		},
	],

	cues: [
		// Beat 1 — the tile arrives.
		{ id: 'c-tile-in', target: 'tile', channel: 'component.opacity', anchor: { beatId: 'b1', offset: 600 }, at: 0, dur: 700, from: 0, to: 1, ease },

		// Beat 2 — two more components, and their numbers run.
		{ id: 'c-ring-in', target: 'ring', channel: 'component.opacity', anchor: { beatId: 'b2', offset: 0 }, at: 0, dur: 500, from: 0, to: 1, ease },
		{ id: 'c-bar-in', target: 'bar', channel: 'component.opacity', anchor: { beatId: 'b2', offset: 150 }, at: 0, dur: 500, from: 0, to: 1, ease },
		{ id: 'c-ring', target: 'ring', channel: 'props.RadialProgress.value', anchor: { beatId: 'b2', offset: 400 }, at: 0, dur: 2200, from: 0, to: 94, ease },
		{ id: 'c-bar', target: 'bar', channel: 'props.ProgressBar.value', anchor: { beatId: 'b2', offset: 600 }, at: 0, dur: 2400, from: 0, to: 72, ease },

		// Beat 3 — enums and text step at their cue; there is no value between.
		{ id: 'c-dir', target: 'tile', channel: 'props.StatTile.subVariant', anchor: { beatId: 'b3', offset: 500 }, at: 0, dur: 200, to: 'down' },
		{ id: 'c-sub', target: 'tile', channel: 'props.StatTile.sub', anchor: { beatId: 'b3', offset: 500 }, at: 0, dur: 200, to: '↓ 38% vs last week' },
		{ id: 'c-val', target: 'tile', channel: 'props.StatTile.value', anchor: { beatId: 'b3', offset: 500 }, at: 0, dur: 200, to: '256' },

		// Beat 4 — the mesh comes up on the same clock.
		{ id: 'c-links', target: 'tag:link', channel: 'edge.style', anchor: { beatId: 'b4', offset: 0 }, at: 0, dur: 400, to: 'energy', stagger: 200 },
		{ id: 'c-links-on', target: 'tag:link', channel: 'edge.active', anchor: { beatId: 'b4', offset: 0 }, at: 0, dur: 200, to: 'true', stagger: 200 },
		{ id: 'c-sig', target: 'tag:link', channel: 'edge.sig', anchor: { beatId: 'b4', offset: 0 }, at: 0, dur: 900, from: 0.2, to: 0.8, ease, stagger: 200 },
		{ id: 'c-up', target: 'tag:agent', channel: 'node.state', anchor: { beatId: 'b4', offset: 300 }, at: 0, dur: 400, to: 'healthy', stagger: 200 },
		{ id: 'c-flow', target: 'tag:agent', channel: 'node.flow', anchor: { beatId: 'b4', offset: 300 }, at: 0, dur: 900, from: 0, to: 0.6, ease, stagger: 200 },
		{ id: 'c-spark', target: 'agent-east', burst: 'flourish.sparkle', anchor: { beatId: 'b4', offset: 700 }, at: 0, dur: 900 },
	],
};
