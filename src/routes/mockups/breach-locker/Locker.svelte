<script lang="ts">
	// ── THE LOCKER ───────────────────────────────────────────────────────────
	// Where a player dresses the two things they own: the figure they play, and
	// the cards they play it with.
	//
	// Built on the Theme Studio's bones — slot rail left, live preview centre,
	// detail rail right, one full-bleed <dialog> opened from an icon — because
	// that layout already solved this problem: choose from a set, see the choice
	// immediately, commit it in one place.
	//
	// TWO DIFFERENCES FROM THE STUDIO, both deliberate.
	//
	// 1. There is a BASE. The studio styles a component in the abstract; a
	//    locker dresses something specific. So each subject picks its base first
	//    — a character off the roster, a card out of the catalogue — and both are
	//    the real objects, rendered by the game's own `Figure` and `CardFace`.
	//    Cosmetics are layers on them and can only ever be layers, which is what
	//    makes "does this change the game" answerable without reading any code.
	//
	// 2. It previews the WHOLE TABLE, not the one item selected. A hat you can
	//    only see while shopping for hats is a hat nobody buys — what sells it is
	//    the flag still flying beside it and the hand behind that, all moving
	//    under the choice at once.
	import { ROSTER, catalogueFor } from '$examples/breach/internal/rules.js';
	import { bySlot, item, RARITY, slotsFor, SLOTS, SUBJECTS } from './catalog.js';
	import { LockerState } from './locker.svelte.js';
	import CardSkin from './CardSkin.svelte';
	import ItemGrid from './ItemGrid.svelte';
	import Mannequin from './Mannequin.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		locker: LockerState;
	}
	let { open, onclose, locker }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let flipped = $state(false);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	// Every derived read the stage needs, resolved once. `previewFor` swaps in
	// the browsed item for the active slot and the equipped one everywhere else.
	const banner = $derived(locker.previewFor('banner'));
	const tone = $derived(banner?.color ?? '#FB7185');
	const emblem = $derived(locker.previewFor('emblem'));
	const hat = $derived(locker.previewFor('headwear'));
	const back = $derived(locker.previewFor('cardback'));
	const frame = $derived(locker.previewFor('frame'));
	const finish = $derived(locker.previewFor('finish'));
	const stamp = $derived(locker.previewFor('killmark'));

	const sel = $derived(locker.selected);
	const owned = $derived(!!sel && locker.owns(sel.key));
	const equipped = $derived(!!sel && locker.isEquipped(sel.key));

	const rail = $derived(
		[...new Set(slotsFor(locker.subject).map((s) => s.group))].map((g) => ({
			group: g,
			slots: slotsFor(locker.subject).filter((s) => s.group === g)
		}))
	);

	// The base sets: the real roster, and the real cards this character brings.
	// A card list that ignored the character would offer cards the player has no
	// way to hold.
	const deck = $derived(catalogueFor(locker.klass.faction).slice(0, 10));

	const SWALLOW = 'polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)';

	function act() {
		if (!sel) return;
		if (owned) locker.equip(sel.key);
		else if (sel.lock?.kind === 'price') locker.buy(sel.key);
	}
</script>

<dialog
	class="lk"
	bind:this={dialogEl}
	aria-labelledby="lk-wordmark"
	onclose={onclose}
	onclick={(e) => {
		if (e.target === dialogEl) onclose();
	}}
>
	<div class="shell" style:--tone={tone}>
		<!-- ── Header ──────────────────────────────────────────────────────── -->
		<header class="head">
			<span class="wordmark" id="lk-wordmark">◈ THE LOCKER</span>

			<div class="subjects">
				{#each SUBJECTS as s (s.key)}
					<button
						class:active={locker.subject === s.key}
						aria-pressed={locker.subject === s.key}
						onclick={() => locker.selectSubject(s.key)}>{s.label}</button
					>
				{/each}
			</div>

			<label class="callsign">
				<span class="cs-label">Side</span>
				<input
					value={locker.callsign}
					oninput={(e) => (locker.callsign = e.currentTarget.value)}
					maxlength="22"
					spellcheck="false"
					aria-label="Side name"
				/>
			</label>

			<div class="head-end">
				<!-- A demo control, and the most load-bearing one on the page: an
				     owned-but-priced item only exists on a granted account, and
				     there is no other way to look at one. -->
				<div class="persona">
					<button class:active={locker.persona === 'new'} onclick={() => locker.setPersona('new')}
						>New</button
					>
					<button
						class:active={locker.persona === 'alpha'}
						onclick={() => locker.setPersona('alpha')}>Alpha</button
					>
				</div>

				<span class="wallet"><b>◈ {locker.balance.toLocaleString()}</b> marks</span>

				{#if locker.dirty}
					<button class="link" onclick={() => locker.reset()}>Reset</button>
				{/if}

				<button class="close" onclick={onclose} aria-label="Close">
					<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
						<path d="M1 1l9 9M10 1l-9 9" />
					</svg>
				</button>
			</div>
		</header>

		<div class="body">
			<!-- ── Slot rail ───────────────────────────────────────────────── -->
			<nav class="rail">
				{#each rail as g (g.group)}
					<div class="cat">{g.group}</div>
					{#each g.slots as s (s.key)}
						{@const eq = item(locker.equipped(s.key))}
						<button
							class="slot"
							class:active={locker.slot === s.key}
							aria-pressed={locker.slot === s.key}
							onclick={() => locker.selectSlot(s.key)}
						>
							<span class="slot-name">{s.label}</span>
							<span class="slot-eq">{eq?.name ?? '—'}</span>
						</button>
					{/each}
				{/each}
			</nav>

			<!-- ── Stage + grid ────────────────────────────────────────────── -->
			<div class="main">
				<div class="stage">
					{#if locker.subject === 'operator'}
						<div class="plinth">
							<Mannequin skin={locker.skin} {hat} color={tone} crop="hero" size={186} />
						</div>

						<div class="reads">
							<div class="read-label">At the table</div>

							<!-- Seat plate, as the hero stack draws it. -->
							<div class="seat" style:border-color="color-mix(in srgb, {tone} 45%, transparent)">
								<span
									class="flag"
									style:clip-path={SWALLOW}
									style:background="color-mix(in srgb, {tone} 24%, var(--bg))"
									style:box-shadow="inset 3px 0 0 0 {tone}"
								>
									<svg viewBox="0 0 24 24" width="15" height="15" style:color={tone} aria-hidden="true">
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html emblem?.art ?? ''}
									</svg>
								</span>
								<b style:color={tone}>{locker.callsign || 'Unnamed side'}</b>
								<span class="now">NOW</span>
							</div>

							<!-- The roster chip: the same figure at 30px, wearing the same
							     hat, because that is where three of four players will
							     actually see it. -->
							<div class="chiprow">
								{#each ROSTER.filter((k) => k.faction === locker.klass.faction).slice(0, 3) as k (k.key)}
									<span class="chip" class:me={k.key === locker.klassKey}>
										<Mannequin
											skin={k}
											hat={k.key === locker.klassKey ? hat : undefined}
											color={tone}
											crop="chip"
											size={30}
											opts={{ yaw: 0.15 }}
										/>
									</span>
								{/each}
								<span class="chip-note">roster, 30px</span>
							</div>

							<!-- The mark, in the only place it appears without a card. -->
							<div class="feed">
								{#each ['THE FORGE · breached', 'COLD STORE · held'] as row, i (i)}
									<div class="row">
										<svg viewBox="0 0 24 24" width="11" height="11" style:color={tone} aria-hidden="true">
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html stamp?.art ?? ''}
										</svg>
										<span>{row}</span>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<!-- The card stage: the real face, and the same card turned over,
						     side by side. Two states of one object rather than a toggle —
						     a back is bought to be seen next to a face, not instead of it. -->
						<div class="pair">
							<CardSkin
								ability={locker.ability}
								faction={locker.klass.faction}
								skills={locker.klass.skills}
								seatColor={tone}
								{frame}
								{finish}
								{stamp}
								{back}
								{emblem}
								faceDown={flipped}
							/>
							<CardSkin
								ability={locker.ability}
								faction={locker.klass.faction}
								skills={locker.klass.skills}
								seatColor={tone}
								{frame}
								{finish}
								{stamp}
								{back}
								{emblem}
								faceDown={!flipped}
								scale={0.82}
							/>
						</div>

						<div class="reads">
							<div class="read-label">Base card</div>
							<div class="basecard">
								<b>{locker.ability.name}</b>
								<p>{locker.ability.text}</p>
								<span class="printed"
									>{locker.ability.ap} AP · {locker.ability.kind} · {locker.ability.skill}</span
								>
							</div>
							<button class="flip" onclick={() => (flipped = !flipped)}>Turn over</button>

							<div class="feed">
								{#each ['THE FORGE · breached', 'COLD STORE · held'] as row, i (i)}
									<div class="row">
										<svg viewBox="0 0 24 24" width="11" height="11" style:color={tone} aria-hidden="true">
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html stamp?.art ?? ''}
										</svg>
										<span>{row}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- ── Base picker ─────────────────────────────────────────────
				     Under the stage and above the shop, which is the reading order:
				     this is what I have, THEN this is what I can put on it. -->
				<div class="bases">
					<span class="bases-label"
						>{locker.subject === 'operator' ? 'Character' : 'Card'}</span
					>
					<div class="bases-scroll">
						{#if locker.subject === 'operator'}
							{#each ROSTER as k (k.key)}
								<button
									class="base"
									class:active={locker.klassKey === k.key}
									style:--kc={k.color}
									onclick={() => (locker.klassKey = k.key)}
								>
									<span class="base-dot"></span>{k.name}
								</button>
							{/each}
						{:else}
							{#each deck as c (c.ability.key)}
								<button
									class="base"
									class:active={locker.cardKey === c.ability.key}
									style:--kc={tone}
									onclick={() => (locker.cardKey = c.ability.key)}
								>
									<span class="base-ap">{c.ability.ap}</span>{c.ability.name}
								</button>
							{/each}
						{/if}
					</div>
				</div>

				<ItemGrid
					items={bySlot(locker.slot)}
					{locker}
					color={tone}
					onpick={(k) => locker.preview(k)}
				/>
			</div>

			<!-- ── Detail rail ─────────────────────────────────────────────── -->
			<aside class="detail">
				{#if sel}
					<div class="d-rare" style:color={RARITY[sel.rarity].tone}>
						{RARITY[sel.rarity].label}
					</div>
					<h2>{sel.name}</h2>
					<p class="d-slot">{SLOTS.find((s) => s.key === sel.slot)?.hint}</p>

					{#if sel.blurb}
						<p class="d-blurb">{sel.blurb}</p>
					{/if}

					<div class="d-spacer"></div>

					{#if locker.justBought === sel.key}
						<div class="bought">Unlocked · equipped</div>
					{/if}

					{#if sel.lock}
						<!-- The price tag stays on an item you already own. It is what a
						     stranger would pay, and on a granted item it is the whole
						     reason the ribbon means anything. -->
						<div class="d-lock" class:held={owned}>
							{#if sel.lock.kind === 'reward'}
								<span class="d-lock-k" style:color={RARITY[sel.rarity].tone}>{sel.lock.label}</span>
								<span class="d-lock-n">{sel.lock.note}</span>
							{:else}
								<span class="d-lock-k">◈ {sel.lock.marks.toLocaleString()} marks</span>
								<span class="d-lock-n">{owned ? 'Already in your locker.' : 'Available now.'}</span>
							{/if}
						</div>
					{/if}

					<button
						class="commit"
						class:ghost={equipped || (!owned && sel.lock?.kind === 'reward')}
						disabled={equipped || (!owned && (sel.lock?.kind === 'reward' || !locker.canAfford))}
						onclick={act}
					>
						{#if equipped}
							Equipped
						{:else if owned}
							Equip
						{:else if sel.lock?.kind === 'reward'}
							Not for sale
						{:else if locker.canAfford}
							Unlock · ◈ {sel.lock?.kind === 'price' ? sel.lock.marks.toLocaleString() : ''}
						{:else}
							Not enough marks
						{/if}
					</button>
				{/if}
			</aside>
		</div>
	</div>
</dialog>

<style>
	.lk {
		position: fixed;
		inset: 4% 3%;
		width: auto;
		max-width: none;
		height: auto;
		max-height: none;
		padding: 0;
		background: var(--bg);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		box-shadow: 0 32px 80px -24px rgb(0 0 0 / 0.7);
		overflow: hidden;
		color: var(--fg);
	}
	.lk::backdrop {
		background: rgb(0 0 0 / 0.6);
		backdrop-filter: blur(4px);
	}

	.shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	/* ── Header ──────────────────────────────────────────────────────────── */
	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		height: 48px;
		padding: 0 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.wordmark {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.25em;
		color: var(--accent);
		flex-shrink: 0;
	}

	.subjects {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}
	.subjects button {
		padding: 5px 12px;
		font-size: 0.74rem;
		color: var(--fg-dim);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
	}
	.subjects button:hover {
		color: var(--fg);
	}
	.subjects button.active {
		color: var(--fg);
		background: var(--surface-strong);
		border-color: var(--border);
	}

	.callsign {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}
	.cs-label {
		font-family: var(--mono);
		font-size: 0.45rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.callsign input {
		width: min(220px, 100%);
		padding: 5px 9px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--tone);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.callsign input:focus {
		outline: none;
		border-color: var(--tone);
	}

	.head-end {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.persona {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}
	.persona button {
		padding: 4px 9px;
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.persona button.active {
		color: var(--fg);
		background: var(--surface-strong);
	}

	.wallet {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.wallet b {
		color: var(--fg);
	}

	.link {
		font-size: 0.7rem;
		color: var(--fg-dim);
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 2px;
	}
	.link:hover {
		color: var(--fg);
	}

	.close {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.close:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}

	/* ── Body ────────────────────────────────────────────────────────────── */
	.body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.rail {
		width: 156px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		overflow-y: auto;
		padding: 8px 0;
	}
	.cat {
		font-family: var(--mono);
		font-size: 0.45rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 12px 14px 5px;
	}
	.slot {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
		padding: 6px 14px;
		background: transparent;
		border: none;
		border-left: 2px solid transparent;
		cursor: pointer;
		text-align: left;
	}
	.slot:hover {
		background: var(--surface-raised);
	}
	.slot.active {
		background: var(--surface-strong);
		border-left-color: var(--accent);
	}
	.slot-name {
		font-size: 0.78rem;
		color: var(--fg-muted);
	}
	.slot.active .slot-name {
		color: var(--fg);
	}
	/* What is on right now, under the slot that would change it — so the rail
	   doubles as the loadout sheet and the screen needs no second summary. */
	.slot-eq {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* ── Stage ───────────────────────────────────────────────────────────── */
	.stage {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 34px;
		height: 232px;
		padding: 14px 28px;
		border-bottom: 1px solid var(--border);
		background:
			radial-gradient(120% 80% at 22% 100%, color-mix(in srgb, var(--tone) 12%, transparent), transparent 62%),
			var(--bg);
	}

	.plinth {
		flex-shrink: 0;
	}

	.pair {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-shrink: 0;
	}

	.reads {
		display: flex;
		flex-direction: column;
		gap: 9px;
		min-width: 0;
	}
	.read-label {
		font-family: var(--mono);
		font-size: 0.44rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.seat {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 11px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--surface-raised);
	}
	.seat b {
		font-size: 0.76rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.flag {
		display: grid;
		place-items: center;
		width: 22px;
		height: 16px;
		padding-right: 3px;
		flex-shrink: 0;
	}
	.now {
		font-family: var(--mono);
		font-size: 0.42rem;
		letter-spacing: 0.24em;
		color: var(--bg);
		background: var(--tone);
		padding: 2px 5px;
		border-radius: 2px;
	}

	.chiprow {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.chip {
		display: block;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
		background: var(--surface-raised);
		line-height: 0;
	}
	.chip.me {
		border-color: color-mix(in srgb, var(--tone) 60%, transparent);
	}
	.chip-note {
		font-family: var(--mono);
		font-size: 0.44rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.6;
	}

	.basecard {
		max-width: 330px;
	}
	.basecard b {
		display: block;
		font-size: 0.86rem;
		font-weight: 800;
	}
	.basecard p {
		margin: 3px 0 5px;
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--fg-dim);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.printed {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.flip {
		align-self: flex-start;
		padding: 4px 10px;
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-muted);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 3px;
		cursor: pointer;
	}
	.flip:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}

	.feed {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	/* ── Base picker ─────────────────────────────────────────────────────── */
	.bases {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 20px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.bases-label {
		font-family: var(--mono);
		font-size: 0.44rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		flex-shrink: 0;
	}
	.bases-scroll {
		display: flex;
		gap: 5px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.base {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 0.7rem;
		white-space: nowrap;
		color: var(--fg-dim);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		flex-shrink: 0;
	}
	.base:hover {
		color: var(--fg);
	}
	.base.active {
		color: var(--fg);
		border-color: var(--kc);
		background: color-mix(in srgb, var(--kc) 14%, transparent);
	}
	.base-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--kc);
	}
	.base-ap {
		display: grid;
		place-items: center;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		font-family: var(--mono);
		font-size: 0.52rem;
		font-weight: 900;
		color: var(--kc);
		border: 1px solid color-mix(in srgb, var(--kc) 55%, transparent);
	}

	/* ── Detail rail ─────────────────────────────────────────────────────── */
	.detail {
		width: 224px;
		flex-shrink: 0;
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 18px 16px 16px;
		overflow-y: auto;
	}
	.d-rare {
		font-family: var(--mono);
		font-size: 0.45rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}
	.detail h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		line-height: 1.2;
	}
	.d-slot {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.45;
		color: var(--fg-dim);
	}
	.d-blurb {
		margin: 6px 0 0;
		font-size: 0.72rem;
		line-height: 1.55;
		color: var(--fg-muted);
	}
	.d-spacer {
		flex: 1;
		min-height: 14px;
	}

	.bought {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--accent);
		padding-bottom: 4px;
	}

	.d-lock {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 9px 10px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface-raised);
		margin-bottom: 8px;
	}
	.d-lock.held {
		opacity: 0.55;
	}
	.d-lock-k {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg);
	}
	.d-lock-n {
		font-size: 0.66rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	.commit {
		width: 100%;
		padding: 11px;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bg);
		background: var(--tone);
		border: 1px solid var(--tone);
		border-radius: 3px;
		cursor: pointer;
	}
	.commit.ghost,
	.commit:disabled {
		color: var(--fg-dim);
		background: transparent;
		border-color: var(--border);
		cursor: default;
	}
</style>
