<script lang="ts">
	const DOT_COLORS = [
		'var(--accent)',
		'var(--palette-cyan)',
		'var(--palette-emerald)',
		'var(--palette-blue)'
	] as const;

	const DEFAULT_ITEMS = [
		'SOC 2 TYPE II',
		'ISO 27001 · 27017 · 27018',
		'SPF · DKIM · DMARC',
		'PHISHING SIMULATIONS',
		'DNS FILTERING',
		'PENETRATION TESTING',
		'RISK REGISTERS',
		'VENDOR RISK MANAGEMENT'
	];

	interface TickerProps {
		/** Text items to scroll. Defaults to security-themed sample list. */
		items?: string[];
		/** Scroll duration in seconds for one full loop. Default: 30. */
		speed?: number;
		/** Separator glyph between items. Default: '●'. */
		separator?: string;
		/** Show top/bottom accent borders. Default: true. */
		bordered?: boolean;
	}

	let {
		items = DEFAULT_ITEMS,
		speed = 30,
		separator = '●',
		bordered = true
	}: TickerProps = $props();
</script>

<div
	class="bg-[var(--bg-elev)] overflow-hidden py-[0.875rem] {bordered
		? 'border-t border-b border-[var(--border-accent)]'
		: ''}"
>
	<div class="overflow-hidden w-full">
		<div class="ticker-track inline-flex items-center whitespace-nowrap" style:animation-duration="{speed}s">
			{#each [0, 1] as _}
				{#each items as item, i}
					<span
						class="px-[1.5rem] font-[var(--mono)] text-[0.6875rem] tracking-[0.4em] uppercase text-[var(--accent)] opacity-70"
						>{item}</span
					>
					<span
						class="px-[1.5rem] font-[var(--mono)] text-[0.6875rem] shrink-0"
						style:color={DOT_COLORS[i % DOT_COLORS.length]}
						>{separator}</span
					>
				{/each}
			{/each}
		</div>
	</div>
</div>

<style>
	.ticker-track {
		animation: ticker-scroll linear infinite;
	}
	@keyframes ticker-scroll {
		from { transform: translateX(0); }
		to   { transform: translateX(-50%); }
	}
	@media (prefers-reduced-motion: reduce) {
		.ticker-track { animation-play-state: paused; }
	}
</style>
