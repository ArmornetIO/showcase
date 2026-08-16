<script lang="ts">
	interface SectionBarProps {
		label: string;
	}

	let { label }: SectionBarProps = $props();
</script>

<div class="flex items-center gap-[10px]">
	<span class="font-[var(--mono)] text-[11px] tracking-[0.3em] uppercase text-[var(--fg-dim)] whitespace-nowrap flex-shrink-0">
		{label}
	</span>
	<span
		class="flex-1 h-px bg-gradient-to-r from-[var(--border-strong)] to-transparent"
		aria-hidden="true"
	></span>
</div>
