/**
 * Vite transform plugin that auto-wraps component demos inside ShowcaseBlock
 * with <DemoVariant code={`...`}> at build time.
 *
 * Rules:
 *  - Only processes +page.svelte files under src/routes/
 *  - Recursively finds ShowcaseBlock nodes anywhere in the template
 *  - Wraps each custom Component inside a ShowcaseBlock (not in {#each}, not already DemoVariant)
 *  - Injects `import DemoVariant` into the script block if absent
 */

import { parse } from 'svelte/compiler';
import type { Plugin } from 'vite';

/** Never wrap these — they are either dev scaffolding or already handle their own wrapping. */
const SKIP_WRAP = new Set(['ShowcaseBlock', 'DemoVariant', 'Canvas', 'NodeDrawer']);

/**
 * Layout/container components whose slot content should be traversed to find
 * wrappable leaf components, rather than wrapping the container itself.
 * e.g. <CardStack> contains <Card> items — wrap each Card, not the CardStack.
 */
const RECURSE_INTO = new Set(['CardStack', 'PagePanel']);

interface Span {
	start: number;
	end: number;
}

/** Collect custom-component spans inside a ShowcaseBlock fragment (no EachBlock, no DemoVariant). */
function collectInBlock(fragment: { nodes: unknown[] }): Span[] {
	const results: Span[] = [];

	function visit(node: Record<string, unknown>): void {
		if (!node || typeof node !== 'object') return;
		const type = node.type as string;

		if (type === 'EachBlock') return; // template vars → useless snippet

		if (type === 'Component') {
			const name = node.name as string;
			if (SKIP_WRAP.has(name)) return;
			if (RECURSE_INTO.has(name)) {
				// Layout container — look inside for wrappable leaf components
				for (const c of (node.fragment as { nodes: unknown[] } | undefined)?.nodes ?? []) {
					visit(c as Record<string, unknown>);
				}
				return;
			}
			results.push({ start: node.start as number, end: node.end as number });
			return; // leaf component — don't recurse into slot content
		}

		if (type === 'RegularElement') {
			for (const c of (node.fragment as { nodes: unknown[] } | undefined)?.nodes ?? []) {
				visit(c as Record<string, unknown>);
			}
			return;
		}

		if (type === 'IfBlock') {
			for (const c of (node.consequent as { nodes: unknown[] } | undefined)?.nodes ?? []) {
				visit(c as Record<string, unknown>);
			}
			for (const c of (node.alternate as { nodes: unknown[] } | undefined)?.nodes ?? []) {
				visit(c as Record<string, unknown>);
			}
			return;
		}

		// Generic: try nodes or fragment.nodes
		const nodes =
			(node.nodes as unknown[] | undefined) ??
			(node.fragment as { nodes?: unknown[] } | undefined)?.nodes;
		for (const c of nodes ?? []) visit(c as Record<string, unknown>);
	}

	for (const n of fragment.nodes) visit(n as Record<string, unknown>);
	return results;
}

/** Walk the whole template tree, entering every container, collecting ShowcaseBlock fragments. */
function findShowcaseBlocks(
	nodes: unknown[],
	all: Span[]
): void {
	for (const raw of nodes) {
		const node = raw as Record<string, unknown>;
		if (!node || typeof node !== 'object') continue;

		const type = node.type as string;

		if (type === 'Component' && node.name === 'ShowcaseBlock') {
			const frag = node.fragment as { nodes: unknown[] } | undefined;
			if (frag) all.push(...collectInBlock(frag));
			// still recurse in case ShowcaseBlocks are nested (unusual but safe)
		}

		// Recurse into any container that holds child nodes
		const children =
			(node.nodes as unknown[] | undefined) ??
			(node.fragment as { nodes?: unknown[] } | undefined)?.nodes ??
			(node.body as { nodes?: unknown[] } | undefined)?.nodes ??
			(node.consequent as { nodes?: unknown[] } | undefined)?.nodes;

		if (children) findShowcaseBlocks(children, all);

		// IfBlock alternate branch
		const alt = (node.alternate as { nodes?: unknown[] } | undefined)?.nodes;
		if (alt) findShowcaseBlocks(alt, all);
	}
}

export function demoVariantPlugin(): Plugin {
	return {
		name: 'demo-variant-injector',
		enforce: 'pre',

		transform(src: string, id: string) {
			if (!id.includes('/routes/') || !id.endsWith('/+page.svelte')) return null;

			let ast: ReturnType<typeof parse>;
			try {
				ast = parse(src, { filename: id, modern: true });
			} catch {
				return null;
			}

			const allSpans: Span[] = [];
			findShowcaseBlocks(ast.fragment?.nodes ?? [], allSpans);

			if (allSpans.length === 0) return null;

			// Remove duplicates (shouldn't happen, but be safe)
			const seen = new Set<number>();
			const unique = allSpans.filter((s) => {
				if (seen.has(s.start)) return false;
				seen.add(s.start);
				return true;
			});

			// Process from end → start to keep earlier offsets valid
			unique.sort((a, b) => b.start - a.start);

			let result = src;
			for (const span of unique) {
				const original = src.slice(span.start, span.end);
				const escaped = original.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
				const wrapped = '<DemoVariant code={`' + escaped + '`}>' + original + '</DemoVariant>';
				result = result.slice(0, span.start) + wrapped + result.slice(span.end);
			}

			// Inject import into script block if absent
			if (!result.includes("import DemoVariant")) {
				const instanceEnd = (ast.instance as { end?: number } | undefined)?.end ?? 0;
				if (instanceEnd > 0) {
					// ast.instance.end points to just after </script>
					const closeTag = '</script>';
					const closePos = result.lastIndexOf(closeTag, instanceEnd);
					if (closePos !== -1) {
						const line = "\n\timport DemoVariant from '$lib/dev/DemoVariant.svelte';";
						result = result.slice(0, closePos) + line + '\n' + result.slice(closePos);
					}
				}
			}

			return { code: result, map: null };
		}
	};
}
