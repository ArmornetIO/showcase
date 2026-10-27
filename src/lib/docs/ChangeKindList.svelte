<script module lang="ts">
	/** The closed vocabulary internal/docview enforces on a changelog's headings. */
	export type ChangeKind = 'breaking' | 'added' | 'changed' | 'fixed' | 'removed';

	export interface Change {
		kind: ChangeKind;
		text: string;
	}

	// Hue per kind, declared once. `breaking` and `removed` are deliberately
	// different: removing something announced a year ago is routine, breaking
	// something silently is not.
	export const CHANGE_HUES: Record<ChangeKind, string> = {
		breaking: 'var(--palette-rose, #fb7185)',
		added: 'var(--palette-emerald, #34d399)',
		changed: 'var(--palette-blue, #60a5fa)',
		fixed: 'var(--palette-amber, #fcd34d)',
		removed: 'var(--fg-dim)'
	};
</script>

<script lang="ts">
	// CHANGE KIND LIST — a release's bullets, each labelled by what it did.
	//
	// The kind is a chip rather than a coloured bullet because a reader scanning for
	// breaking changes is reading the WORD, not decoding a hue — and a hue alone
	// fails for anyone who cannot distinguish it.
	import Chip from '../primitives/status/Chip.svelte';
	import { ticks } from './docText.js';

	interface Props {
		changes: Change[];
	}

	let { changes }: Props = $props();
</script>

<ul class="changes" role="list">
	{#each changes as c, i (i)}
		<li class="change">
			<Chip tint={CHANGE_HUES[c.kind]} cut="tag" size="sm">{c.kind}</Chip>
			<span class="change-text">
				<!-- Runs rather than {@html}: the source is a markdown bullet, so
				     backticks are code, and rendering them as real markup means no
				     escaping decision to get wrong. -->
				{#each ticks(c.text) as run, j (j)}
					{#if run.code}<code>{run.text}</code>{:else}{run.text}{/if}
				{/each}
			</span>
		</li>
	{/each}
</ul>

<style>
	.changes {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	/* Baseline alignment, so a one-line chip and a wrapping sentence share a first
	   line rather than the chip floating at the vertical centre of the text block. */
	.change {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.change-text {
		font-size: 0.9rem;
		line-height: 1.55;
		color: var(--fg-muted);
	}

	.change-text code {
		font-family: var(--mono);
		font-size: 0.85em;
		padding: 0.05rem 0.3rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--accent-faint-strong);
		color: var(--fg);
	}
</style>
