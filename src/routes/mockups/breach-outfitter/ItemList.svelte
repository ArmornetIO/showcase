<script lang="ts">
	// ── The panel ────────────────────────────────────────────────────────────
	// The ONE panel, and the whole right-hand side. Built on the icons page's
	// pattern rather than the Locker's: a list of the category's items where the
	// selected row carries its own detail and its own action, instead of a third
	// column that exists to describe whatever the second column highlighted.
	//
	// The swatch on each row is the REAL figure wearing that item, cropped to the
	// bust — not a separate thumbnail drawing of it. It costs nothing to be
	// honest here: `art()` memoises on the whole signature, so the row's little
	// figure and the big one on the stage share every cached frame they have in
	// common, and a row can never show a hat the stage would render differently.
	import Figure from '$lib/character/Figure.svelte';
	import type { CharacterSkin } from '$lib/character/characters.js';
	import type { Anchor } from '$lib/character/wearables.js';
	import { RARITY, type Item } from './catalog.js';
	import type { OutfitterState } from './outfitter.svelte.js';

	interface Props {
		fit: OutfitterState;
		who: CharacterSkin;
		ondragitem: (i: Item | null) => void;
	}
	let { fit, who, ondragitem }: Props = $props();

	/** Frame the row's figure on the part the row is about. Every crop the
	 *  component shipped with is a HEAD crop, so a list of chest emblems drawn at
	 *  `chip` is eleven identical heads with the item off the bottom of the
	 *  cell. */
	const focus = $derived(fit.category === 'trim' ? undefined : (fit.category as Anchor));

	/** What a row's figure wears: everything currently on, with this row's item
	 *  swapped into its own category. A row that showed the item alone would
	 *  show a hat on a bare head while the stage wears a visor. */
	const wornFor = (i: Item) =>
		i.wearable ? [...fit.worn.filter((k) => k !== fit.equippedItem(i.category)?.wearable), i.wearable] : fit.worn;
</script>

<div class="panel">
	<ul class="list">
		{#each fit.list as i (i.key)}
			{@const owned = fit.owns(i.key)}
			{@const on = fit.isEquipped(i.key)}
			{@const sel = fit.previewKey === i.key}
			<li>
				<div
					class="row"
					class:sel
					class:locked={!owned}
					style:--tone={RARITY[i.rarity].tone}
					draggable={owned}
					ondragstart={() => ondragitem(i)}
					ondragend={() => ondragitem(null)}
					role="presentation"
				>
					<button class="pick" onclick={() => fit.preview(i.key)}>
						<span class="swatch">
							{#if i.color}
								<span class="chip" style:background={i.color}></span>
							{:else}
								<Figure
									klass={who}
									{focus}
									art={{ yaw: 0.4, worn: wornFor(i), ...fit.paint }}
								/>
							{/if}
						</span>
						<span class="name">
							{i.name}
							{#if on}<em class="on">Worn</em>{/if}
						</span>
						<span class="tag">{RARITY[i.rarity].label}</span>
					</button>

					{#if sel}
						<div class="detail">
							{#if i.blurb}<p>{i.blurb}</p>{/if}
							{#if !owned && i.lock?.kind === 'reward'}
								<p class="grant"><b>{i.lock.label}</b> — {i.lock.note}</p>
							{/if}
							<div class="act">
								{#if on}
									<span class="state">Currently worn</span>
								{:else if owned}
									<button class="go" onclick={() => fit.act()}>Wear it</button>
								{:else if i.lock?.kind === 'price'}
									<button class="go" disabled={!fit.canAfford} onclick={() => fit.act()}>
										Buy · ◈ {i.lock.marks.toLocaleString()}
									</button>
									{#if !fit.canAfford}<span class="state">Not enough marks</span>{/if}
								{:else}
									<span class="state">Granted, not sold</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		border-left: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.list {
		margin: 0;
		padding: 6px;
		list-style: none;
		overflow-y: auto;
		min-height: 0;
	}
	.row {
		border: 1px solid transparent;
		border-radius: 3px;
		margin-bottom: 2px;
	}
	.row.sel {
		border-color: color-mix(in srgb, var(--tone) 55%, transparent);
		background: color-mix(in srgb, var(--tone) 9%, transparent);
	}
	.row[draggable='true'] {
		cursor: grab;
	}

	.pick {
		display: grid;
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 9px;
		width: 100%;
		padding: 5px 8px 5px 5px;
		border: 0;
		background: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:not(.sel) .pick:hover {
		background: color-mix(in srgb, var(--fg-dim) 8%, transparent);
	}

	.swatch {
		display: block;
		width: 34px;
		height: 34px;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
		line-height: 0;
	}
	.chip {
		display: block;
		width: 100%;
		height: 100%;
	}
	.locked .swatch {
		opacity: 0.45;
		filter: grayscale(0.8);
	}

	.name {
		font-size: 0.76rem;
		font-weight: 600;
	}
	.on {
		margin-left: 6px;
		font-family: var(--mono);
		font-size: 0.5rem;
		font-style: normal;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.tag {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--tone);
	}

	.detail {
		padding: 0 9px 9px 48px;
	}
	.detail p {
		margin: 0 0 6px;
		font-size: 0.68rem;
		line-height: 1.45;
		color: var(--fg-dim);
	}
	.grant b {
		color: var(--tone);
	}
	.act {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.go {
		padding: 4px 11px;
		border: 1px solid color-mix(in srgb, var(--tone) 60%, transparent);
		border-radius: 2px;
		background: color-mix(in srgb, var(--tone) 16%, transparent);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.go:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.state {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
</style>
