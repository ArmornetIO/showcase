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
	/* ── The page gutter, owned in one place ────────────────────────────────
	   Pages do not set their own horizontal padding. They used to, and the
	   result was every page a slightly different width — `px-6` here,
	   `px-3 sm:px-6` there, `max-w-[1400px] mx-auto` on two of them — against a
	   LayoutHeader that ran on its own 1.5rem regardless, so the header and the
	   body it introduced did not line up even on the same page.

	   So the shell owns it: one padding, applied once, here. `--page-gutter` is
	   defined at this element and nowhere else. A page that genuinely needs a
	   different measure overrides the variable rather than reaching for a
	   padding class. */
	.page-panel {
		--page-gutter: 1.5rem;
		/* No max by default — the dashboards and the dense tables want the width.
		   Pages that read better narrow set `--page-content-max` (or pass
		   `narrow`). */
		--page-content-max: none;

		width: 100%;
		max-width: var(--page-content-max);
		margin-inline: auto;
		box-sizing: border-box;
		padding-inline: var(--page-gutter);
		padding-bottom: 3rem;
	}
	@media (max-width: 639px) {
		.page-panel {
			--page-gutter: 1rem;
		}
	}
	@media (min-width: 640px) {
		.page-panel {
			padding-bottom: 4rem;
		}
	}

	/* LayoutHeader is the standing exception: its border and background span the
	   whole main, so it has to reach the edges. Rather than teach the panel which
	   of a page's children is the header — pages nest it at whatever depth their
	   layout needs — the header breaks back out. One gutter went on, so exactly
	   one comes off, at any depth. It re-applies `--page-gutter` to its own inner
	   content, which is what puts its text on the same column as the body below.

	   `:global` because the header is a sibling component's element, and the
	   negative margin is the panel's business: it is the panel's padding being
	   undone. */
	.page-panel :global(.layout-header) {
		margin-inline: calc(-1 * var(--page-gutter));
	}

	.page-panel.narrow {
		--page-content-max: 760px;
	}
</style>
