<script lang="ts">
	interface PanelLoadingProps {
		message?: string;
		/** Tailwind height class applied to the container, e.g. "h-32". */
		class?: string;
	}

	let { message = 'LOADING…', class: cls = 'h-32' }: PanelLoadingProps = $props();
</script>

<div
	class="flex items-center justify-center gap-2 text-[var(--fg-dim)] font-[var(--mono)] text-[0.72rem] tracking-widest {cls}"
>
	<!-- Activity indicator (inline SVG; no external icon dep) -->
	<svg
		class="animate-pulse text-teal-300 shrink-0"
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
	</svg>
	{message}
</div>
