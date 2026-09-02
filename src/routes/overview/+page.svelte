<script lang="ts">
	import Button from '$lib/primitives/actions/Button.svelte';
	import LayoutHeader from '$lib/primitives/chrome/LayoutHeader.svelte';
	import { base } from '$app/paths';
	import { componentIndex } from '$lib/dev/component-index.js';

	const sections = componentIndex();

	// A card is a signpost, not a manifest — /display alone imports 20+.
	const SHOWN = 8;

	function summary(components: string[]): string {
		const rest = components.length - SHOWN;
		return rest > 0
			? `${components.slice(0, SHOWN).join(', ')} +${rest} more`
			: components.join(', ');
	}
</script>

<svelte:head>
	<title>Armornet UI — Component Library</title>
</svelte:head>

<LayoutHeader eyebrow="// showcase · demo">
	{#snippet title()}Armornet <span class="accent">components.</span>{/snippet}
	{#snippet lede()}
		Every component in every configuration. Use the theme picker in the sidebar to verify tokens
		across every theme.
	{/snippet}
	{#snippet actions()}
		<Button variant="primary" size="sm" href="{base}/design-patterns">Design patterns</Button>
		<Button variant="ghost" size="sm" href="{base}/primitives">Browse components</Button>
		<Button variant="ghost" size="sm" href="{base}/theme">Theme picker</Button>
	{/snippet}
</LayoutHeader>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<a href="{base}/design-patterns" class="lead-card">
		<span class="lead-eyebrow">Start here</span>
		<span class="lead-title">Design patterns</span>
		<span class="lead-desc">
			The rules this interface is built on. Each pattern carries its intent, the checkable rules, and
			the same thing built correctly and built wrong — rendered live, side by side, with the code for
			both.
		</span>
	</a>

	<p class="intro">
		{sections.length} sections, read off the routes on disk and the generated component index —
		every link here resolves. Each page shows all variants and interactive demos.
	</p>
	<div class="section-grid">
		{#each sections as s (s.slug)}
			<a href="{base}{s.href}" class="section-card">
				<span class="section-label">{s.label}</span>
				{#if s.components.length}
					<span class="section-desc">{summary(s.components)}</span>
				{:else if s.note}
					<span class="section-desc">{s.note}</span>
				{/if}
			</a>
		{/each}
	</div>
</div>

<style>
	:global(.accent) {
		color: var(--accent);
	}

	.lead-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1.35rem 1.5rem;
		margin-bottom: 1.75rem;
		border: 1px solid var(--border-accent);
		border-radius: 10px;
		background: var(--accent-faint);
		text-decoration: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.lead-card:hover {
		border-color: var(--accent);
		background: var(--accent-faint-strong);
	}

	.lead-eyebrow {
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.lead-title {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--fg);
		letter-spacing: -0.01em;
	}
	.lead-desc {
		font-size: 0.82rem;
		color: var(--fg-muted);
		line-height: 1.65;
		max-width: 76ch;
	}

	.intro {
		font-size: 0.9rem;
		color: var(--fg-muted);
		margin: 0 0 1.5rem;
		line-height: 1.6;
	}

	.section-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.section-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		text-decoration: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.section-card:hover {
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.section-label {
		font-family: var(--mono);
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.04em;
	}

	.section-desc {
		font-size: 0.78rem;
		color: var(--fg-dim);
		line-height: 1.5;
	}
</style>
