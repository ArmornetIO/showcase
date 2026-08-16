<script lang="ts" module>
	import type { IconName } from '../../icons/Icon.svelte';
	export type { IconName };

	export interface OverviewDrawerStat {
		label: string;
		value: string;
	}
</script>

<script lang="ts">
	// ── OverviewDrawer — the light, right-pinned detail card ──────────────────────
	// Lifted out of MeshMembrane's click-detail card: an accent-edged card that slides
	// in over a canvas when a node is picked, showing the record at a glance — icon,
	// title, role, a stat grid and a note. Lighter than the tabbed NodeDrawer, which
	// is why it suits an OVERVIEW page: nothing to page through, just the summary and
	// an optional way onward.
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Eyebrow under the title — what KIND of thing this is (e.g. 'Monitored vendor'). */
		role: string;
		/** Accent colour that themes the card (left edge, icon, role). */
		accent: string;
		icon: IconName;
		stats: OverviewDrawerStat[];
		note?: string;
		/** Optional call-to-action button at the foot (e.g. 'View full record →'). */
		ctaLabel?: string;
		oncta?: () => void;
		onclose: () => void;
		/** How wide the card is drawing right now, px — 0 while closed.
		 *
		 *  Reported rather than assumed because the width is a `clamp` against the
		 *  container, so it is a different number at every viewport size. A caller
		 *  fitting a canvas around this card needs the real one: guessing means the
		 *  thing the card is describing can end up underneath it. Measured here, next
		 *  to the CSS that decides it, so the two cannot drift apart. */
		width?: number;
	}

	let {
		open,
		title,
		role,
		accent,
		icon,
		stats,
		note,
		ctaLabel,
		oncta,
		onclose,
		width = $bindable(0)
	}: Props = $props();

	// Closed means occupying nothing. Without this the last measured width sticks
	// after the card unmounts, and whatever was fitted around it stays shrunk.
	$effect(() => {
		if (!open) width = 0;
	});
</script>

{#if open}
	<div class="od" style:--accent={accent} bind:clientWidth={width}>
		<button class="od-close" onclick={onclose} aria-label="Close">✕</button>
		<div class="od-head">
			<span class="od-ic"><Icon name={icon} size={20} /></span>
			<div class="od-titles">
				<div class="od-title">{title}</div>
				<div class="od-role">{role}</div>
			</div>
		</div>
		<dl class="od-stats">
			{#each stats as s (s.label)}
				<div><dt>{s.label}</dt><dd>{s.value}</dd></div>
			{/each}
		</dl>
		{#if note}
			<p class="od-note">{note}</p>
		{/if}
		{#if oncta}
			<button class="od-cta" onclick={oncta}>{ctaLabel ?? 'View detail →'}</button>
		{/if}
	</div>
{/if}

<style>
	/* Detail card — pinned to the right of the (positioned) canvas, interactive. */
	.od {
		position: absolute;
		z-index: 5;
		top: 0.9rem;
		right: 0.9rem;
		bottom: 0.9rem;
		width: clamp(220px, 26%, 288px);
		padding: 1rem;
		border-radius: 10px;
		background: color-mix(in srgb, var(--bg-elev) 94%, transparent);
		border: 1px solid var(--border);
		border-left: 2px solid var(--accent);
		box-shadow: -12px 0 40px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: hidden auto;
		animation: od-slide 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes od-slide {
		from {
			opacity: 0;
			transform: translateX(12px);
		}
	}

	.od-close {
		position: absolute;
		top: 0.55rem;
		right: 0.6rem;
		width: 22px;
		height: 22px;
		border: none;
		border-radius: 5px;
		background: transparent;
		color: var(--fg-dim);
		font-size: 0.75rem;
		cursor: pointer;
	}
	.od-close:hover {
		background: var(--surface-raised);
		color: var(--fg);
	}

	.od-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.od-ic {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 8px;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.od-titles {
		min-width: 0;
	}
	.od-title {
		font-family: var(--mono);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.15;
	}
	.od-role {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
		margin-top: 1px;
	}

	.od-stats {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem 0.5rem;
	}
	.od-stats div {
		min-width: 0;
	}
	.od-stats dt {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.od-stats dd {
		margin: 1px 0 0;
		font-family: var(--mono);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--fg);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.od-note {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--fg-muted);
		border-top: 1px solid var(--border);
		padding-top: 0.7rem;
	}

	.od-cta {
		margin-top: auto;
		width: 100%;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 0.5rem 0;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.od-cta:hover {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
	}
</style>
