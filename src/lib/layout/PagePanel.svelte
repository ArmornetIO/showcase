<script lang="ts">
	import type { Snippet } from 'svelte';

	interface PagePanelProps {
		children: Snippet;
		/** Constrain content to a readable narrow width (≤ 760px). */
		narrow?: boolean;
	}

	let { children, narrow = false }: PagePanelProps = $props();
</script>

<div class="page-panel" class:narrow>
	{@render children()}
</div>

<style>
	/* 0.75rem, not 2rem. Pages already carry their own gutter — LayoutHeader's
	   1.5rem and, on app pages, a `px-6` wrapper — so this was a third gutter
	   stacked on a content area the nav rail has already inset. Kept non-zero
	   because the ~65 pages with no wrapper of their own rely on it. */
	.page-panel {
		width: 100%;
		box-sizing: border-box;
		padding: 0 0.5rem 3rem;
	}
	@media (min-width: 640px) {
		.page-panel {
			padding: 0 0.75rem 4rem;
		}
	}
	.page-panel.narrow {
		max-width: 760px;
	}
</style>
