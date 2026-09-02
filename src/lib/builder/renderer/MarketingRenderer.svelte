<script lang="ts">
	// Full-bleed marketing sections. These size themselves off the viewport, so
	// on the canvas they read as a band rather than a card.
	import PageHero from '$lib/primitives/cards/PageHero.svelte';
	import ClosingCTA from '$lib/primitives/cards/ClosingCTA.svelte';
	import FaqAccordion from '$lib/display/content/FaqAccordion.svelte';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b } = accessors(() => props);

	const faqItems = $derived(
		parseJson<{ q: string; a: string }[]>(props.items, [
			{ q: 'What is SOC 2?', a: 'SOC 2 is a security framework developed by the AICPA.' },
			{
				q: 'How long does certification take?',
				a: 'Typically 3-6 months depending on your readiness posture.'
			}
		])
	);
</script>

{#if componentId === 'PageHero'}
	<PageHero
		kicker={s('kicker', 'PLATFORM')}
		headline={s('headline', 'Defend Your Stack')}
		lede={s('lede', 'Automate your compliance program end-to-end.')}
		overlay={b('overlay', true)}
	/>

{:else if componentId === 'ClosingCTA'}
	<ClosingCTA
		kicker={s('kicker', 'GET STARTED')}
		headline={s('headline', 'Ready to ship compliance?')}
		lede={s('lede', 'Book a 30-minute intro call with our team.')}
		primaryLabel={s('primaryLabel', 'Book a demo')}
		primaryHref={s('primaryHref', '/demo')}
		secondaryLabel={s('secondaryLabel', 'View pricing')}
		secondaryHref={s('secondaryHref', '/pricing')}
		overlay={b('overlay', true)}
	/>

{:else if componentId === 'FaqAccordion'}
	<FaqAccordion items={faqItems} />
{/if}
