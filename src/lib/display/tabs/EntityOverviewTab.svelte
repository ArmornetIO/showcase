<script lang="ts">
	// Summary face for a selected entity: a key/value grid, an optional list of
	// highlights, a recent-activity excerpt, and an optional credentials block.
	// Presentational — every section is driven by props and hidden when empty.
	import { eventColor, eventIcon, type LogEventVM } from './eventLog.js';

	export interface OverviewStat {
		label: string;
		value: string;
		/** Render the value in a smaller monospace style (e.g. endpoints). */
		mono?: boolean;
		/** Highlight the value as live/healthy. */
		live?: boolean;
		/** Truncate the value with an ellipsis. */
		truncate?: boolean;
	}

	/** A named thing worth calling out, with an optional measure and a count
	 *  badge — e.g. a capability and how often it fired. */
	export interface OverviewHighlight {
		label: string;
		/** Secondary measure, shown dim and right-aligned (e.g. a rate). */
		detail?: string;
		/** Count badge, drawn in the alert tone. Hidden when 0 or absent. */
		count?: number;
		/** Word after the count. Defaults to nothing, so pass e.g. 'denied'. */
		countLabel?: string;
	}

	/** A revealed or masked identifier the reader may need to copy or rotate. */
	export interface OverviewCredential {
		label: string;
		value: string;
		/** Draw a fixed mask instead of the value. */
		masked?: boolean;
		/** Offer a copy button (fires `oncopy` with this credential's label). */
		copyable?: boolean;
		/** Offer a destructive-styled button with this label (fires `onaction`). */
		actionLabel?: string;
	}

	let {
		stats = [],
		highlights = [],
		events = [],
		credentials = [],
		highlightsTitle = 'Highlights',
		eventsTitle = 'Recent activity',
		credentialsTitle = 'Identity',
		/** Label of the credential most recently copied, so its button can confirm. */
		copiedLabel = null,
		oncopy,
		onaction
	}: {
		stats?: OverviewStat[];
		highlights?: OverviewHighlight[];
		events?: LogEventVM[];
		credentials?: OverviewCredential[];
		highlightsTitle?: string;
		eventsTitle?: string;
		credentialsTitle?: string;
		copiedLabel?: string | null;
		oncopy?: (label: string) => void;
		onaction?: (label: string) => void;
	} = $props();
</script>

<div class="tab-content">
	<!-- Key-value stats -->
	<div class="kv-grid">
		{#each stats as s (s.label)}
			<div class="kv-row">
				<span class="kv-key">{s.label}</span>
				<span
					class="kv-val"
					class:kv-val--live={s.live}
					class:kv-val--mono={s.mono}
					class:kv-val--truncate={s.truncate}>{s.value}</span
				>
			</div>
		{/each}
	</div>

	<!-- Highlights -->
	{#if highlights.length}
		<div class="section-label">{highlightsTitle}</div>
		<div class="highlights">
			{#each highlights as h (h.label)}
				<div class="highlight-row">
					<span class="highlight-dot"></span>
					<span class="highlight-name">{h.label}</span>
					{#if h.detail}
						<span class="highlight-detail">{h.detail}</span>
					{/if}
					{#if h.count !== undefined && h.count > 0}
						<span class="highlight-count"
							>{h.count}{h.countLabel ? ` ${h.countLabel}` : ''}</span
						>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Recent activity -->
	{#if events.length}
		<div class="section-label">{eventsTitle}</div>
		{#each events as ev}
			<div class="event-row">
				<span class="event-icon" style:color={eventColor(ev.tone)}>{eventIcon(ev.tone)}</span>
				<span class="event-msg">{ev.msg}</span>
				<span class="event-ts">{ev.ts}</span>
			</div>
		{/each}
	{/if}

	<!-- Credentials -->
	{#if credentials.length}
		<div class="section-label" style="margin-top:0.5rem">{credentialsTitle}</div>
		{#each credentials as cred (cred.label)}
			<div class="cred-row">
				<span class="cred-key">{cred.label}</span>
				<code class="cred-val" class:cred-val--dim={cred.masked}>
					{cred.masked ? '••••••••••••••••••••' : cred.value || '—'}
				</code>
				{#if cred.copyable && cred.value}
					<button
						class="cred-copy"
						onclick={() => oncopy?.(cred.label)}
						aria-label="Copy {cred.label}"
					>
						{#if copiedLabel === cred.label}
							<svg
								width="11"
								height="11"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg
							>
						{:else}
							<svg
								width="11"
								height="11"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								aria-hidden="true"
								><rect width="14" height="14" x="8" y="8" rx="2" /><path
									d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
								/></svg
							>
						{/if}
					</button>
				{/if}
				{#if cred.actionLabel}
					<button class="cred-action" onclick={() => onaction?.(cred.label)}
						>{cred.actionLabel}</button
					>
				{/if}
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

	.kv-grid {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.kv-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

	.kv-key {
		font-family: var(--mono);
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--fg-dim);
		min-width: 72px;
		flex-shrink: 0;
	}

	.kv-val {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-muted);
	}

	.kv-val--live {
		color: var(--accent-emerald);
	}
	.kv-val--mono {
		font-size: 0.65rem;
	}
	.kv-val--truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.highlights {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
	}

	.highlight-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface-raised);
	}

	.highlight-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 5px var(--accent-glow);
		flex-shrink: 0;
	}

	.highlight-name {
		flex: 1;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
	}

	.highlight-detail {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}

	.highlight-count {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--palette-red);
		background: color-mix(in srgb, var(--palette-red) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--palette-red) 20%, transparent);
		padding: 0.1em 0.4em;
		border-radius: 2px;
	}

	.event-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
	}

	.event-icon {
		font-family: var(--mono);
		font-size: 0.72rem;
		flex-shrink: 0;
		width: 14px;
		text-align: center;
	}

	.event-msg {
		flex: 1;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.event-ts {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
		flex-shrink: 0;
	}

	.cred-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--input-bg);
		margin-bottom: 0.3rem;
	}

	.cred-key {
		font-family: var(--mono);
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
		min-width: 52px;
		flex-shrink: 0;
	}

	.cred-val {
		flex: 1;
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.cred-val--dim {
		color: var(--fg-dim);
		letter-spacing: 0.04em;
	}

	.cred-copy {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 1px solid transparent;
		color: var(--fg-dim);
		padding: 0.15rem 0.3rem;
		border-radius: 2px;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.cred-copy:hover {
		color: var(--accent);
		border-color: var(--border-strong);
	}

	.cred-action {
		background: none;
		border: 1px solid var(--border-strong);
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0.15rem 0.5rem;
		border-radius: 2px;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.cred-action:hover {
		color: var(--palette-red);
		border-color: color-mix(in srgb, var(--palette-red) 40%, transparent);
	}
</style>
