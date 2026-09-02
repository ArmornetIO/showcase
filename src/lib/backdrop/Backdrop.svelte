<script lang="ts">
	// The one component that knows which backdrop id needs which renderer, and
	// how to put several of them on top of each other.
	//
	// Callers — the app shell, the builder, the studio — pass an id and get the
	// right art. Without this every one of them would carry the same
	// `{#if}` ladder, and adding a sixth family would mean editing all of them.
	//
	// STACKING. `id` accepts a comma-joined list as well as a single id (see
	// `parseStack`), so every existing call site keeps working and a stack is
	// just a longer value. Two things make layers actually compose rather than
	// occlude each other:
	//
	//   · Every layer above the bottom one has `--backdrop-ground: transparent`
	//     forced on it. Each family paints an opaque plate as its background —
	//     correct on its own, fatal in a stack, because the top plate would
	//     cover everything beneath it.
	//   · Those layers get a blend mode, `screen` by default, so what survives
	//     is what each layer ADDS. These are dark plates with faint marks; over
	//     normal blending a stack looks identical to its top member.
	//
	// `none` — or anything unrecognised — renders NOTHING, not a transparent
	// layer. A backdrop left mounted at zero opacity still composites its
	// filters every frame, which is exactly what someone choosing "None" is
	// asking not to happen.

	import HorizonBackdrop from './HorizonBackdrop.svelte';
	import type { StripSpec } from './strips.js';
	import {
		DEFAULT_BLEND,
		FAMILIES,
		isFamily,
		isMobius,
		parseStack,
		type BackdropId,
		type BlendMode
	} from './backdrops.js';

	interface Props {
		/** One id, a comma-joined stack, or the ids as an array. */
		id?: BackdropId | readonly BackdropId[] | string;
		/** 0–1, applied as `--backdrop-strength` on the layer. */
		strength?: number;
		/** How layers above the bottom one composite. Ignored for a single id. */
		blend?: BlendMode;
		/**
		 * Per-family prop overrides, keyed by family id — the studio's knobs.
		 * A family with no entry renders on its own defaults.
		 */
		params?: Partial<Record<string, Record<string, number>>>;
		/**
		 * Per-family custom-property declarations, keyed by family id, applied to
		 * that layer alone.
		 *
		 * Scoped per layer rather than set on a shared ancestor because the one
		 * token every family DOES share — `--backdrop-ground` — has to differ per
		 * layer: the bottom one paints the plate and the rest are forced
		 * transparent. Everything else is prefixed per family in `tokens.css`.
		 */
		styles?: Partial<Record<string, string>>;
		/** An authored composition, applied to the first Möbius layer only. */
		strips?: StripSpec[];
		rainbow?: boolean;
		rainbowSpeed?: number;
		/** Studio affordances, forwarded to the composed Möbius layer. */
		labels?: boolean;
		selected?: string | null;
		onselect?: (id: string) => void;
	}
	let {
		id = 'none',
		strength = 1,
		blend = DEFAULT_BLEND,
		params,
		styles,
		strips,
		rainbow = false,
		rainbowSpeed = 18,
		labels = false,
		selected = null,
		onselect
	}: Props = $props();

	const stack = $derived(parseStack(id));

	/**
	 * Which layer an authored composition belongs to.
	 *
	 * The studio edits ONE strip array, so a stack holding two Möbius entries
	 * has one composition and one preset rather than two compositions. The
	 * first one wins; the rest resolve their own preset by name.
	 */
	const composed = $derived(stack.findIndex(isMobius));
</script>

{#if stack.length}
	<!-- One isolated root for the whole stack. `mix-blend-mode` composites
	     against the nearest stacking context, so without this the layers would
	     blend with whatever the PAGE had painted behind the backdrop rather
	     than with each other. -->
	<div class="backdrop-stack">
		{#each stack as layer, i (layer)}
			<div
				class="backdrop-host"
				style:--backdrop-strength={strength}
				style:--backdrop-ground={i > 0 ? 'transparent' : undefined}
				style:mix-blend-mode={i > 0 ? blend : undefined}
				style={styles?.[layer]}
			>
				{#if isFamily(layer)}
					{@const Family = FAMILIES[layer]}
					<Family {...params?.[layer] ?? {}} />
				{:else if isMobius(layer)}
					<HorizonBackdrop
						preset={layer}
						strips={i === composed ? strips : undefined}
						labels={i === composed && labels}
						selected={i === composed ? selected : null}
						{onselect}
						{rainbow}
						--rainbow-speed="{rainbowSpeed}s"
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.backdrop-stack {
		position: absolute;
		inset: 0;
		pointer-events: none;
		isolation: isolate;
	}

	/* Exists only to scope `--backdrop-strength` to the art. Setting it on a
	   shared ancestor would leak the value to anything else reading the token.
	   `isolation` keeps each family's own internal blend modes — Ash Drift's
	   overlay grain, Drift Strata's screened slabs — resolving inside their own
	   layer instead of against the layer below. */
	.backdrop-host {
		position: absolute;
		inset: 0;
		pointer-events: none;
		isolation: isolate;
	}
</style>
