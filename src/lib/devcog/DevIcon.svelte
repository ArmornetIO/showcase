<script lang="ts">
	// Renders one glyph from `icons.ts`. Always `currentColor`, always
	// aria-hidden — every DevCog control carries its own accessible name, so
	// the glyph itself is decoration.
	import type { DevGlyph } from './icons.js';

	interface DevIconProps {
		glyph: DevGlyph;
		size?: number;
		strokeWidth?: number;
	}

	let { glyph, size = 15, strokeWidth = 2 }: DevIconProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={glyph.filled ? 'currentColor' : 'none'}
	stroke={glyph.filled ? 'none' : 'currentColor'}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each glyph.paths as d (d)}
		<path {d} />
	{/each}
</svg>
