<script lang="ts">
	// ── What a card SAYS ─────────────────────────────────────────────────────────
	// A fanned card can only ever show its top strip and its name, so clicking one
	// is how you read it — and the reading happens down here rather than by blowing
	// the card up in place: enlarging a card in the fan covers the cards either
	// side of it, which are the ones you are comparing it to.
	import { Icon, Panel, type IconName } from 'showcase';
	import { fxFor } from '../internal/fx.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const card = $derived(match.inspected);
	const fx = $derived(card ? fxFor(card.key, match.seat.faction) : null);
</script>

<!-- label + value, four times across the header. Same shape every time. -->
{#snippet field(label: string, value: string, hue?: string)}
	<span class="font-mono text-[0.54rem] tracking-wide uppercase text-[var(--fg-dim)]">
		{label}
		<b class="ml-1 text-[0.66rem] tabular-nums" style:color={hue ?? 'var(--fg)'}>{value}</b>
	</span>
{/snippet}

{#if card && fx}
	{#snippet head()}
		<div class="flex items-center gap-2 flex-wrap">
			<span style:color={fx.hue}><Icon name={fx.icon as IconName} size={14} /></span>
			<span class="font-mono text-[0.74rem] font-bold">{card.name}</span>
			<span
				class="font-mono text-[0.48rem] font-bold tracking-[0.14em] uppercase px-1 py-px rounded"
				style:color={fx.hue}
				style:background="color-mix(in srgb, {fx.hue} 16%, transparent)"
			>
				{card.kind}
			</span>
			<span class="flex-1"></span>
			{@render field('cost', `${card.ap} AP`)}
			{#if card.mod}{@render field('roll', `+${card.mod}`, fx.hue)}{/if}
			{@render field(
				'noise',
				card.noise ? String(card.noise) : 'none',
				card.noise ? '#FBBF24' : '#34D399'
			)}
			<button
				type="button"
				onclick={() => (match.inspectKey = null)}
				class="font-mono text-[0.7rem] leading-none text-[var(--fg-dim)] hover:text-[var(--fg)]"
				aria-label="Close card">✕</button
			>
		</div>
	{/snippet}

	<Panel header={head} padding="dense" class="pointer-events-auto {cls}">
		<div class="flex flex-col gap-1.5">
			<p class="m-0 font-mono text-[0.58rem] leading-snug text-[var(--fg-dim)]">{card.text}</p>
			<div class="flex items-center gap-2 flex-wrap">
				<!-- Not a list of building names. The board is already showing exactly
				     where this can go — this only says how many, so you know whether to
				     go looking round the back of the globe. -->
				<span
					class="font-mono text-[0.5rem] tracking-wide uppercase"
					style:color={match.inspectedSites ? fx.hue : '#FB7185'}
				>
					{match.inspectedSites
						? `${match.inspectedSites} site${match.inspectedSites === 1 ? '' : 's'} lit on the board`
						: 'nowhere to play this yet'}
				</span>
				<span class="flex-1"></span>
				<span class="font-mono text-[0.5rem] tracking-wide uppercase" style:color={fx.hue}>
					drag onto the world to play →
				</span>
			</div>
		</div>
	</Panel>
{/if}
