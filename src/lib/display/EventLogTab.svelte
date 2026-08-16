<script lang="ts">
	// A full activity log. Presentational: the caller supplies pre-formatted,
	// pre-ordered entries (newest first) and this draws them.
	import { eventColor, eventIcon, type LogEventVM } from './eventLog.js';

	let {
		events = [],
		title = 'Event log',
		emptyText = 'No activity recorded yet.'
	}: {
		events?: LogEventVM[];
		/** Section heading above the log. */
		title?: string;
		/** Shown in place of the list when there is nothing to draw. */
		emptyText?: string;
	} = $props();
</script>

<div class="tab-content">
	<div class="section-label">{title}</div>
	{#if events.length === 0}
		<p class="empty">{emptyText}</p>
	{:else}
		{#each events as ev}
			<div class="event-row event-row--full">
				<span class="event-icon event-icon--lg" style:color={eventColor(ev.tone)}
					>{eventIcon(ev.tone)}</span
				>
				<div class="event-body">
					<span class="event-msg">{ev.msg}</span>
					<span class="event-ts">{ev.ts}</span>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.tab-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-label {
		font-family: var(--mono);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border);
		margin-bottom: 0.25rem;
		margin-top: 0.25rem;
	}

	.empty {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}

	.event-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
	}

	.event-row--full {
		align-items: flex-start;
		padding: 0.55rem 0;
	}

	.event-icon {
		font-family: var(--mono);
		font-size: 0.72rem;
		flex-shrink: 0;
		width: 14px;
		text-align: center;
	}

	.event-icon--lg {
		font-size: 0.8rem;
		width: 16px;
		margin-top: 1px;
	}

	.event-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.event-msg {
		flex: 1;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
	}

	.event-ts {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		flex-shrink: 0;
	}
</style>
