<script lang="ts">
	// ── Mode: roster ─────────────────────────────────────────────────────────────
	// The old table panel, kept — but demoted from "the only way to know who else
	// is playing" to one mode among six, and given the thing it never had: where
	// each seat was last seen, and how long ago.
	//
	// It stays because the other five modes are all spatial, and a spatial answer
	// cannot be read aloud. This is the one that names names.
	import { Icon, Panel, ProgressBar, type IconName } from 'showcase';
	import { TERRITORIES } from '../internal/rules.js';
	import type { PresenceModel } from '../internal/presence.js';

	interface Props {
		model: PresenceModel;
		/** Open the full sheet for a seat. Omit to make the rows inert. */
		oninspect?: (key: string) => void;
		/** Sit down in a chair the demonstrator is playing. Omit — as a table whose
		 *  settings did not offer it does — and no row grows the control. */
		ontakeover?: (key: string) => void;
	}

	let { model, oninspect, ontakeover }: Props = $props();

	/** Everyone but you, in initiative order rather than roster order — the list
	 *  should read in the order they will actually act on you. */
	const others = $derived(model.seats.filter((s) => s.relation !== 'self'));

	/** How long since this seat surfaced, in the fewest words that are honest.
	 *  "Not seen" is a real state and the most common one for an enemy — saying
	 *  nothing at all would read as an absence of UI rather than an absence of
	 *  information. */
	function lastSeen(quietFor: number | null, focus: string | null): string {
		if (focus === null || quietFor === null) return 'not seen';
		const where = TERRITORIES[focus as keyof typeof TERRITORIES]?.name ?? focus;
		if (quietFor === 0) return where;
		return `${where} · ${quietFor}r ago`;
	}
</script>

{#snippet count()}
	<span class="font-mono text-[0.5rem] tracking-widest uppercase text-[var(--fg-dim)]">2 v 2</span>
{/snippet}

<Panel title="the table" padding="dense" actions={count} class="pointer-events-auto">
	<div class="flex flex-col gap-1.5">
		{#each others as seat (seat.key)}
			{@const enemy = seat.relation === 'enemy'}
			{@const takeable = !!ontakeover && seat.automatic}
			<!-- The row's frame is a plain div so the take-over control can be a
			     button without sitting inside one. -->
			<div
				class="flex flex-col gap-1 rounded border px-1.5 py-1 w-full"
				style:border-color={seat.active
					? `color-mix(in srgb, ${seat.color} 55%, transparent)`
					: 'var(--border)'}
				style:background={seat.active
					? `color-mix(in srgb, ${seat.color} 10%, transparent)`
					: 'transparent'}
			>
				<svelte:element
					this={oninspect ? 'button' : 'div'}
					role={oninspect ? 'button' : undefined}
					tabindex={oninspect ? 0 : undefined}
					onclick={oninspect ? () => oninspect(seat.key) : undefined}
					class="flex flex-col gap-1 text-left w-full"
				>
					<div class="flex items-center gap-2 w-full">
						<span style:color={seat.color}><Icon name={seat.icon as IconName} size={12} /></span>
						<!-- The PERSON, where the character used to be. A roster answers
						     "who else is at this table", and until the character is issued
						     — or in a local game, where there is nobody to name — the role
						     is the only answer there is. -->
						<span class="flex-1 min-w-0 font-mono text-[0.6rem] truncate">
							{seat.player ?? seat.name}
						</span>
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
							steps={seat.apMax}
							filled={seat.ap}
							pipSize={5}
							color={seat.color}
							label="{seat.name} — {seat.ap} action points left"
						/>
					</div>

					<!-- The role, under the person holding it. Two different facts that
					     used to compete for one line: who they are does not change, and
					     which character they were issued does. -->
					<div class="flex items-center gap-1.5 pl-[1.15rem]">
						<!-- Only when somebody is NAMED above. Without a player the line
						     above is already the role, and printing it twice reads as a
						     rendering bug rather than as two facts. -->
						{#if seat.player}
							<span
								class="font-mono text-[0.46rem] tracking-[0.1em] uppercase truncate"
								style:color={seat.color}
							>
								{seat.name}
							</span>
						{/if}
						<span class="flex-1"></span>
						<!-- Turn order, and nothing for the seat that is up: the row is
						     already lit and outlined in their colour, so a word saying so
						     is the same fact twice. `next` and `+2` are the ones that
						     cannot be seen. -->
						{#if !seat.active}
							<span
								class="font-mono text-[0.46rem] tracking-[0.1em] uppercase text-[var(--fg-dim)]"
							>
								{seat.order === 1 ? 'next' : `+${seat.order}`}
							</span>
						{/if}
					</div>
				</svelte:element>

				<!-- The line the old panel was missing. A roster tells you who is at
				     the table; this tells you which way they are facing. -->
				<div class="flex items-center gap-1.5 pl-[1.15rem]">
					<span
						class="font-mono text-[0.46rem] tracking-[0.1em] uppercase"
						style:color={seat.focus
							? 'var(--fg-dim)'
							: 'color-mix(in srgb, var(--fg-dim) 55%, transparent)'}
					>
						{lastSeen(seat.quietFor, seat.focus)}
					</span>
					{#if takeable}
						<span class="flex-1"></span>
						<!-- Only ever on a chair nobody is in: `automatic` is the seating,
						     not a guess at the name. The engine refuses a person's chair
						     as well, because a control that is merely hidden is a control
						     that comes back the moment somebody calls the method. -->
						<button
							type="button"
							onclick={() => ontakeover?.(seat.key)}
							title="Take {seat.name} — you leave your own chair to the demonstrator"
							class="font-mono text-[0.46rem] font-bold tracking-[0.14em] uppercase px-1 py-px rounded
							       border transition-colors hover:brightness-125
							       focus-visible:outline focus-visible:outline-1"
							style:color={seat.color}
							style:border-color="color-mix(in srgb, {seat.color} 45%, transparent)"
							style:background="color-mix(in srgb, {seat.color} 12%, transparent)"
						>
							take over
						</button>
					{/if}
				</div>
			</div>
		{/each}

		<!-- Onboarding, and the only prose on the board that says what the match is
		     FOR. It outlived the panel it was written for. -->
		<span class="font-mono text-[0.5rem] leading-snug text-[var(--fg-dim)]">
			{model.self.faction === 'red'
				? 'You and your ally are getting through. The two blue seats are trying to see you doing it.'
				: 'You and your ally are holding. The two red seats are already inside something and you have to prove which.'}
		</span>
	</div>
</Panel>
