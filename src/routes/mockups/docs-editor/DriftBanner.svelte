<script lang="ts">
	// Section drift, at the size the problem actually deserves.
	//
	// The first version was a full-measure card with a headline, a paragraph, a
	// two-column comparator, a confidence meter, a blast-radius icon row, two
	// captioned choices and a compare link — ~400px of chrome between a heading
	// and its prose, for a state affecting ONE section of one document.
	//
	// Now it is a SectionCallout like everything else a section carries, opened
	// from the header's alert toggle, stating the four facts that decide the
	// matter — which id, which commit, how weak the match, how much is bound to
	// it — and offering the two decisions. Nothing is hidden that the toggle and
	// the top-bar alarm don't already announce.

	import { Button, Icon } from 'showcase';
	import SectionCallout from './SectionCallout.svelte';
	import type { DriftRecord } from './data.js';

	interface Props {
		drift: DriftRecord;
		section_id: string;
		/** Evidence + verdicts + controls pointing at this id — the blast radius. */
		bound: number;
		resolution: 'unresolved' | 'rebound' | 'retired';
		onresolve: (r: 'rebound' | 'retired') => void;
	}

	let { drift, section_id, bound, resolution, onresolve }: Props = $props();

	const pct = $derived(Math.round(drift.match_confidence * 100));
	const accent = $derived(resolution === 'unresolved' ? 'var(--palette-amber)' : '#34d399');
</script>

<SectionCallout
	icon={resolution === 'unresolved' ? 'alert-triangle' : 'check-circle'}
	label="Section identity · {section_id} · {drift.commit_sha}"
	{accent}
>
	{#snippet status()}
		<span class="shrink-0 font-mono text-[0.6rem] tabular-nums text-[var(--fg-dim)]">
			{pct}% match · floor 85%
		</span>
	{/snippet}

	{#if resolution === 'rebound'}
		<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">
			Re-anchored — <code class="font-mono text-[var(--fg)]">{section_id}</code> was kept and all
			{bound} references followed it. Logged to the anchor history.
		</p>
	{:else if resolution === 'retired'}
		<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">
			Retired <code class="font-mono text-[var(--fg)]">{section_id}</code> — {bound} references were
			orphaned and are queued for re-collection.
		</p>
	{:else}
		<!-- What we hold vs. what arrived. -->
		<div class="flex items-center gap-2 flex-wrap font-mono text-[0.66rem]">
			<span class="text-[var(--fg-dim)]">holds</span>
			<span class="text-[var(--fg)]">{drift.known_heading}</span>
			<Icon name="arrow-right" size={11} />
			<span class="text-[var(--fg-dim)]">repo has</span>
			<span class="text-[var(--fg)]">{drift.observed_heading}</span>
			<span class="text-[var(--fg-dim)]">
				· position {drift.known_ordinal}→{drift.observed_ordinal} · {drift.commit_author} · {drift.detected_at}
			</span>
		</div>

		<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">
			The heading was reworded <em class="not-italic text-[var(--fg)]">and</em> moved in the same
			commit, so the match falls below the auto-bind floor and Armornet will not guess. A wrong bind
			silently re-points <span style:color="var(--palette-amber)">{bound} audit references</span> at
			prose they never described.
		</p>

		<div class="flex items-center gap-2 flex-wrap">
			<Button variant="primary" size="sm" onclick={() => onresolve('rebound')}>
				<Icon name="link" size={12} />
				Same section
			</Button>
			<Button variant="ghost" size="sm" onclick={() => onresolve('retired')}>
				<Icon name="plus" size={12} />
				New section
			</Button>
			<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">
				keeps the id, {bound} refs follow · retires it, {bound} refs orphaned
			</span>
			<span class="flex-1"></span>
			<a
				class="flex items-center gap-1 font-mono text-[0.6rem] text-[var(--fg-dim)] no-underline hover:text-[var(--accent)]"
				href={drift.compare_url}
			>
				<Icon name="external-link" size={10} />
				compare
			</a>
		</div>
	{/if}
</SectionCallout>
