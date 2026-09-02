<script lang="ts" module>
	export type Verdict = 'strong' | 'gaps' | 'exposed';
	export type PostureClauseTone = 'neutral' | 'good' | 'warn' | 'bad';
	export interface PostureClause {
		text: string;
		tone?: PostureClauseTone;
	}
</script>

<script lang="ts">
	import CountUp from './CountUp.svelte';
	import { getFrameState } from '../../frames/context.js';
	import FrameNumber from '../../frames/FrameNumber.svelte';

	/**
	 * PostureVerdict — the one-sentence security-posture line a dashboard leads with:
	 * a large headline metric, an auto-derived verdict chip (Strong / Gaps / Exposed),
	 * and hairline sub-clauses that state the "so what". Supports a first-run empty mode.
	 */
	interface Props {
		/** Headline metric (e.g. 82 for "82%"). Omit in empty mode. */
		value?: number;
		/** Unit appended to the metric. Default '%'. */
		unit?: string;
		/** Text before the metric, e.g. "You have assurance on". */
		prefix?: string;
		/** Text after the metric, e.g. "of your critical third-party risk". */
		suffix?: string;
		/** Explicit verdict; when omitted it is derived from `value` + `thresholds`. */
		verdict?: Verdict;
		/** Verdict thresholds (inclusive lower bounds). Default strong≥90, gaps≥70. */
		thresholds?: { strong: number; gaps: number };
		/** Supporting sub-clauses shown under the headline. */
		clauses?: PostureClause[];
		/** Animate the metric with a count-up. Default true. */
		animateValue?: boolean;
		/** First-run mode — no metric/chip, just an inviting statement. */
		empty?: boolean;
		/** Headline shown in empty mode. */
		emptyTitle?: string;
		/** Sub-line shown in empty mode. */
		emptySub?: string;
	}

	let {
		value,
		unit = '%',
		prefix,
		suffix,
		verdict,
		thresholds = { strong: 90, gaps: 70 },
		clauses = [],
		animateValue = true,
		empty = false,
		emptyTitle = "Let's map your exposure.",
		emptySub
	}: Props = $props();

	const VERDICT_LABEL: Record<Verdict, string> = {
		strong: 'Strong',
		gaps: 'Gaps',
		exposed: 'Exposed'
	};

	// Pre-load frame: keep the full sentence, but roll the headline number (via
	// FrameNumber, fixed-width) until the real value arrives.
	const framed = getFrameState();

	const resolved = $derived<Verdict>(
		verdict ??
			(value == null
				? 'gaps'
				: value >= thresholds.strong
					? 'strong'
					: value >= thresholds.gaps
						? 'gaps'
						: 'exposed')
	);
</script>

{#if empty}
	<div class="posture posture--empty">
		<h2 class="empty-title">{emptyTitle}</h2>
		{#if emptySub}<p class="empty-sub">{emptySub}</p>{/if}
	</div>
{:else}
	<div class="posture">
		<p class="statement">
			{#if prefix}<span class="lead">{prefix}</span>{/if}
			<span class="metric">
				{#if framed()}<FrameNumber value={value ?? 0} />{unit}{:else if value != null}<CountUp {value} animate={animateValue} />{unit}{:else}—{/if}
			</span>
			{#if suffix}<span class="lead">{suffix}</span>{/if}
			{#if framed()}
				<span class="chip chip--frame frame-field">····</span>
			{:else}
				<span
					class="chip chip--{resolved}"
					title="≥{thresholds.strong}% Strong · {thresholds.gaps}–{thresholds.strong - 1}% Gaps · <{thresholds.gaps}% Exposed"
				>
					{VERDICT_LABEL[resolved]}
				</span>
			{/if}
		</p>
		{#if clauses.length}
			<ul class="clauses">
				{#each clauses as clause, i (i)}
					<li class="clause clause--{clause.tone ?? 'neutral'}">{clause.text}</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.posture {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.statement {
		margin: 0;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem 0.65rem;
		font-family: var(--sans-brand);
		font-size: clamp(1.35rem, 2.6vw, 2rem);
		font-weight: 600;
		line-height: 1.15;
		color: var(--fg-muted);
	}

	.lead {
		color: var(--fg-muted);
	}

	.metric {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 1.15em;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
	.chip--frame {
		align-self: center;
		border-color: transparent;
	}

	.chip {
		align-self: center;
		font-family: var(--mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 3px 9px;
		border-radius: var(--radius-inset);
		border: 1px solid;
		white-space: nowrap;
	}
	.chip--strong {
		color: var(--palette-emerald-l);
		border-color: rgba(52, 211, 153, 0.4);
		background: rgba(52, 211, 153, 0.08);
	}
	.chip--gaps {
		color: var(--palette-amber-l);
		border-color: rgba(252, 211, 77, 0.4);
		background: rgba(252, 211, 77, 0.08);
	}
	.chip--exposed {
		color: var(--palette-red);
		border-color: rgba(248, 113, 113, 0.4);
		background: rgba(248, 113, 113, 0.08);
	}

	.clauses {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.clause {
		font-family: var(--mono);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--fg-dim);
		padding-left: 0.9rem;
		border-left: 1px solid var(--border);
	}
	.clause--good {
		color: var(--palette-emerald-l);
		border-left-color: rgba(52, 211, 153, 0.4);
	}
	.clause--warn {
		color: var(--palette-amber-l);
		border-left-color: rgba(252, 211, 77, 0.4);
	}
	.clause--bad {
		color: var(--palette-red);
		border-left-color: rgba(248, 113, 113, 0.4);
	}

	/* ── First-run ── */
	.posture--empty {
		gap: 0.4rem;
	}
	.empty-title {
		margin: 0;
		font-family: var(--sans-brand);
		font-size: clamp(1.5rem, 3vw, 2.25rem);
		font-weight: 700;
		color: var(--fg);
	}
	.empty-sub {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.82rem;
		color: var(--fg-dim);
	}
</style>
