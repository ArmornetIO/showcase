<script lang="ts">
	// ── THE OUTFITTER ────────────────────────────────────────────────────────
	// The Locker and the Character Studio, merged — and the merge was blocked on
	// geometry, not on layout. The Locker could not turn its own model because
	// its hats were an SVG overlay that had no idea where the camera was; once
	// worn items became part of the figure (`$lib/character/wearables.ts`), the
	// studio's turntable and the shop's catalogue could finally be the same
	// screen.
	//
	// WHAT CHANGED FROM THE LOCKER, all three on purpose:
	//
	//   1. THE FIGURE IS THE SCREEN. Full stage height, always, in every
	//      category. The old shell spent two of its three columns on chrome and
	//      left the merchandise smaller on the shop than it was on the board.
	//
	//   2. NO LEFT RAIL. Categories moved into a filter in the header, which
	//      shows what is equipped in each — so the loadout is legible without
	//      opening anything, and the column it used to need is now figure.
	//
	//   3. ONE PANEL. The right-hand side lists the category and nothing else;
	//      the selected row carries its own detail and its own single action,
	//      instead of a third column describing what the second highlighted.
	//
	// ── API ──────────────────────────────────────────────────────────────────
	//   GET  /api/breach/outfitter
	//        → { balance_marks, callsign, entitlements: [item_key],
	//            loadout: { crown, brow, chest, trim } }
	//   POST /api/breach/outfitter/equip     { category, item_key } → { loadout }
	//   POST /api/breach/outfitter/purchase  { item_key } → { balance_marks, entitlements }
	//
	//   Grants are NOT an endpoint. An alpha reward is a row somebody else writes
	//   into `entitlements`, which is what makes "give the first hundred tables
	//   the crown" a backfill rather than a feature.
	import { CHARACTERS } from '$lib/character/characters.js';
	import { FRAMES, poseAt } from '$lib/character/poses.js';
	import type { Anchor } from '$lib/character/wearables.js';
	import { CATEGORIES, type Category, type Item } from './catalog.js';
	import { OutfitterState } from './outfitter.svelte.js';
	import ItemList from './ItemList.svelte';
	import Paint from './Paint.svelte';
	import Stage from './Stage.svelte';
	import CardStage from './CardStage.svelte';
	import CardPanel from './CardPanel.svelte';
	import { CardBench } from './cards.svelte.js';

	const fit = new OutfitterState();

	// ── Two benches, one shell ───────────────────────────────────────────────
	// The Outfitter already had everything a scene editor needs — a turntable, a
	// clip clock, a panel of knobs wired live to a model — and card art is the
	// same figures in the same renderer. So cards are a MODE here rather than a
	// fourth mockup that would have to grow its own copy of all of it.
	//
	// The state is separate (`CardBench`) because the two screens share the shell
	// and nothing else: a card has no loadout and a mannequin has no camera
	// window, and one merged store would give every knob a meaning it has to
	// document as "ignored in the other mode".
	const bench = new CardBench();
	let mode = $state<'figure' | 'cards'>('figure');

	/**
	 * How tall the surface may be.
	 *
	 * `100dvh` is wrong and `100%` does not resolve: the mockup mounts INSIDE the
	 * showcase's own chrome, so a viewport-height box overflows by exactly the
	 * height of that chrome — which pushed the stage deck off the bottom — while
	 * a percentage height against an auto-height parent collapses. So the surface
	 * measures where it actually starts and takes the rest. Hard-coding the
	 * chrome's height here would be a number that is wrong the first time
	 * somebody adds a row to it.
	 */
	let root = $state<HTMLElement | null>(null);
	let top = $state(0);
	$effect(() => {
		if (!root) return;
		const measure = () => (top = root!.getBoundingClientRect().top);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(document.documentElement);
		return () => ro.disconnect();
	});

	let menu = $state(false);
	let held = $state<Item | null>(null);

	// ── The clip ─────────────────────────────────────────────────────────────
	// Quantised to the clip's own frame count rather than run on a continuous
	// clock, because `art()` memoises on its whole signature: a pose evaluated
	// at a real-valued `t` misses the cache every tick and re-culls two hundred
	// facets sixty times a second for pictures it already drew. Twenty-four
	// frames is a loop that costs nothing after one pass round.
	//
	// SPEED CHANGES THE CLOCK, NOT THE POSE. Running it faster is a shorter
	// interval over the same twenty-four cached frames — so a run and a walk are
	// the same frames at different rates, and turning the speed up costs
	// nothing.
	let frame = $state(0);
	$effect(() => {
		if (fit.clip === 'still') return;
		const t = setInterval(() => (frame = (frame + 1) % FRAMES), 1000 / (12 * fit.speed));
		return () => clearInterval(t);
	});
	const pose = $derived(poseAt(fit.clip, frame / FRAMES, fit.clipOpts));

	const current = $derived(CATEGORIES.find((c) => c.key === fit.category));

	/** Where the held item would land — what the stage lights up, and the only
	 *  region that will accept the drop. */
	const heldAnchor = $derived(
		held && held.category !== 'trim' ? (held.category as Anchor) : null
	);

	function pickAnchor(a: Anchor) {
		fit.selectCategory(a as Category);
		menu = false;
	}

	function dropOn(a: Anchor) {
		if (held && held.category === a) {
			fit.preview(held.key);
			fit.act();
		}
		held = null;
	}

	function choose(c: Category) {
		fit.selectCategory(c);
		menu = false;
	}
</script>

<svelte:head><title>The Outfitter — mockup</title></svelte:head>

<div class="out" bind:this={root} style:--tone={fit.trim} style:height="calc(100dvh - {top}px)">
	<!-- ── Header ────────────────────────────────────────────────────────── -->
	<header class="head">
		<span class="wordmark">◈ THE OUTFITTER</span>

		<!-- Which bench. First control in the header because it decides what every
		     control after it means. -->
		<div class="mode">
			<button class:active={mode === 'figure'} onclick={() => (mode = 'figure')}>Figure</button>
			<button class:active={mode === 'cards'} onclick={() => (mode = 'cards')}>Cards</button>
		</div>

		<!-- The filter. It replaces a whole column, so it has to carry what that
		     column carried: which categories exist AND what is on in each. -->
		<div class="filter" hidden={mode === 'cards'}>
			<button class="drop" aria-expanded={menu} onclick={() => (menu = !menu)}>
				<b>{current?.label}</b>
				<span>{fit.equippedItem(fit.category)?.name ?? '—'}</span>
				<svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true">
					<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" />
				</svg>
			</button>

			{#if menu}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="sheet" role="menu">
					{#each CATEGORIES as c (c.key)}
						<button
							class="opt"
							class:active={c.key === fit.category}
							role="menuitem"
							onclick={() => choose(c.key)}
						>
							<b>{c.label}</b>
							<span>{fit.equippedItem(c.key)?.name ?? '—'}</span>
							<em>{c.hint}</em>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Paint, always on show. Colour was reachable only as the fourth entry
		     of the category menu, which is a control nobody finds: an item has a
		     picture in a list, a colour had a word in a dropdown. Four live
		     swatches are both the affordance and the read-out. -->
		<div class="paint">
			{#each fit.swatches as sw (sw.key)}
				<button
					class="sw"
					class:on={fit.category === 'trim' && fit.paintFocus === sw.key}
					style:background={sw.value}
					title="{sw.label} — {sw.value}"
					aria-label="Change {sw.label} colour"
					onclick={() => fit.openPaint(sw.key)}
				></button>
			{/each}
		</div>

		<label class="callsign">
			<span>Side</span>
			<input
				value={fit.callsign}
				oninput={(e) => (fit.callsign = e.currentTarget.value)}
				maxlength="22"
				spellcheck="false"
				aria-label="Side name"
			/>
		</label>

		<div class="end">
			<div class="who">
				{#each CHARACTERS as c (c.key)}
					<button
						class:active={fit.who.key === c.key}
						title={c.name}
						aria-label={c.name}
						onclick={() => (fit.who = c)}>{c.shape}</button
					>
				{/each}
			</div>

			<!-- A demo control, and the most load-bearing one here: an
			     owned-but-priced item only exists on a granted account, and there
			     is no other way to look at one. -->
			<div class="persona">
				<button class:active={fit.persona === 'new'} onclick={() => fit.setPersona('new')}>New</button>
				<button class:active={fit.persona === 'alpha'} onclick={() => fit.setPersona('alpha')}>Alpha</button>
			</div>

			<span class="wallet"><b>◈ {fit.balance.toLocaleString()}</b> marks</span>

			{#if fit.turned}<button class="link" onclick={() => fit.resetCamera()}>Recentre</button>{/if}
			{#if fit.dirty}<button class="link" onclick={() => fit.reset()}>Reset</button>{/if}
		</div>
	</header>

	<!-- ── Stage + panel. Two columns, and that is the whole layout. ──────── -->
	<div class="body">
		{#if mode === 'cards'}
			<CardStage {bench} />
			<CardPanel {bench} />
		{:else}
			<Stage {fit} {pose} dragging={heldAnchor} onpick={pickAnchor} ondrop={dropOn} />

			<!-- Colour is not a list of objects, so it does not get the list. One
			     panel, two shapes of content — which is still one panel. -->
			{#if fit.category === 'trim'}
				<Paint {fit} />
			{:else}
				<ItemList {fit} who={fit.skin} ondragitem={(i) => (held = i)} />
			{/if}
		{/if}
	</div>

	<p class="hint">
		{#if mode === 'cards'}
			Drag the card to turn the scene · pick a clip to play it · the cast is posed
			independently of whoever is standing in it
		{:else}
			Drag the model to turn it · click a part of it to jump there · drag an item onto it to wear it
		{/if}
	</p>
</div>

<style>
	.out {
		display: grid;
		grid-template-rows: auto 1fr auto;
		/* A DEFINITE height, set inline — see the comment on `top` above. The
		   figure's `<svg>` sizes itself from its viewBox when its parent's height
		   is indefinite, and this viewBox is a whole standing body, so at stage
		   width that resolved to several thousand pixels of head. */
		background: var(--bg);
		overflow: hidden;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 9px 14px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.wordmark {
		font-family: var(--mono);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		color: var(--tone);
	}

	.mode {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.mode button {
		padding: 4px 11px;
		border: 0;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		cursor: pointer;
	}
	.mode button.active {
		background: color-mix(in srgb, var(--tone) 18%, transparent);
		color: var(--fg);
	}

	.filter {
		position: relative;
	}
	.filter[hidden] {
		display: none;
	}
	.drop {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 5px 10px;
		border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
		border-radius: 3px;
		background: color-mix(in srgb, var(--tone) 10%, transparent);
		color: var(--fg);
		cursor: pointer;
	}
	.drop b {
		font-size: 0.74rem;
	}
	.drop span {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.sheet {
		position: absolute;
		z-index: 5;
		top: calc(100% + 4px);
		left: 0;
		width: 268px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--surface-raised);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.5);
	}
	.opt {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px 8px;
		width: 100%;
		padding: 6px 8px;
		border: 0;
		border-radius: 2px;
		background: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.opt:hover {
		background: color-mix(in srgb, var(--fg-dim) 10%, transparent);
	}
	.opt.active {
		background: color-mix(in srgb, var(--tone) 14%, transparent);
	}
	.opt b {
		font-size: 0.74rem;
	}
	.opt span {
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--tone);
	}
	.opt em {
		grid-column: 1 / -1;
		font-style: normal;
		font-size: 0.62rem;
		color: var(--fg-dim);
	}

	.paint {
		display: flex;
		gap: 3px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 3px;
	}
	.sw {
		width: 19px;
		height: 19px;
		border: 1px solid color-mix(in srgb, var(--fg-dim) 45%, transparent);
		border-radius: 2px;
		cursor: pointer;
	}
	.sw:hover {
		border-color: var(--fg);
	}
	.sw.on {
		outline: 2px solid var(--fg);
		outline-offset: 1px;
	}

	.callsign {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.callsign span {
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.callsign input {
		width: 150px;
		padding: 4px 7px;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: var(--bg);
		color: var(--fg);
		font-size: 0.74rem;
	}

	.end {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-left: auto;
	}
	.who,
	.persona {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.who button,
	.persona button {
		padding: 4px 8px;
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.who button.active,
	.persona button.active {
		background: color-mix(in srgb, var(--tone) 20%, transparent);
		color: var(--fg);
	}
	.wallet {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.wallet b {
		color: var(--tone);
	}
	.link {
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: underline;
		cursor: pointer;
	}

	/* The figure gets everything the panel does not. */
	.body {
		display: grid;
		grid-template-columns: 1fr 312px;
		min-height: 0;
		overflow: hidden;
	}

	.hint {
		margin: 0;
		padding: 6px 14px;
		border-top: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.53rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
</style>
