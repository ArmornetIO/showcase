import type { Port, MeshNodeType } from '../primitives/canvas/canvas.types.js';

// ── Port templates per MeshNodeType ──────────────────────────────────────
// Angles: 0=right · 90=bottom · 180=left · 270=top
// Diagonals: 45=bottom-right · 135=bottom-left · 225=top-left · 315=top-right

export const PORT_TEMPLATES: Record<MeshNodeType, Port[]> = {
	'control-plane': [
		{ id: 'agents-in',      angle: 270, role: 'in',    dataType: 'lifecycle' },
		{ id: 'rest-in',        angle: 0,   role: 'in',    dataType: 'query'     },
		{ id: 'config-push',    angle: 90,  role: 'out',   dataType: 'config'    },
		{ id: 'query-dispatch', angle: 180, role: 'out',   dataType: 'query'     },
	],
	'agentic': [
		{ id: 'query-in',   angle: 270, role: 'in',  dataType: 'query' },
		{ id: 'tool-call',  angle: 0,   role: 'out', dataType: 'query' },
		{ id: 'answer-out', angle: 90,  role: 'out', dataType: 'query' },
		{ id: 'feed-in',    angle: 180, role: 'in',  dataType: 'feed'  },
	],
	'proxy': [
		{ id: 'intercept-in', angle: 225, role: 'in',    dataType: 'intercept' },
		{ id: 'allow-out',    angle: 315, role: 'out',   dataType: 'intercept' },
		{ id: 'block-out',    angle: 45,  role: 'out',   dataType: 'verdict'   },
		{ id: 'config-in',    angle: 180, role: 'in',    dataType: 'config'    },
		{ id: 'threat-check', angle: 270, role: 'inout', dataType: 'feed'      },
	],
	'daemon': [
		{ id: 'config-in',     angle: 270, role: 'in',  dataType: 'config'    },
		{ id: 'heartbeat-out', angle: 0,   role: 'out', dataType: 'lifecycle' },
		{ id: 'task-out',      angle: 90,  role: 'out', dataType: 'lifecycle' },
	],
};

export function getPortsForType(type: MeshNodeType): Port[] {
	return PORT_TEMPLATES[type] ?? [];
}

export function portSegments(type: MeshNodeType): Array<Port & { startDeg: number; endDeg: number }> {
	const ports = getPortsForType(type);
	const segHalf = 180 / ports.length;
	return ports.map((p) => ({
		...p,
		startDeg: p.angle - segHalf,
		endDeg:   p.angle + segHalf,
	}));
}
