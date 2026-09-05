// The hero globe, held still at the top of the page.
//
// The surface the density-ceiling work and the SVG mask work were both aimed at.
export default {
	name: 'marketing hero',
	path: '/',
	viewport: { width: 1600, height: 1000, dpr: 2 },
	settleMs: 5000,
	holdMs: 30000,
	scroll: null,
	// Proof the hero mounted. Without it a redirect to the login page measures a
	// beautifully quiet blank page and calls it a win.
	//
	// The CONTAINER, deliberately, not the globe. Across the versions this exists
	// to compare, the hero's globe has been an SVG (`GlobeFrame`) and a WebGL
	// canvas (`GlobeShell`) — asserting on either one turns "the other build
	// draws this differently", which is the thing being measured, into a crash.
	// The canvas census in the report is what names the difference.
	expectSelector: '.hero-visual',
	auth: 'stub-session',
	// A 120Hz budget. This is the display the work was tuned on; on a 60Hz
	// machine pass a scenario with 16.7 or every frame reads as late.
	budgetMs: 8.3
};
