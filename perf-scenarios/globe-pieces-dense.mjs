// Full-viewport GL-pieces globe carrying every catalogue piece twice — the
// overview's fragment load, which the small /canvas demo under-represents.
//
// The route lives in the gitignored mockups/ tree and is copied into each build
// under comparison; see docs/perf/globe-pieces.perf.md.
export default {
	name: 'globe pieces (dense, full viewport)',
	path: '/showcase/mockups/perf-globe',
	viewport: { width: 1600, height: 1000, dpr: 2 },
	settleMs: 6000,
	// Short on purpose: the deltas this scene is for are large. Stretch it only
	// when a verdict lands inside the noise band.
	holdMs: 10000,
	expectSelector: ['.perf-globe'],
	budgetMs: 8.3
};
