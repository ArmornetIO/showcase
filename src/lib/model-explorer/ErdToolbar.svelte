<script lang="ts">
	// ── ErdToolbar — floating diagram controls ─────────────────────────────────
	// Detail-level segment, focus toggle, auto-arrange, and the table/ref counts.
	// Bindable `level`/`focusMode`; `onarrange` fires the layout recompute.
	import Icon from '../icons/Icon.svelte';
	import SegmentGroup from '../primitives/actions/SegmentGroup.svelte';
	import type { DetailLevel } from './erd-layout.js';

	let {
		tableCount,
		fkCount,
		level = $bindable('all'),
		focusMode = $bindable(true),
		onarrange
	}: {
		tableCount: number;
		fkCount: number;
		level?: DetailLevel;
		focusMode?: boolean;
		onarrange: () => void;
	} = $props();

	const LEVEL_OPTS = [
		{ label: 'all', value: 'all' },
		{ label: 'keys', value: 'keys' },
		{ label: 'min', value: 'collapsed' }
	];
</script>

<div class="erd-bar">
	<span class="erd-stat"><Icon name="table-2" size={12} /> {tableCount} tables</span>
	<span class="erd-stat"><Icon name="share-2" size={12} /> {fkCount} refs</span>
	<span class="erd-sep"></span>
	<SegmentGroup options={LEVEL_OPTS} value={level} onchange={(v: string) => (level = v as DetailLevel)} />
	<button
		class="erd-tgl"
		class:on={focusMode}
		title="Focus mode — dim tables unrelated to the selection (d)"
		onclick={() => (focusMode = !focusMode)}
	>
		<Icon name="eye-off" size={13} /> focus
	</button>
	<button class="erd-tgl" title="Auto-arrange (a)" onclick={onarrange}>
		<Icon name="layout-grid" size={13} /> arrange
	</button>
</div>

<style>
	.erd-bar {
		position: absolute;
		top: 12px;
		left: 14px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
		backdrop-filter: blur(6px);
		z-index: 5;
	}
	.erd-stat {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}
	.erd-sep {
		width: 1px;
		height: 16px;
		background: var(--border);
	}
	.erd-tgl {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 9px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.68rem;
		cursor: pointer;
	}
	.erd-tgl:hover {
		color: var(--fg);
	}
	.erd-tgl.on {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}
</style>
