import { REGISTRY_MAP, type ComponentMeta } from '../registry.js';
import type { ThemeKey } from '$lib/theme/themes.js';
import type { ColorControl, StyleControl, TokenMap } from './types.js';
import { specFor, RADIUS_DEFAULT } from './specs.js';
import { defaultFor, THEME_DEFAULTS } from './defaults.js';
import { buildPrompt, changedProps } from './prompt.js';

export type PreviewTab = 'component' | 'prompt';

/**
 * All Theme Studio state and the rules that connect it. Kept out of the
 * component so the transitions — which token counts as changed, when the prompt
 * tab is reachable — can be reasoned about (and tested) without a DOM.
 */
export class ThemeStudioState {
	componentId = $state<string | null>(null);
	theme = $state<ThemeKey>('dark');
	overrides = $state<TokenMap>({});
	borderRadius = $state<number | null>(null);
	props = $state<Record<string, unknown>>({});

	/** What the user last asked to see. Read `tab` instead — see below. */
	requestedTab = $state<PreviewTab>('component');

	readonly meta = $derived<ComponentMeta | null>(
		this.componentId ? (REGISTRY_MAP.get(this.componentId) ?? null) : null
	);

	readonly spec = $derived<StyleControl[]>(specFor(this.componentId));

	readonly colorControls = $derived(
		this.spec.filter((c): c is ColorControl => c.type === 'color')
	);

	readonly hasRadiusControl = $derived(this.spec.some((c) => c.type === 'radius'));

	readonly hasStyleChanges = $derived(
		Object.keys(this.overrides).length > 0 || this.borderRadius !== null
	);

	readonly changedProps = $derived(changedProps(this.meta, this.props));

	readonly hasChanges = $derived(this.hasStyleChanges || this.changedProps.length > 0);

	/**
	 * The tab actually shown. The prompt tab only exists while there are
	 * changes, so a request for it has to lapse when the last change is undone —
	 * otherwise clearing an override strands the user on a prompt view whose
	 * tab strip has just unmounted, with no control left to get back.
	 */
	readonly tab = $derived<PreviewTab>(
		this.requestedTab === 'prompt' && !this.hasChanges ? 'component' : this.requestedTab
	);

	/** Token values for the active theme, before any override. */
	readonly themeDefaults = $derived<TokenMap>(THEME_DEFAULTS[this.theme]);

	readonly prompt = $derived(
		buildPrompt({
			meta: this.meta,
			componentId: this.componentId,
			overrides: this.overrides,
			defaults: this.themeDefaults,
			controls: this.colorControls,
			borderRadius: this.borderRadius,
			props: this.props
		})
	);

	/** Current value of a token — the override if set, else the theme default. */
	valueOf(token: string): string {
		return this.overrides[token] ?? defaultFor(this.theme, token);
	}

	isOverridden(token: string): boolean {
		return this.overrides[token] !== undefined;
	}

	/** Setting a token back to its theme value clears the override rather than
	 *  storing a redundant one, so `hasChanges` stays truthful. */
	setToken(token: string, value: string): void {
		if (value === defaultFor(this.theme, token)) {
			const next = { ...this.overrides };
			delete next[token];
			this.overrides = next;
		} else {
			this.overrides = { ...this.overrides, [token]: value };
		}
	}

	setTheme(key: ThemeKey): void {
		// Overrides are expressed against the old palette, so they cannot carry.
		this.theme = key;
		this.overrides = {};
		this.borderRadius = null;
	}

	selectComponent(id: string): void {
		if (this.componentId !== id) {
			this.overrides = {};
			this.borderRadius = null;
			this.requestedTab = 'component';
			this.props = defaultProps(REGISTRY_MAP.get(id) ?? null);
		}
		this.componentId = id;
	}

	setProp(key: string, value: unknown): void {
		this.props = { ...this.props, [key]: value };
	}

	setRadius(px: number | null): void {
		this.borderRadius = px;
	}

	/** Radius to display; the control sits at the house default until touched. */
	get radiusOrDefault(): number {
		return this.borderRadius ?? RADIUS_DEFAULT;
	}

	reset(): void {
		this.overrides = {};
		this.borderRadius = null;
		this.props = defaultProps(this.meta);
	}
}

function defaultProps(meta: ComponentMeta | null): Record<string, unknown> {
	if (!meta) return {};
	return Object.fromEntries(Object.entries(meta.props).map(([k, d]) => [k, d.default]));
}
