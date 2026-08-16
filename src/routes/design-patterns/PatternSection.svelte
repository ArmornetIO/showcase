<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Anchor slug for the section heading. */
		id: string;
		name: string;
		/** One line: what this family of patterns governs. */
		blurb: string;
		children: Snippet;
	}

	let { id, name, blurb, children }: Props = $props();
</script>

<section class="section" {id}>
	<header class="section-head">
		<h2 class="section-name">{name}</h2>
		<p class="section-blurb">{blurb}</p>
	</header>
	{@render children()}
</section>

<style>
	.section {
		margin-bottom: 2.5rem;
		scroll-margin-top: 1.5rem;
	}

	.section-head {
		padding-bottom: 0.35rem;
	}

	.section-name {
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 0.4rem;
	}

	.section-blurb {
		font-size: 0.83rem;
		color: var(--fg-muted);
		line-height: 1.6;
		margin: 0;
		max-width: 74ch;
	}
</style>
