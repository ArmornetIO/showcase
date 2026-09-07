<script lang="ts">
	// ── BREACH · customisation, entered the way it will be entered ───────────
	// The locker is a modal opened from an icon in the board's right-hand rail,
	// so this page is the rail and the thing behind it: enough board to prove the
	// choice lands somewhere, and no more.
	//
	// Everything under the dialog is the REAL thing — the roster `Figure`, real
	// `CardFace`s printed from the catalogue — carrying the same loadout the
	// locker is editing. Close it and the table has changed. A customisation
	// screen that previews only inside itself is a screen you cannot tell is
	// working.
	//
	// ── API ──────────────────────────────────────────────────────────────────
	//   GET  /api/breach/locker
	//        → { balance_marks, callsign, entitlements: [item_key],
	//            loadout: { emblem, banner, headwear, cardback, frame, finish, killmark } }
	//   POST /api/breach/locker/equip     { slot, item_key }   → { loadout }
	//   POST /api/breach/locker/purchase  { item_key }         → { balance_marks, entitlements }
	//   POST /api/breach/locker/callsign  { callsign }         → { callsign }
	//
	//   Grants are NOT an endpoint on this route. An alpha reward is a row
	//   somebody else writes into `entitlements` — which is what makes "give the
	//   first hundred tables the crown" a backfill rather than a feature.
	import { catalogueFor } from '$examples/breach/internal/rules.js';
	import { item } from './catalog.js';
	import { LockerState } from './locker.svelte.js';
	import CardSkin from './CardSkin.svelte';
	import Locker from './Locker.svelte';
	import Mannequin from './Mannequin.svelte';

	const locker = new LockerState();
	let open = $state(true);

	const tone = $derived(item(locker.equipped('banner'))?.color ?? '#FB7185');
	const emblem = $derived(locker.itemAt('emblem'));
	const hat = $derived(locker.itemAt('headwear'));
	const back = $derived(locker.itemAt('cardback'));
	const frame = $derived(locker.itemAt('frame'));
	const finish = $derived(locker.itemAt('finish'));
	const stamp = $derived(locker.itemAt('killmark'));

	// A real hand: four cards this character actually brings.
	const hand = $derived(catalogueFor(locker.klass.faction).slice(0, 4));

	const SWALLOW = 'polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)';

	// The rail as it stands in the game today, with one new stop on it. The other
	// two are drawn inert on purpose — a rail with a single icon in it does not
	// show whether the locker earned its place.
	const RAIL = [
		{ key: 'rules', label: 'Rulebook', d: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3Z' },
		{ key: 'watch', label: 'Spectate', d: 'M2.5 12S6.5 6 12 6s9.5 6 9.5 6-4 6-9.5 6-9.5-6-9.5-6Z' },
		{ key: 'locker', label: 'The Locker', d: 'M12 2 21 6.5v6c0 5-3.9 8.4-9 9.5-5.1-1.1-9-4.5-9-9.5v-6Z' }
	];
</script>

<div class="board" style:--tone={tone}>
	<div class="felt"></div>

	<div class="seat">
		<span
			class="flag"
			style:clip-path={SWALLOW}
			style:background="color-mix(in srgb, {tone} 24%, var(--bg))"
			style:box-shadow="inset 3px 0 0 0 {tone}"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" style:color={tone} aria-hidden="true">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html emblem?.art ?? ''}
			</svg>
		</span>
		<b style:color={tone}>{locker.callsign || 'Unnamed side'}</b>
		<span class="seat-fig">
			<Mannequin skin={locker.skin} {hat} color={tone} crop="bust" size={34} opts={{ yaw: 0.15 }} />
		</span>
	</div>

	<div class="hero">
		<Mannequin skin={locker.skin} {hat} color={tone} crop="hero" size={230} />
	</div>

	<div class="fan">
		{#each hand as c, i (c.ability.key)}
			<span class="held" style:--rot="{(i - 1.5) * 7}deg" style:--lift="{Math.abs(i - 1.5) * 9}px">
				<CardSkin
					ability={c.ability}
					faction={locker.klass.faction}
					skills={locker.klass.skills}
					seatColor={tone}
					{frame}
					{finish}
					{stamp}
					{back}
					{emblem}
					stamped={false}
					scale={0.9}
				/>
			</span>
		{/each}
	</div>

	<nav class="rail" aria-label="Board tools">
		{#each RAIL as r (r.key)}
			<button
				class="icon"
				class:live={r.key === 'locker'}
				title={r.label}
				aria-label={r.label}
				disabled={r.key !== 'locker'}
				onclick={() => (open = true)}
			>
				<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
					<path d={r.d} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
				</svg>
			</button>
		{/each}
	</nav>

	{#if !open}
		<p class="hint">↑ the shield opens the locker</p>
	{/if}
</div>

<Locker {open} {locker} onclose={() => (open = false)} />

<style>
	.board {
		position: relative;
		height: 100%;
		min-height: 640px;
		overflow: hidden;
		background: var(--bg);
	}

	.felt {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(70% 50% at 50% 108%, color-mix(in srgb, var(--tone) 16%, transparent), transparent 70%),
			radial-gradient(50% 40% at 50% 30%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%);
	}

	.seat {
		position: absolute;
		top: 22px;
		left: 22px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 12px 7px 10px;
		border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
		border-radius: 3px;
		background: var(--surface-raised);
	}
	.seat b {
		font-size: 0.82rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.flag {
		display: grid;
		place-items: center;
		width: 24px;
		height: 18px;
		padding-right: 3px;
	}
	.seat-fig {
		display: block;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
		line-height: 0;
	}

	/* The figure stands where the dais is, which is also where the dialog covers
	   it — on purpose. Closing the locker is what reveals it. */
	.hero {
		position: absolute;
		left: 50%;
		bottom: 210px;
		transform: translateX(-50%);
	}

	.fan {
		position: absolute;
		left: 50%;
		bottom: 10px;
		transform: translateX(-50%);
		display: flex;
		align-items: flex-end;
		gap: 6px;
	}
	.held {
		display: block;
		transform: rotate(var(--rot)) translateY(var(--lift));
		transform-origin: 50% 120%;
	}

	.rail {
		position: absolute;
		top: 22px;
		right: 22px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--surface-raised);
		color: var(--fg-dim);
		cursor: pointer;
	}
	.icon:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.icon.live {
		color: var(--tone);
		border-color: color-mix(in srgb, var(--tone) 55%, transparent);
	}
	.icon.live:hover {
		background: color-mix(in srgb, var(--tone) 14%, var(--surface-raised));
	}

	.hint {
		position: absolute;
		/* Clears the rail rather than running underneath it — three icons is
		   118px, and the arrow has to point at the bottom one. */
		top: 152px;
		right: 22px;
		margin: 0;
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
</style>
