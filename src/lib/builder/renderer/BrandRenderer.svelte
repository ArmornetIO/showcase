<script lang="ts">
	// Marks and emblems. Pure SVG/CSS — no data, just geometry props.
	import HexShield from '../../display/feedback/HexShield.svelte';
	import ArmornetLogo from '../../icons/ArmornetLogo.svelte';
	import ArmornetCrestChrome from '../../icons/ArmornetCrestChrome.svelte';
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);
</script>

{#if componentId === 'HexShield'}
	<HexShield layers={n('layers', 4)} plates={n('plates', 19)} active={b('active', true)} />

{:else if componentId === 'ArmornetLogo'}
	<ArmornetLogo
		size={n('size', 64)}
		color={s('color', 'var(--accent)')}
		variant={e('variant', 'outline') as 'outline' | 'filled'}
		innerWall={b('innerWall', true)}
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
