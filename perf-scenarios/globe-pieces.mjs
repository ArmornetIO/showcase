// The GL-pieces globe on the showcase /canvas page, auto-rotating.
//
// This page rather than the app overview because it needs no login and no
// server data, so every build under comparison draws the same scene. Governed
// by docs/perf/globe-pieces.perf.md.
export default {
	name: 'globe pieces',
	path: '/showcase/canvas',
	viewport: { width: 1600, height: 1000, dpr: 2 },
	// Long enough to outlast the globe's intro fly-in.
	settleMs: 6000,
	holdMs: 30000,
	// The demo's container, not the canvas inside it: which layers the globe is
	// built from is what differs between the builds being compared.
	scroll: ['.canvas-demo--globe'],
	expectSelector: ['.canvas-demo--globe'],
	budgetMs: 8.3
};
