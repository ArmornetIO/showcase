<script lang="ts">
	// ── Buying marks ─────────────────────────────────────────────────────────
	// Opened from the marks pill, and only where this deployment sells marks.
	// Money buys marks and only marks; the payment page is the provider's, so
	// no card ever touches this dialog. Coming back is handled by the Lobby.
	import { Icon, Modal } from 'showcase';
	import { SIDE_TONE } from '../internal/badge.js';
	import type { Faction } from '../internal/rules.js';
	import type { OutfitterState } from './outfitter.svelte.js';

	interface Props {
		open: boolean;
		fit: OutfitterState;
		/** The side you play for, or none yet. The shop wears that side's color,
		 *  so a blue player buys in blue. */
		side?: Faction | null;
		onclose: () => void;
	}

	let { open, fit, side = null, onclose }: Props = $props();
	const accent = $derived(side ? SIDE_TONE[side] : fit.trim);

	let pick = $state(0);
	const sel = $derived(fit.packs[Math.min(pick, fit.packs.length - 1)]);
	const n = (v: number) => v.toLocaleString();
	/** Minor units to a price: 499 usd → "$4.99". */
	const money = (p: { amount: number; currency: string }) =>
		new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency.toUpperCase() }).format(
			p.amount / 100
		);
</script>

<Modal {open} size="lg" title="Get marks" {onclose}>
	<div class="shop" style:--trim={accent}>
		<!-- True of the catalogue: every item changes a look, none changes play. -->
		<p class="lede">Marks buy hats, eyewear and colors. Nothing you buy changes a roll, a cost or a target.</p>

		<div class="balance">
			<Icon name="credit-card" size={13} />
			You have <b>{n(fit.balance)}</b> marks
			{#if side}<span class="side">{side} side</span>{/if}
		</div>

		<div class="bundles" role="radiogroup" aria-label="Bundles">
			{#each fit.packs as p, i (p.code)}
				<button
					class="bundle"
					class:on={sel?.code === p.code}
					role="radio"
					aria-checked={sel?.code === p.code}
					onclick={() => (pick = i)}
				>
					<span class="coin"><Icon name="credit-card" size={18} /></span>
					<span class="amount">{n(p.marks)}</span>
					<span class="unit">marks</span>
					<span class="name">{p.name}</span>
					<span class="price">{money(p.price)}</span>
				</button>
			{/each}
		</div>

		{#if fit.notice}<p class="notice" role="status">{fit.notice}</p>{/if}

		<div class="actions">
			<button class="secondary" onclick={onclose}>Cancel</button>
			<button class="primary" disabled={!sel || fit.pending} onclick={() => sel && fit.buyMarks(sel.code)}>
				{#if sel}Buy {n(sel.marks)} marks · {money(sel.price)}{:else}Nothing for sale{/if}
			</button>
		</div>
	</div>
</Modal>

<style>
	.shop {
		display: grid;
		gap: 16px;
	}
	.lede {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}
	.balance {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.04em;
		color: var(--fg-dim);
	}
	.balance b {
		color: var(--trim);
		font-weight: 600;
	}

	/* Lit from above in the side's color: the clearest sign of whose shop
	   this is. */
	.bundles {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
		padding: 14px;
		margin: 0 -14px;
		border-radius: 6px;
		background: radial-gradient(
			ellipse 70% 90% at 50% 0%,
			color-mix(in srgb, var(--trim) 12%, transparent),
			transparent 75%
		);
		transition: background 200ms;
	}
	.side {
		padding: 1px 6px;
		border: 1px solid color-mix(in srgb, var(--trim) 45%, transparent);
		border-radius: 3px;
		color: var(--trim);
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	/* The item tile's shape, so a bundle reads as one more thing in the shop. */
	.bundle {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 3px;
		padding: 26px 8px 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: color-mix(in srgb, var(--bg) 60%, transparent);
		color: var(--fg);
		cursor: pointer;
		transition:
			border-color 120ms,
			background 120ms;
	}
	.bundle:hover {
		border-color: color-mix(in srgb, var(--trim) 60%, transparent);
	}
	.bundle.on {
		border-color: var(--trim);
		background: color-mix(in srgb, var(--trim) 10%, transparent);
	}
	.coin {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		margin-bottom: 4px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--trim) 14%, transparent);
		color: var(--trim);
	}
	.amount {
		font-family: var(--mono-display, var(--mono));
		font-size: 1.05rem;
		letter-spacing: 0.04em;
	}
	.unit,
	.name {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.name {
		color: var(--trim);
		text-align: center;
	}
	.price {
		margin-top: 8px;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 3px;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
	}
	.bundle.on .price {
		border-color: var(--trim);
	}

	.notice {
		margin: 0;
		font-size: 0.7rem;
		color: #f5b942;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 10px;
	}
	.actions button {
		padding: 11px 14px;
		border-radius: 4px;
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.secondary {
		border: 1px solid var(--border);
		background: none;
		color: var(--fg-dim);
	}
	.secondary:hover {
		color: var(--fg);
	}
	.primary {
		border: 1px solid var(--trim);
		background: color-mix(in srgb, var(--trim) 22%, transparent);
		color: var(--fg);
		font-weight: 600;
	}
	.primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--trim) 32%, transparent);
	}
	.primary:disabled {
		opacity: 0.5;
		cursor: progress;
	}

	@media (max-width: 639px) {
		.bundles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
