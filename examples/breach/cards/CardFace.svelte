<script lang="ts">
	// ── Card — one ability as a playing card, built around a SCENE ───────────
	// The face this replaced put a line icon in a ring on a coloured wash. That
	// is a bullet point, not card art: it says which family the card is in and
	// nothing else, and forty of them side by side read as one deck of the same
	// card in six colours.
	//
	// A real card shows a PLACE with somebody doing something in it, and we have
	// a 3D engine, so the art here is a scene built out of the card's own data —
	// see `card-scene.ts`. Nobody illustrates anything; the Maintainer walks
	// into the Circle because the card says `owner: maintainer` and
	// `kind: econ`.
	//
	// The numbers are the HUD's, deliberately: numeral over a small tracked unit
	// label, hairlines between the columns. That treatment is already the way
	// AP reads on the table strip, and two surfaces in one game printing the
	// same number two different ways is how a player learns to distrust both.
	import { Backdrop, Icon, Scene } from 'showcase';
	import { SKILL_GLYPH } from '../parts/skill-glyphs.js';
	import type { Ability, Klass } from '../internal/rules.js';
	import type { CardFx } from '../internal/fx.js';
	import { sceneFor, shotFor, type Shot, type SceneAnim } from './card-scene.js';
	// The HUD's badge treatment, not a second opinion about it. `hud-state` calls
	// this "the tinted-not-filled treatment every badge in this game wears (the AP
	// gem, the LINK tab)" — and the cost pip on a card IS the AP gem. Two surfaces
	// printing the same fact two ways is how a player learns to distrust both.
	import { gemEdge, gemFill } from '../hud/hud-state.js';

	interface Props {
		ability: Ability;
		fx: CardFx;
		/** The character the card belongs to — the one standing in the art. */
		owner: Klass;
		/** The seat's rating in this card's skill. The same card is a different
		 *  card in another seat, and this is the line that says so. */
		skillMod: number;
		raised?: boolean;
		/**
		 * The card can be played right now — the seat can afford it and it is
		 * their turn. False greys the whole face.
		 *
		 * One prop and not the pair of `affordable` / `disabled` the fan used to
		 * pass: they were ANDed into one opacity on arrival, so two booleans that
		 * can only ever produce two outcomes were two chances to disagree.
		 */
		playable?: boolean;
		scale?: number;
		/** Live edits to the card's shot, from an editor. Absent everywhere the
		 *  card is merely being PLAYED — the deck prints what `card-scene` says. */
		shot?: Partial<Shot>;
		/** Play the scene. See `SceneAnim`: which frame is showing is a fact about
		 *  the moment, not about the card. */
		anim?: SceneAnim;
		/** The card is on the table, not in the hand. Same class of fact as
		 *  `anim` — see `sceneFor`. Cards whose shot names no `wakes` are drawn
		 *  identically either way. */
		played?: boolean;
	}

	let {
		ability,
		fx,
		owner,
		skillMod,
		raised = false,
		playable = true,
		scale = 1,
		shot,
		anim,
		played = false
	}: Props = $props();

	const scene = $derived(sceneFor(ability, owner, fx, shot, anim, played));

	// The texture is the only part of a shot that is NOT geometry, so it cannot
	// ride in the `SceneSpec` — it is resolved here, from the same merge
	// `sceneFor` does, rather than being a second prop a caller has to remember
	// to pass alongside the first.
	const look = $derived({ ...shotFor(ability.key), ...shot });
	const modTone = $derived(
		skillMod > 0 ? '#34D399' : skillMod < 0 ? '#FB7185' : 'var(--fg-dim)'
	);

	const NOISE_HUE = '#FBBF24';
	const QUIET_HUE = '#34D399';
</script>

{#snippet stat(value: string, unit: string, tone: string, hint: string)}
	<!-- Value and unit on ONE baseline, not a numeral over a caption.
	     Stacked, each column takes its width from the UNIT rather than the
	     number — so `REP` and `NOISE` set the gap between the two figures, and at
	     card size the captions closed up into a single word. Inline, the pair is
	     one object and the label reads as the number's unit, which is what the
	     seat plate and the table strip already do with AP.

	     Colour on the NUMERAL only. Tinting the unit too made each pair one
	     coloured lump the size of a price — `3 REP` in gold next to `0 NOISE` in
	     green is a tariff, not a stat line. The label is chrome: it says the same
	     word on all forty cards, so it belongs in the chrome colour, and the one
	     thing that varies is the one thing that carries the hue.

	     `flex-1 basis-0` and not `shrink-0`: the two cells take the same width, so
	     REP and NOISE land on the same x on every card in the deck. Content-width
	     columns walked left and right with the digit count, and a wall of forty
	     cards is where that reads as sloppy rather than as tight. -->
	<span class="flex min-w-0 flex-1 basis-0 items-baseline gap-[3px]" title={hint}>
		<b class="font-mono text-[0.66rem] leading-none font-black tabular-nums" style:color={tone}
			>{value}</b
		>
		<span
			class="font-mono text-[0.42rem] leading-none font-black tracking-[0.1em] text-[var(--fg-dim)] uppercase"
		>
			{unit}
		</span>
	</span>
{/snippet}

<!-- ── One object, one scale ────────────────────────────────────────────────
     `zoom`, and every size below stays in `rem` — the same call `hud-scale`
     made, for the same reason it wrote down.

     Sizing the box by `scale` and leaving the type in `rem` was the bug: `rem`
     is root-relative, so a card drawn at 2.4× got a picture 2.4× bigger and kept
     its typography at 1×, and the name plate collapsed into a caption under a
     poster. Converting the file to `em` fixes the type and silently misses
     whatever it misses — here it missed the stat row's gap, and the two unit
     captions ran together into one word. `zoom` takes type, padding, borders and
     icon strokes at once, which is what "a bigger card" actually means. -->
<div
	class="relative flex select-none flex-col overflow-hidden rounded-[12px] border"
	class:opacity-40={!playable}
	style:width="136px"
	style:height="188px"
	style:zoom={scale}
	style:border-color={raised ? `color-mix(in srgb, ${fx.hue} 78%, transparent)` : 'var(--border)'}
	style:background="var(--bg-elev, #0b0f16)"
	style:box-shadow={raised
		? `0 0 0 1px color-mix(in srgb, ${fx.hue} 40%, transparent), 0 16px 34px rgba(0,0,0,0.5)`
		: '0 6px 16px rgba(0,0,0,0.4)'}
>
	<!-- ── The art ──────────────────────────────────────────────────────────
	     Full-bleed to three edges. A window with a margin all round is a
	     photograph mounted on a card; art that runs off the sides is a card.

	     `slice`, so the scene fills the box and loses its edges rather than
	     shrinking to fit inside it — the framing decision a card makes. -->
	<!-- The art takes whatever the text does not, rather than a height of its
	     own. A fixed art box leaves a band of empty card between the name plate
	     and the numbers on every card whose name runs to one line — and a card
	     with a hole in it is the one thing a layout cannot get away with. -->
	<div class="relative w-full min-h-0 flex-1 overflow-hidden">
		<div
			class="absolute inset-0"
			style:background="radial-gradient(120% 90% at 50% 82%,
				color-mix(in srgb, {fx.hue} 34%, var(--bg-elev, #0b0f16)) 0%,
				var(--bg-elev, #0b0f16) 72%)"
		></div>
		<!-- A real surface behind the scene, for the cards that want one. Above
		     the wash and below the art: it is what the art is standing in front
		     of, so a card can hand the job of "the wall at the back" to a tuned
		     texture instead of modelling a rectangle big enough never to show an
		     edge. -->
		{#if look.texture}
			<Backdrop id={look.texture} styles={{ [look.texture]: look.textureStyle ?? '' }} />
		{/if}

		<!-- Positioned, not in flow. The wash above it is `absolute`, and an
		     absolutely positioned box paints over in-flow content whatever the
		     source order says — so an in-flow scene is a scene behind its own
		     background. -->
		<div class="absolute inset-0">
			<Scene {scene} fit="slice" zoom={1.06} offset={{ y: 0.04 }} label={ability.name} />
		</div>

		<!-- The horizon. Without it the scene floats: a ground plane that stops
		     nowhere reads as figures hanging in a coloured void. -->
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-[26px]"
			style:background="linear-gradient(180deg, transparent, color-mix(in srgb, {fx.hue} 16%, var(--bg-elev, #0b0f16)) 78%)"
		></div>
	</div>

	<!-- COST, in the true top-left corner — the one part of a card that is never
	     covered by the card fanned in front of it. Over the art, because the art
	     now goes all the way up.

	     Inset to a real margin and sized down. Flush in the corner at 26px the
	     gem crossed the card's own corner radius, so the two curves fought and
	     the pip read as a sticker slapped over the art rather than as part of the
	     card. A gem inside a margin, with a ring and a shadow to lift it off
	     whatever the scene happens to put behind it, is the same fact printed
	     like hardware. -->
	<span
		class="absolute top-[5px] left-[5px] z-10 grid h-[22px] w-[22px] place-items-center rounded-full border-2 font-mono text-[0.68rem] font-black tabular-nums"
		style:color={fx.hue}
		style:border-color={gemEdge(fx.hue)}
		style:background={gemFill(fx.hue)}
		style:box-shadow="0 1px 6px rgba(0,0,0,0.55)"
		title="{ability.ap} action points">{ability.ap}</span
	>

	<!-- What the card LEAVES on the board, top-right. The one fact a player must
	     know before choosing that no colour can carry. Squared to the cost gem's
	     inset so the two corner marks share one margin. -->
	{#if fx.leaves !== 'nothing'}
		<span
			class="absolute top-[7px] right-[7px] z-10 grid h-[15px] w-[15px] place-items-center rounded-full"
			style:color="var(--bg-elev, #0b0f16)"
			style:background={fx.hue}
			title={fx.leaves === 'implant'
				? 'stays on the board, hidden, until a review pulls it out'
				: 'stays on the board as posted defenders'}
		>
			<Icon name={fx.leaves === 'implant' ? 'lock' : 'shield'} size={10} />
		</span>
	{/if}

	<!-- ── The name plate ──────────────────────────────────────────────────
	     Sits ON the boundary between art and numbers, tinted by the card, with
	     a lit hairline along its top edge — the join every printed card has
	     between illustration and text box. -->
	<div
		class="relative w-full shrink-0 px-2 pt-[5px] pb-[5px]"
		style:background="linear-gradient(180deg, color-mix(in srgb, {fx.hue} 22%, var(--bg-elev, #0b0f16)), var(--bg-elev, #0b0f16))"
		style:box-shadow="inset 0 1px 0 color-mix(in srgb, {fx.hue} 55%, transparent),
			inset 0 -1px 0 var(--border)"
	>
		<span
			class="block overflow-hidden font-mono text-[0.6rem] leading-[1.12] font-black text-[var(--fg)]"
			style:display="-webkit-box"
			style:-webkit-line-clamp="2"
			style:-webkit-box-orient="vertical"
			title={ability.text}>{ability.name}</span
		>
		<!-- Whose card this is, in their own colour. The scene already says it —
		     that is the point of putting them in it — but at a glance across a
		     table a word is faster than recognising a silhouette.

		     Only the OWNER carries the hue. The kind is a taxonomy word that
		     repeats across the whole deck, and printing it in the character's
		     colour made the byline one long saturated banner competing with the
		     name directly above it. Tracking eased off for the same reason: at
		     0.14em two words spread the full width of the card and turned the
		     subtitle into a second title. -->
		<span
			class="mt-[3px] flex items-baseline gap-[4px] overflow-hidden font-mono text-[0.42rem] leading-none font-black tracking-[0.1em] whitespace-nowrap uppercase"
		>
			<span
				class="truncate"
				style:color="color-mix(in srgb, {owner.color} 62%, var(--fg-dim, #94a3b8))"
			>
				{owner.name.replace(/^The /, '')}
			</span>
			<span class="shrink-0 text-[var(--border)]">·</span>
			<span class="shrink-0 text-[var(--fg-dim)]">{ability.kind}</span>
		</span>
	</div>

	<!-- ── The numbers ─────────────────────────────────────────────────────
	     Numeral first, unit under it, hairline between the columns — the table
	     strip's stat line, on a card. Three facts and no labels spelled out in
	     words: a player learns three columns in one hand. -->
	<div class="flex w-full shrink-0 items-center gap-[6px] px-2 pt-[7px] pb-[7px]">
		{@render stat(
			`${fx.power >= 0 && fx.powerLabel === 'ROLL' ? '+' : ''}${fx.power}`,
			fx.powerLabel,
			fx.hue,
			fx.powerLabel === 'ATK' ? 'added to the attack roll' : 'size of the effect'
		)}

		<span class="h-[12px] w-px shrink-0 bg-[var(--border)]"></span>

		{@render stat(
			`${ability.noise || 0}`,
			'noise',
			ability.noise ? NOISE_HUE : QUIET_HUE,
			ability.noise ? `makes ${ability.noise} heat` : 'makes no heat — quiet'
		)}

		<!-- Your rating in the skill this card rolls on, as glyph and number. Not
		     a stat column: it is not the CARD's number, it is yours, and giving it
		     a unit label would put it in the same class as the two that are.

		     A hairline chip, not a filled gem. Filled, it was the heaviest object
		     in the text box — and on the common case, a rating of 0, that weight
		     went to a grey lozenge with nothing to say. The cost gem is the one
		     filled mark on the face; anything else wearing the same treatment
		     argues with it about which number to read first. -->
		<span
			class="flex shrink-0 items-center gap-[3px] rounded-[3px] border px-[4px] py-[2px]"
			style:color={modTone}
			style:border-color="color-mix(in srgb, {modTone} 40%, transparent)"
			title="your {ability.skill}"
		>
			<Icon name={SKILL_GLYPH[ability.skill]} size={9} />
			<b class="font-mono text-[0.54rem] leading-none font-black tabular-nums">
				{skillMod >= 0 ? '+' : ''}{skillMod}
			</b>
		</span>
	</div>
</div>
