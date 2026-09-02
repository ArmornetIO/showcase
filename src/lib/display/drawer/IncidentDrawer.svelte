<script lang="ts" module>
	export interface IncidentDrawerData {
		ecosystem: string;
		package: string;
		version?: string;
		threatType: string;
		threatScore: number;
		cve?: string;
		description: string;
		recommendation: string;
		agents: string[];
		firstSeen: string;
		lastSeen: string;
		count: number;
	}
</script>

<script lang="ts">
	// ── IncidentDrawer — a stopped supply-chain attack, in depth ──────────────────
	// The click-through detail for one blast-radius interception: what the package
	// was, how dangerous, who was exposed, the intelligence and the recommended
	// action. A right-hand sheet with its own scrim; Esc / scrim-click close it.
	//
	// Read-only by design — the `triage` snippet is where a caller drops the
	// disposition + hand-off controls (status, send-to-tracker, create-rule) so the
	// drawer itself carries no workflow state.
	import type { Snippet } from 'svelte';
	import Chip from '../../primitives/status/Chip.svelte';
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		open: boolean;
		incident: IncidentDrawerData | null;
		onclose: () => void;
		/** Colour for the threat type (caller owns the threat palette). */
		threatColor?: string;
		/** Colour for the severity score/ring (caller owns the severity ramp). */
		severityColor?: string;
		/** Severity band label, e.g. 'CRITICAL'. */
		severityLabel?: string;
		/** Triage / enforcement controls, dropped in under the score. */
		triage?: Snippet;
	}

	let {
		open,
		incident,
		onclose,
		threatColor = 'var(--fg)',
		severityColor = 'var(--fg)',
		severityLabel,
		triage
	}: Props = $props();

	const label = (t: string) => t.replace(/_/g, ' ');
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) onclose();
	}}
/>

{#if open && incident}
	{@const i = incident}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="scrim" onclick={onclose} role="presentation"></div>
	<aside class="drawer" aria-label="Incident detail">
		<header class="dh">
			<div class="dh-chips">
				<Chip color="cyan">{i.ecosystem.toUpperCase()}</Chip>
				<span class="dh-threat" style:color={threatColor}>{label(i.threatType)}</span>
			</div>
			<button class="dh-close" onclick={onclose} aria-label="Close">
				<Icon name="x" size={18} strokeWidth={2} />
			</button>
		</header>

		<div class="dh-pkg">{i.package}{#if i.version}<span class="dh-ver">@{i.version}</span>{/if}</div>

		<div class="d-score">
			<div class="d-score-ring" style:border-color={severityColor}>
				<span class="d-score-n" style:color={severityColor}>{i.threatScore}</span>
				<span class="d-score-d">/10</span>
			</div>
			<div class="d-score-meta">
				{#if severityLabel}<span class="d-sev" style:color={severityColor}>{severityLabel}</span>{/if}
				<span class="d-when">seen {i.count}× · {i.firstSeen} → {i.lastSeen}</span>
			</div>
		</div>

		{#if triage}
			<section class="d-triage">{@render triage()}</section>
		{/if}

		<section class="d-sec">
			<div class="d-sec-h">
				<Icon name="git-fork" size={13} strokeWidth={1.75} />
				Blast radius · {i.agents.length} {i.agents.length === 1 ? 'agent' : 'agents'} exposed
			</div>
			{#if i.agents.length}
				<div class="d-agents">
					{#each i.agents as a (a)}<span class="d-agent">{a}</span>{/each}
				</div>
			{:else}
				<p class="d-desc">No agents were in the blast radius — the pull was stopped upstream.</p>
			{/if}
		</section>

		<section class="d-sec">
			<div class="d-sec-h"><Icon name="file-text" size={13} strokeWidth={1.75} /> Intelligence</div>
			{#if i.cve}<a class="d-cve" href="#cve">{i.cve}</a>{/if}
			<p class="d-desc">{i.description}</p>
		</section>

		{#if i.recommendation}
			<section class="d-sec d-rec">
				<div class="d-sec-h">
					<Icon name="wrench" size={13} strokeWidth={1.75} /> Recommended action
				</div>
				<p class="d-desc">{i.recommendation}</p>
			</section>
		{/if}
	</aside>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(3, 6, 10, 0.55);
		backdrop-filter: blur(2px);
		z-index: 40;
		animation: id-fade 160ms ease;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(440px, 92vw);
		z-index: 41;
		overflow-y: auto;
		padding: 1.4rem 1.4rem 2.5rem;
		background: linear-gradient(160deg, #0b1017, #070b10);
		border-left: 1px solid var(--border);
		box-shadow: -24px 0 60px -20px rgba(0, 0, 0, 0.7);
		animation: id-slide 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	@keyframes id-fade {
		from {
			opacity: 0;
		}
	}
	@keyframes id-slide {
		from {
			transform: translateX(30px);
			opacity: 0;
		}
	}
	.dh {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.dh-chips {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.dh-threat {
		font-family: var(--mono);
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.dh-close {
		display: flex;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 5px;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.dh-close:hover {
		color: var(--fg);
		border-color: var(--accent);
	}
	.dh-pkg {
		margin-top: 0.9rem;
		font-family: var(--mono);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--fg);
		word-break: break-all;
	}
	.dh-ver {
		color: var(--fg-dim);
		font-weight: 500;
	}
	.d-score {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.1rem 0;
		padding-bottom: 1.1rem;
		border-bottom: 1px solid var(--border);
	}
	.d-score-ring {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 76px;
		height: 76px;
		border: 3px solid;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.d-score-n {
		font-family: var(--mono);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}
	.d-score-d {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
	}
	.d-score-meta {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.d-sev {
		font-family: var(--mono);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}
	.d-when {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.d-triage {
		margin-bottom: 1.3rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid var(--border);
	}
	.d-sec {
		margin-bottom: 1.15rem;
	}
	.d-sec-h {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
		margin-bottom: 0.6rem;
	}
	.d-sec-h :global(svg) {
		color: var(--accent);
	}
	.d-agents {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.d-agent {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 3px 8px;
	}
	.d-cve {
		display: inline-block;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
		text-decoration: none;
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: var(--radius-control);
		padding: 3px 8px;
		margin-bottom: 0.6rem;
	}
	.d-desc {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.6;
		color: var(--fg-muted);
	}
	.d-rec {
		background: rgba(94, 234, 212, 0.05);
		border: 1px solid rgba(94, 234, 212, 0.18);
		border-radius: var(--radius-surface);
		padding: 0.8rem 0.9rem;
	}
</style>
