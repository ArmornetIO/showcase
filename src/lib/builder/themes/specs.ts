import type { StyleControl } from './types.js';

// ── Per-component visual style specs ─────────────────────────────────────────
// component id → ordered list of controls. See types.ts for why controls are
// labeled by effect rather than by token name.

export const COMPONENT_STYLE_SPECS: Record<string, StyleControl[]> = {
	Button: [
		{ type: 'color', label: 'Accent color', token: '--accent' },
		{ type: 'color', label: 'Hover accent', token: '--accent-bright' },
		{ type: 'color', label: 'CTA text', token: '--accent-deep' },
		{ type: 'color', label: 'Background', token: '--bg' },
		{ type: 'color', label: 'Text', token: '--fg' },
		{ type: 'radius', label: 'Corners' }
	],
	IconButton: [
		{ type: 'color', label: 'Accent color', token: '--accent' },
		{ type: 'color', label: 'Hover accent', token: '--accent-bright' },
		{ type: 'color', label: 'Background', token: '--bg' },
		{ type: 'color', label: 'Icon', token: '--fg' },
		{ type: 'radius', label: 'Corners' }
	],
	Chip: [
		{ type: 'color', label: 'Accent', token: '--accent' },
		{ type: 'color', label: 'Background', token: '--surface-raised' },
		{ type: 'color', label: 'Text', token: '--fg-dim' },
		{ type: 'radius', label: 'Corners' }
	],
	Card: [
		{ type: 'color', label: 'Background', token: '--bg-elev' },
		{ type: 'color', label: 'Border', token: '--border-strong' },
		{ type: 'color', label: 'Heading', token: '--fg' },
		{ type: 'color', label: 'Body text', token: '--fg-muted' },
		{ type: 'color', label: 'Accent', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	Toggle: [
		{ type: 'color', label: 'Active color', token: '--accent' },
		{ type: 'color', label: 'Track', token: '--surface-raised' },
		{ type: 'color', label: 'Inactive', token: '--border-strong' }
	],
	Input: [
		{ type: 'color', label: 'Fill', token: '--input-bg' },
		{ type: 'color', label: 'Border', token: '--border' },
		{ type: 'color', label: 'Text', token: '--fg' },
		{ type: 'color', label: 'Placeholder', token: '--fg-dim' },
		{ type: 'color', label: 'Focus ring', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	Textarea: [
		{ type: 'color', label: 'Fill', token: '--input-bg' },
		{ type: 'color', label: 'Border', token: '--border' },
		{ type: 'color', label: 'Text', token: '--fg' },
		{ type: 'color', label: 'Placeholder', token: '--fg-dim' },
		{ type: 'color', label: 'Focus ring', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	SearchInput: [
		{ type: 'color', label: 'Fill', token: '--input-bg' },
		{ type: 'color', label: 'Border', token: '--border' },
		{ type: 'color', label: 'Text', token: '--fg' },
		{ type: 'color', label: 'Icon / hint', token: '--fg-dim' },
		{ type: 'color', label: 'Focus ring', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	Select: [
		{ type: 'color', label: 'Fill', token: '--input-bg' },
		{ type: 'color', label: 'Border', token: '--border' },
		{ type: 'color', label: 'Text', token: '--fg' },
		{ type: 'color', label: 'Focus ring', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	Panel: [
		{ type: 'color', label: 'Background', token: '--bg-elev' },
		{ type: 'color', label: 'Border', token: '--border' },
		{ type: 'color', label: 'Header fill', token: '--surface-raised' },
		{ type: 'color', label: 'Header text', token: '--fg-dim' },
		{ type: 'color', label: 'Accent', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	Tabs: [
		{ type: 'color', label: 'Active color', token: '--accent' },
		{ type: 'color', label: 'Active text', token: '--fg' },
		{ type: 'color', label: 'Inactive text', token: '--fg-dim' },
		{ type: 'color', label: 'Border', token: '--border' }
	],
	ActionBar: [
		{ type: 'color', label: 'Background', token: '--bg-elev' },
		{ type: 'color', label: 'Border', token: '--border' },
		{ type: 'color', label: 'Text', token: '--fg' },
		{ type: 'color', label: 'Accent', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	Breadcrumbs: [
		{ type: 'color', label: 'Links', token: '--accent' },
		{ type: 'color', label: 'Separators', token: '--fg-dim' },
		{ type: 'color', label: 'Current page', token: '--fg-muted' }
	],
	StatTile: [
		{ type: 'color', label: 'Metric value', token: '--fg' },
		{ type: 'color', label: 'Label', token: '--fg-dim' },
		{ type: 'color', label: 'Accent metric', token: '--accent' },
		{ type: 'radius', label: 'Corners' }
	],
	ProgressBar: [
		{ type: 'color', label: 'Fill', token: '--accent' },
		{ type: 'color', label: 'Track', token: '--fg-dim' },
		{ type: 'color', label: 'Label', token: '--fg-muted' },
		{ type: 'radius', label: 'Corners' }
	]
};

export const DEFAULT_SPEC: StyleControl[] = [
	{ type: 'color', label: 'Accent', token: '--accent' },
	{ type: 'color', label: 'Background', token: '--bg' },
	{ type: 'color', label: 'Text', token: '--fg' },
	{ type: 'color', label: 'Border', token: '--border' },
	{ type: 'radius', label: 'Corners' }
];

export function specFor(componentId: string | null): StyleControl[] {
	if (!componentId) return DEFAULT_SPEC;
	return COMPONENT_STYLE_SPECS[componentId] ?? DEFAULT_SPEC;
}

/**
 * Where each component actually lives, so the generated prompt can point an
 * agent at a real path instead of a glob. `specs.spec.ts` asserts every entry
 * resolves — a stale path here silently sends the agent to a file that is not
 * there, which is worse than no path at all.
 */
export const COMP_FILES: Record<string, string> = {
	Button: 'src/lib/primitives/Button.svelte',
	IconButton: 'src/lib/primitives/IconButton.svelte',
	Chip: 'src/lib/primitives/Chip.svelte',
	Card: 'src/lib/primitives/cards/Card.svelte',
	Toggle: 'src/lib/primitives/Toggle.svelte',
	Input: 'src/lib/primitives/Input.svelte',
	Textarea: 'src/lib/primitives/Textarea.svelte',
	SearchInput: 'src/lib/primitives/SearchInput.svelte',
	Select: 'src/lib/primitives/Select.svelte',
	Panel: 'src/lib/layout/Panel.svelte',
	Tabs: 'src/lib/layout/Tabs.svelte',
	ActionBar: 'src/lib/layout/ActionBar.svelte',
	Breadcrumbs: 'src/lib/navigation/Breadcrumbs.svelte',
	StatTile: 'src/lib/display/metric/StatTile.svelte',
	ProgressBar: 'src/lib/display/progress/ProgressBar.svelte'
};

/** Radius values the slider offers, mapped to the Tailwind class the prompt
 *  should tell the agent to use. Keys must match the slider's step sequence. */
export const TW_RADIUS: Record<number, string> = {
	0: 'rounded-none',
	2: 'rounded-sm',
	4: 'rounded',
	6: 'rounded-md',
	8: 'rounded-lg',
	12: 'rounded-xl',
	16: 'rounded-2xl'
};

export const RADIUS_DEFAULT = 6;
