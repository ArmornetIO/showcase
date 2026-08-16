<script lang="ts">
	/** What an event MEANS, as a colour. Absent reads as the neutral accent. */
	export type TimelineTone = 'ok' | 'warn' | 'bad' | 'info';

	/** How the same events are drawn.
	 *  - `rail`  — dot-and-connector history. Few events, read top to bottom.
	 *  - `feed`  — dense ticker rows with a tone bar and a right-aligned age.
	 *              For a live stream in a narrow column. */
	export type TimelineVariant = 'rail' | 'feed';

	import Icon from '../../icons/Icon.svelte';
	import type { IconName } from '../../icons/Icon.svelte';

	export interface TimelineEvent {
		id?: string;
		/** Timestamp or age — the small dim text (above the title on `rail`,
		 *  right-aligned on `feed`). */
		when: string;
		/** The headline. With `subject` set this is the words BEFORE it.
		 *  IGNORED by `feed`, where the icon is the verb. */
		title: string;
		/** The thing acted on — the bright element of a `feed` row. */
		subject?: string;
		/** Words after the subject. `rail` only. */
		trail?: string;
		/** Second line — the "so what". On `feed` it is a fallback, rendered only
		 *  when neither `transition` nor `qualifiers` is set. */
		desc?: string;
		/** Dim trailing tokens after the subject. Tokens, never a sentence. */
		qualifiers?: string[];
		/** Occurrence multiplier for a collapsed streak. Rendered `×N` when > 1. */
		count?: number;
		/** Trailing emphasis glyph — a "medal" on an exceptional row. */
		accent?: IconName;
		/** A state change. `to` is the loudest thing on the row: a state change
		 *  means what it moved TO. */
		transition?: {
			from: string;
			to: string;
			/** Meaning of the DESTINATION. Overrides `tone` for the rail, the icon
			 *  and the `to` chip. */
			tone?: TimelineTone;
		};
		/** The verb, as a glyph. Never spell out what the icon already says. */
		icon?: IconName;
		/** Where the row goes for the full story. Makes it a link. */
		href?: string;
		/** Significant: a glowing dot on `rail`, a lit rail on `feed`. */
		major?: boolean;
		tone?: TimelineTone;
	}

	interface TimelineProps {
		events: TimelineEvent[];
		variant?: TimelineVariant;
	}

	let { events, variant = 'rail' }: TimelineProps = $props();

	const TONE_COLOR: Record<TimelineTone, string> = {
		ok: '#34d399',
		warn: '#fbbf24',
		bad: '#fb7185',
		info: '#60a5fa'
	};
	const NEUTRAL = 'rgba(95,234,213,0.9)';
	// A transition's destination outranks the row's own tone — a rejection is not
	// "info" just because vendor bookkeeping usually is.
	const toneOf = (e: TimelineEvent) => e.transition?.tone ?? e.tone;
	const toneColor = (e: TimelineEvent) => {
		const t = toneOf(e);
		return t ? TONE_COLOR[t] : NEUTRAL;
	};
	// Hostile subjects (a package or domain that attacked us) wear the tone;
	// friendly ones (our vendor, our agent) stay bright neutral. Two allegiances,
	// no extra field.
	const subjectColor = (e: TimelineEvent) => {
		const t = toneOf(e);
		return t === 'bad' || t === 'warn' ? TONE_COLOR[t] : 'var(--fg)';
	};
	const keyOf = (e: TimelineEvent) => e.id ?? e.when + e.title + (e.subject ?? '');

	// Middle-ellipsis, not tail: npm scopes and Go module hosts are shared
	// prefixes, so tail-truncating renders @babel/plugin-transform-runtime and
	// @babel/plugin-transform-classes as the same string.
	const MAX_SUBJECT = 32;
	function midTruncate(s: string, max = MAX_SUBJECT): string {
		if (s.length <= max) return s;
		const head = Math.ceil((max - 1) * 0.6);
		return s.slice(0, head) + '…' + s.slice(s.length - (max - 1 - head));
	}

	// A streak count is a magnitude, not a figure to read off: "×45434" is six
	// characters of precision nobody wants in a 240px column.
	function compactCount(n: number): string {
		if (n < 1000) return String(n);
		if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'k';
		return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
	}
</script>

{#if variant === 'feed'}
	<!-- Feed: two lines per event on a tone rail — ⟨verb glyph⟩ TARGET on top, the
	     detail (a state change, or qualifier tokens) under it, with the streak and
	     age pinned right across both.
	     The verb is NEVER spelled: the glyph is the verb, and it leads every row so
	     it forms one column the eye runs down without reading.
	     EVERY ROW IS THE SAME HEIGHT — a ragged feed can't be scanned — so the row
	     is sized for two lines and a row with nothing to say on the second simply
	     centres the first. The detail owns its own line because sharing one with
	     the target meant whichever was `shrink-0` starved the other: agent names
	     were being squeezed to "v…" and "su" by their own qualifiers. -->
	<ul class="flex flex-col gap-1 m-0 p-0 list-none">
		{#each events as event (keyOf(event))}
			<!-- The rail carries severity as hue AND as brightness: a `major` row lights
			     up, so a block reads as louder than routine bookkeeping without
			     anyone reading a word. -->
			<li
				class="flex items-center gap-2 h-[42px] pl-2.5 pr-1 rounded-r border-l-2"
				style:border-color={event.major
					? toneColor(event)
					: `color-mix(in srgb, ${toneColor(event)} 50%, transparent)`}
			>
				<svelte:element
					this={event.href ? 'a' : 'div'}
					href={event.href}
					class="flex-1 min-w-0 flex flex-col justify-center gap-0.5 font-[var(--mono)] no-underline
					       {event.href ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}"
				>
					<!-- Line 1: the verb glyph and what it happened to. -->
					<span class="flex items-center gap-1.5 min-w-0">
						{#if event.icon}
							<span class="shrink-0 flex" style:color={toneColor(event)}>
								<Icon name={event.icon} size={13} />
							</span>
						{/if}
						<span
							class="flex-1 min-w-0 truncate text-[0.74rem] font-semibold leading-tight"
							style:color={event.subject ? subjectColor(event) : 'var(--fg-muted)'}
							title={event.subject ?? event.title}
							>{midTruncate(event.subject ?? event.title)}</span
						>
						{#if event.accent}
							<span class="shrink-0 flex" style:color={toneColor(event)}>
								<Icon name={event.accent} size={10} />
							</span>
						{/if}
					</span>

					<!-- Line 2: the "so what", indented to sit under the target rather than
					     under the glyph column. -->
					{#if event.transition}
						<span class="flex items-center gap-1 pl-[19px] min-w-0">
							<!-- Where it came from recedes: it's context. -->
							<span class="shrink truncate text-[0.6rem] font-normal text-[var(--fg-muted)]"
								>{event.transition.from}</span
							>
							<span class="shrink-0 flex text-[var(--fg-dim)]"
								><Icon name="arrow-right" size={10} /></span
							>
							<!-- Where it LANDED is the payload — boldest, coloured by what it
							     means, and it never truncates. -->
							<span
								class="shrink-0 text-[0.68rem] font-bold tracking-wide"
								style:color={toneColor(event)}>{event.transition.to}</span
							>
						</span>
					{:else if event.qualifiers?.length}
						<span
							class="pl-[19px] text-[0.6rem] tracking-wide uppercase text-[var(--fg-muted)] truncate"
							title={event.qualifiers.join(' · ')}>{event.qualifiers.join(' · ')}</span
						>
					{:else if event.desc}
						<span
							class="pl-[19px] text-[0.6rem] text-[var(--fg-muted)] truncate"
							title={event.desc}>{event.desc}</span
						>
					{/if}
				</svelte:element>

				{#if (event.count ?? 0) > 1}
					<span
						class="shrink-0 font-[var(--mono)] text-[0.6rem] tabular-nums opacity-75"
						style:color={toneColor(event)}
						title="{event.count} occurrences">×{compactCount(event.count!)}</span
					>
				{/if}
				<span class="shrink-0 font-[var(--mono)] text-[0.6rem] text-[var(--fg-muted)] tabular-nums"
					>{event.when}</span
				>
			</li>
		{/each}
	</ul>
{:else}
	<div class="flex flex-col">
		{#each events as event, i (keyOf(event))}
			<div class="flex gap-[14px] relative">
				<!-- Rail: dot + connector line -->
				<div class="flex flex-col items-center shrink-0 w-[9px]">
					<span
						class="w-[9px] h-[9px] rounded-full bg-transparent shrink-0 mt-[3px] border transition-shadow duration-[150ms] ease-in-out"
						style:border-color={event.tone ? toneColor(event) : 'rgba(95,234,213,0.5)'}
						style:background={event.major || event.tone ? toneColor(event) : 'transparent'}
						style:box-shadow={event.major ? `0 0 8px ${toneColor(event)}` : 'none'}
					></span>
					{#if i < events.length - 1}
						<span
							class="flex-1 w-px bg-[linear-gradient(180deg,rgba(95,234,213,0.4),rgba(95,234,213,0.1))] mt-[4px]"
						></span>
					{/if}
				</div>
				<!-- Content -->
				<div class="flex flex-col gap-[2px] pb-[16px] min-w-0">
					<span class="font-[var(--mono)] text-[10px] text-[var(--fg-dim)]">{event.when}</span>
					<span
						class="font-[var(--sans-brand)] text-[14px] text-[var(--fg)] leading-[1.2]"
					>
						{event.title}{#if event.subject}&nbsp;<b
								class="font-semibold"
								style:color={toneColor(event)}>{event.subject}</b
							>{#if event.trail}&nbsp;{event.trail}{/if}{/if}
					</span>
					{#if event.desc}
						<span class="font-[var(--mono)] text-[10px] text-[var(--fg-dim)]">{event.desc}</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
