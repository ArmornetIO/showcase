// The mesh cluster, ~6,500px down, scrolled on screen.
//
// A separate scenario rather than a flag on the hero one, because it is a
// genuinely different page: four GL layers, an SVG mesh overlay and the BREACH
// board's presence sampler, none of which the hero has. Measuring it from the
// top of the page measures a scene deliberately doing nothing — its loops gate
// on an IntersectionObserver.
export default {
	name: 'marketing mesh cluster',
	path: '/',
	viewport: { width: 1600, height: 1000, dpr: 2 },
	settleMs: 5000,
	holdMs: 30000,
	// The SECTION, not a canvas inside it: which canvases the cluster is built
	// from is exactly what changes between the versions being compared, and a
	// scroll target that only one build has scrolls the other one nowhere.
	//
	// Two spellings because the section was renamed — `#game` at the stage
	// commit, `#showcase` now. First match wins; neither matching is a failure.
	scroll: ['#showcase', '#game'],
	expectSelector: ['#showcase', '#game'],
	auth: 'stub-session',
	budgetMs: 8.3
};
