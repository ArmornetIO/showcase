<script lang="ts">
	interface PeerCardProps {
		name: string;
		id: string;
		latency: string;
		color: string;
	}

	let { name, id, latency, color }: PeerCardProps = $props();
</script>

<div
	class="flex items-center gap-[10px] px-3 py-2 border border-[var(--border)] rounded-[3px] bg-transparent transition-[border-color,background,transform] duration-[150ms] ease-in-out cursor-default hover:border-[rgba(95,234,213,0.4)] hover:bg-[rgba(95,234,213,0.04)] hover:-translate-y-px"
>
	<span
		class="w-[10px] h-[10px] rounded-full shrink-0"
		style:background={color}
		style:box-shadow="0 0 8px {color}"
	></span>
	<div class="flex flex-col gap-[2px] flex-1 min-w-0">
		<span
			class="font-[var(--sans-brand)] text-[14px] font-semibold text-[var(--fg)] whitespace-nowrap overflow-hidden text-ellipsis"
			>{name}</span
		>
		<span
			class="font-[var(--mono)] text-[9px] text-[var(--fg-dim)] whitespace-nowrap overflow-hidden text-ellipsis"
			>{id}</span
		>
	</div>
	<span class="font-[var(--mono)] text-[11px] text-[var(--fg-dim)] shrink-0 ml-auto">{latency}</span>
</div>
