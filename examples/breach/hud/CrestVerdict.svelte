<script lang="ts">
	// ── The verdict, as the mark itself ──────────────────────────────────────────
	// The match opens on the crest being forged (`LogoForge`, in the lobby) and it
	// ends here, on the same shield — whole when the estate held, in pieces when
	// it did not. That is the whole idea: one object, two states, and the player
	// has already watched it built.
	//
	// So neither state is new artwork. `held` is `ArmornetCrestChrome` at
	// `LOGO_SHAPE` — the exact mark the forge lands on. `breached` is that same
	// component, drawn once per fracture wedge and clipped to it (`shatter.ts`),
	// which is why the seams line up and why a change to the logo turns up in
	// both without anybody redrawing a broken one.
	//
	// The pieces are `clip-path`ed rather than cut into paths: the crest is a
	// stack of gradients, filters and a figure on ball joints, and re-cutting all
	// of that per shard would be a second rendering of the mark to keep in step.
	import { ArmornetCrestChrome, LOGO_SHAPE, prefersReducedMotion } from 'showcase';
	import { shatter, debris } from './shatter.js';

	interface Props {
		/** Which end of the match this is. `held` is blue's win and red's failure
		 *  — the shield's state, NOT the reader's; the words beside it are what
		 *  say whether that was good news for you (see `outcome.ts`). */
		state: 'held' | 'breached';
		/** The crest's rendered width, px. Everything else is a fraction of it. */
		size?: number;
		/** The reader's verdict hue — what the bloom behind the shield is lit in.
		 *  The crest keeps its own metal either way; only the light changes. */
		tone?: string;
		class?: string;
	}

	let { state, size = 132, tone = '#34D399', class: cls = '' }: Props = $props();

	// Read once, at mount: the CSS below already answers the media query on its
	// own, and this is only here for the states it cannot express — a transform
	// that has to LAND somewhere when the animation carrying it is off.
	const still = prefersReducedMotion();

	// Cut once. Re-cutting on every render would re-seed nothing — the break is
	// deterministic — but it would rebuild seven clip strings per frame the tone
	// changes.
	const shards = shatter();
	const specks = debris();

	// The chrome cut is authored 200 wide by 220 tall; the box has to match or the
	// clip percentages land somewhere other than the silhouette.
	const h = $derived(Math.round(size * 1.1));
</script>

<div
	class="relative grid place-items-center {cls}"
	style:width="{size}px"
	style:height="{h}px"
	aria-hidden="true"
>
	<!-- The light the verdict is read by. Behind the mark in both states, and the
	     only thing on this component the tone touches — a shield recoloured to
	     match the result would stop being the mark from the title screen.
	     A broken shield takes the lamp as a RIM rather than as a backlight: lit
	     from behind, the fracture seams fill with the tone and the crest reads as
	     a shield with red beams shining through it rather than one that has come
	     apart. The gaps have to be dark, because that is what a gap is. -->
	<span
		class="absolute rounded-full"
		class:inset-[-18%]={state === 'held'}
		class:inset-[-10%]={state === 'breached'}
		style:background={state === 'held'
			? `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${tone} 42%, transparent) 0%, transparent 62%)`
			: `radial-gradient(circle at 50% 46%, transparent 42%, color-mix(in srgb, ${tone} 14%, transparent) 54%, transparent 66%)`}
		class:verdict-breathe={state === 'held' && !still}
	></span>

	<!-- The dark the pieces are seen against. Only for the break, and only so the
	     seams have something to be. -->
	{#if state === 'breached'}
		<span
			class="absolute inset-0"
			style:background="radial-gradient(closest-side, rgba(2,5,10,0.9) 0%, rgba(2,5,10,0.6) 72%, transparent 100%)"
		></span>
	{/if}

	{#if state === 'held'}
		<!-- Intact, lit, and holding. `tethers` on: the struts tie the figure out
		     to the wall, which is the reading the win wants — the mark is carried
		     BY the shield rather than sitting in front of it. -->
		<ArmornetCrestChrome
			{size}
			shape={LOGO_SHAPE}
			glow
			bloom={0.9}
			tethers
			title=""
			class="relative"
		/>
		<!-- One ring, once. A pulse that loops would keep asking for attention
		     after the player has read the screen. -->
		{#if !still}
			<span
				class="verdict-ring pointer-events-none absolute inset-0 rounded-full border-2"
				style:border-color="color-mix(in srgb, {tone} 65%, transparent)"
			></span>
		{/if}
	{:else}
		<!-- Every shard is a whole crest seen through its own hole. The transform
		     is a CSS variable rather than a per-shard keyframe so one animation
		     serves all seven. -->
		<span class="verdict-break absolute inset-0" style:filter="saturate(0.5) brightness(0.82)">
			{#each shards as s, i (i)}
				<span
					class="absolute inset-0 grid place-items-center"
					class:verdict-shard={!still}
					style:clip-path="polygon({s.poly})"
					style:--dx="{s.dx}%"
					style:--dy="{s.dy}%"
					style:--rot="{s.rot}deg"
					style:--hold={s.opacity}
					style:--wait="{s.delay}s"
					style:opacity={still ? s.opacity : undefined}
					style:transform={still
						? `translate(${s.dx}%, ${s.dy}%) rotate(${s.rot}deg)`
						: undefined}
				>
					<ArmornetCrestChrome
						{size}
						shape={LOGO_SHAPE}
						glow={false}
						emboss={false}
						title=""
					/>
				</span>
			{/each}
		</span>

		<!-- The bits. Without them the wedges read as a shield neatly sliced, and
		     what happened to it was not neat. -->
		{#each specks as p, i (i)}
			<span
				class="absolute rounded-[1px]"
				class:verdict-speck={!still}
				style:left="{p.x}%"
				style:top="{p.y}%"
				style:width="{p.size}px"
				style:height="{p.size}px"
				style:background="color-mix(in srgb, {tone} 45%, #CBD5E1)"
				style:--dx="{p.dx}%"
				style:--dy="{p.dy}%"
				style:--wait="{p.delay}s"
				style:--hold={p.hold}
				style:opacity={still ? p.hold : undefined}
			></span>
		{/each}

		<!-- The blow that did it, at the fracture origin. One frame's worth. -->
		{#if !still}
			<span
				class="verdict-impact pointer-events-none absolute h-2 w-2 rounded-full"
				style:left="36%"
				style:top="24%"
				style:background={tone}
			></span>
		{/if}
	{/if}
</div>

<style>
	/* The break, held. `forwards` on purpose — the pieces do not come back, and a
	   fill that reverted would put the shield together again behind the words
	   saying it failed. */
	.verdict-shard {
		animation: shard-out 900ms cubic-bezier(0.16, 0.8, 0.3, 1) var(--wait) both;
	}
	@keyframes shard-out {
		0% {
			transform: none;
			opacity: 1;
		}
		12% {
			transform: none;
			opacity: 1;
			filter: brightness(1.9);
		}
		100% {
			transform: translate(var(--dx), var(--dy)) rotate(var(--rot));
			opacity: var(--hold);
		}
	}

	.verdict-speck {
		animation: speck-out 1100ms cubic-bezier(0.12, 0.7, 0.25, 1) var(--wait) both;
	}
	@keyframes speck-out {
		0% {
			transform: none;
			opacity: 0;
		}
		15% {
			opacity: 0.95;
		}
		100% {
			transform: translate(var(--dx), var(--dy));
			opacity: var(--hold);
		}
	}

	.verdict-impact {
		animation: impact 520ms ease-out both;
	}
	@keyframes impact {
		0% {
			transform: scale(0.2);
			opacity: 1;
			box-shadow: 0 0 0 0 currentColor;
		}
		100% {
			transform: scale(9);
			opacity: 0;
		}
	}

	/* The intact shield is doing nothing, which is the point — so it gets a slow
	   lamp rather than a motion. */
	.verdict-breathe {
		animation: breathe 3.4s ease-in-out infinite;
	}
	@keyframes breathe {
		0%,
		100% {
			opacity: 0.75;
		}
		50% {
			opacity: 1;
		}
	}

	.verdict-ring {
		animation: ring-out 900ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
	}
	@keyframes ring-out {
		0% {
			transform: scale(0.55);
			opacity: 0.9;
		}
		100% {
			transform: scale(1.35);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.verdict-shard,
		.verdict-speck,
		.verdict-impact,
		.verdict-breathe,
		.verdict-ring {
			animation: none;
		}
	}
</style>
