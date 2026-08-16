// Portable logic for the DevCog "nits" tool — capture a DOM element, annotate
// it, persist it, and export the batch as an AI fix-prompt. Framework-agnostic
// and side-effect-light so it can be node-tested and reused by any host app.
// Host branding (app name, tech stack, storage key) is injected via config.

/** A single captured UI nit. */
export interface Nit {
	id: string;
	selector: string;
	textContent: string;
	outerHTML: string;
	note: string;
	url: string;
	ts: number;
}

export interface NitConfig {
	/** localStorage key the nit batch is persisted under. */
	storageKey: string;
	/** Human name of the host app, e.g. 'Armornet web app'. */
	appName: string;
	/** Tech stack blurb for the AI prompt, e.g. 'Svelte 5 + SvelteKit'. */
	appStack: string;
}

export const DEFAULT_NIT_CONFIG: NitConfig = {
	storageKey: 'devcog_nits',
	appName: 'this web app',
	appStack: 'Svelte 5 + SvelteKit'
};

/** Parse a persisted nit batch; tolerant of missing / corrupt storage. */
export function parseNits(raw: string | null): Nit[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as Nit[]) : [];
	} catch {
		return [];
	}
}

/** Load the persisted nit batch from localStorage (SSR-safe). */
export function loadNits(config: NitConfig): Nit[] {
	if (typeof localStorage === 'undefined') return [];
	return parseNits(localStorage.getItem(config.storageKey));
}

/** Persist the nit batch to localStorage (SSR-safe, best-effort). */
export function saveNits(config: NitConfig, nits: Nit[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(config.storageKey, JSON.stringify(nits));
	} catch {
		// quota / disabled storage — ignored.
	}
}

/**
 * getCssPath builds a short, reasonably-unique CSS selector for an element by
 * walking up to <body>, preferring ids and stable (non-svelte-scoped) classes.
 */
export function getCssPath(el: Element): string {
	const parts: string[] = [];
	let cur: Element | null = el;
	while (cur && cur !== document.body) {
		let part = cur.tagName.toLowerCase();
		if (cur.id) {
			parts.unshift(`#${cur.id}`);
			break;
		}
		const cls = Array.from(cur.classList)
			.filter((c) => !c.startsWith('svelte-'))
			.slice(0, 2)
			.join('.');
		if (cls) part += '.' + cls;
		const parent = cur.parentElement;
		if (parent) {
			const siblings = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
			if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
		}
		parts.unshift(part);
		cur = cur.parentElement;
	}
	return parts.slice(-4).join(' > ');
}

/**
 * buildAIPrompt renders a batch of nits into a copy-pasteable prompt asking an
 * assistant to propose targeted fixes. Returns '' for an empty batch.
 */
export function buildAIPrompt(nits: Nit[], config: NitConfig): string {
	if (nits.length === 0) return '';
	const s = nits.length > 1 ? 's' : '';
	const lines = [
		`I have ${nits.length} UI nit${s} to fix in the ${config.appName} (${config.appStack}). Please review each and suggest targeted fixes.\n`,
		...nits.map(
			(n, i) =>
				`## Nit ${i + 1} — captured on \`${n.url}\`\n**Note:** ${n.note}\n**Selector:** \`${n.selector}\`\n**Content:** \`${n.textContent.replace(/`/g, "'")}\`\n**HTML excerpt:** \`${n.outerHTML.replace(/`/g, "'").slice(0, 200)}\`\n`
		),
		`\nFor each nit:\n1. The likely cause\n2. The specific CSS or Svelte change to fix it\n3. The file path\n4. Effort: quick (<30 min), medium (30 min–2 h), or large (>2 h)`
	];
	return lines.join('\n');
}
