<script lang="ts">
	// Inline number that rolls random digits while its enclosing region is a
	// pre-load Frame, then snaps to the real value once data lands. Use it for
	// numbers embedded in sentences or stat rows where a shimmer bar would be
	// heavier than the number deserves.
	//
	// The rolling box is FIXED WIDTH (sized to the real value's digit count, with
	// tabular figures) so the digits never reflow the surrounding content.
	import { getFrameState } from './context.js';

	interface Props {
		value: number | string;
	}

	let { value }: Props = $props();

	// Width = how many digits the real value has, min 2. Locks the box so a 1→2→3
	// digit roll can't nudge neighbouring text.
	const digits = $derived(Math.max(2, String(value).replace(/[^0-9]/g, '').length || 2));
	const rollMax = $derived(Math.pow(10, digits));

	const framed = getFrameState();
	let roll = $state(0);
	$effect(() => {
		if (!framed()) return;
		const id = setInterval(() => {
			roll = Math.floor(Math.random() * rollMax);
		}, 80);
		return () => clearInterval(id);
	});
</script>{#if framed()}<span class="frame-number" style:width="{digits}ch">{roll}</span>{:else}{value}{/if}

<style>
	.frame-number {
		display: inline-block;
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--accent);
	}
</style>
