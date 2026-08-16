<script lang="ts">
	// Marks and emblems. Pure SVG/CSS — no data, just geometry props.
	import HexShield from '$lib/display/feedback/HexShield.svelte';
	import ArmornetCrest from '$lib/icons/ArmornetCrest.svelte';
	import ArmornetCrestHub from '$lib/icons/ArmornetCrestHub.svelte';
	import ArmornetCrestChrome from '$lib/icons/ArmornetCrestChrome.svelte';
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);
</script>

{#if componentId === 'HexShield'}
	<HexShield layers={n('layers', 4)} plates={n('plates', 19)} active={b('active', true)} />

{:else if componentId === 'ArmornetCrest'}
	<ArmornetCrest
		size={n('size', 96)}
		color={s('color', 'var(--accent)')}
		glow={b('glow', true)}
		mesh={b('mesh', true)}
	/>

{:else if componentId === 'ArmornetCrestHub'}
	<ArmornetCrestHub
		size={n('size', 96)}
		look={e('look', 'hollow') as 'hollow' | 'weight' | 'plated'}
		spokes={e('spokes', 'full') as 'full' | 'stem' | 'bar'}
		tethers={b('tethers', true)}
		glow={b('glow', true)}
	/>

{:else if componentId === 'ArmornetCrestChrome'}
	<ArmornetCrestChrome
		size={n('size', 192)}
		glow={b('glow', true)}
		bloom={n('bloom', 1)}
		traces={b('traces', true)}
		rim={b('rim', true)}
		emboss={b('emboss', true)}
		tethers={b('tethers', false)}
		breakout={n('breakout', 0)}
	/>
{/if}
