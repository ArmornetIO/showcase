<script lang="ts">
	import { getFrameState } from '../../frames/context.js';
	import FrameNumber from '../../frames/FrameNumber.svelte';

	export type StatTileSubVariant = 'up' | 'down' | 'neutral';
	export type StatTileHalo = 'mint' | 'cyan' | 'emerald' | 'blue' | 'amber' | 'red';
	export type StatTileShape = 'default' | 'cut-corner';

	interface StatTileProps {
		label: string;
		value: string;
		sub?: string;
		subVariant?: StatTileSubVariant;
		mono?: boolean;
		halo?: StatTileHalo;
		/** `'cut-corner'` applies diagonal clip-path with persistent accent glow (assessments style). */
		shape?: StatTileShape;
	}

	let { label, value, sub, subVariant = 'neutral', mono = false, halo = 'mint', shape = 'default' }: StatTileProps =
		$props();

	// Pre-load frame: the label stays real, the value rolls (if it's a number).
	const framed = getFrameState();
	const hasDigits = $derived(/\d/.test(String(value)));

	const HALO_RGB: Record<StatTileHalo, string> = {
		mint: '95,234,213',
		cyan: '34,211,238',
		emerald: '52,211,153',
		blue: '56,189,248',
		amber: '252,211,77',
		red: '251,113,133'
	};
</script>

<div
	class="stat-tile"
	class:stat-tile--cut={shape === 'cut-corner'}
	style:--halo-rgb={HALO_RGB[halo]}
>
	<div class="tile-label">{label}</div>
	<div class="tile-value" class:tile-value--mono={mono}>
		{#if framed() && hasDigits}<FrameNumber {value} />{:else}{value}{/if}
	</div>
	{#if sub}
		<div class="tile-sub sub-{subVariant}">{sub}</div>
	{/if}
</div>

<style>
	.stat-tile {
		--halo-rgb: 95, 234, 213;
		position: relative;
		padding: 16px 16px 15px;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--bg-elev);
		transition:
			box-shadow 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
			transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
			border-color 0.4s ease;
	}

	.stat-tile:hover {
		transform: translateY(-4px);
		border-color: rgba(var(--halo-rgb), 0.5);
		box-shadow:
			0 0 0 1px rgba(var(--halo-rgb), 0.5),
			0 0 12px 2px rgba(var(--halo-rgb), 0.4),
			0 0 30px 4px rgba(var(--halo-rgb), 0.25),
			0 0 60px 8px rgba(var(--halo-rgb), 0.12);
	}

	/* ── Cut-corner shape (assessments style) ─────────────────────────────── */
	.stat-tile--cut {
		border-radius: 0;
		clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
		box-shadow: 0 0 22px -10px rgba(var(--halo-rgb), 0.35);
	}
	.stat-tile--cut:hover {
		box-shadow:
			0 0 22px -6px rgba(var(--halo-rgb), 0.5),
			0 0 40px -14px rgba(var(--halo-rgb), 0.3);
	}

	/* Base pseudo-elements (L-bracket corners for default shape) */
	.stat-tile::before,
	.stat-tile::after {
		content: '';
		position: absolute;
		width: 12px;
		height: 12px;
		pointer-events: none;
	}

	.stat-tile::before {
		top: 7px;
		left: 7px;
		border-top: 1px solid var(--border-strong);
		border-left: 1px solid var(--border-strong);
	}

	.stat-tile::after {
		bottom: 7px;
		right: 7px;
		border-bottom: 1px solid var(--border-strong);
		border-right: 1px solid var(--border-strong);
	}

	/* Cut-corner pseudo-elements override base — must come AFTER base rules */
	.stat-tile--cut::before,
	.stat-tile--cut::after {
		width: 22px;
		height: 1px;
		border: none;
		background: var(--accent);
	}
	.stat-tile--cut::before {
		top: 0;
		left: 0;
	}
	.stat-tile--cut::after {
		bottom: 0;
		right: 0;
	}

	.tile-label {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 9px;
	}

	.tile-value {
		font-family: var(--sans-brand);
		font-size: 26px;
		font-weight: 700;
		color: var(--fg);
		line-height: 1;
	}

	.tile-value--mono {
		font-family: var(--mono);
		font-size: 18px;
	}

	.tile-sub {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--mono);
		font-size: 11px;
		margin-top: 5px;
		color: var(--fg-dim);
	}

	.sub-up {
		color: var(--palette-emerald-l);
	}
	.sub-down {
		color: var(--palette-red);
	}
	.sub-neutral {
		color: var(--fg-dim);
	}
</style>
