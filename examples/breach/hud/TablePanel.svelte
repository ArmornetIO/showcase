<script lang="ts">
	// ── The table ────────────────────────────────────────────────────────────────
	// Who else is playing, and which side they are on. Without this the other
	// three seats are three names in a ticker: you cannot tell who you are
	// fighting, who is helping, or whose turn just cost you something. The ally is
	// as important as the enemies — this is 2v2.
	import { Icon, Panel, ProgressBar, type IconName } from 'showcase';
	import { ROSTER } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		/** Open the full sheet for a seat. Omit to make the rows inert. */
		oninspect?: (key: string) => void;
	}

	let { match, oninspect }: Props = $props();

	const others = $derived(ROSTER.filter((k) => k.key !== match.seat.key));
</script>

{#snippet count()}
	<span class="font-mono text-[0.5rem] tracking-widest uppercase text-[var(--fg-dim)]">2 v 2</span>
{/snippet}

<Panel title="the table" padding="dense" actions={count} class="pointer-events-auto">
	<div class="flex flex-col gap-1.5">
		{#each others as klass (klass.key)}
			{@const enemy = klass.faction !== match.seat.faction}
			{@const acting = match.activeKlass.key === klass.key}
			<svelte:element
				this={oninspect ? 'button' : 'div'}
				role={oninspect ? 'button' : undefined}
				tabindex={oninspect ? 0 : undefined}
				onclick={oninspect ? () => oninspect(klass.key) : undefined}
				class="flex items-center gap-2 rounded border px-1.5 py-1 text-left w-full"
				style:border-color={acting
					? `color-mix(in srgb, ${klass.color} 55%, transparent)`
					: 'var(--border)'}
				style:background={acting
					? `color-mix(in srgb, ${klass.color} 10%, transparent)`
					: 'transparent'}
			>
				<span style:color={klass.color}><Icon name={klass.icon as IconName} size={12} /></span>
				<span class="flex-1 min-w-0 font-mono text-[0.6rem] truncate">{klass.name}</span>
				<span
					class="font-mono text-[0.46rem] font-bold tracking-[0.14em] uppercase px-1 py-px rounded"
					style:color={enemy ? '#FB7185' : '#34D399'}
					style:background="color-mix(in srgb, {enemy ? '#FB7185' : '#34D399'} 16%, transparent)"
				>
					{enemy ? 'enemy' : 'ally'}
				</span>
				<!-- What they have left to spend on you this round. -->
				<ProgressBar
					type="pips"
					steps={3}
					filled={match.ap[klass.key] ?? 0}
					pipSize={5}
					color={klass.color}
					label="{klass.name} — {match.ap[klass.key] ?? 0} action points left"
				/>
			</svelte:element>
		{/each}

		<span class="font-mono text-[0.5rem] leading-snug text-[var(--fg-dim)]">
			{match.seat.faction === 'red'
				? 'You and your ally are getting through. The two blue seats are trying to see you doing it.'
				: 'You and your ally are holding. The two red seats are already inside something and you have to prove which.'}
		</span>
	</div>
</Panel>
