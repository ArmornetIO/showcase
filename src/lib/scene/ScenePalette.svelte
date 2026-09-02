<script lang="ts">
	// ── ScenePalette — the shared component palette, plus the scene's own copy ──
	// You see the thing, you drag the thing. No hover step: a palette you have to
	// interrogate one row at a time is a list with extra work, and browsing is the
	// whole job here.
	//
	// Supersedes `builder-enhancements.md` §3.4 ("hover to see a tooltip popover"),
	// which is the weaker shape — it hides the answer behind an interaction.
	//
	// The grid itself is `builder/ComponentPalette.svelte`, shared with the
	// builder toolbox; what stays here is the scene-specific footer about
	// animatable channels.
	import ComponentPalette from '../builder/ComponentPalette.svelte';
	import { componentChannelStats } from './component-channels.js';

	let { onAdd }: { onAdd?: (componentId: string) => void } = $props();

	const channelCount = componentChannelStats().channels;
</script>

<ComponentPalette {onAdd} placeholder="search…" />

<div class="cap">
	Drag a card onto the canvas to place it there. Double-click drops it centre.
	<br />
	Every one of these has <b>{channelCount}</b> animatable props derived from
	<code>registry.ts</code> — select it and press <b>A</b>.
</div>

<style>
	.cap {
		font-size: 0.56rem;
		line-height: 1.45;
		color: var(--fg-dim);
		margin: 0.5rem 0;
	}
	.cap code,
	.cap b {
		font-family: var(--mono);
		color: var(--fg);
		font-weight: 500;
	}
</style>
