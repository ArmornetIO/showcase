<script lang="ts">
	// ── BREACH · the deck, printed ───────────────────────────────────────────
	// Every card in the game, as the game draws it. There was no such page: the
	// only way to look at a `CardFace` was to deal yourself one in a match, which
	// means the one surface a player spends the whole game reading was the one
	// surface nobody could review a change to.
	//
	// It is the REAL component printed from the REAL generated catalogue, so this
	// page cannot drift: a card added to `internal/breach/cards.yaml` and pushed
	// through `make breachgen` appears here on the next reload with nothing to
	// update. A gallery that retyped the cards would be a second deck.
	//
	// It also wears the locker's layers, which is the other reason it exists. A
	// frame and a finish look fine on the one card you were browsing; the
	// question that decides whether they ship is whether they look fine on
	// FORTY, next to each other, at the size a hand is actually read at.
	import { CATALOGUE, ROSTER, klassByKey } from '$examples/breach/internal/rules.js';
	import type { Faction } from '$examples/breach/internal/rules.js';
	import { item, bySlot, DEFAULT_LOADOUT } from '../breach-locker/catalog.js';
	import CardSkin from '../breach-locker/CardSkin.svelte';
	import CardFace from '$examples/breach/cards/CardFace.svelte';
	import { fxFor } from '$examples/breach/internal/fx.js';

	// The face as the game deals it, or the same face wearing the locker's
	// cosmetics. Two views of ONE component now that the scene face has replaced
	// the icon one in the game — a frame and a finish are judged against the art
	// they sit over, and the art is what changed.
	let face = $state<'bare' | 'dressed'>('bare');

	let side = $state<Faction>('red');
	let owner = $state<string>('all');
	let faceDown = $state(false);
	let scale = $state(1);

	// Which card is on the table. A gallery that could only show cards being READ
	// could not review the half of a face that only exists once it is PLAYED —
	// `sleeper` is a picture of nothing at all until then. One at a time, because
	// what is being judged is a card standing out from the ones beside it.
	//
	// Two ways in, and they are not redundant. HOVER is the reviewing gesture:
	// moving across a wall of forty and watching each one go off costs no clicks
	// and is the only way to compare the play states at speed. CLICK pins one, so
	// a state you want to sit and look at survives the pointer leaving — which
	// hover alone cannot do, and which is exactly what you need to screenshot one
	// or to read it next to its neighbour.
	let pinned = $state<string | null>(null);
	let hovered = $state<string | null>(null);
	const isPlayed = (id: string) => pinned === id || hovered === id;

	// The layers, picked straight off the catalogue — this page is the viewer for
	// them, so it has no loadout of its own to keep in step.
	let frameKey = $state(DEFAULT_LOADOUT.frame);
	let finishKey = $state(DEFAULT_LOADOUT.finish);
	let backKey = $state(DEFAULT_LOADOUT.cardback);
	let stampKey = $state(DEFAULT_LOADOUT.killmark);
	let emblemKey = $state(DEFAULT_LOADOUT.emblem);
	let tone = $state('#FB7185');

	const owners = $derived([
		'all',
		...new Set(CATALOGUE.filter((c) => c.side === side).map((c) => c.owner))
	]);

	// The deck, and only the deck. A signature is never dealt and never held — it
	// is a button on the character sheet — so printing one here would invent a
	// card the game does not have.
	const cards = $derived(
		CATALOGUE.filter((c) => c.side === side && (owner === 'all' || c.owner === owner))
	);

	// The seat whose skills the faces are printed with. The same card is a
	// different card in another seat — the modifier in the middle of the face is
	// that difference — so a gallery has to say whose hand this is.
	const seat = $derived(klassByKey(owner === 'all' ? ROSTER.find((k) => k.faction === side)!.key : owner));

	const SIDES: { key: Faction; label: string }[] = [
		{ key: 'red', label: 'Red' },
		{ key: 'blue', label: 'Blue' }
	];
</script>

<div class="page">
	<header>
		<div class="title">
			<h1>The deck</h1>
			<p>
				{cards.length} cards · printed by the game’s own <code>CardFace</code>, from the generated
				catalogue. Wearing the locker’s layers.
			</p>
		</div>

		<div class="controls">
			<div class="seg">
				{#each SIDES as s (s.key)}
					<button
						class:active={side === s.key}
						onclick={() => {
							side = s.key;
							owner = 'all';
							tone = s.key === 'red' ? '#FB7185' : '#38BDF8';
						}}>{s.label}</button
					>
				{/each}
			</div>

			<div class="seg">
				<button class:active={face === 'bare'} onclick={() => (face = 'bare')}>Bare</button>
				<button class:active={face === 'dressed'} onclick={() => (face = 'dressed')}
					>Dressed</button
				>
			</div>

			<select bind:value={owner} aria-label="Character">
				{#each owners as o (o)}
					<option value={o}>{o === 'all' ? 'All characters' : klassByKey(o).name}</option>
				{/each}
			</select>

			<select bind:value={frameKey} aria-label="Frame">
				{#each bySlot('frame') as i (i.key)}<option value={i.key}>{i.name}</option>{/each}
			</select>
			<select bind:value={finishKey} aria-label="Finish">
				{#each bySlot('finish') as i (i.key)}<option value={i.key}>{i.name}</option>{/each}
			</select>
			<select bind:value={backKey} aria-label="Card back">
				{#each bySlot('cardback') as i (i.key)}<option value={i.key}>{i.name}</option>{/each}
			</select>

			<label class="zoom">
				<span>Size</span>
				<input type="range" min="0.55" max="1.25" step="0.05" bind:value={scale} />
			</label>

			<button class="flip" onclick={() => (faceDown = !faceDown)}>
				{faceDown ? 'Face up' : 'Turn over'}
			</button>
		</div>
	</header>

	<div class="deck" style:--gap="{Math.round(18 * scale)}px">
		{#each cards as c (c.ability.key + c.owner)}
			{@const id = c.ability.key + c.owner}
			<figure>
				{#if face === 'bare'}
					<!-- The whole card is the button. A separate "play" control beside
					     each face would be forty controls in a wall of forty cards, and
					     the thing being reviewed is the card, not the chrome round it. -->
					<button
						class="play"
						aria-pressed={pinned === id}
						title="Play {c.ability.name}"
						onclick={() => (pinned = pinned === id ? null : id)}
						onpointerenter={() => (hovered = id)}
						onpointerleave={() => (hovered = hovered === id ? null : hovered)}
						onfocus={() => (hovered = id)}
						onblur={() => (hovered = hovered === id ? null : hovered)}
					>
						<CardFace
							ability={c.ability}
							fx={fxFor(c.ability.key, side)}
							owner={klassByKey(c.owner)}
							skillMod={seat.skills[c.ability.skill]}
							played={isPlayed(id)}
							raised={isPlayed(id)}
							{scale}
						/>
					</button>
				{:else}
					<CardSkin
						ability={c.ability}
						faction={side}
						skills={seat.skills}
						owner={klassByKey(c.owner)}
						seatColor={tone}
						frame={item(frameKey)}
						finish={item(finishKey)}
						stamp={item(stampKey)}
						back={item(backKey)}
						emblem={item(emblemKey)}
						{faceDown}
						stamped={false}
						{scale}
					/>
				{/if}
				<figcaption>
					<b>{c.ability.name}</b>
					<span>{klassByKey(c.owner).name} · ×{c.copies}</span>
				</figcaption>
			</figure>
		{/each}
	</div>
</div>

<style>
	.page {
		padding: 26px 28px 60px;
	}

	header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 22px;
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 800;
	}
	.title p {
		margin: 5px 0 0;
		font-size: 0.78rem;
		color: var(--fg-dim);
		max-width: 46ch;
	}
	code {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-muted);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.seg {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}
	.seg button {
		padding: 5px 12px;
		font-size: 0.72rem;
		color: var(--fg-dim);
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.seg button.active {
		color: var(--fg);
		background: var(--surface-strong);
	}

	select,
	.flip {
		padding: 5px 9px;
		font-size: 0.72rem;
		color: var(--fg-muted);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
	}
	select:focus,
	.flip:hover {
		color: var(--fg);
		outline: none;
		border-color: var(--border-strong);
	}

	.zoom {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.zoom span {
		font-family: var(--mono);
		font-size: 0.48rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.zoom input {
		width: 84px;
		accent-color: var(--accent);
	}

	.deck {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap);
	}
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	/* No chrome of its own — the card already has a border, a radius and a lift,
	   and a button drawn round one is a second frame arguing with the first. */
	.play {
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		line-height: 0;
		border-radius: 12px;
	}
	.play:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	figcaption {
		display: flex;
		flex-direction: column;
		gap: 1px;
		max-width: 136px;
	}
	figcaption b {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--fg-muted);
		line-height: 1.25;
	}
	figcaption span {
		font-family: var(--mono);
		font-size: 0.48rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
</style>
