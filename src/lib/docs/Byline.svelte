<script module lang="ts">
	export interface BylineAuthor {
		name: string;
		handle?: string;
		role?: string;
	}
</script>

<script lang="ts">
	// BYLINE — who is making the argument, inline.
	//
	// Not ProfileCard and not UserBlock: both are stacked blocks that own their own
	// vertical rhythm, and this sits in a meta row beside a date and a read time. A
	// card there would break the line it is part of.
	//
	// The role is divided by a rule rather than a bullet or a comma, because name
	// and role are different KINDS of fact — one identifies, one qualifies — and a
	// comma reads as a list of two names.
	import Avatar from '../display/entity/Avatar.svelte';

	interface Props {
		author: BylineAuthor;
		/** Avatar diameter. Default 24 — sized to sit in a text line, not above one. */
		size?: number;
		/** Hide the role even when the author has one, for a dense listing row. */
		compact?: boolean;
	}

	let { author, size = 24, compact = false }: Props = $props();

	// Two letters, from the first and last word — "A. Person" gives AP, "Person"
	// gives P. Never more than two: three is unreadable at 24px.
	const initials = $derived(
		author.name
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w[0])
			.filter((c, i, all) => i === 0 || i === all.length - 1)
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

<span class="byline">
	<Avatar {initials} {size} shape="round" />
	<span class="by-name">{author.name}</span>
	{#if author.role && !compact}
		<span class="by-role">{author.role}</span>
	{/if}
</span>

<style>
	.byline {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.by-name {
		font-size: 0.82rem;
		color: var(--fg);
		white-space: nowrap;
	}
	.by-role {
		padding-left: 0.5rem;
		border-left: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
