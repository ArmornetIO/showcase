<script lang="ts">
	export type StatusLevel = 'healthy' | 'degraded' | 'offline';

	interface StatusDotProps {
		status: StatusLevel;
		/** Show a glow shadow. Default true for live dashboards, set false for static lists. */
		glow?: boolean;
		/** Pulse animation for live state. */
		pulse?: boolean;
	}

	let { status, glow = true, pulse = false }: StatusDotProps = $props();
</script>

<span
	class="status-dot status-{status} {glow ? 'has-glow' : ''} {pulse ? 'pulse-dot' : ''}"
	aria-hidden="true"
></span>

<style>
	.status-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		vertical-align: middle;
	}

	.status-healthy  { background: var(--palette-emerald); }
	.status-degraded { background: var(--palette-amber); }
	.status-offline  { background: var(--palette-red); }

	.status-healthy.has-glow  { box-shadow: 0 0 6px rgba(52, 211, 153, 0.7); }
	.status-degraded.has-glow { box-shadow: 0 0 6px rgba(252, 211, 77, 0.7); }
	.status-offline.has-glow  { box-shadow: 0 0 6px rgba(252, 165, 165, 0.7); }
</style>