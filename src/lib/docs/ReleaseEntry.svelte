<script lang="ts">
	// RELEASE ENTRY — one release in a changelog stream.
	//
	// Two columns: a sticky rail carrying the version and date, and the entry
	// itself. The rail sticks because a reader deep in a long release still needs to
	// know which version they are reading — the question a changelog is most often
	// opened to answer.
	//
	// The version leads, not the title. Readers look up v2.14, not "faster
	// verdicts"; the title is what the release was FOR, which is the second
	// question.
	import type { Snippet } from 'svelte';
	import Byline from './Byline.svelte';
	import type { BylineAuthor } from './Byline.svelte';
	import { fmtDate } from './docText.js';

	interface Props {
		version: string;
		/** ISO `YYYY-MM-DD`. */
		date?: string;
		title: string;
		/** Who cut the release. */
		author?: BylineAuthor;
		/** Permalink to this release. */
		href?: string;
		children: Snippet;
		/** CSS top offset for the sticky rail — match the app header height. */
		topOffset?: string;
	}

	let { version, date, title, author, href, children, topOffset = '0px' }: Props = $props();
</script>

<article class="release" style:--rel-top={topOffset}>
	<div class="rail">
		<div class="rail-inner">
			{#if href}
				<a class="version" {href}>v{version}</a>
			{:else}
				<span class="version">v{version}</span>
			{/if}
			{#if date}
				<time class="date" datetime={date}>{fmtDate(date)}</time>
			{/if}
			{#if author}
				<div class="rail-author"><Byline {author} size={20} compact /></div>
			{/if}
		</div>
	</div>

	<div class="entry">
		<h2 class="entry-title">
			{#if href}<a {href}>{title}</a>{:else}{title}{/if}
		</h2>
		{@render children()}
	</div>
</article>

<style>
	.release {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 2rem;
		padding: 2rem 0;
		border-top: 1px solid var(--border);
	}

	.rail-inner {
		position: sticky;
		top: calc(var(--rel-top) + 2rem);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.version {
		font-family: var(--mono);
		font-size: 0.95rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--accent);
		text-decoration: none;
	}

	.date {
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.rail-author {
		margin-top: 0.35rem;
	}

	.entry-title {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--fg);
	}
	.entry-title a {
		color: inherit;
		text-decoration: none;
	}
	.entry-title a:hover {
		color: var(--accent);
	}

	/* The rail stops being a rail when there is no room beside the entry; it becomes
	   a header row above it, which keeps the version first in reading order. */
	@media (max-width: 52rem) {
		.release {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.75rem;
		}
		.rail-inner {
			position: static;
			flex-direction: row;
			align-items: center;
			gap: 0.75rem;
		}
		.rail-author {
			margin-top: 0;
			margin-left: auto;
		}
	}
</style>
