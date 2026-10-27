<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { IconName } from 'showcase';

	/** One step of the "how it plays" card. `die` is drawn, since the icon set
	 *  has no dice. */
	export interface StartStep {
		icon: IconName | 'die';
		title: string;
		text: string;
	}

	/** A side as the match card names it. */
	export interface StartSide {
		label: string;
		tone: string;
	}

	/** The numbered card on the right: the steps one side has to complete,
	 *  lit as the hero plays them. */
	export interface StartPath {
		title: string;
		steps: readonly { id: string; name: string }[];
		lit: ReadonlySet<string>;
		tone: string;
	}

	/** Learn more: a lede, how each side wins, then titled sections — a
	 *  paragraph, a numbered list, or a game's own markup. */
	export interface StartLearn {
		title: string;
		lede: string;
		wins: readonly { label: string; tone: string; text: string }[];
		sections: readonly { title: string; text?: string; steps?: readonly string[]; body?: Snippet }[];
	}

	/** What the hero is fitted around: its own box, and on the wide layout the
	 *  dock under it and the headline over it. */
	export interface HeroBox {
		w: number;
		h: number;
		dockH: number;
		headW: number;
		/** The two-column layout, where the dock and headline float over the hero. */
		wide: boolean;
	}

	/** A game the bar can switch to, so a visitor picks the title here rather
	 *  than finding it later in the lobby. */
	export interface StartTitle {
		label: string;
		current: boolean;
		select: () => void;
	}
</script>

<script lang="ts">
	// ── A game's start screen ───────────────────────────────────────────────────
	// The frame every game's start screen shares: a side column, a stage with the
	// game's own scene, a headline typed in over it, three cards along the bottom
	// with Play in the middle, and Learn more and the leaderboard as dialogs. A
	// game brings its words, its two side panels and its scene; everything about
	// how they are laid out, at any width, is here once.
	//
	// Breach's screen came first (lobby/StartScreen.svelte), and this is that
	// screen's frame lifted out unchanged so Insider Threat could have the same one.
	import { Icon, Modal, prefersReducedMotion } from 'showcase';
	import type { Leader } from '../../api.js';
	import Standings from '../Standings.svelte';

	interface Props {
		/** The game's name on the bar. */
		name: string;
		/** The headline, one sentence a line. */
		lines: readonly string[];
		/** The index of a headline line set in Armornet Orange. */
		accent?: number;
		/** The pill under the headline. A `<b>` in it is lit. */
		tagline: Snippet;
		/** The screen is uncovered: type the headline. Held back while the title
		 *  is over it, so it is never typed under the curtain. */
		live: boolean;
		/** `false` when the host knows the visitor is signed out, so Play is
		 *  honest about leading to the sign-in step. `null` is a host with no
		 *  accounts (the standalone build), where Play goes straight in. */
		account: boolean | null;
		/** Play was pressed and the page is on its way to sign in. */
		leaving: boolean;
		onplay: () => void;
		/** The rulebook. Without one, the bar and Learn more leave the link out. */
		rules?: string;
		howTitle: string;
		steps: readonly StartStep[];
		versus: readonly [StartSide, StartSide];
		facts: readonly string[];
		path: StartPath;
		learn: StartLearn;
		/** The game's standings. Without them the leaderboard says it is coming. */
		standings?: () => Promise<Leader[] | null>;
		/** The side column's two panels (SidePanel). Without them the stage
		 *  takes the whole frame. */
		sides?: Snippet;
		sidesLabel?: string;
		/** The game's scene, fitted to `HeroBox`. */
		hero: Snippet<[HeroBox]>;
		/** The scene fills the stage, under the bar, rather than starting below it. */
		bleed?: boolean;
		/** Where the headline sits on the wide layout: over the right of the
		 *  scene (Breach), or centred along its top. One column is unaffected. */
		headline?: 'side' | 'top';
		/** A seasonal look for the frame. Halloween trades the night's teal for
		 *  the pumpkin orange and party purple of the Halloween office. */
		season?: 'halloween';
		/** The games on offer. Two or more put a switch between them at the
		 *  right of the bar. */
		titles?: readonly StartTitle[];
	}

	let {
		name,
		lines,
		accent,
		tagline,
		live,
		account,
		leaving,
		onplay,
		rules,
		howTitle,
		steps,
		versus,
		facts,
		path,
		learn,
		standings,
		sides,
		sidesLabel,
		hero,
		bleed = false,
		headline = 'side',
		season,
		titles
	}: Props = $props();

	let learnOpen = $state(false);
	let boardOpen = $state(false);

	// ── The leaderboard ──────────────────────────────────────────────────────
	// Asked for on open rather than on mount: most visitors never press it, and
	// a fetch while the component is created breaks the showcase's server render
	// (see AgentSelect). `null` means the host keeps no history.
	let leaders = $state<Leader[] | null>(null);
	let loadingLeaders = $state(false);
	async function openBoard() {
		boardOpen = true;
		if (!standings) return;
		loadingLeaders = true;
		leaders = await standings();
		loadingLeaders = false;
	}

	// The hero's box, and what floats over it, measured: both change height
	// with the window, and a game fits its scene around them.
	let vw = $state(0);
	let dockH = $state(0);
	let headW = $state(0);
	let heroW = $state(0);
	let heroH = $state(0);
	/** Matches the stylesheet's one-column breakpoint. */
	const wide = $derived(vw >= 1000);
	const box = $derived<HeroBox>({ w: heroW, h: heroH, dockH, headW, wide });

	// ── The headline, typed in once ──────────────────────────────────────────
	const still = prefersReducedMotion();
	/** Where each line starts in the run of letters. */
	const starts = $derived(lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length, 0)));
	const total = $derived(lines.reduce((n, l) => n + l.length, 0));
	/** The headline was drawn for Breach's sixteen-letter lines; a longer line
	 *  is set smaller rather than run under the scene. Along the top it has
	 *  most of the stage's width, so it keeps its size for longer lines; one
	 *  column always has a phone's width. */
	const longest = $derived(Math.max(...lines.map((l) => l.length)));
	const scale = $derived(Math.min(1, (headline === 'top' ? 24 : 17) / longest));
	const scaleNarrow = $derived(Math.min(1, 17 / longest));
	let typed = $state(0);
	let caret = $state(false);
	$effect(() => {
		const n0 = total;
		const ends = new Set(starts.slice(1));
		if (!live) {
			typed = 0;
			caret = false;
			return;
		}
		if (still) {
			typed = n0;
			return;
		}
		let n = 0;
		let timer: ReturnType<typeof setTimeout>;
		caret = true;
		const tick = () => {
			typed = ++n;
			if (n < n0) timer = setTimeout(tick, ends.has(n) ? 360 : 58);
			else timer = setTimeout(() => (caret = false), 1400);
		};
		timer = setTimeout(tick, 600);
		return () => clearTimeout(timer);
	});

	const playLabel = $derived(leaving ? 'Opening sign in…' : 'Enter game');

	// Breach's name and sides are short. A longer name is spaced tighter on a
	// phone, and longer sides are set to the Play card's width, rather than
	// either running past its edge.
	const longName = $derived(name.length > 10);
	const vsLen = $derived(versus[0].label.length + versus[1].label.length);
	const vsFit = $derived(vsLen > 9);
</script>

<svelte:window bind:innerWidth={vw} />

<div class="ss" class:halloween={season === 'halloween'}>
	<div class="frame" class:solo={!sides}>
		<!-- ── The two sides ─────────────────────────────────────────────────── -->
		{#if sides}
			<aside class="teams" aria-label={sidesLabel}>
				{@render sides()}
			</aside>
		{/if}

		<!-- ── The stage ─────────────────────────────────────────────────────── -->
		<main class="stage" class:head-top={headline === 'top'}>
			<nav class="bar" class:long={longName}>
				<span class="mark"><Icon name="armornet" size={18} /> <b>{name}</b></span>
				<div class="pills">
					<button type="button" aria-label="How it plays" onclick={() => (learnOpen = true)}>
						<Icon name="info" size={14} /> <span class="how-lbl">How it plays</span>
					</button>
					{#if rules}
						<a href={rules}><Icon name="file-text" size={14} /> Rules</a>
					{/if}
					<button type="button" aria-label="Leaderboard" onclick={openBoard}>
						<Icon name="bar-chart-2" size={14} /> <span class="lbl">Leaderboard</span>
					</button>
				</div>
				<!-- Right-aligned, where it sits still while the screen under it swaps. -->
				{#if titles && titles.length > 1}
					<div class="titles" role="group" aria-label="Game mode">
						{#each titles as t (t.label)}
							<button type="button" aria-pressed={t.current} onclick={t.select}>{t.label}</button>
						{/each}
					</div>
				{/if}
			</nav>

			<!-- Inert to the pointer on touch screens: a full-width scene that eats
			     the drag is a page nobody can scroll past. With a mouse it spins. -->
			<div class="hero" class:bleed aria-hidden="true" bind:clientWidth={heroW} bind:clientHeight={heroH}>
				{@render hero(box)}
			</div>

			<div class="headline" bind:clientWidth={headW}>
				<!-- Every letter is laid out from the start and only revealed, so the
				     right-aligned lines never shift as they type. -->
				<h1 aria-label={lines.join(' ')} style:--hl-k={scale} style:--hl-kn={scaleNarrow}>
					{#each lines as line, li (li)}
						{@const at = starts[li]}
						<span class="line" class:accent={li === accent} aria-hidden="true">{#if caret && typed === 0 && li === 0}<i class="caret"></i>{/if}{#each [...line] as ch, ci (ci)}<span class="ch" class:off={at + ci >= typed}>{ch}</span>{#if caret && at + ci === typed - 1}<i class="caret"></i>{/if}{/each}</span>
					{/each}
				</h1>
				<p class="tag" class:shown={typed >= total}>
					<span class="tag-ico"><Icon name="shield-check" size={14} /></span>
					<span>{@render tagline()}</span>
				</p>
			</div>

			<div class="dock" bind:clientHeight={dockH}>
				<section class="card how" aria-label={howTitle}>
					<h2>{howTitle}</h2>
					<ol>
						{#each steps as s, i (s.title)}
							<li>
								<span class="ico">
									{#if s.icon === 'die'}
										<span class="die" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
									{:else}
										<Icon name={s.icon} size={15} />
									{/if}
								</span>
								<span class="n">{i + 1}</span>
								<b>{s.title}</b>
								<span class="t">{s.text}</span>
							</li>
						{/each}
					</ol>
				</section>

				<section class="card match" class:fit={vsFit} style:--vs-len={vsFit ? vsLen : undefined} aria-label="Start a match">
					<div class="versus">
						<span class="side" style:--tone={versus[0].tone}>{versus[0].label}</span>
						<span class="vs">vs</span>
						<span class="side" style:--tone={versus[1].tone}>{versus[1].label}</span>
					</div>
					<div class="facts">
						{#each facts as f (f)}<span>{f}</span>{/each}
					</div>
					<div class="ctas">
						<button type="button" class="play" disabled={leaving} onclick={onplay}>
							<Icon name="play" size={14} />
							{playLabel}
						</button>
						<button type="button" class="more" onclick={() => (learnOpen = true)}>Learn more</button>
					</div>
					{#if account === false}
						<p class="next">Next, sign in with Google or GitHub.</p>
					{/if}
				</section>

				<section class="card path" aria-label={path.title} style:--hot={path.tone}>
					<h2>{path.title}</h2>
					<ol>
						{#each path.steps as s, i (s.id)}
							<li class:held={path.lit.has(s.id)}><span class="n">{i + 1}</span>{s.name}</li>
						{/each}
					</ol>
				</section>
			</div>
		</main>
	</div>

	<Modal open={learnOpen} title={learn.title} size="lg" onclose={() => (learnOpen = false)}>
		<div class="learn">
			<p class="lede">{learn.lede}</p>

			<div class="wins">
				{#each learn.wins as w (w.label)}
					<div style:--tone={w.tone}>
						<b>{w.label}</b>
						<span>{w.text}</span>
					</div>
				{/each}
			</div>

			{#each learn.sections as s (s.title)}
				<h3>{s.title}</h3>
				{#if s.body}
					{@render s.body()}
				{:else if s.steps}
					<ol class="turn">
						{#each s.steps as step (step)}<li>{step}</li>{/each}
					</ol>
				{:else}
					<p>{s.text}</p>
				{/if}
			{/each}
		</div>

		{#snippet footer()}
			<div class="learn-foot">
				{#if rules}
					<a href={rules}>Read the full rules <Icon name="arrow-right" size={13} /></a>
				{/if}
				<button
					type="button"
					class="play"
					disabled={leaving}
					onclick={() => {
						learnOpen = false;
						onplay();
					}}
				>
					<Icon name="play" size={14} />
					{playLabel}
				</button>
			</div>
		{/snippet}
	</Modal>

	<Modal open={boardOpen} title="Leaderboard" size="md" onclose={() => (boardOpen = false)}>
		{#if leaders}
			<Standings {leaders} />
		{:else if loadingLeaders}
			<p class="soon">Loading…</p>
		{:else if standings}
			<p class="soon">The leaderboard isn't available right now.</p>
		{:else}
			<p class="soon">{name} doesn't have a leaderboard yet.</p>
		{/if}
	</Modal>
</div>

<style>
	/* ── The frame ────────────────────────────────────────────────────────────
	   One rounded console, a side column and a stage, after the reference the
	   screen was drawn from. Scoped CSS rather than utilities: almost every rule
	   here is a one-off shape, and a page of arbitrary-value classes is harder
	   to change than a stylesheet. */
	/* Always the game's night, whatever theme the host page is in. The core
	   tokens are pinned here because the Learn more dialog and every library
	   piece on this screen read them, and a showcase in its light theme would
	   otherwise put dark ink on these dark panels. */
	.ss {
		--bg: #06070b;
		--bg-elev: #0a0b10;
		--fg: #eef4f6;
		--fg-muted: #b9c5cc;
		--fg-dim: #97a3aa;
		--accent: #5eead4;
		--border: rgba(255, 255, 255, 0.08);
		--border-strong: rgba(255, 255, 255, 0.14);
		--panel: rgba(9, 18, 24, 0.86);
		--edge: color-mix(in srgb, var(--accent, #5eead4) 16%, transparent);
		--red: #fb7185;
		--blue: #38bdf8;
		/* Armornet Orange: `--palette-orange` as the dark theme sets it, the
		   orange armornet.io lights its headline with. */
		--orange: #fb923c;
		position: relative;
		min-height: 100%;
		padding: max(14px, var(--safe-t, 0px)) max(14px, var(--safe-r, 0px)) max(14px, var(--safe-b, 0px))
			max(14px, var(--safe-l, 0px));
		box-sizing: border-box;
		color: var(--fg, #e2e8f0);
	}
	.frame {
		display: grid;
		grid-template-columns: minmax(250px, 300px) 1fr;
		gap: 12px;
		height: calc(100dvh - 28px);
		min-height: 640px;
		padding: 12px;
		box-sizing: border-box;
		border-radius: 30px;
		background: rgba(4, 9, 13, 0.78);
		border: 1px solid var(--edge);
		box-shadow:
			0 30px 80px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.frame.solo {
		grid-template-columns: 1fr;
	}

	/* ── The side column: two panels, one above the other ───────────────── */
	.teams {
		display: grid;
		grid-template-rows: 1fr 1fr;
		gap: 12px;
		min-height: 0;
	}

	/* ── Stage ───────────────────────────────────────────────────────────── */
	.stage {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border-radius: 24px;
		background:
			radial-gradient(60% 60% at 46% 52%, rgba(94, 234, 212, 0.17), transparent 70%),
			linear-gradient(180deg, #0d2026 0%, #081419 60%, #061015 100%);
		border: 1px solid var(--edge);
	}
	.hero {
		position: absolute;
		inset: 56px 0 0 0;
	}
	/* A scene that fills the stage sits under the bar, and is shaded toward the
	   headline and the dock so the words over it stay readable. */
	.hero.bleed {
		inset: 0;
	}
	.hero.bleed::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(270deg, rgba(4, 9, 13, 0.62), transparent 55%),
			linear-gradient(0deg, rgba(4, 9, 13, 0.7), transparent 38%),
			linear-gradient(180deg, rgba(4, 9, 13, 0.45), transparent 16%);
	}
	@media (pointer: coarse) {
		.hero {
			pointer-events: none;
		}
	}

	.bar {
		position: absolute;
		z-index: 3;
		top: 12px;
		left: 12px;
		right: 12px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.mark,
	.pills,
	.titles {
		display: flex;
		align-items: center;
		height: 40px;
		border-radius: 999px;
		background: rgba(4, 10, 14, 0.72);
		border: 1px solid var(--edge);
		backdrop-filter: blur(6px);
	}
	.mark {
		gap: 8px;
		padding: 0 16px 0 12px;
		color: var(--accent, #5eead4);
	}
	.mark b {
		color: var(--fg, #e2e8f0);
		font-weight: 900;
		font-size: 0.85rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.titles {
		gap: 2px;
		margin-left: auto;
		padding: 0 4px;
	}
	.titles button {
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--fg-dim, #97a3aa);
		font: inherit;
		font-weight: 900;
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
	}
	.titles button:hover {
		color: var(--fg, #e2e8f0);
	}
	.titles button[aria-pressed='true'] {
		background: rgba(94, 234, 212, 0.14);
		color: var(--fg, #e2e8f0);
	}
	.pills {
		gap: 2px;
		padding: 0 4px;
	}
	.pills button,
	.pills a {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--fg-dim, #97a3aa);
		font: inherit;
		font-size: 0.78rem;
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
	}
	.pills button:hover,
	.pills a:hover {
		background: rgba(94, 234, 212, 0.1);
		color: var(--fg, #e2e8f0);
	}
	/* Italic capitals over the scene, as the reference sets its line. */
	.headline {
		position: absolute;
		z-index: 2;
		top: 28%;
		right: 36px;
		max-width: 52%;
		text-align: right;
		pointer-events: none;
	}
	/* Centred along the top, under the bar, and the scene shaded from the top
	   rather than from the right. Wide only: one column already sets the
	   headline in the flow, under the scene. */
	@media (min-width: 1000px) {
		.head-top .headline {
			top: 76px;
			left: 36px;
			right: 36px;
			max-width: none;
			text-align: center;
		}
		/* A centred headline over a Play card that is not reads as a mistake,
		   so the outer cards share their width and the middle one sits on the
		   stage's centre line. Breach's narrower right card stays as it is. */
		.head-top .dock {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr);
		}
		.head-top .hero.bleed::after {
			background:
				linear-gradient(180deg, rgba(4, 9, 13, 0.74), rgba(4, 9, 13, 0.4) 26%, transparent 44%),
				linear-gradient(0deg, rgba(4, 9, 13, 0.7), transparent 38%);
		}
	}
	/* One sentence a line: a break inside either one reads as four short
	   phrases instead of the two halves of the game. */
	h1 .line {
		display: block;
		white-space: nowrap;
	}
	h1 .line.accent {
		color: var(--orange);
	}
	/* Hidden, not absent, so each line keeps its final width while it types. */
	.ch.off {
		visibility: hidden;
	}
	/* Zero-width, so the caret moving never nudges a letter. */
	.caret {
		position: relative;
		display: inline-block;
		width: 0;
		height: 0.86em;
		vertical-align: -0.06em;
	}
	.caret::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0.05em;
		width: 0.07em;
		height: 100%;
		background: var(--accent, #5eead4);
		box-shadow: 0 0 10px var(--accent, #5eead4);
		animation: blink 0.9s steps(1) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	h1 {
		margin: 0 0 10px;
		font-size: calc(clamp(1.9rem, 3.5vw, 3.8rem) * var(--hl-k, 1));
		font-weight: 600;
		font-style: italic;
		line-height: 0.98;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: #eef4f6;
		text-shadow: 0 2px 30px rgba(0, 0, 0, 0.6);
	}
	/* The line that says what the game is FOR, so it is set as a badge rather
	   than a caption: a pill with a red-to-blue edge, a shield, and the point
	   itself lit. It lands after the headline has typed, and a light passes
	   over it once as it does. */
	.tag {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin: 4px 0 0;
		padding: 6px 16px 6px 6px;
		overflow: hidden;
		border: 1px solid transparent;
		border-radius: 999px;
		background:
			linear-gradient(rgba(5, 12, 16, 0.86), rgba(5, 12, 16, 0.86)) padding-box,
			linear-gradient(90deg, var(--red), #5eead4 50%, var(--blue)) border-box;
		box-shadow:
			0 0 26px rgba(94, 234, 212, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		font-size: 0.88rem;
		line-height: 1.3;
		text-align: left;
		color: var(--fg, #eef4f6);
		opacity: 0;
		transform: translateY(6px) scale(0.98);
		transition:
			opacity 0.6s ease,
			transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.tag.shown {
		opacity: 1;
		transform: none;
	}
	.tag :global(b) {
		font-weight: 800;
		background: linear-gradient(90deg, #5eead4, var(--blue));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.tag-ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(94, 234, 212, 0.14);
		color: var(--accent, #5eead4);
		box-shadow: 0 0 14px rgba(94, 234, 212, 0.35);
	}
	.tag::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.22) 50%, transparent 70%);
		transform: translateX(-120%);
		pointer-events: none;
	}
	.tag.shown::after {
		animation: shine 1.3s ease 0.35s 1 forwards;
	}
	@keyframes shine {
		to {
			transform: translateX(120%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tag.shown::after {
			animation: none;
		}
	}

	/* ── The dock: three cards along the bottom of the stage ───────────────── */
	.dock {
		position: absolute;
		z-index: 2;
		left: 14px;
		right: 14px;
		bottom: 14px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 0.8fr);
		gap: 12px;
		align-items: end;
	}
	.card {
		padding: 14px 16px;
		border-radius: 20px;
		background: rgba(5, 12, 16, 0.84);
		border: 1px solid var(--edge);
		backdrop-filter: blur(8px);
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
	}
	.card h2 {
		margin: 0 0 10px;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.card ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.how ol {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.how li {
		display: grid;
		grid-template-columns: 32px auto 1fr;
		align-items: center;
		column-gap: 8px;
		row-gap: 1px;
	}
	.how .ico {
		grid-row: 1 / 3;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--edge);
		color: var(--accent, #5eead4);
	}
	.how .n {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--accent, #5eead4);
		line-height: 1.5;
	}
	.how b {
		font-size: 0.74rem;
	}
	.how .t {
		grid-column: 2 / -1;
		font-size: 0.68rem;
		line-height: 1.35;
		color: var(--fg-dim, #97a3aa);
	}
	/* A five on a die, since the icon set has no dice. */
	.die {
		display: grid;
		grid-template-columns: repeat(3, 3px);
		grid-template-rows: repeat(3, 3px);
		gap: 2px;
		padding: 3px;
		border: 1.5px solid currentColor;
		border-radius: 4px;
	}
	.die i {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: currentColor;
	}
	.die i:nth-child(1) {
		grid-area: 1 / 1;
	}
	.die i:nth-child(2) {
		grid-area: 1 / 3;
	}
	.die i:nth-child(3) {
		grid-area: 2 / 2;
	}
	.die i:nth-child(4) {
		grid-area: 3 / 1;
	}
	.die i:nth-child(5) {
		grid-area: 3 / 3;
	}

	/* The match card is the one that matters, so it stands taller and carries
	   the notch the reference cuts into its middle card. */
	.match {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding-top: 18px;
		text-align: center;
		border-color: color-mix(in srgb, var(--accent, #5eead4) 30%, transparent);
	}
	.versus {
		display: flex;
		align-items: baseline;
		gap: 12px;
		font-size: 1.5rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.versus .side {
		color: var(--tone);
		text-shadow: 0 0 18px color-mix(in srgb, var(--tone) 50%, transparent);
	}
	.match.fit {
		container-type: inline-size;
	}
	.match.fit .versus {
		font-size: min(1.5rem, calc((100cqi - 28px) / (var(--vs-len) * 0.8)));
	}
	.vs {
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--fg-dim, #97a3aa);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 14px;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim, #97a3aa);
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		width: 100%;
	}
	.play,
	.more {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 46px;
		padding: 0 18px;
		border-radius: 999px;
		white-space: nowrap;
		font: inherit;
		font-size: 0.86rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.play {
		border: 0;
		background: linear-gradient(180deg, #ff8aa0, #f43f6e);
		color: #fff;
		box-shadow:
			0 8px 24px rgba(244, 63, 110, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
	}
	.play:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.play:disabled {
		opacity: 0.7;
		cursor: progress;
	}
	.more {
		border: 1px solid color-mix(in srgb, var(--accent, #5eead4) 40%, transparent);
		background: rgba(94, 234, 212, 0.06);
		color: var(--fg, #e2e8f0);
	}
	.more:hover {
		background: rgba(94, 234, 212, 0.14);
	}
	.next {
		margin: 0;
		font-size: 0.7rem;
		color: var(--fg-dim, #97a3aa);
	}

	.path ol {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.path li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.72rem;
		transition: color 0.4s ease;
	}
	.path li.held {
		color: var(--hot);
	}
	.path li.held .n {
		background: var(--hot);
		color: #fff;
	}
	.path .n {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--hot) 55%, transparent);
		color: var(--hot);
		font-family: var(--mono);
		font-size: 0.6rem;
	}

	/* ── Learn more ──────────────────────────────────────────────────────── */
	.learn {
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-size: 0.88rem;
		line-height: 1.5;
	}
	.learn p {
		margin: 0;
	}
	.lede {
		font-size: 0.95rem;
	}
	.learn h3 {
		margin: 6px 0 0;
		font-size: 0.85rem;
		font-weight: 800;
	}
	.wins {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.wins div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
		background: color-mix(in srgb, var(--tone) 7%, transparent);
	}
	.wins b {
		color: var(--tone);
	}
	.wins span {
		font-size: 0.8rem;
		color: var(--fg-dim, #97a3aa);
	}
	.turn {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.learn-foot {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
	}
	.learn-foot a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--accent, #5eead4);
		font-size: 0.82rem;
		text-decoration: none;
	}
	.learn-foot .play {
		flex: none;
		margin-left: auto;
	}

	/* ── Narrow: one column that scrolls ──────────────────────────────────────
	   Most visitors arrive from a post on a phone. The stage becomes the top of
	   a page — headline, scene, the Play card — and the sides and the rest
	   follow underneath. */
	@media (max-width: 999px) {
		/* The stage and the dock dissolve into the frame, so their pieces can be
		   ordered against the sides: scene, line, Play, the sides, then the
		   detail. The stage's light moves onto the frame with them. */
		.frame {
			display: flex;
			flex-direction: column;
			height: auto;
			min-height: 0;
			padding: 8px;
			border-radius: 24px;
			background:
				radial-gradient(90% 40% at 50% 18%, rgba(94, 234, 212, 0.16), transparent 70%),
				linear-gradient(180deg, #0d2026 0%, #081419 45%, #061015 100%);
		}
		.stage,
		.dock {
			display: contents;
		}
		.bar,
		.headline,
		.hero {
			position: relative;
			inset: auto;
		}
		.bar {
			order: 1;
			padding: 2px 2px 0;
		}
		.hero {
			order: 2;
			height: min(78vw, 460px);
			margin-top: -8px;
		}
		/* A scene with edges of its own is a framed picture on one column, not
		   a backdrop tucked under the bar. */
		.hero.bleed {
			margin-top: 2px;
			overflow: hidden;
			border-radius: 18px;
			border: 1px solid var(--edge);
		}
		.hero.bleed::after {
			background: linear-gradient(0deg, rgba(4, 9, 13, 0.4), transparent 30%);
		}
		.headline {
			order: 3;
			max-width: none;
			padding: 4px 8px 6px;
			text-align: left;
		}
		/* A screen centred wide stays centred on a phone, over its Play card. */
		.head-top .headline {
			text-align: center;
		}
		h1 {
			font-size: calc(min(3rem, 8.4vw) * var(--hl-kn, 1));
		}
		.match {
			order: 4;
		}
		.teams {
			order: 5;
			grid-template-rows: none;
			grid-template-columns: 1fr 1fr;
		}
		.how {
			order: 6;
		}
		.path {
			order: 7;
		}
		.pills {
			margin-left: auto;
		}
		.bar:has(.titles) .pills {
			margin-left: 0;
		}
	}
	@media (max-width: 640px) {
		.ss {
			padding: max(8px, var(--safe-t, 0px)) max(8px, var(--safe-r, 0px)) max(8px, var(--safe-b, 0px))
				max(8px, var(--safe-l, 0px));
		}
		.teams {
			grid-template-columns: 1fr;
		}
		.mark b {
			letter-spacing: 0.14em;
		}
		.bar.long .mark b {
			letter-spacing: 0.06em;
		}
		.play,
		.more {
			padding: 0 12px;
			font-size: 0.8rem;
		}
		.mark {
			padding: 0 12px 0 10px;
		}
		.pills button,
		.pills a {
			padding: 0 10px;
		}
		.wins {
			grid-template-columns: 1fr;
		}
		.learn-foot {
			flex-direction: column-reverse;
			align-items: stretch;
		}
		.learn-foot .play {
			margin-left: 0;
		}
	}
	/* The rulebook is a link in Learn more as well, so the bar can lose it
	   before it has to wrap; the leaderboard keeps its icon. */
	@media (max-width: 520px) {
		.pills .lbl {
			display: none;
		}
	}
	@media (max-width: 420px) {
		.pills a {
			display: none;
		}
	}
	/* A long name leaves no room for the words; Learn more on the Play card
	   opens the same dialog. */
	@media (max-width: 400px) {
		.bar.long .how-lbl {
			display: none;
		}
	}
	.soon {
		margin: 0;
		color: var(--fg-dim, #97a3aa);
	}

	/* ── Halloween ───────────────────────────────────────────────────────────
	   The office after hours (insider/halloween.ts) is lit by pumpkins and
	   candles and drapes its party in purple, so the frame takes those two in
	   place of the night's teal: Armornet Orange (`--palette-orange`) and
	   `--palette-purple`, as the dark theme sets them. The crest keeps its own
	   colour, and the sides keep theirs. Last, so it wins the rules above. */
	.ss.halloween {
		--accent: #fb923c;
		--edge: color-mix(in srgb, #fb923c 18%, transparent);
		--panel: rgba(18, 11, 22, 0.86);
		--purple: #a78bfa;
	}
	/* The scene reads its colours from the page; it is the game's map, drawn
	   as the game draws it, so it keeps the night's accent. */
	.halloween .mark,
	.halloween .hero {
		--accent: #5eead4;
	}
	.halloween .mark {
		color: #5eead4;
	}
	.halloween .stage {
		background:
			radial-gradient(60% 60% at 46% 52%, rgba(251, 146, 60, 0.14), transparent 70%),
			linear-gradient(180deg, #1c1022 0%, #120a17 60%, #0b0710 100%);
	}
	.halloween .card {
		background: rgba(16, 9, 18, 0.86);
	}
	.halloween .pills button:hover,
	.halloween .pills a:hover {
		background: rgba(251, 146, 60, 0.12);
	}
	.halloween .titles button[aria-pressed='true'] {
		background: rgba(251, 146, 60, 0.16);
	}
	.halloween .tag {
		background:
			linear-gradient(rgba(16, 9, 18, 0.88), rgba(16, 9, 18, 0.88)) padding-box,
			linear-gradient(90deg, #fb923c, #facc15 50%, var(--purple)) border-box;
		box-shadow:
			0 0 26px rgba(251, 146, 60, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}
	.halloween .tag :global(b) {
		background: linear-gradient(90deg, #fb923c, #facc15);
		-webkit-background-clip: text;
		background-clip: text;
	}
	.halloween .tag-ico {
		background: rgba(251, 146, 60, 0.14);
		box-shadow: 0 0 14px rgba(251, 146, 60, 0.35);
	}
	/* Play in pumpkin orange, light to full (`--palette-orange-l` to
	   `--palette-orange`), with dark ink: white on this orange is too faint to
	   read, and black on orange is the season's own pairing. Both Play buttons,
	   the card's and Learn more's. */
	.halloween .play {
		background: linear-gradient(180deg, #fdba74, #fb923c);
		color: #1a0b04;
		box-shadow:
			0 8px 24px rgba(251, 146, 60, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.halloween .more {
		background: rgba(251, 146, 60, 0.06);
	}
	.halloween .more:hover {
		background: rgba(251, 146, 60, 0.14);
	}
	@media (max-width: 999px) {
		.halloween .frame {
			background:
				radial-gradient(90% 40% at 50% 18%, rgba(251, 146, 60, 0.14), transparent 70%),
				linear-gradient(180deg, #1c1022 0%, #120a17 45%, #0b0710 100%);
		}
	}
</style>
