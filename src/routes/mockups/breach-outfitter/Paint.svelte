<script lang="ts">
	// ── Paint ────────────────────────────────────────────────────────────────
	// Every colour on the figure, at two altitudes.
	//
	// MATERIALS are the broadcast: move Suit and every suit-material mass moves
	// together. That is what you want when you are dressing a squad, and it is
	// the Character Studio's original panel, unchanged.
	//
	// PARTS are the exception to it: one boot, one hat, the visor. This is the
	// half that was missing — the first cut of this panel had four global
	// materials and called itself complete, which it was, in the sense that it
	// covered every painted FACE. It did not cover every painted THING, and
	// "make the hat red without making the boots red" was unreachable.
	//
	// The list is derived, never written down: body masses come from
	// `BODY_PARTS` filtered to the ones this build actually has, and worn rows
	// come from the live loadout. So a new hat is paintable the moment it is
	// worn, and a drone is not offered boots it does not have.
	import { DEFAULT_ART } from '$lib/character/render.js';
	import { inCategory, RARITY } from './catalog.js';
	import type { OutfitterState } from './outfitter.svelte.js';

	interface Props {
		fit: OutfitterState;
	}
	let { fit }: Props = $props();

	/** Colour inputs cannot hold "unset" — they are always some hex. So a row
	 *  shows the RESOLVED colour while the state keeps the override absent, and
	 *  the reset link is what removes it again. Seeding the input's value into
	 *  state on mount would silently pin every colour the moment the panel
	 *  opened, which is an override nobody asked for. */
	const materials = $derived([
		{
			key: 'suit',
			label: 'Suit',
			hint: 'The body, shared by all four characters. Keep it neutral — the moment the suit competes with the plate, four figures stop reading as one squad.',
			value: fit.suit,
			set: (v: string) => { fit.suit = v; },
			clear: fit.suit !== DEFAULT_ART.suit ? () => { fit.suit = DEFAULT_ART.suit; } : null
		},
		{
			key: 'plate',
			label: 'Plate',
			hint: 'Boots, chest, pauldrons, hood. The character’s identity — the only hue on the body.',
			value: fit.plate ?? fit.who.color,
			set: (v: string) => { fit.plate = v; },
			clear: fit.plate ? () => { fit.plate = null; } : null
		},
		{
			key: 'lamp',
			label: 'Visor',
			hint: 'The one bright face. Follows the plate unless you say otherwise — a light source is the only thing on the model not being lit by something else.',
			value: fit.lamp ?? fit.plate ?? fit.who.color,
			set: (v: string) => { fit.lamp = v; },
			clear: fit.lamp ? () => { fit.lamp = null; } : null
		}
	]);

	const body = $derived(fit.paintables.filter((p) => p.group === 'body'));
	const worn = $derived(fit.paintables.filter((p) => p.group === 'worn'));
	const swag = $derived(inCategory('trim'));
</script>

<div class="panel">
	<div class="scroll">
		<!-- ── Materials ───────────────────────────────────────────────────── -->
		<h3>Materials <em>everything of that kind, at once</em></h3>
		{#each materials as m (m.key)}
			<div class="row">
				<label>
					<input
						type="color"
						value={m.value}
						oninput={(e) => m.set(e.currentTarget.value)}
						aria-label={m.label}
					/>
					<span class="name">{m.label}</span>
					<code>{m.value}</code>
				</label>
				<p class="hint">{m.hint}</p>
				{#if m.clear}<button class="link" onclick={m.clear}>Reset</button>{/if}
			</div>
		{/each}

		<!-- ── Swag colour ─────────────────────────────────────────────────── -->
		<h3>Swag <em>bought, so it is a list rather than a picker</em></h3>
		<div class="grid">
			{#each swag as i (i.key)}
				{@const owned = fit.owns(i.key)}
				<button
					class="chip"
					class:on={fit.isEquipped(i.key)}
					class:locked={!owned}
					style:--c={i.color}
					style:--tone={RARITY[i.rarity].tone}
					title="{i.name} · {RARITY[i.rarity].label}{owned
						? ''
						: i.lock?.kind === 'price'
							? ` · ◈ ${i.lock.marks}`
							: ' · granted only'}"
					aria-label={i.name}
					onclick={() => {
						fit.preview(i.key);
						fit.act();
					}}
				></button>
			{/each}
		</div>

		<!-- ── Per part ────────────────────────────────────────────────────── -->
		<h3>Body <em>one part at a time, overriding its material</em></h3>
		{#each body as p (p.slot)}
			<div class="part" class:set={!!fit.tints[p.slot]}>
				<label>
					<input
						type="color"
						value={p.value}
						oninput={(e) => fit.paintOne(p.slot, e.currentTarget.value)}
						aria-label={p.label}
					/>
					<span class="name">{p.label}</span>
				</label>
				{#if fit.tints[p.slot]}
					<button class="link" onclick={() => fit.clearOne(p.slot)}>Reset</button>
				{/if}
			</div>
		{/each}

		{#if worn.length}
			<h3>What you are wearing <em>each piece, its own colour</em></h3>
			{#each worn as p (p.slot)}
				<div class="part" class:set={!!fit.tints[p.slot]}>
					<label>
						<input
							type="color"
							value={p.value}
							oninput={(e) => fit.paintOne(p.slot, e.currentTarget.value)}
							aria-label={p.label}
						/>
						<span class="name">{p.label}</span>
					</label>
					{#if fit.tints[p.slot]}
						<button class="link" onclick={() => fit.clearOne(p.slot)}>Reset</button>
					{/if}
				</div>
			{/each}
		{/if}

		{#if fit.painted}
			<button class="reset" onclick={() => fit.resetPaint()}>Reset all paint</button>
		{/if}
	</div>
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
	.scroll {
		padding: 10px;
		overflow-y: auto;
		min-height: 0;
	}

	h3 {
		display: flex;
		align-items: baseline;
		gap: 7px;
		margin: 14px 0 6px;
		font-family: var(--mono);
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg);
	}
	h3:first-child {
		margin-top: 0;
	}
	h3 em {
		font-family: var(--sans, inherit);
		font-size: 0.6rem;
		font-style: normal;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		color: var(--fg-dim);
	}

	.row {
		padding: 6px 0;
		border-top: 1px solid var(--border);
	}
	label {
		display: flex;
		align-items: center;
		gap: 9px;
		cursor: pointer;
	}
	input[type='color'] {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		cursor: pointer;
		flex: none;
	}
	.name {
		font-size: 0.76rem;
		font-weight: 600;
	}
	code {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.54rem;
		color: var(--fg-dim);
	}
	.hint {
		margin: 4px 0 0 33px;
		font-size: 0.62rem;
		line-height: 1.45;
		color: var(--fg-dim);
	}

	/* Parts are one line each. There are a dozen of them, and a paragraph under
	   every one turns a palette into an essay. */
	.part {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
	}
	.part.set .name {
		color: var(--accent);
	}

	.link,
	.reset {
		margin-left: auto;
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		text-decoration: underline;
		cursor: pointer;
	}
	.row .link {
		display: block;
		margin: 5px 0 0 33px;
	}
	.reset {
		margin: 14px 0 0;
	}

	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.chip {
		width: 24px;
		height: 24px;
		border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
		border-radius: 3px;
		background: var(--c);
		cursor: pointer;
	}
	.chip.on {
		outline: 2px solid var(--fg);
		outline-offset: 1px;
	}
	/* Locked swatches stay VISIBLE — you should be able to see what you are
	   missing, or there is no reason to want it. */
	.chip.locked {
		opacity: 0.4;
		border-style: dashed;
	}
</style>
