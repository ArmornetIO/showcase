<script lang="ts">
	import StatusDot from './StatusDot.svelte';

	export type StatusLevel = 'healthy' | 'degraded' | 'offline';

	interface StatusBadgeProps {
		status: StatusLevel;
		/** Override the rendered label. Defaults to the status keyword. */
		label?: string;
		/** Border around the text label (full pill). Set false for plain text only. */
		bordered?: boolean;
		/** Renders a filled accent pill (e.g. status-page "operational"). Overrides `bordered`. */
		filled?: boolean;
		/** Show a leading status dot. */
		dot?: boolean;
	}

	let {
		status,
		label,
		bordered = true,
		filled = false,
		dot = false
	}: StatusBadgeProps = $props();
</script>

<span
	class="sbadge sbadge-{status} {filled ? 'sbadge-filled' : bordered ? 'sbadge-bordered' : ''}"
>
	{#if dot}<StatusDot {status} glow={!filled} />{/if}
	{label ?? status}
</span>

<style>
	.sbadge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
	}

	/* ── Bordered (default) — outlined pill ──────────────────────────────── */
	.sbadge-bordered {
		padding: 4px 9px;
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
	}

	/* ── Filled — solid status-page pill ─────────────────────────────────── */
	/* ── Filled — solid status-page pill ─────────────────────────────────── */
	.sbadge-filled {
		padding: 4px 9px;
		border-radius: var(--radius-control);
	}
	.sbadge-filled.sbadge-healthy  { color: #001a13; }
	.sbadge-filled.sbadge-degraded { color: #1c1408; }
	.sbadge-filled.sbadge-offline  { color: #2a0a0a; }

	/* ── Variants ────────────────────────────────────────────────────────── */
	.sbadge-healthy  { color: var(--palette-emerald-l); }
	.sbadge-degraded { color: var(--palette-amber); }
	.sbadge-offline  { color: var(--palette-red); }

	.sbadge-filled.sbadge-healthy  { background: var(--palette-emerald); }
	.sbadge-filled.sbadge-degraded { background: var(--palette-amber); }
	.sbadge-filled.sbadge-offline  { background: var(--palette-red); }
</style>