// Flow depth palette — colours a step's distance from the flow's origin.
// Consumed by MeshStudio's flow-step rendering.

export const FLOW_DEPTH_COLORS = [
	'#22D3EE', // depth 0 — origin (cyan)
	'#5eead4', // depth 1 — teal/accent
	'#60a5fa', // depth 2 — blue
	'#c4a8ff', // depth 3 — purple
	'#fbbf24', // depth 4 — amber
	'#f87171', // depth 5 — red
];

export function flowDepthColor(depth: number): string {
	return FLOW_DEPTH_COLORS[depth % FLOW_DEPTH_COLORS.length];
}
