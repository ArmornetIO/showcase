<script lang="ts">
	import { onMount } from 'svelte';
	import { perfBudget, type PerfTier } from './budget.svelte.js';

	// Sampling is reference-counted and off by default, so the panel turns it on
	// while it is open and lets go when it closes.
	onMount(() => perfBudget.start());

	const TIERS: PerfTier[] = ['full', 'reduced', 'minimal'];

	const TIER_COLOR: Record<PerfTier, string> = {
		full:    'var(--accent)',
		reduced: 'rgba(251,191,36,0.9)',
		minimal: 'rgba(248,113,133,0.9)',
	};

	// Sparkline: last 60 FPS readings → SVG polyline
	function sparkPoints(history: number[]): string {
		const W = 120, H = 28;
		const len = history.length;
		if (len < 2) return '';
		return history
			.map((v, i) => {
				const x = (i / (len - 1)) * W;
				const y = H - (Math.min(v, 120) / 120) * H;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	const tier = $derived(perfBudget.tier);
	const fps  = $derived(perfBudget.fps);
</script>

<div class="perf-section">
	<div class="perf-header">
		<span class="perf-title">// perf</span>
		<span class="tier-badge" style:color={TIER_COLOR[tier]}>{tier}</span>
	</div>

	<!-- FPS sparkline -->
	<div class="spark-row">
		<span class="perf-label">fps</span>
		<div class="spark-wrap">
			<svg width="120" height="28" class="sparkline">
				<polyline
					points={sparkPoints(perfBudget.fpsHistory)}
					fill="none"
					stroke={fps < 30 ? 'rgba(248,113,133,0.7)' : fps < 50 ? 'rgba(251,191,36,0.7)' : 'rgba(95,234,213,0.7)'}
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<!-- 30fps floor line -->
				<line x1="0" y1={28 - (30/120)*28} x2="120" y2={28 - (30/120)*28}
					stroke="rgba(248,113,133,0.2)" stroke-width="1" stroke-dasharray="3 3" />
				<!-- 60fps floor line -->
				<line x1="0" y1={28 - (60/120)*28} x2="120" y2={28 - (60/120)*28}
					stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="3 3" />
			</svg>
			<span class="fps-num" style:color={TIER_COLOR[tier]}>{fps}</span>
		</div>
	</div>

	<!-- Battery -->
	{#if perfBudget.batteryLevel !== null}
		<div class="stat-row">
			<span class="perf-label">battery</span>
			<div class="battery-wrap">
				<div class="battery-bar">
					<div
						class="battery-fill"
						style:width="{perfBudget.batteryLevel * 100}%"
						style:background={perfBudget.batteryLevel < 0.1 ? 'rgba(248,113,133,0.8)' : perfBudget.batteryLevel < 0.2 ? 'rgba(251,191,36,0.8)' : 'rgba(95,234,213,0.5)'}
					></div>
				</div>
				<span class="stat-val">
					{Math.round(perfBudget.batteryLevel * 100)}%{perfBudget.batteryCharging ? ' ⚡' : ''}
				</span>
			</div>
		</div>
	{/if}

	<!-- prefers-reduced-motion -->
	{#if perfBudget.prefersReducedMotion}
		<div class="stat-row">
			<span class="perf-label">motion</span>
			<span class="stat-val warn">reduced</span>
		</div>
	{/if}

	<!-- Force tier override -->
	<div class="stat-row">
		<span class="perf-label">force</span>
		<div class="tier-switcher">
			<button
				class="tier-opt"
				class:active={perfBudget.forceTier === null}
				onclick={() => perfBudget.setForceTier(null)}
			>auto</button>
			{#each TIERS as t (t)}
				<button
					class="tier-opt"
					class:active={perfBudget.forceTier === t}
					style:--tc={TIER_COLOR[t]}
					onclick={() => perfBudget.setForceTier(t)}
				>{t}</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.perf-section {
		border-top: 1px solid var(--border);
		padding: 0.5rem 0;
	}

	.perf-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 1rem 0.2rem;
	}
	.perf-title {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
	}
	.tier-badge {
		font-family: var(--mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.spark-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 1rem;
	}
	.spark-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.sparkline {
		display: block;
		overflow: visible;
	}
	.fps-num {
		font-family: var(--mono);
		font-size: 0.78rem;
		font-weight: 700;
		min-width: 28px;
		text-align: right;
	}

	.stat-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.28rem 1rem;
	}
	.perf-label {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-dim);
		letter-spacing: 0.07em;
		min-width: 44px;
	}
	.stat-val {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
	}
	.stat-val.warn {
		color: rgba(251, 191, 36, 0.9);
	}

	.battery-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.battery-bar {
		width: 56px;
		height: 7px;
		border-radius: 3px;
		background: var(--surface-strong);
		border: 1px solid var(--border-strong);
		overflow: hidden;
	}
	.battery-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 1s, background 0.3s;
	}

	.tier-switcher {
		display: flex;
		gap: 2px;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 2px;
	}
	.tier-opt {
		font-family: var(--mono);
		font-size: 0.58rem;
		padding: 0.18rem 0.4rem;
		border-radius: 3px;
		border: none;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		letter-spacing: 0.04em;
		transition: color 0.15s, background 0.15s;
	}
	.tier-opt:hover {
		color: var(--fg-muted);
	}
	.tier-opt.active {
		background: var(--accent-faint-strong);
		color: var(--tc, var(--accent));
	}
</style>
