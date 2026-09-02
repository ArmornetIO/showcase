<script lang="ts">
	// ── CollapsibleStack — a worklist of one-line rows that open in place ────────
	//
	// The list shape, not the section shape. `Collapsible` is a single generic
	// disclosure and `FaqAccordion` is prose; this is a queue you work down —
	// findings, a log, a scan list — where every row is one line high and opens
	// to show the rest of itself.
	//
	//   <CollapsibleStack>
	//     {#each rows as r (r.id)}
	//       <CollapsibleStackRow key={r.id} glyph="flag" label={...}>…</CollapsibleStackRow>
	//     {/each}
	//   </CollapsibleStack>
	//
	// THE STACK OWNS WHICH ROW IS OPEN, because "one at a time" is a property of
	// the list and not of any row in it. Every consumer that hand-rolls this ends
	// up with the same `openKey` state and the same bug — several rows expanded
	// turns the queue back into the stack of tall cards it replaced.
	//
	// HEIGHT IS THE CALLER'S: the stack does not scroll itself. A list that grows
	// on expand pushes whatever is under it down the page, so the fix belongs to
	// whoever knows what is under it — usually a fixed-height, scrolling parent.
	import type { Snippet } from 'svelte';
	import { setStackContext } from './collapsible-stack.js';

	interface Props {
		/** The open row's key. Bindable, so a caller can drive or observe it. */
		openKey?: string | null;
		/**
		 * Close the open row when another opens. On by default: these lists are
		 * queues, and several open at once defeats the shape. Off allows the
		 * classic multi-open accordion.
		 */
		single?: boolean;
		children: Snippet;
		class?: string;
	}

	let { openKey = $bindable(null), single = true, children, class: cls = '' }: Props = $props();

	// `multiOpen` only matters when `single` is false, so it costs nothing in the
	// default case and keeps the row unaware of which mode it is in.
	let multiOpen = $state(new Set<string>());

	setStackContext({
		get openKey() {
			return openKey;
		},
		toggle(key: string) {
			if (single) {
				openKey = openKey === key ? null : key;
				return;
			}
			if (multiOpen.has(key)) multiOpen.delete(key);
			else multiOpen.add(key);
			// Mirrored onto `openKey` so a `bind:` caller still sees the last
			// interaction in both modes rather than only in one.
			openKey = multiOpen.has(key) ? key : null;
		},
		isOpen(key: string) {
			return single ? openKey === key : multiOpen.has(key);
		}
	});
</script>

<ul class="list-none m-0 p-0 {cls}">
	{@render children()}
</ul>
