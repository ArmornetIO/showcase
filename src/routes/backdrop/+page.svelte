<script lang="ts">
	import HorizonBackdrop from '$lib/backdrop/HorizonBackdrop.svelte';
	import MobiusWeave from '$lib/backdrop/MobiusWeave.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import { PRESET_IDS, resolvePreset, type PresetId } from '$lib/backdrop/presets.js';

	// ── Backdrop — the animated ground behind a page ──────────────────────────
	//
	// Authoring happens in the background studio (`/mockups/background-studio`),
	// which edits one strip at a time. This page is the LIBRARY view: the named
	// compositions that studio produces, as a consumer sees them — by name.

	let preset = $state<PresetId>('mr robot');

	// The weave renderer takes the strips alone — the palette half of a preset is
	// a set of CSS tokens the SVG path scopes to its own wrapper, and canvas has
	// no cascade to read them from. Its colours are props instead.
	const strips = $derived(resolvePreset(preset).strips);
</script>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="HorizonBackdrop">
		<h3 class="component-name">Backdrop · horizon</h3>
		<p class="component-desc">
			A static perspective floor with Möbius strips laid on it. The floor never moves — only the
			traffic over it does, because a moving surface behind a page of tables is motion peripheral
			vision cannot ignore. Each strip is a belt: its rim carries a travelling dash and its slats
			pulse in a wave down the band, while the strip itself holds still.
		</p>

		<div class="flex flex-wrap gap-1 mb-3">
			{#each PRESET_IDS as id (id)}
				<button
					class="px-2 py-1 rounded-[5px] border font-mono text-[0.6rem] uppercase tracking-wide
					       {preset === id
						? 'text-[var(--accent)] border-[var(--border-accent)] bg-[var(--accent-faint)]'
						: 'text-[var(--fg-dim)] border-[var(--border)] hover:text-[var(--fg)]'}"
					onclick={() => (preset = id)}
				>
					{id}
				</button>
			{/each}
		</div>

		<!--
			A preset carries its own palette, and the component scopes those tokens
			to its own wrapper rather than `:root` — so this demo box can sit on a
			page it does not own the colours of, and two of these side by side stay
			independent.
		-->
		<div class="demo-stage">
			<HorizonBackdrop {preset} />
		</div>

		<p class="component-desc mt-3">
			Compositions are authored in the
			<a class="demo-link" href="mockups/background-studio">background studio</a> and consumed here
			by name. <code class="demo-code">mr robot</code> is the cheapest — three strips, one traveller,
			no hue flow — and <code class="demo-code">spider-verse</code> the most expensive, since every
			strip is drawn twice for its misregistration ghost.
		</p>
	</ShowcaseBlock>

	<ShowcaseBlock component="MobiusWeave">
		<h3 class="component-name">Backdrop · möbius weave</h3>
		<p class="component-desc">
			The same compositions, painted on canvas instead of SVG — follow the selector above and read
			the two against each other. In SVG every pass is additive, so where a strip's far lap and near
			lap cross you get a bright junction and the band reads as a decal. Here each facet fills with
			the page ground before its edges are stroked, back to front, so near genuinely hides far and
			the strip weaves through itself. Same <code class="demo-code">StripSpec</code> data, second
			renderer.
		</p>

		<!-- `ground` is the paint the near lap occludes WITH, so it has to be the
		     colour actually behind the canvas — hence the literal on both, rather
		     than `var(--bg)` here and a guess there. Mismatch it and the occlusion
		     reads as a grey smear instead of a hole. -->
		<div class="demo-stage weave-stage">
			<MobiusWeave {strips} ground="6, 7, 11" />
		</div>
	</ShowcaseBlock>
</div>

<style>
	/* The backdrop is `position: absolute; inset: 0`, so it needs a positioned
	   box with a real height to fill — it has no intrinsic size of its own. */
	.demo-stage {
		position: relative;
		height: 420px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg);
	}
	.weave-stage {
		background: rgb(6, 7, 11);
	}
	.demo-link {
		color: var(--accent);
	}
</style>
