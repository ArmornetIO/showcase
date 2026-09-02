<script lang="ts">
	interface HexShieldProps {
		layers?: number;
		plates?: number;
		active?: boolean;
	}

	let { layers = 4, plates = 19, active = true }: HexShieldProps = $props();

	const hexes = [
		{ cx: 160, cy: 160, fill: 'rgba(95,234,213,0.18)', stroke: 'rgba(95,234,213,0.85)', label: 'A' },
		{ cx: 110, cy: 130, fill: 'rgba(56,189,248,0.06)', stroke: 'rgba(56,189,248,0.55)' },
		{ cx: 210, cy: 130, fill: 'rgba(95,234,213,0.06)', stroke: 'rgba(95,234,213,0.4)' },
		{ cx: 110, cy: 190, fill: 'rgba(95,234,213,0.06)', stroke: 'rgba(95,234,213,0.4)' },
		{ cx: 210, cy: 190, fill: 'rgba(56,189,248,0.06)', stroke: 'rgba(56,189,248,0.55)' },
		{ cx: 160, cy: 100, fill: 'rgba(95,234,213,0.04)', stroke: 'rgba(95,234,213,0.35)' },
		{ cx: 160, cy: 220, fill: 'rgba(95,234,213,0.04)', stroke: 'rgba(95,234,213,0.35)' },
		{ cx: 60, cy: 160, fill: 'rgba(95,234,213,0.04)', stroke: 'rgba(95,234,213,0.25)' },
		{ cx: 260, cy: 160, fill: 'rgba(95,234,213,0.04)', stroke: 'rgba(95,234,213,0.25)' },
		{ cx: 110, cy: 70, fill: 'rgba(95,234,213,0.03)', stroke: 'rgba(95,234,213,0.2)' },
		{ cx: 210, cy: 70, fill: 'rgba(95,234,213,0.03)', stroke: 'rgba(95,234,213,0.2)' },
		{ cx: 110, cy: 250, fill: 'rgba(95,234,213,0.03)', stroke: 'rgba(95,234,213,0.2)' },
		{ cx: 210, cy: 250, fill: 'rgba(95,234,213,0.03)', stroke: 'rgba(95,234,213,0.2)' }
	] as const;

	function hexPoints(cx: number, cy: number): string {
		return [
			`${cx},${cy - 32}`,
			`${cx + 28},${cy - 16}`,
			`${cx + 28},${cy + 16}`,
			`${cx},${cy + 32}`,
			`${cx - 28},${cy + 16}`,
			`${cx - 28},${cy - 16}`
		].join(' ');
	}
</script>

<div class="relative w-full max-w-[30rem] aspect-square flex flex-col p-2">
	<div class="flex justify-between font-[var(--mono)] text-[0.62rem] tracking-[0.22em] uppercase text-[var(--accent)]">
		<span class="hex-meta-label">
			<span
				class="inline-block w-[6px] h-[6px] rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] mr-[0.4rem] align-middle {active ? 'hex-dot-active' : ''}"
			></span>
			SHIELD · {active ? 'ACTIVE' : 'STANDBY'}
		</span>
		<span class="text-[var(--fg-muted)]">ARMOR · {active ? 'ENGAGED' : 'IDLE'}</span>
	</div>

	<div class="flex-1 flex items-center justify-center">
		<svg viewBox="0 0 320 320" width="100%" height="100%" aria-hidden="true">
			<!-- outer dashed rings -->
			<circle
				cx="160"
				cy="160"
				r="148"
				fill="none"
				stroke="rgba(95,234,213,0.25)"
				stroke-width="1"
				stroke-dasharray="4 6"
			></circle>
			<circle
				cx="160"
				cy="160"
				r="118"
				fill="none"
				stroke="rgba(95,234,213,0.2)"
				stroke-width="1"
				stroke-dasharray="4 6"
			></circle>

			<!-- honeycomb hex shapes — pointy-top, arranged in flower pattern -->
			{#each hexes as h, i (i)}
				<polygon
					points={hexPoints(h.cx, h.cy)}
					fill={h.fill}
					stroke={h.stroke}
					stroke-width="1.5"
				/>
				{#if 'label' in h && h.label}
					<text
						x={h.cx}
						y={h.cy + 5}
						text-anchor="middle"
						fill="#5FEAD5"
						font-family="var(--mono-display)"
						font-weight="900"
						font-size="20">{h.label}</text
					>
				{/if}
			{/each}

			<!-- horizontal lead-in line from edge to central hex -->
			<line
				x1="0"
				y1="160"
				x2="120"
				y2="160"
				stroke="rgba(95,234,213,0.3)"
				stroke-width="1"
				stroke-dasharray="6 4"
			/>
		</svg>
	</div>

	<div class="flex justify-between font-[var(--mono)] text-[0.62rem] tracking-[0.22em] uppercase text-[var(--fg-muted)] mt-auto">
		<span>LAYERS · <span class="text-[var(--accent)]">{String(layers).padStart(2, '0')}</span></span>
		<span>PLATES · <span class="text-[var(--accent)]">{String(plates).padStart(2, '0')}</span></span>
	</div>
</div>

<style>
	/* @keyframes for pulsing dot — not a Tailwind built-in with this exact timing */
	@keyframes shield-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
	.hex-dot-active {
		animation: shield-pulse 1.6s ease-in-out infinite;
	}
</style>
