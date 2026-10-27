/**
 * Hydrates the inert `component` placeholders docengine renders into real
 * components.
 *
 * docengine turns a ```component fence into
 * `<div class="doc-component" data-component="Name"><pre><code>…props…</code></pre></div>`
 * — escaped, never live markup. This module is the other half of that
 * contract, and it is a trust boundary: the name and every prop line come
 * from repository markdown that other people write, and the public docs
 * reader hydrates too. So the registry decides everything — only entries
 * flagged `embeddable` mount, only declared props pass, and every value is
 * coerced to its `PropDef` (enums clamped to `options`, numbers to
 * `min`/`max`). Nothing derived from a prop is ever written as HTML: the
 * placeholder that fails validation keeps its code-block fallback, and the
 * one that passes is mounted through `ComponentRenderer`, the same dispatcher
 * the builder canvas uses.
 */
import { mount, unmount } from 'svelte';
import ComponentRenderer from '../builder/ComponentRenderer.svelte';
import { REGISTRY_MAP, type ComponentMeta, type PropDef } from '../builder/registry.js';

/**
 * Fence body → raw string per key: one `key: value` line per prop.
 *
 * Flat on purpose — the `PropDef` vocabulary is scalar-only, so nothing needs
 * nesting, and a colon-split line survives hand-editing in a way YAML
 * indentation does not. Values may be JSON scalars (`"quoted"`, `3`, `true`)
 * or bare text; the coercer decides what they mean.
 */
export function parseEmbedBody(body: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of body.split('\n')) {
		const i = line.indexOf(':');
		if (i <= 0) continue;
		const key = line.slice(0, i).trim();
		if (key) out[key] = line.slice(i + 1).trim();
	}
	return out;
}

/** A parsed, validated embed: the prop bag plus its laid-out size in px
 *  (`0` = the component sizes itself). */
export interface EmbedSpec {
	props: Record<string, unknown>;
	w: number;
	h: number;
}

/**
 * The filter behind `PropDef.href`: site-relative and web schemes pass,
 * anything else — javascript:, data:, vbscript:, protocol-relative `//` —
 * is dropped. Allowlist, not blocklist: the scheme set that cannot execute
 * is the one worth naming.
 */
function safeHref(s: string): string {
	const v = s.trim();
	if (v === '' || /^(\/(?!\/)|\.\/|#|\?)/.test(v) || /^(https?:\/\/|mailto:)/i.test(v)) return v;
	return '';
}

function coerceValue(def: PropDef, raw: string): unknown {
	let v: unknown = raw;
	try {
		v = JSON.parse(raw);
	} catch {
		// Bare text is fine — quoting is a courtesy, not a requirement.
	}
	if (def.href) return safeHref(String(v));
	switch (def.kind) {
		case 'boolean':
			return v === true || v === 'true';
		case 'number': {
			const n = Number(v);
			if (!Number.isFinite(n)) return def.default;
			if (def.min !== undefined && n < def.min) return def.min;
			if (def.max !== undefined && n > def.max) return def.max;
			return n;
		}
		case 'enum': {
			const s = String(v);
			if (def.multi) {
				const sel = s
					.split(',')
					.map((t) => t.trim())
					.filter((t) => def.options?.includes(t));
				return sel.length ? sel.join(',') : def.default;
			}
			return def.options?.includes(s) ? s : def.default;
		}
		default:
			return String(v);
	}
}

/** Reserved size keys: px, non-negative, capped so a fence cannot demand a
 *  viewport-swallowing box. */
function coerceSize(raw: string | undefined, fallback: number): number {
	if (raw === undefined) return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 0) return fallback;
	return Math.min(Math.round(n), 4000);
}

/**
 * Raw fence lines → the prop bag `ComponentRenderer` receives.
 *
 * Starts from the registry defaults and lets only declared keys move, so an
 * undeclared or misspelled key is dropped rather than smuggled through the
 * untyped prop bag.
 */
export function coerceEmbed(meta: ComponentMeta, raw: Record<string, string>): EmbedSpec {
	const props: Record<string, unknown> = {};
	for (const [key, def] of Object.entries(meta.props)) {
		// hasOwn, not `in`: raw is built from attacker lines, and a key like
		// `constructor` must not resolve through the prototype chain.
		props[key] = Object.hasOwn(raw, key) ? coerceValue(def, raw[key]) : def.default;
	}
	return {
		props,
		w: coerceSize(Object.hasOwn(raw, 'w') ? raw.w : undefined, meta.defaultW),
		h: coerceSize(Object.hasOwn(raw, 'h') ? raw.h : undefined, meta.defaultH)
	};
}

/**
 * Mounts every embeddable placeholder under `root` and returns the teardown.
 *
 * A placeholder that names an unknown or non-embeddable component, or whose
 * body will not parse, is left exactly as docengine rendered it — the
 * code-block fallback is the designed failure mode, not an error state.
 */
export function hydrateEmbeds(root: HTMLElement): () => void {
	const mounted: object[] = [];
	for (const el of root.querySelectorAll<HTMLElement>('.doc-component[data-component]')) {
		// Two hydration seams can overlap (a layout around a Prose, say); whoever
		// got there first owns the mount.
		if (el.dataset.hydrated) continue;
		const meta = REGISTRY_MAP.get(el.dataset.component ?? '');
		if (!meta?.embeddable) continue;
		const body = el.querySelector('pre > code')?.textContent ?? '';
		const { props, w, h } = coerceEmbed(meta, parseEmbedBody(body));
		el.replaceChildren();
		el.dataset.hydrated = 'true';
		mounted.push(
			mount(ComponentRenderer, { target: el, props: { componentId: meta.id, props, w, h } })
		);
	}
	return () => {
		for (const m of mounted) void unmount(m);
	};
}

/** The embeddable registry entries, for insert menus and prop forms. */
export function embeddableComponents(): ComponentMeta[] {
	return [...REGISTRY_MAP.values()].filter((m) => m.embeddable);
}

/**
 * The fence a menu inserts for `meta`: every declared prop at its default, so
 * the block documents its own vocabulary. Internal keys (`__`-prefixed
 * builder plumbing) stay out of documents.
 */
export function embedFence(meta: ComponentMeta): string {
	const lines = Object.entries(meta.props)
		.filter(([key]) => !key.startsWith('__'))
		.map(([key, def]) => `${key}: ${JSON.stringify(def.default)}`);
	return '```component ' + meta.id + '\n' + lines.join('\n') + '\n```';
}
