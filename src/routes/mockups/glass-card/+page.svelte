<script lang="ts">
	// Glass card — the first surface themed for the `glass` treatment.
	//
	// One card, deliberately. The subject is the SURFACE, so anything else on
	// the page is only competing evidence. Note there is no card CSS below:
	// this is the library's own `Card`, and the glass comes from the theme
	// tokens it now reads. If it were styled here it would prove nothing.
	//
	// The page div exists because glass needs something to refract.
	// `--glass-aurora` is the other half of the recipe — a card floated on flat
	// charcoal does not read as glass, it reads as a grey slab.
	import Card from '$lib/primitives/cards/Card.svelte';
	import type { CompositeCardItem } from '$lib/primitives/cards/card.types.js';

	// ── API stub ────────────────────────────────────────────────────────────
	// GET /api/v1/vendors/:id → Vendor
	interface Vendor {
		name: string;
		domain: string;
		tier: string;
		open_findings: number;
		last_assessed_days: number;
	}

	const vendor: Vendor = {
		name: 'Northwind Analytics',
		domain: 'northwind-analytics.io',
		tier: 'Tier 1 · Critical',
		open_findings: 7,
		last_assessed_days: 214
	};

	const items: CompositeCardItem[] = [
		{ label: 'Open findings', headline: String(vendor.open_findings), variant: 'amber' },
		{ label: 'Last assessed', headline: `${vendor.last_assessed_days}d` },
		{ label: 'Tier', headline: vendor.tier }
	];
</script>

<div class="page">
	<div class="stage">
		<Card
			type="composite"
			variant="accent"
			eyebrow="Vendor"
			title={vendor.name}
			description={vendor.domain}
			body="Assessment overdue. This vendor holds production data access and has not been re-scoped since the last contract renewal."
			{items}
		/>
	</div>
</div>

<style>
	/* The mesh rides the scrolling container, not the body, and is `local` so it
	   travels with the content — cards drift across the tint rather than sitting
	   on a fixed wash. That drift is the movement you notice without being able
	   to name it.
	   vh, not %: the layout's <main> is `min-h-screen` with an auto height, so a
	   percentage would resolve against the card and cut the mesh off mid-page. */
	.page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 4rem 2rem;
		background-image: var(--glass-ground);
		background-attachment: local;
	}
	.stage {
		width: min(46rem, 100%);
	}
</style>
