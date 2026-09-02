// ── Sample scene — "an agent goes dark and the mesh reroutes" ──────────────
// Deliberately small: one hub, six agents, one proxy, a Card, four beats. Small
// enough to hold in your head while you learn the tool, complete enough to
// exercise every part of the model — solved and pinned placement, a component
// in the same solve, channel cues on both nodes and edges, a staggered
// set-selector cue, and a burst.

import type { Scene } from './types.js';

export const SAMPLE_SCENE: Scene = {
	id: 'mesh-reroute',
	label: 'Agent goes dark',
	runMs: 20000,
	layout: 'radial',
	hub: { x: 520, y: 340, r: 52 },

	beats: [
		{
			id: 'b1',
			at: 0,
			caption: 'Six agents. One control plane.',
			spin: false,
			camera: { kind: 'fit' },
		},
		{
			id: 'b2',
			at: 5000,
			caption: 'One goes dark.',
			sub: 'agent-04 stops answering',
			spin: false,
			camera: { kind: 'flyTo', target: 'agent-04', zoom: 1.5 },
		},
		{
			id: 'b3',
			at: 11000,
			caption: 'The mesh reroutes.',
			sub: 'Traffic shifts to the proxy in under a second',
			spin: false,
			camera: { kind: 'fit' },
		},
		{
			id: 'b4',
			at: 16000,
			caption: 'No traffic lost.',
			spin: false,
			camera: { kind: 'fit' },
		},
	],

	objects: [
		// ── Cast: six agents on a solved ring ──────────────────────────────
		...['01', '02', '03', '04', '05', '06'].map((n) => ({
			id: `agent-${n}`,
			name: `agent-${n}`,
			kind: 'mesh.node' as const,
			place: { mode: 'solved' as const },
			tags: ['agent'],
			node: {
				type: 'agentic' as const,
				state: 'healthy' as const,
				label: `agent-${n}`,
				r: 34,
				flow: 0.4,
				opacity: 1,
			},
		})),
		// A proxy the operator placed by hand — the solver packs the ring around
		// it rather than moving it.
		{
			id: 'proxy-1',
			name: 'proxy',
			kind: 'mesh.node',
			place: { mode: 'pinned', x: 760, y: 190 },
			tags: ['proxy'],
			node: {
				type: 'proxy',
				state: 'healthy',
				label: 'proxy',
				r: 30,
				flow: 0.2,
				opacity: 1,
			},
		},
		// ── Edges ──────────────────────────────────────────────────────────
		...['01', '02', '03', '04', '05', '06'].map((n) => ({
			id: `e-${n}`,
			name: `hub → agent-${n}`,
			kind: 'mesh.edge' as const,
			place: { mode: 'solved' as const },
			tags: ['link'],
			edge: {
				from: '__hub__',
				to: `agent-${n}`,
				dataType: 'lifecycle' as const,
				style: 'energy' as const,
				sig: 0.6,
				active: true,
			},
		})),
		{
			id: 'e-proxy',
			name: 'hub → proxy',
			kind: 'mesh.edge',
			place: { mode: 'solved' },
			tags: ['link'],
			edge: {
				from: '__hub__',
				to: 'proxy-1',
				dataType: 'config',
				style: 'latent',
				sig: 0.2,
				active: false,
			},
		},
		// ── A component in the same scene, hand-placed ─────────────────────
		{
			id: 'verdict',
			name: 'Verdict card',
			kind: 'component',
			// Clear of the ring: at (880, 470) the card sat on top of agent-04, which
			// is the node the beat before it is about.
			place: { mode: 'fixed', x: 980, y: 610 },
			tags: ['stage'],
			component: {
				componentId: 'Card',
				// `type: 'hud'` is load-bearing, not decoration. Card's `title` is
				// showWhen-gated to composite/article/data-input/doc/hud, and Card
				// defaults to 'stat' — so with the default type this card rendered a
				// stat placeholder and the `props.Card.title` cue below was a silent
				// no-op. Authoring props by hand bypasses the picker's showWhen filter,
				// which is exactly the check that would have caught it.
				props: { type: 'hud', title: 'REROUTED', body: '0 requests dropped' },
				w: 260,
				opacity: 0,
			},
		},
	],

	cues: [
		// Beat 2 — agent-04 goes dark, and its link with it.
		{
			id: 'c1',
			target: 'agent-04',
			channel: 'node.state',
			anchor: { beatId: 'b2', offset: 400 },
			at: 0,
			dur: 600,
			to: 'offline',
		},
		{
			id: 'c2',
			target: 'agent-04',
			channel: 'node.flow',
			anchor: { beatId: 'b2', offset: 400 },
			at: 0,
			dur: 900,
			from: 0.4,
			to: 0,
			ease: 'out',
		},
		{
			id: 'c3',
			target: 'e-04',
			channel: 'edge.style',
			anchor: { beatId: 'b2', offset: 500 },
			at: 0,
			dur: 600,
			to: 'blocked',
		},
		{
			id: 'c4',
			target: 'e-04',
			channel: 'edge.active',
			anchor: { beatId: 'b2', offset: 500 },
			at: 0,
			dur: 200,
			to: 'false',
		},

		// Beat 3 — the proxy takes over. One cue, one selector, staggered: this
		// is the thing that used to require a .filter() inside a component.
		{
			id: 'c5',
			target: 'e-proxy',
			channel: 'edge.style',
			anchor: { beatId: 'b3', offset: 200 },
			at: 0,
			dur: 400,
			to: 'energy',
		},
		{
			id: 'c6',
			target: 'e-proxy',
			channel: 'edge.sig',
			anchor: { beatId: 'b3', offset: 200 },
			at: 0,
			dur: 900,
			from: 0.2,
			to: 0.95,
			ease: 'out',
		},
		{
			id: 'c7',
			target: 'proxy-1',
			channel: 'node.flow',
			anchor: { beatId: 'b3', offset: 200 },
			at: 0,
			dur: 900,
			from: 0.2,
			to: 0.9,
			ease: 'out',
		},
		{
			id: 'c8',
			target: 'proxy-1',
			burst: 'flourish.aurora',
			anchor: { beatId: 'b3', offset: 300 },
			at: 0,
			dur: 1100,
		},
		{
			id: 'c9',
			target: 'tag:agent',
			channel: 'node.flow',
			anchor: { beatId: 'b3', offset: 600 },
			at: 0,
			dur: 800,
			from: 0.4,
			to: 0.75,
			ease: 'out',
			stagger: 90,
		},

		// Beat 4 — the card arrives.
		{
			id: 'c10',
			target: 'verdict',
			channel: 'component.opacity',
			anchor: { beatId: 'b4', offset: 200 },
			at: 0,
			dur: 700,
			from: 0,
			to: 1,
			ease: 'out',
		},
		// …and then its own text changes. `props.Card.title` is not written down
		// anywhere: it is generated from `registry.ts`'s ComponentMeta for Card, so
		// every prop of every registry component is drivable without anyone
		// authoring a channel for it.
		{
			id: 'c11',
			target: 'verdict',
			channel: 'props.Card.title',
			anchor: { beatId: 'b4', offset: 1600 },
			at: 0,
			dur: 400,
			to: 'HEALTHY',
		},
	],
};
