// ── What a session does not carry ────────────────────────────────────────────
// A shared design session carries the placed components, the regions they sit
// in, and their named collections. It carries nothing else the builder can do.
//
// That is a decision, not an omission — but a decision nobody communicated is
// indistinguishable from a defect, and somebody who draws a connector and finds
// that no colleague can see it will file a bug. So the boundary is declared
// here, once, and the interface reads it.
//
// ONE LIST rather than a message at each call site. When a surface later becomes
// shared it is deleted from here and every notice about it disappears with it;
// scattered strings would go on claiming something untrue until each was found.

/** A part of the builder whose work stays in the browser that made it. */
export type LocalSurface =
	| 'connector'
	| 'cluster'
	| 'page'
	| 'tour'
	| 'canvasSize'
	| 'grid'
	| 'itemName'
	| 'style'
	| 'visibility';

/** What a person is told the first time they use one, in a shared session. */
export const LOCAL_SURFACES: Record<LocalSurface, string> = {
	connector:
		'Connectors are yours alone — other people in this session will not see the lines you draw.',
	cluster: 'Clusters are yours alone. Other people see the components, not the arrangement.',
	page: 'Pages are yours alone. The session shares one canvas, and this switches which one you are looking at.',
	tour: 'Tours are yours alone and are not part of the shared design.',
	canvasSize: 'Canvas size is yours alone — it changes what you see, not what anybody else does.',
	grid: 'Grid and snapping are yours alone.',
	itemName: 'Layer names are yours alone. Everybody sees the component; only you see what you called it.',
	style: 'Style overrides are yours alone and do not travel with the design.',
	visibility: 'Hiding and locking are yours alone — nobody else’s view changes.'
};

/**
 * Whether a surface is one of the unshared ones.
 *
 * A function rather than callers reaching into the record, so that adding a
 * surface is one edit and removing one cannot leave a caller asserting about a
 * key that no longer exists.
 */
export function isLocalSurface(name: string): name is LocalSurface {
	return name in LOCAL_SURFACES;
}
