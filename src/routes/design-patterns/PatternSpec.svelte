<script lang="ts">
	import type { Snippet } from 'svelte';
	import CodeBlock from '$lib/display/code/CodeBlock.svelte';

	interface Props {
		/** Anchor slug — also the TOC target. */
		id: string;
		/** Display number, e.g. "01". */
		index: string;
		name: string;
		/** One line: what the pattern is for. */
		intent: string;
		/** Prose: why this is the rule here, not just anywhere. */
		why?: Snippet;
		/** The checkable rules a reviewer can hold a diff against. */
		rules?: string[];
		/** Live render of the correct form. */
		correct: Snippet;
		correctCode: string;
		/** Live render of the wrong form. */
		incorrect: Snippet;
		incorrectCode: string;
		/** Why the wrong form is tempting / what it actually costs. */
		trap?: string;
	}

	let {
		id,
		index,
		name,
		intent,
		why,
		rules = [],
		correct,
		correctCode,
		incorrect,
		incorrectCode,
		trap
	}: Props = $props();
</script>

<section class="pattern" {id}>
	<header class="pattern-head">
		<span class="pattern-index">{index}</span>
		<div>
			<h2 class="pattern-name">{name}</h2>
			<p class="pattern-intent">{intent}</p>
		</div>
	</header>

	{#if why}
		<div class="pattern-why">{@render why()}</div>
	{/if}

	{#if rules.length}
		<ul class="pattern-rules">
			{#each rules as rule}
				<li>{rule}</li>
			{/each}
		</ul>
	{/if}

	<div class="pattern-grid">
		<div class="side side-correct">
			<div class="side-head">
				<span class="mark mark-correct">✓</span>
				<span class="side-label">Do this</span>
			</div>
			<div class="demo demo-correct">{@render correct()}</div>
			<div class="code code-correct">
				<CodeBlock title="correct" code={correctCode} maxHeight="30rem" />
			</div>
		</div>

		<div class="side side-incorrect">
			<div class="side-head">
				<span class="mark mark-incorrect">✕</span>
				<span class="side-label">Not this</span>
			</div>
			<div class="demo demo-incorrect">{@render incorrect()}</div>
			<div class="code code-incorrect">
				<CodeBlock title="incorrect" code={incorrectCode} maxHeight="30rem" />
			</div>
		</div>
	</div>

	{#if trap}
		<p class="pattern-trap"><span>Why it happens anyway —</span> {trap}</p>
	{/if}
</section>

<style>
	.pattern {
		border-top: 1px solid var(--border);
		padding: 2.25rem 0 2.5rem;
		scroll-margin-top: 1.5rem;
	}

	.pattern-head {
		display: flex;
		gap: 0.9rem;
		align-items: baseline;
		margin-bottom: 0.85rem;
	}

	.pattern-index {
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.08em;
		padding-top: 0.15rem;
	}

	.pattern-name {
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--fg);
		margin: 0 0 0.3rem;
		letter-spacing: -0.01em;
	}

	.pattern-intent {
		font-size: 0.85rem;
		color: var(--fg-muted);
		margin: 0;
		line-height: 1.6;
		max-width: 68ch;
	}

	.pattern-why {
		font-size: 0.83rem;
		color: var(--fg-dim);
		line-height: 1.7;
		max-width: 74ch;
		margin: 0 0 1rem;
	}

	.pattern-rules {
		list-style: none;
		margin: 0 0 1.4rem;
		padding: 0.75rem 0.9rem;
		border-left: 2px solid var(--border-accent);
		background: var(--surface-raised);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.pattern-rules li {
		font-size: 0.79rem;
		color: var(--fg-muted);
		line-height: 1.55;
		font-family: var(--mono);
	}
	.pattern-rules li::before {
		content: '— ';
		color: var(--accent);
	}

	.pattern-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.pattern-grid {
			grid-template-columns: 1fr;
		}
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
	}

	.side-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 700;
	}
	.mark-correct {
		color: var(--palette-emerald);
		background: rgba(52, 211, 153, 0.12);
	}
	.mark-incorrect {
		color: var(--palette-red);
		background: rgba(252, 165, 165, 0.12);
	}

	.side-label {
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.demo {
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-elev);
		padding: 1.25rem;
		min-height: 88px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow-x: auto;
	}
	.demo-correct {
		border-color: rgba(52, 211, 153, 0.22);
	}
	.demo-incorrect {
		border-color: rgba(252, 165, 165, 0.22);
	}

	/* CodeBlock owns its own chrome; the verdict tint is the one thing this page
	   adds, so it recolours the border rather than restyling the block. */
	.code-correct :global(.code-block) {
		border-color: rgba(52, 211, 153, 0.28);
	}
	.code-incorrect :global(.code-block) {
		border-color: rgba(252, 165, 165, 0.28);
	}

	.pattern-trap {
		margin: 1.1rem 0 0;
		font-size: 0.79rem;
		color: var(--fg-dim);
		line-height: 1.65;
		max-width: 74ch;
	}
	.pattern-trap span {
		font-family: var(--mono);
		color: var(--fg-muted);
	}
</style>
