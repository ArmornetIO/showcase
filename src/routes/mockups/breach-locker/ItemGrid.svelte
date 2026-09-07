<script lang="ts">
	// The picker itself — every item in one slot, as tiles.
	//
	// A locked tile is drawn, not hidden. A locker that only shows what you own
	// is a settings page; the empty frames are the reason anybody opens this
	// screen twice, and they are also the only honest way to say "there is more
	// of this" before a store exists to say it.
	//
	// Every tile draws the item ON ITS BASE, using the same components the stage
	// does: a hat on the real `Figure`, a frame on the real `CardFace`. A grid of
	// items floating on their own is a grid you have to imagine your way out of,
	// and imagination is what a preview exists to remove.
	//
	// It takes the whole `LockerState` rather than a dozen props, because every
	// tile needs the OTHER equipped layers to compose a base — a frame tile has
	// to show the frame over the card you actually play, with the finish you
	// actually own on it.
	import { RARITY, type CosmeticItem } from './catalog.js';
	import type { LockerState } from './locker.svelte.js';
	import CardSkin from './CardSkin.svelte';
	import Mannequin from './Mannequin.svelte';

	interface Props {
		items: CosmeticItem[];
		locker: LockerState;
		/** The banner colour everything else is drawn in. */
		color: string;
		onpick: (key: string) => void;
	}

	let { items, locker, color, onpick }: Props = $props();

	const SWALLOW = 'polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)';
	const MINI = 0.4;

	/** The card layers for a tile: whatever is equipped, with THIS item swapped
	 *  into its own slot. */
	function layers(it: CosmeticItem) {
		const at = (slot: string) =>
			it.slot === slot ? it : locker.itemAt(slot as CosmeticItem['slot']);
		return {
			frame: at('frame'),
			finish: at('finish'),
			back: at('cardback'),
			stamp: at('killmark'),
			emblem: at('emblem')
		};
	}
</script>

<div class="grid" role="listbox" aria-label="items">
	{#each items as it (it.key)}
		{@const owned = locker.owns(it.key)}
		{@const on = locker.isEquipped(it.key)}
		{@const tint = it.slot === 'banner' ? (it.color ?? color) : color}
		{@const l = layers(it)}
		<button
			type="button"
			role="option"
			aria-selected={locker.previewKey === it.key}
			class="tile"
			class:sel={locker.previewKey === it.key}
			class:on
			class:locked={!owned}
			style:--rare={RARITY[it.rarity].tone}
			onclick={() => onpick(it.key)}
		>
			<span class="art" style:color={tint}>
				{#if it.slot === 'emblem'}
					<span
						class="flag"
						style:clip-path={SWALLOW}
						style:background="color-mix(in srgb, {tint} 22%, var(--bg))"
						style:box-shadow="inset 3px 0 0 0 {tint}"
					>
						<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html it.art ?? ''}
						</svg>
					</span>
				{:else if it.slot === 'banner'}
					<span class="chip" style:background={it.color}></span>
				{:else if it.slot === 'headwear'}
					<Mannequin
						skin={locker.skin}
						hat={it}
						color={tint}
						crop="bust"
						size={74}
						opts={{ yaw: 0.15 }}
					/>
				{:else if it.slot === 'killmark'}
					<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html it.art ?? ''}
					</svg>
				{:else}
					<!-- Card slots: the real face, at 40%, wearing this item. -->
					<CardSkin
						ability={locker.ability}
						faction={locker.klass.faction}
						skills={locker.klass.skills}
						seatColor={color}
						frame={l.frame}
						finish={l.finish}
						stamp={l.stamp}
						back={l.back}
						emblem={l.emblem}
						faceDown={it.slot === 'cardback'}
						stamped={false}
						scale={MINI}
					/>
				{/if}
			</span>

			<span class="name">{it.name}</span>

			<span class="foot">
				{#if on}
					<span class="badge equipped">Equipped</span>
				{:else if owned}
					<span class="badge rare">{RARITY[it.rarity].label}</span>
				{:else if it.lock?.kind === 'price'}
					<span class="price">◈ {it.lock.marks.toLocaleString()}</span>
				{:else if it.lock?.kind === 'reward'}
					<span class="badge rare">{it.lock.label}</span>
				{/if}
			</span>

			{#if !owned}
				<span class="lock" aria-label="Locked">
					<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
						<path
							d="M7 10V7a5 5 0 0 1 10 0v3"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
						/>
						<rect x="4.5" y="10" width="15" height="10" rx="2.5" fill="currentColor" />
					</svg>
				</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 8px;
		padding: 16px 20px 24px;
		overflow-y: auto;
		align-content: start;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		padding: 12px 8px 9px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 6px;
		cursor: pointer;
		transition:
			border-color 0.12s,
			background 0.12s,
			transform 0.12s;
	}
	.tile:hover {
		border-color: var(--border-strong);
		transform: translateY(-2px);
	}
	/* Selection is the ring; being EQUIPPED is the rail along the bottom. Two
	   states that co-occur constantly, so they cannot both be "the border goes
	   bright". */
	.tile.sel {
		border-color: var(--accent);
		background: var(--surface-strong);
	}
	.tile.on::before {
		content: '';
		position: absolute;
		inset: auto 0 0 0;
		height: 2px;
		background: var(--accent);
		border-radius: 0 0 5px 5px;
	}
	.tile.locked .art {
		opacity: 0.42;
		filter: grayscale(0.85);
	}

	.art {
		height: 78px;
		display: grid;
		place-items: center;
	}

	.flag {
		display: grid;
		place-items: center;
		width: 54px;
		height: 40px;
		padding-right: 7px;
	}

	.chip {
		display: block;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25);
	}

	.name {
		font-size: 0.68rem;
		color: var(--fg-muted);
		text-align: center;
		line-height: 1.2;
	}
	.tile.sel .name {
		color: var(--fg);
	}

	.foot {
		min-height: 13px;
		display: flex;
		align-items: center;
	}

	.badge {
		font-family: var(--mono);
		font-size: 0.44rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}
	.badge.rare {
		color: var(--rare);
	}
	.badge.equipped {
		color: var(--accent);
	}

	.price {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
	}

	.lock {
		position: absolute;
		top: 6px;
		right: 6px;
		color: var(--fg-dim);
		line-height: 0;
	}
</style>
