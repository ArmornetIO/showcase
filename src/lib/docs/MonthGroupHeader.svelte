<script lang="ts">
	// MONTH GROUP HEADER — the rule that separates one month of an archive from the
	// next.
	//
	// A heading, not a chip: it labels a region of the list rather than an item in
	// it, and the rule carrying to the full width is what makes that readable
	// without a box around the group.
	interface Props {
		/** Display label, e.g. "June 2026". */
		label: string;
		/** Item count, shown at the far end when supplied. */
		count?: number;
	}

	let { label, count }: Props = $props();
</script>

<h3 class="month">
	<span class="month-label">{label}</span>
	{#if count !== undefined}
		<span class="month-count">{count}</span>
	{/if}
</h3>

<style>
	/* The rule is a flex child that eats the remaining space, rather than a
	   border-bottom on the heading — a border would run under the text's descenders
	   at this size. */
	.month {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 2.5rem 0 1rem;
		font-family: var(--mono);
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.month::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.month-count {
		order: 1;
		font-variant-numeric: tabular-nums;
		color: var(--fg-dim);
	}
</style>
