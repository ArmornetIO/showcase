// ── TUI sign-in scene — "approve a code, and the terminal is you" ──────────
// The replay for the TUI how-to (docs/how-to/tui/tui.md).
//
// One idea: the terminal never sees a password. It shows a code, the browser
// you are already signed in to approves it, and the session lands back in the
// shell. So the link between the machine and the server stays latent until the
// approval beat, and only then carries anything.
//
// The machine is a `daemon`, not `agentic`: the CLI holds no seat on the mesh,
// the same call bridge-scene.ts makes for the responder.
//
// The terminal frames are what the binary prints (cmd/internal/apicli/login.go)
// and draws (cmd/tui/testdata/home.golden). If either changes, change them here.

import type { Scene } from './types.js';

const LOGIN = `$ eval "$(armornet auth login)"

  Open:  https://armornet.io/dex/device
  Code:  WDJB-MJHT

Waiting for approval…`;

const SIGNED_IN = `$ eval "$(armornet auth login)"

Signed in.

$ armornet auth whoami
signed in as CgcxMjM0NTY3EgZnaXRodWI`;

const HOME = ` armornet ▸ resources
╭─ resources ───────────────────────────────╮
│ NAME     SUMMARY                          │
│ agent ▸  Agents on this machine.          │
│ dns ▸    DNS filtering.                   │
│ proxy ▸  Supply-chain proxies.            │
╰───────────────────────────────────────────╯
 <enter> open  </> filter  <:> command  <q> quit`;

export const TUI_SCENE: Scene = {
	id: 'tui-sign-in',
	label: 'Sign in from the terminal',
	runMs: 16000,
	layout: 'radial',
	hub: { x: 760, y: 220, r: 40 },

	beats: [
		{
			id: 'b1',
			at: 0,
			caption: 'Ask for a code.',
			sub: 'eval "$(armornet auth login)"',
			spin: false,
			camera: { kind: 'fit' },
		},
		{
			id: 'b2',
			at: 4000,
			caption: 'Approve it in your browser.',
			sub: 'No password in the terminal',
			spin: false,
			camera: { kind: 'fit' },
		},
		{
			id: 'b3',
			at: 8000,
			caption: "You're signed in.",
			sub: 'The session lives in this shell',
			spin: false,
			camera: { kind: 'fit' },
		},
		{
			id: 'b4',
			at: 11500,
			caption: 'Open the TUI.',
			sub: 'armornet tui',
			spin: false,
			camera: { kind: 'fit' },
		},
	],

	objects: [
		{
			id: 'machine',
			name: 'your machine',
			kind: 'mesh.node',
			place: { mode: 'pinned', x: 280, y: 220 },
			tags: ['device'],
			node: { type: 'daemon', state: 'dormant', label: 'your terminal', r: 34, flow: 0, opacity: 1 },
		},
		{
			id: 'e-session',
			name: 'machine → armornet.io',
			kind: 'mesh.edge',
			place: { mode: 'solved' },
			tags: ['link'],
			edge: { from: 'machine', to: '__hub__', dataType: 'config', style: 'latent', sig: 0.2, active: false, label: 'session' },
		},
		{
			id: 'term-login',
			name: 'Terminal: code',
			kind: 'component',
			place: { mode: 'fixed', x: 280, y: 470 },
			tags: ['stage', 'terminal'],
			component: { componentId: 'TerminalBlock', props: { title: 'zsh', content: LOGIN }, w: 380, opacity: 1 },
		},
		{
			id: 'approve-card',
			name: 'Browser: approve',
			kind: 'component',
			place: { mode: 'fixed', x: 760, y: 460 },
			tags: ['stage'],
			// `type: 'hud'` or Card drops the title — see bridge-scene.ts.
			component: {
				componentId: 'Card',
				props: { type: 'hud', title: 'APPROVE WDJB-MJHT', body: 'armornet.io · grant access to armornet CLI' },
				w: 280,
				opacity: 0,
			},
		},
		{
			id: 'term-done',
			name: 'Terminal: signed in',
			kind: 'component',
			place: { mode: 'fixed', x: 280, y: 470 },
			tags: ['stage', 'terminal'],
			component: { componentId: 'TerminalBlock', props: { title: 'zsh', content: SIGNED_IN }, w: 380, opacity: 0 },
		},
		{
			id: 'term-tui',
			name: 'Terminal: armornet tui',
			kind: 'component',
			place: { mode: 'fixed', x: 520, y: 440 },
			tags: ['stage', 'terminal'],
			component: { componentId: 'TerminalBlock', props: { title: 'armornet tui', content: HOME }, w: 520, opacity: 0 },
		},
	],

	cues: [
		// ── Beat 2 — the browser card arrives beside the waiting terminal.
		{ id: 'c-card-in', target: 'approve-card', channel: 'component.opacity', anchor: { beatId: 'b2', offset: 300 }, at: 0, dur: 600, from: 0, to: 1, ease: 'out' },

		// ── Beat 3 — approval lands: the link wakes, the machine comes up, the
		// terminal swaps to the signed-in frame and the card leaves.
		{ id: 'c-link-active', target: 'e-session', channel: 'edge.active', anchor: { beatId: 'b3', offset: 0 }, at: 0, dur: 200, to: 'true' },
		{ id: 'c-link-style', target: 'e-session', channel: 'edge.style', anchor: { beatId: 'b3', offset: 0 }, at: 0, dur: 500, to: 'energy' },
		{ id: 'c-link-sig', target: 'e-session', channel: 'edge.sig', anchor: { beatId: 'b3', offset: 0 }, at: 0, dur: 900, from: 0.2, to: 0.7, ease: 'out' },
		{ id: 'c-machine-up', target: 'machine', channel: 'node.state', anchor: { beatId: 'b3', offset: 200 }, at: 0, dur: 400, to: 'healthy' },
		{ id: 'c-machine-flow', target: 'machine', channel: 'node.flow', anchor: { beatId: 'b3', offset: 200 }, at: 0, dur: 900, from: 0, to: 0.6, ease: 'out' },
		{ id: 'c-burst', target: 'machine', burst: 'flourish.sparkle', anchor: { beatId: 'b3', offset: 300 }, at: 0, dur: 900 },
		{ id: 'c-login-out', target: 'term-login', channel: 'component.opacity', anchor: { beatId: 'b3', offset: 0 }, at: 0, dur: 400, from: 1, to: 0 },
		{ id: 'c-done-in', target: 'term-done', channel: 'component.opacity', anchor: { beatId: 'b3', offset: 200 }, at: 0, dur: 500, from: 0, to: 1, ease: 'out' },
		{ id: 'c-card-out', target: 'approve-card', channel: 'component.opacity', anchor: { beatId: 'b3', offset: 600 }, at: 0, dur: 500, from: 1, to: 0 },

		// ── Beat 4 — the TUI takes the stage.
		{ id: 'c-done-out', target: 'term-done', channel: 'component.opacity', anchor: { beatId: 'b4', offset: 0 }, at: 0, dur: 400, from: 1, to: 0 },
		{ id: 'c-tui-in', target: 'term-tui', channel: 'component.opacity', anchor: { beatId: 'b4', offset: 200 }, at: 0, dur: 600, from: 0, to: 1, ease: 'out' },
	],
};
