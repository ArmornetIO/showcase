// ── Bridge scene — "the model is already on your machine" ──────────────────
// The replay for the agent-bridge post (docs/blog/agent-bridge.md, spec 044).
//
// It has to carry one idea: the agent does NOT reach out to a model service. It
// asks something already running beside it, and the question never leaves the
// device. So the composition is deliberately lopsided — the server link is thin
// and quiet, the local link is the one that lights up.
//
// The agent opens `dormant`, not `offline`. Both draw powered down and the
// distinction is the whole first beat: nothing is broken, nobody has switched a
// model on yet.

import type { Scene } from './types.js';

export const BRIDGE_SCENE: Scene = {
	id: 'agent-bridge',
	label: 'The model is already on your machine',
	runMs: 19000,
	layout: 'radial',
	hub: { x: 520, y: 340, r: 46 },

	beats: [
		{
			id: 'b1',
			at: 0,
			caption: 'Your agent needs a model.',
			sub: 'No API key configured — nothing to reason with',
			spin: false,
			camera: { kind: 'fit' },
		},
		{
			id: 'b2',
			at: 4500,
			caption: 'It asks the assistant you already run.',
			sub: 'Over Line, on a unix socket only your account can reach',
			spin: false,
			camera: { kind: 'flyTo', target: 'responder', zoom: 1.4 },
		},
		{
			id: 'b3',
			at: 9500,
			caption: 'You claim the question.',
			sub: 'armornet agent bridge next',
			spin: false,
			camera: { kind: 'flyTo', target: 'responder', zoom: 1.6 },
		},
		{
			id: 'b4',
			at: 13500,
			caption: 'And answer it.',
			sub: 'armornet agent bridge answer <id>',
			spin: false,
			camera: { kind: 'fit' },
		},
	],

	objects: [
		// ── The agent on the customer's device ─────────────────────────────
		{
			id: 'agent',
			name: 'agent on your device',
			kind: 'mesh.node',
			place: { mode: 'pinned', x: 520, y: 560 },
			tags: ['device'],
			node: {
				type: 'agentic',
				state: 'dormant',
				label: 'agent',
				r: 40,
				flow: 0,
				opacity: 1,
			},
		},
		// The responder — your coding assistant. `daemon` rather than `agentic`
		// because it is NOT an agent: it holds no seat on the mesh and has no
		// identity in the console. It is a model source, and the silhouette
		// should not claim otherwise.
		{
			id: 'responder',
			name: 'armornet agent bridge',
			kind: 'mesh.node',
			place: { mode: 'pinned', x: 850, y: 560 },
			tags: ['device'],
			node: {
				type: 'daemon',
				state: 'dormant',
				label: 'your assistant',
				r: 34,
				flow: 0,
				opacity: 1,
			},
		},

		// ── Links ──────────────────────────────────────────────────────────
		// Server ↔ agent: the question's route in and the answer's route out.
		// Quiet throughout — this is the hop that already existed.
		{
			id: 'e-server',
			name: 'server → agent (Line)',
			kind: 'mesh.edge',
			place: { mode: 'solved' },
			tags: ['link'],
			edge: {
				from: '__hub__',
				to: 'agent',
				dataType: 'query',
				style: 'latent',
				sig: 0.25,
				active: true,
				label: 'Line',
			},
		},
		// Agent ↔ responder: the new hop, and the only one the post is about.
		// Starts latent because nothing is attached yet.
		{
			id: 'e-local',
			name: 'agent → responder (unix socket)',
			kind: 'mesh.edge',
			place: { mode: 'solved' },
			tags: ['link', 'local'],
			edge: {
				from: 'agent',
				to: 'responder',
				dataType: 'verdict',
				style: 'latent',
				sig: 0.2,
				active: false,
				label: '0700',
			},
		},

		// The answer, arriving. Hidden until the last beat.
		{
			id: 'answer-card',
			name: 'Answer card',
			kind: 'component',
			place: { mode: 'fixed', x: 1010, y: 300 },
			tags: ['stage'],
			component: {
				// `type: 'hud'` is load-bearing: Card's `title` is showWhen-gated to
				// composite/article/data-input/doc/hud and Card defaults to 'stat', so
				// the default type renders a stat placeholder and silently drops the
				// title. Authoring props by hand bypasses the picker that would catch it.
				componentId: 'Card',
				props: { type: 'hud', title: 'ANSWERED', body: 'no model service was called' },
				w: 260,
				opacity: 0,
			},
		},
	],

	cues: [
		// ── Beat 2 — the agent asks. The local link wakes; the agent does not
		// go healthy yet, because it is still waiting.
		{
			id: 'c-ask-style',
			target: 'e-local',
			channel: 'edge.style',
			anchor: { beatId: 'b2', offset: 300 },
			at: 0,
			dur: 500,
			to: 'pulse',
		},
		{
			id: 'c-ask-active',
			target: 'e-local',
			channel: 'edge.active',
			anchor: { beatId: 'b2', offset: 300 },
			at: 0,
			dur: 200,
			to: 'true',
		},
		{
			id: 'c-ask-sig',
			target: 'e-local',
			channel: 'edge.sig',
			anchor: { beatId: 'b2', offset: 300 },
			at: 0,
			dur: 900,
			from: 0.2,
			to: 0.7,
			ease: 'out',
		},

		// ── Beat 3 — the responder claims it. This is the moment a person
		// runs a command, so it gets the burst rather than beat 2.
		{
			id: 'c-claim-state',
			target: 'responder',
			channel: 'node.state',
			anchor: { beatId: 'b3', offset: 200 },
			at: 0,
			dur: 400,
			to: 'healthy',
		},
		{
			id: 'c-claim-flow',
			target: 'responder',
			channel: 'node.flow',
			anchor: { beatId: 'b3', offset: 200 },
			at: 0,
			dur: 900,
			from: 0,
			to: 0.8,
			ease: 'out',
		},
		{
			id: 'c-claim-burst',
			target: 'responder',
			burst: 'flourish.aurora',
			anchor: { beatId: 'b3', offset: 300 },
			at: 0,
			dur: 1000,
		},

		// ── Beat 4 — the answer lands. The agent finally comes up, the local
		// link settles to steady energy, and the card fades in.
		{
			id: 'c-ans-state',
			target: 'agent',
			channel: 'node.state',
			anchor: { beatId: 'b4', offset: 200 },
			at: 0,
			dur: 400,
			to: 'healthy',
		},
		{
			id: 'c-ans-flow',
			target: 'agent',
			channel: 'node.flow',
			anchor: { beatId: 'b4', offset: 200 },
			at: 0,
			dur: 900,
			from: 0,
			to: 0.6,
			ease: 'out',
		},
		{
			id: 'c-ans-style',
			target: 'e-local',
			channel: 'edge.style',
			anchor: { beatId: 'b4', offset: 300 },
			at: 0,
			dur: 500,
			to: 'energy',
		},
		// The server link only now carries anything back — the answer's return
		// trip is the last thing to happen, not the first.
		{
			id: 'c-ans-return',
			target: 'e-server',
			channel: 'edge.sig',
			anchor: { beatId: 'b4', offset: 500 },
			at: 0,
			dur: 800,
			from: 0.25,
			to: 0.6,
			ease: 'out',
		},
		{
			id: 'c-card-in',
			target: 'answer-card',
			channel: 'component.opacity',
			anchor: { beatId: 'b4', offset: 600 },
			at: 0,
			dur: 700,
			from: 0,
			to: 1,
			ease: 'out',
		},
		{
			id: 'c-card-burst',
			target: 'answer-card',
			burst: 'flourish.sparkle',
			anchor: { beatId: 'b4', offset: 900 },
			at: 0,
			dur: 900,
		},
	],
};
