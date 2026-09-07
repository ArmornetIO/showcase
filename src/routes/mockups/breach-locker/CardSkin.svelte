<script lang="ts">
	// ── A card, dressed ──────────────────────────────────────────────────────
	// The face is the REAL `CardFace` from the game, printed from the real
	// `Ability` and the real `fxFor` — cost, power, noise, glyph and skill
	// modifier all come out of the catalogue, not out of this file.
	//
	// Everything a player can buy sits in a layer AROUND it:
	//
	//   frame    an SVG in the card's own 136×188 box, over the face
	//   finish   a gradient and a blend mode, over that
	//   stamp    struck in the corner, over that
	//   back     a whole other face, shown when the card is turned over
	//
	// This is the point of the design and not an implementation detail. Because
	// no cosmetic is INSIDE `CardFace`, no cosmetic can move a number, hide a
	// cost or change what a card does — and a new frame ships without anybody
	// re-reading the rules. It also means the layers work on every card in the
	// game for free, including ones that do not exist yet.
	import CardFace from '$examples/breach/CardFace.svelte';
	import { fxFor } from '$examples/breach/internal/fx.js';
	import type { Ability, Faction, Skill } from '$examples/breach/internal/rules.js';
	import type { IconName } from 'showcase';
	import type { CosmeticItem } from './catalog.js';

	interface Props {
		ability: Ability;
		faction: Faction;
		/** The seat's rating in this card's skill — printed on the face. */
		skills: Record<Skill, number>;
		/** The cost gem's hue. In game this is the seat colour, which is exactly
		 *  the thing the banner replaces. */
		seatColor: string;
		frame?: CosmeticItem;
		finish?: CosmeticItem;
		stamp?: CosmeticItem;
		back?: CosmeticItem;
		emblem?: CosmeticItem;
		/** Turned over: the table's view of the card while it is still yours. */
		faceDown?: boolean;
		/** Struck, i.e. this card landed. Off in the shop, on in the preview so
		 *  the stamp has somewhere to be. */
		stamped?: boolean;
		scale?: number;
	}

	let {
		ability,
		faction,
		skills,
		seatColor,
		frame,
		finish,
		stamp,
		back,
		emblem,
		faceDown = false,
		stamped = true,
		scale = 1
	}: Props = $props();

	const fx = $derived(fxFor(ability.key, faction));
</script>

<div class="skin" style:--s={scale} style:--tone={seatColor}>
	{#if faceDown}
		<!-- The back. Composed rather than a picture: the pattern is the card-back
		     item, the tint is the banner and the mark in the middle is the emblem
		     off the flag — so a player's back is recognisably theirs without a
		     third thing to choose. -->
		<div
			class="back"
			style:background="radial-gradient(120% 80% at 50% 20%, color-mix(in srgb, {seatColor} 24%, var(--bg-elev, #0b0f16)), var(--bg-elev, #0b0f16) 68%)"
			style:border-color="color-mix(in srgb, {seatColor} 55%, transparent)"
		>
			<svg class="lay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html back?.art ?? ''}
			</svg>
			<svg class="back-mark" viewBox="0 0 24 24" width={44} height={44} aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html emblem?.art ?? ''}
			</svg>
		</div>
	{:else}
		<CardFace
			{ability}
			{fx}
			{seatColor}
			affordable={true}
			disabled={false}
			armed={false}
			raised={false}
			icon={fx.icon as IconName}
			skillMod={skills[ability.skill]}
		/>

		{#if finish?.css}
			<span
				class="finish"
				style:background={finish.css.background}
				style:mix-blend-mode={finish.css.blend ?? 'normal'}
				style:opacity={finish.css.opacity ?? 1}
			></span>
		{/if}

		{#if frame?.art}
			<svg class="lay" viewBox="0 0 136 188" aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html frame.art}
			</svg>
		{/if}

		{#if stamped && stamp?.art}
			<!-- Struck, not printed: rotated and part-off the edge, because a mark
			     that lines up with the layout reads as another field on the card. -->
			<svg class="stamp" viewBox="0 0 24 24" width={34} height={34} aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html stamp.art}
			</svg>
		{/if}
	{/if}
</div>

<style>
	.skin {
		position: relative;
		width: calc(136px * var(--s));
		height: calc(188px * var(--s));
		flex-shrink: 0;
	}
	/* The face is fixed at 136×188 by the game; scaling the wrapper rather than
	   restyling it keeps this a viewer and not a fork. */
	.skin > :global(:first-child) {
		transform: scale(var(--s));
		transform-origin: 0 0;
	}

	.lay,
	.finish {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
		border-radius: calc(12px * var(--s));
		color: var(--tone);
	}
	.finish {
		overflow: hidden;
	}

	.back {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border: 1px solid;
		border-radius: calc(12px * var(--s));
		overflow: hidden;
		color: var(--tone);
		box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
	}
	.back-mark {
		position: relative;
		width: calc(44px * var(--s));
		height: calc(44px * var(--s));
		color: var(--tone);
	}

	.stamp {
		position: absolute;
		right: calc(-4px * var(--s));
		top: calc(30px * var(--s));
		width: calc(34px * var(--s));
		height: calc(34px * var(--s));
		color: var(--tone);
		transform: rotate(-16deg);
		opacity: 0.9;
		filter: drop-shadow(0 0 5px color-mix(in srgb, var(--tone) 55%, transparent));
		pointer-events: none;
	}
</style>
