// ── Mesh node taxonomy ────────────────────────────────────────────────────

export type MeshNodeType = 'control-plane' | 'agentic' | 'proxy' | 'daemon';

export type NodeState = 'healthy' | 'degraded' | 'offline';

export type DataType = 'query' | 'config' | 'feed' | 'verdict' | 'lifecycle' | 'intercept';

export type EdgeStyle =
	| 'energy'
	| 'pulse'
	| 'dashed'
	| 'degraded'
	| 'blocked'
	| 'latent'
	| 'scanning'
	| 'encrypted';

// Dash patterns for a line's transmission status. Colours are not fixed here —
// MeshStudio drives them from live tuning.
// The rhythm carries the meaning: a long mark with a short gap reads as moving
// (energy, degraded); a short mark with a long gap reads as intermittent or
// severed (blocked, latent). `encrypted` is deliberately absent — a secure link
// is solid, and the padlock at its midpoint is what marks it.
export const EDGE_STYLE_DASH: Partial<Record<EdgeStyle, string>> = {
	energy: '7 7',
	dashed: '8 6',
	degraded: '9 7',
	blocked: '2 8',
	latent: '1 8',
};
/** Dash pattern for a health/edge state (degraded / offline). */
export const EDGE_STATE_DASH: Record<'degraded' | 'offline', string> = {
	degraded: '9 7',
	offline: '2 8',
};

// ── Port ─────────────────────────────────────────────────────────────────

export interface Port {
	id: string;
	/** Degrees. 0=right · 90=bottom · 180=left · 270=top. */
	angle: number;
	role: 'in' | 'out' | 'inout';
	dataType: DataType;
}

// ── Mesh node base palette ────────────────────────────────────────────────

export const MESH_NODE_COLOR: Record<MeshNodeType, string> = {
	'control-plane': '#5FEAD5',
	'agentic':       '#C4A8FF',
	'proxy':         '#38BDF8',
	'daemon':        '#6EE7B7',
};

export const MESH_NODE_FILL: Record<MeshNodeType, string> = {
	'control-plane': 'rgba(95,234,213,0.14)',
	'agentic':       'rgba(196,168,255,0.14)',
	'proxy':         'rgba(56,189,248,0.14)',
	'daemon':        'rgba(110,231,183,0.14)',
};

export const MESH_NODE_LABEL: Record<MeshNodeType, string> = {
	'control-plane': 'CTRL·PLANE',
	'agentic':       'AGENTIC',
	'proxy':         'PROXY',
	'daemon':        'DAEMON',
};

// ── Data-type color palette ───────────────────────────────────────────────

export const DATA_TYPE_COLOR: Record<DataType, string> = {
	query:     '#22D3EE',
	config:    '#A78BFA',
	feed:      '#FB923C',
	verdict:   '#4ADE80',
	lifecycle: '#60A5FA',
	intercept: '#FBBF24',
};

export const DATA_TYPE_GLOW: Record<DataType, string> = {
	query:     'rgba(34,211,238,0.65)',
	config:    'rgba(167,139,250,0.65)',
	feed:      'rgba(251,146,60,0.65)',
	verdict:   'rgba(74,222,128,0.65)',
	lifecycle: 'rgba(96,165,250,0.65)',
	intercept: 'rgba(251,191,36,0.65)',
};
