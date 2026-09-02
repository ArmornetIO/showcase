<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// AUTH SPLIT — the branded two-pane sign-in screen: a statement on the left,
	// the flow on the right, and a Möbius strip that weaves through itself
	// across both.
	//
	// It lives here rather than in the route because the route is not allowed to
	// own it: app-ui's layer rules put visuals in showcase and forbid scoped CSS
	// in a page. So the shell takes COPY and a form, and owns every pixel of how
	// they are arranged. The consuming route keeps the flow — which step you are
	// on, what the API said — and nothing else.
	//
	// The long way round to the composition is worth one paragraph, because the
	// scar tissue is the design. The strip used to be an SVG backdrop stretched
	// under the whole page, and the brief was "make it pass in front of the
	// form". Every attempt failed for one reason: additive translucent paint
	// cannot occlude, so "in front" had to be counterfeited with masks, each mask
	// a shape invented to sit wherever the ribbon happened to be. It looked
	// invented because it was.
	//
	// The real fault was never the layering. It was that the far lap and the near
	// lap both SCREEN onto black, so their crossings blew out bright instead of
	// occluding — the strip read as a decal. `MobiusWeave` fixes that at the
	// source by painting back-to-front with an occluding ground, so the shape
	// weaves through itself, which is what a Möbius does anyway.
	//
	// The form is not in that scene and must not be. A canvas cannot depth-test
	// against a DOM input: the ribbon would cross in front of the panel's surface
	// but behind the text printed on it, and the eye reads that contradiction
	// instantly. So the strip is anchored off to the right and cropped, the panes
	// keep a real hard seam, and nothing is masked anywhere.
	import type { Snippet } from 'svelte';
	import MobiusWeave from '../backdrop/MobiusWeave.svelte';
	import { spiderVerseStrips } from '../backdrop/strips.js';
	import { theme } from '../theme/store.svelte.js';

	interface Props {
		/** Small-caps wordmark above the statement. The leading glyph is drawn in
		 *  the accent; pass the mark without it. */
		mark?: string;
		/** The statement, as its two halves. The face switches between them mid
		 *  sentence — the machine finishes the human's sentence — which is the
		 *  whole idea, and why this is two strings rather than one. */
		statement?: { human: string; machine: string };
		/** One supporting sentence. Anything longer wants a different screen. */
		sub?: string;
		/** Where you are in the flow, e.g. `01 / WORKSPACE`. Numbering is earned:
		 *  it says what a bare "Sign in." heading could not. */
		step?: string;
		/** The flow itself — fields, provider buttons, whatever the step needs.
		 *  Style its contents with the `auth-*` classes this component publishes
		 *  (see the style block) rather than with CSS in the route. */
		form: Snippet;
		/** Footer under the form. Typically the "new here?" line. */
		aside?: Snippet;
		/** The left pane, in place of the statement — for a screen whose left half
		 *  IS the thing rather than a claim about it (a live board, a preview).
		 *  It fills the pane edge to edge, so `mark`/`statement`/`sub` are ignored
		 *  when it is given. The flow's own heading then has to live on the right,
		 *  which is what `.auth-title` is for. */
		visual?: Snippet;
	}

	let { mark = '', statement, sub = '', step = '', form, aside, visual }: Props = $props();

	// A preset carries its strips AND the palette they were composed against, so
	// both come from the same place — loading the arrangement without its colours
	// is how a composition drifts from something nobody designed.
	const SPIDER = spiderVerseStrips();

	// Placement overrides, applied HERE rather than in `strips.ts`: the preset is
	// shared, and re-aiming it for one screen's furniture would move the art
	// everywhere else it is used. Only `top` changes — the shapes, sizes,
	// bearings, belts and ghosts are the authored composition untouched.
	//
	//   p1  the big sweep, moved up and right so it crosses the upper half
	//       instead of pooling in the bottom-left corner.
	//   p3  stays in the bottom right, lifted just enough to run THROUGH the
	//       CTA rather than passing under it.
	//   p5  raised clear of the lower half, so it spills behind the workspace
	//       field rather than sitting under the fold.
	const POS: Record<string, { left?: number; top?: number; band?: number }> = {
		// `band` is the strip's half-width. The authored 150 reads heavy where the
		// sweep crosses the top of the frame, so this one is slimmed; the twist
		// still registers because the taper is in the geometry, not the stroke.
		p1: { left: 40, top: 0, band: 96 },
		p3: { top: 58 },
		p5: { top: 18 }
	};
	// `p2` and `p4` are the two small rings — dropped rather than hidden, so the
	// frames they cost are not spent drawing something masked away.
	const DROP = new Set(['p2', 'p4']);
	const STRIPS = SPIDER.strips
		.filter((s) => !DROP.has(s.id))
		// `energyColor` is authored yellow for the spider-verse palette. Overridden
		// alongside the placement so the riders stay in the same family as the band
		// rather than reading as a second accent.
		// `pulse` — the mesh's own solid-rim-plus-travelling-orb style, in place of
		// the authored `degraded` dash.
		.map((s) => ({ ...s, energy: 'pulse' as const, energyColor: '', ...(POS[s.id] ?? {}) }));

	/** `#rrggbb` → `r, g, b`. MobiusWeave paints on a canvas, where a `var()` is
	 *  not a colour and the triples are interpolated per frame — so the token has
	 *  to be resolved to numbers here rather than passed through as CSS. */
	function triplet(token: string, fallback: string): string {
		if (typeof document === 'undefined') return fallback;
		const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
		const m = v.match(/^#([0-9a-f]{6})$/i);
		if (!m) return fallback;
		const n = parseInt(m[1], 16);
		return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
	}

	// `theme.resolved` is read for the dependency, not the value: the tokens moved
	// when it changed, and a computed style is not something Svelte can track.
	//
	// `ground` is load-bearing rather than decorative — the near lap paints it to
	// OCCLUDE the far lap, so a ground that does not match the page behind it
	// reads as a grey smear instead of a hole. The composition was authored
	// against dark, and hardcoding that ground is what punched black holes
	// through the light themes.
	const art = $derived.by(() => {
		void theme.resolved;
		return {
			ground: triplet('--bg', '6, 7, 11'),
			strip: triplet('--accent', '94, 234, 212'),
			strip2: triplet('--palette-violet', '196, 181, 253'),
			traveller: triplet('--palette-emerald', '110, 231, 183')
		};
	});
</script>

<div class="page" class:has-visual={!!visual}>
	<!-- FULL PAGE, and above both panes. A spec's left/top are VIEWPORT
	     percentages, so boxing the canvas inside the brand column did two things
	     at once: squeezed the authored composition, and made the strip stop dead
	     at the seam. Spanning the page is also the only way it can cross the form
	     pane — and here it genuinely crosses, because each facet fills with ground
	     before its edges are stroked. That is the whole difference from the SVG
	     renderer, where the same attempt could only ever glow through the panel.

	     The ghost plate hue-rotates 140° off `stripColor`, so the misregistration
	     stays visible whatever the theme resolves to — the signature is the OFFSET
	     between two hues, not the specific pair. -->
	<div class="art">
		<MobiusWeave
			strips={STRIPS}
			ground={art.ground}
			stripColor={art.strip}
			stripColor2={art.strip2}
			travellerColor={art.traveller}
		/>
	</div>

	<section class="brand">
		{#if visual}
			<!-- Outside `.brand-body`, which is a centred column with a measure on
			     it — the wrong box for something that is meant to fill the pane. -->
			<div class="visual">{@render visual()}</div>
		{:else}
			<div class="brand-body">
				{#if mark}<div class="mark">
						<span class="glyph">▣</span>
						{mark}
					</div>{/if}
				{#if statement}
					<h1 class="statement">
						<span>{statement.human}</span><br /><span class="machine">{statement.machine}</span>
					</h1>
				{/if}
				{#if sub}<p class="sub">{sub}</p>{/if}
			</div>
		{/if}
	</section>

	<section class="form-side">
		<div class="form-body">
			{#if step}<p class="step">{step}</p>{/if}
			{@render form()}
			{#if aside}<div class="aside">{@render aside()}</div>{/if}
		</div>
	</section>
</div>

<style>
	/* A stated measure for the form column; the brand takes the rest. `1.15fr 1fr`
	   was arbitrary, and arbitrary ratios read as arbitrary. */
	.page {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-columns: 1fr min(clamp(380px, 34vw, 460px), 100%);
		background: var(--bg);
		color: var(--fg);
		overflow: auto;
	}

	/* A visual pane is a wider flow pane too. The 340px measure below is sized for
	   provider buttons and one field; a screen that puts its heading, a progress
	   bar and a multi-step form on this side runs out of room at that width, and
	   the stepper is the part that fails first — five labels on one rule. */
	.page.has-visual {
		grid-template-columns: 1fr min(clamp(420px, 32vw, 560px), 100%);
	}

	.brand {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 6vw, 5rem);
		overflow: hidden;
	}
	/* The visual is the pane — the statement's generous inset would frame it like
	   a picture, which is the opposite of "big". */
	.page.has-visual .brand {
		padding: clamp(1rem, 2.5vw, 2rem);
	}
	.visual {
		position: relative;
		z-index: 3;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	/* Three planes, and the strip is the middle one:
	     1  SURFACES  the form pane's ground — what the strip passes over.
	     2  ART       the strip, once, full page.
	     3  CONTENT   type and inputs. Never crossed, always legible.
	   A canvas cannot depth-test against a DOM input, so the form does not go
	   into the scene; it sits above it. The strip covers the pane's SURFACE,
	   which is the effect, without ever landing on the field you are typing in. */
	.art {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		/* Dissolved into the page at both edges, densest through the middle. The
		   strip is cropped by the viewport either way; fading is what makes it
		   read as passing THROUGH the frame rather than being cut off by it.
		   Cheap on this layer — a mask over a canvas costs a composite, not a
		   redraw, which is why it belongs here and not in the paint loop. */
		mask-image: linear-gradient(180deg, transparent 0, #000 26%, #000 62%, transparent 96%);
	}
	.brand-body,
	.form-body {
		position: relative;
		z-index: 3;
	}
	.brand-body {
		position: relative;
	}

	.mark {
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: 0.16em;
		color: var(--fg-muted);
		margin-bottom: var(--sp-6);
	}
	.mark .glyph {
		color: var(--accent);
	}

	/* No `text-wrap: balance`. The break is already stated by the `<br>` — two
	   lines, human then machine — and balance re-flowed the mono line against it,
	   putting the second half on two rows of its own. Balance is for copy whose
	   break you have not decided; this one is decided. */
	.statement {
		font-size: clamp(2.2rem, 3.9vw, 3.4rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
		margin: 0 0 var(--sp-5);
		font-weight: 640;
	}
	.machine {
		font-family: var(--mono);
		/* Mono runs optically larger at the same em, so it is stepped down to sit
		   on the same visual weight as the sans line above it. */
		font-size: 0.86em;
		letter-spacing: -0.02em;
		color: var(--accent);
	}
	/* The measure belongs on the paragraph, not the column. A `ch` cap on the
	   wrapper resolves against ITS 16px rather than the 54px display line it was
	   meant to hold, so it never sized the statement at all. */
	.sub {
		margin: 0;
		max-width: 34ch;
		color: var(--fg-muted);
		font-size: 1rem;
		line-height: 1.6;
	}

	/* A real seam: full height, never occluded, never faked. An earlier one
	   dissolved where the ribbon crossed it, which is a tolerance stack between
	   two numbers that had to agree by hand. */
	.form-side {
		position: relative;
		display: grid;
		place-items: center;
		padding: var(--sp-6);
	}
	/* The pane's ground as its own plate on plane 1, so the strip is over it.
	   Left on the section itself it would sit in the same plane as the content
	   and the strip could never cross the pane at all.

	   Every colour here is a token because the composition was authored dark: a
	   literal `#0a0c12` pane, a white hairline seam and a black falloff are all
	   invisible-or-wrong the moment the page is not black. */
	.form-side::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		background: var(--bg-elev);
		border-left: 1px solid var(--border);
		box-shadow: -40px 0 90px -40px color-mix(in srgb, var(--fg) 55%, transparent);
	}
	.form-body {
		width: 100%;
		max-width: 340px;
	}
	.page.has-visual .form-body {
		max-width: 100%;
	}
	/* Scrolls the FLOW rather than the page: the left pane is a fixed stage, and
	   a page-level scrollbar would slide it out of view to reach a button on the
	   right. `.form-side` is `place-items: center`, which pins a taller child to
	   the middle and cuts off both ends, so the alignment relaxes here too. */
	.page.has-visual .form-side {
		align-items: stretch;
		overflow-y: auto;
	}
	.page.has-visual .form-body {
		align-self: center;
		padding: var(--sp-5) 0;
	}

	.step {
		margin: 0 0 var(--sp-5);
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		color: var(--fg-muted);
	}
	/* One interval everywhere. Five off-scale values was a large and unnameable
	   share of "looks bad". */
	.aside {
		margin: var(--sp-6) 0 0;
		font-size: 0.85rem;
		color: var(--fg-muted);
		text-align: center;
	}
	/* Underlined: an accent link beside accent display type is distinguishable by
	   colour alone, which fails for anyone who cannot separate the two. */
	.aside :global(a) {
		color: var(--accent);
		text-underline-offset: 3px;
	}

	/* ── Slot vocabulary ─────────────────────────────────────────────────────
	   The four shapes a step's content actually takes. They are published as
	   `auth-*` classes and styled here rather than left to the route, because
	   the route is the one place in this codebase that may not carry CSS — and
	   a second sign-in screen restating these by hand is how the first one
	   drifted. Global by necessity: the markup is the caller's. */
	/* The flow's own heading. Only a `visual` screen needs it — on a statement
	   screen the left pane IS the heading — but it is published here rather than
	   left to the caller for the same reason as the rest of this vocabulary. */
	.form-body :global(.auth-title) {
		margin: 0 0 var(--sp-3);
		font-size: 1.5rem;
		line-height: 1.15;
		letter-spacing: -0.02em;
		font-weight: 640;
	}
	.form-body :global(.auth-title .accent) {
		color: var(--accent);
	}
	.form-body :global(.auth-lede) {
		margin: 0 0 var(--sp-5);
		font-size: 0.92rem;
		color: var(--fg-muted);
	}
	.form-body :global(.auth-stack) {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.form-body :global(.auth-error) {
		margin: var(--sp-5) 0 0;
		font-size: 0.85rem;
		color: var(--palette-red);
	}
	/* A button that reads as a link: it goes BACK, and a second solid control
	   beside the primary one would compete with it for the same glance. */
	.form-body :global(.auth-back) {
		display: block;
		margin: var(--sp-5) auto 0;
		border: 0;
		background: none;
		cursor: pointer;
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		/* --fg-dim is ~3.5:1 on this ground — below AA at 11px. */
		color: var(--fg-muted);
	}
	.form-body :global(.auth-back:hover) {
		color: var(--accent);
	}

	/* The ring needs its own ground: accent-on-accent-ribbon is invisible, and
	   this is the only affordance a keyboard user has. */
	.page :global(:is(button, a, input):focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--bg);
	}

	@media (max-width: 900px) {
		.page {
			grid-template-columns: 1fr;
		}
		.brand {
			display: none;
		}
	}
</style>
