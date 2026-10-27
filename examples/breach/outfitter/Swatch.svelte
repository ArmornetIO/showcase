<script lang="ts">
	// ── The paint chip ───────────────────────────────────────────────────────
	// Colour is picked from THIS GAME'S palette, never from the operating
	// system's wheel. `<input type="color">` was one line and wrong twice over:
	// it opens a native dialog that belongs to a different application than the
	// one you are looking at, and it offers sixteen million colours to a figure
	// that has to read as a silhouette at 24px across a board. A closed set of
	// hues IS the art direction — the wardrobe already works this way, and the
	// hues here are the library's own `--palette-*` tokens.
	//
	// Resolved from the tokens at pick time rather than copied into a list of
	// literals: the palette is theme-dependent (violet is `#C4B5FD` on black and
	// `#7C3AED` on paper) and a second copy of it here is the drift that costs a
	// week to find.
	interface Props {
		/** The colour worn now — the chip's own face. */
		value: string;
		/** What is being painted. Also the accessible name of the button. */
		label: string;
		/** Open upward. For the rows at the bottom of the paint panel, where a pad
		 *  that drops is a pad off the end of the panel. Default is downward,
		 *  because a pad that rises covers the item it is recolouring. */
		up?: boolean;
		onpick: (hex: string) => void;
	}

	let { value, label, up = false, onpick }: Props = $props();

	/** Warm to cool, then the neutrals, so the grid scans as a spectrum instead
	 *  of as the alphabetical order the token file happens to be in. */
	const HUES = [
		'rose',
		'red',
		'orange',
		'gold',
		'amber',
		'yellow',
		'green',
		'emerald',
		'teal',
		'cyan',
		'blue',
		'sky',
		'indigo',
		'violet',
		'purple',
		'fuchsia',
		'slate',
		'zinc'
	];

	let open = $state(false);

	function pick(el: HTMLElement) {
		// The computed value, not the token: the tint travels into the renderer's
		// facet shading, which mixes and darkens it as a number. A `var()` there
		// is not a colour.
		const hex = getComputedStyle(el).backgroundColor || value;
		onpick(toHex(hex));
		open = false;
	}

	/** `rgb(r, g, b)` → `#rrggbb`. The renderer parses hex; nothing upstream of
	 *  it has ever been handed anything else. */
	function toHex(color: string): string {
		const m = color.match(/(\d+)\D+(\d+)\D+(\d+)/);
		if (!m) return color;
		return `#${m
			.slice(1, 4)
			.map((n) => Number(n).toString(16).padStart(2, '0'))
			.join('')}`;
	}
</script>

<!-- Focus leaving the whole control closes it. The light dismiss a menu needs,
     without a document listener that outlives the component. -->
<span class="swatch" onfocusout={(e) => (open &&= e.currentTarget.contains(e.relatedTarget as Node))}>
	<button
		type="button"
		class="chip"
		style:background={value}
		aria-label="{label} colour"
		aria-expanded={open}
		onclick={() => (open = !open)}
	></button>

	{#if open}
		<div class="pad" class:up role="listbox" aria-label="{label} colour">
			{#each HUES as hue (hue)}
				{#each ['', '-l'] as step (step)}
					<button
						type="button"
						class="hue"
						style:background="var(--palette-{hue}{step})"
						title="{hue}{step ? ' light' : ''}"
						onclick={(e) => pick(e.currentTarget)}
					></button>
				{/each}
			{/each}
		</div>
	{/if}
</span>

<style>
	.swatch {
		position: relative;
		display: inline-flex;
		flex: none;
	}

	.chip {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 3px;
		cursor: pointer;
	}
	.chip:hover,
	.chip[aria-expanded='true'] {
		border-color: var(--trim, var(--fg));
	}

	.pad {
		position: absolute;
		z-index: 20;
		top: calc(100% + 6px);
		left: -4px;
		display: grid;
		grid-template-columns: repeat(9, 16px);
		gap: 3px;
		padding: 6px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-elev, #0b0f16);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.55);
	}
	/* Rows at the bottom of a panel open the other way — see `up`. */
	.pad.up {
		top: auto;
		bottom: calc(100% + 6px);
	}
	.hue {
		width: 16px;
		height: 16px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 3px;
		cursor: pointer;
	}
	.hue:hover,
	.hue:focus-visible {
		border-color: var(--fg);
		outline: none;
	}
</style>
