import type { ComponentMeta } from '../registry.js';
import type { ColorControl, TokenMap } from './types.js';
import { COMP_FILES, TW_RADIUS } from './specs.js';

export interface PromptInput {
	meta: ComponentMeta | null;
	componentId: string | null;
	/** Token → chosen value, for tokens the user actually changed. */
	overrides: TokenMap;
	/** Token → the theme value it replaced, for the "was:" annotation. */
	defaults: TokenMap;
	/** The colour controls on screen, so tokens can be named by effect. */
	controls: ColorControl[];
	borderRadius: number | null;
	/** Prop key → current value, including unchanged ones. */
	props: Record<string, unknown>;
	/** Injected so the output is deterministic and testable. */
	date?: string;
}

/** Props whose current value differs from the registry default. */
export function changedProps(
	meta: ComponentMeta | null,
	props: Record<string, unknown>
): Array<[string, unknown]> {
	if (!meta) return [];
	return Object.entries(props).filter(([k, v]) => v !== meta.props[k]?.default);
}

/**
 * Renders the hand-off prompt. Pure: everything it needs arrives as arguments,
 * so `prompt.spec.ts` can assert the exact text an agent will receive. That
 * matters more here than in most components — this string IS the product.
 */
export function buildPrompt(input: PromptInput): string {
	const { meta, componentId, overrides, defaults, controls, borderRadius, props } = input;
	const date = input.date ?? new Date().toISOString().split('T')[0];
	const changed = changedProps(meta, props);
	const hasStyle = Object.keys(overrides).length > 0 || borderRadius !== null;

	const lines: string[] = [];
	lines.push(`# Component Style — ${date}${meta ? ` · ${meta.label}` : ''}`);
	lines.push('');

	if (!hasStyle && changed.length === 0) {
		lines.push('No changes yet. Click a color swatch or edit a prop to start.');
		return lines.join('\n');
	}

	if (meta) {
		const file = COMP_FILES[componentId!] ?? `src/lib/**/${componentId}.svelte`;
		lines.push(`## ${meta.label} overrides  →  showcase/${file}`);

		if (Object.keys(overrides).length > 0) {
			// Split so the literal `</style>` never appears in this source file.
			lines.push("In the component's <" + 'style> block, on its root class add:');
			lines.push('');
			lines.push('```css');
			for (const [token, value] of Object.entries(overrides)) {
				const label = controls.find((c) => c.token === token)?.label ?? token;
				lines.push(`  ${token}: ${value}; /* ${label} — was: ${defaults[token] ?? '?'} */`);
			}
			lines.push('```');
		}

		if (borderRadius !== null) {
			const tw = TW_RADIUS[borderRadius];
			const replacement = tw || `style="border-radius:${borderRadius}px"`;
			lines.push(`Corner radius: replace \`rounded-*\` classes with \`${replacement}\``);
		}

		if (changed.length > 0) {
			lines.push('');
			lines.push('## Props (non-default values to hardcode)');
			lines.push('```');
			for (const [key, value] of changed) {
				const def = meta.props[key];
				lines.push(
					`  ${key}=${JSON.stringify(value)}  // ${def?.label ?? key} · default: ${JSON.stringify(def?.default)}`
				);
			}
			lines.push('```');
		}

		lines.push('');
	}

	lines.push('```sh');
	lines.push('cd showcase && npm run check');
	lines.push('```');

	return lines.join('\n');
}
