<script lang="ts" module>
	import { buildFrameCss } from './frames.js';

	// The generated stylesheet is injected exactly once per document, no matter
	// how many <Frame>s mount. Guarded so SSR and repeat mounts are no-ops.
	const STYLE_ID = 'itemframes-css';
	function ensureFrameStyles() {
		if (typeof document === 'undefined') return;
		if (document.getElementById(STYLE_ID)) return;
		const el = document.createElement('style');
		el.id = STYLE_ID;
		el.textContent = buildFrameCss();
		document.head.appendChild(el);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { FRAME_ATTR } from './frames.js';
	import { setFrameState } from './context.js';
	import { frameControl } from './control.svelte.js';

	interface FrameProps {
		/** True while this region has no data yet — the pre-load scaffold state. */
		framed?: boolean;
		/** Fallback tag for the wrapper. */
		as?: string;
		class?: string;
		children: Snippet;
	}

	let { framed = false, as = 'div', class: cls = '', children }: FrameProps = $props();

	ensureFrameStyles();

	// A region is scaffolded if it has no data OR the dev switch forces it.
	const active = $derived(framed || frameControl.forceFrames);

	// Descendants can read the live state — a chart can opt out of shimmer and
	// render its own placeholder while `active`. Getter keeps it reactive.
	setFrameState(() => active);
</script>

<svelte:element
	this={as}
	class={cls}
	{...{ [FRAME_ATTR]: active ? '' : undefined }}
	aria-busy={active ? 'true' : undefined}
	inert={active ? true : undefined}
>
	{@render children()}
</svelte:element>
