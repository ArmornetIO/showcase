<script lang="ts">
	// ── The battle log ───────────────────────────────────────────────────────────
	// Already fogged by the engine — `match.feed` is the rows THIS seat may read,
	// so there is nothing to filter here. The map from the game's own row shape to
	// the Timeline's happens at this boundary and nowhere else, which is what lets
	// `internal/` stay ignorant of the component library.
	import { Panel, StatusDot, Timeline, type IconName, type TimelineEvent } from 'showcase';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const events = $derived(
		match.feed.map(
			(row): TimelineEvent => ({
				id: row.id,
				when: row.when,
				title: row.title,
				subject: row.subject,
				icon: row.icon as IconName,
				tone: row.tone,
				major: row.major,
				qualifiers: row.qualifiers
			})
		)
	);
</script>

{#snippet round()}
	<span
		class="flex items-center gap-1.5 font-mono text-[0.54rem] tracking-widest uppercase text-[var(--fg-dim)]"
	>
		<StatusDot status="healthy" glow />
		round {match.round}
	</span>
{/snippet}

<Panel
	title="battle log"
	padding="dense"
	actions={round}
	class="pointer-events-auto flex flex-col min-h-0 {cls}"
>
	<div class="flex-1 min-h-0 overflow-y-auto pr-1">
		<Timeline {events} variant="feed" />
	</div>
</Panel>
