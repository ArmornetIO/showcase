<script lang="ts">
	// ── Mode: seat cameras ───────────────────────────────────────────────────────
	// Go and stand where they are standing.
	//
	// The designer's note on this one was to cut it, and the reason was right:
	// done carelessly it is a fog leak with a button on it. It is here anyway,
	// built the only way it is allowed to exist —
	//
	//   IT SHOWS THEIR GROUND. IT NEVER SHOWS THEIR KNOWLEDGE.
	//
	// Everything this mode reads is public before the match starts: which
	// territory a seat's passive names, and who owns that territory. Both are on
	// the character sheet in the lobby. It does not touch `visible`, `footholds`,
	// `garrison`, or the other seat's feed — it cannot, because it is not given
	// them: the only props are the presence model and a camera handle.
	//
	// If you are extending this, that is the line. Flying the camera somewhere is
	// a view transform. Rendering what another seat KNOWS when it gets there is
	// the end of the game.
	import { Icon, Panel, type IconName } from 'showcase';
	import { STRUCTURES, TERRITORIES } from '../internal/rules.js';
	import type { PresenceModel } from '../internal/presence.js';
	import { homeOf } from './seating.js';

	interface Props {
		model: PresenceModel;
		/** Fly the camera to a structure. Omit and the rows become inert labels —
		 *  the mode still explains the seating, it just cannot travel. */
		onvisit?: (structureId: string) => void;
		/** Hover feedback, for a host that wants to tint the region. */
		onpeek?: (territory: string | null) => void;
	}

	let { model, onvisit, onpeek }: Props = $props();

	const others = $derived(model.seats.filter((s) => s.relation !== 'self'));

	/** A region has no element of its own to fly to, so the camera is pointed at
	 *  a building standing in it. Any of them will do — the camera frames the
	 *  neighbourhood, not the roof. */
	const landmarkOf = (territory: string) =>
		STRUCTURES.find((s) => s.territory === territory)?.id ?? null;
</script>

{#snippet note()}
	<span class="font-mono text-[0.46rem] tracking-widest uppercase text-[var(--fg-dim)]">
		ground only
	</span>
{/snippet}

<Panel title="seat cameras" padding="dense" actions={note} class="pointer-events-auto">
	<div class="flex flex-col gap-1">
		{#each others as seat (seat.key)}
			{@const home = homeOf(seat.key)}
			{@const landmark = landmarkOf(home)}
			<button
				type="button"
				class="flex items-center gap-2 rounded border border-[var(--border)] px-1.5 py-1 text-left w-full
				       hover:border-[color-mix(in_srgb,var(--fg-dim)_60%,transparent)]"
				disabled={!onvisit || !landmark}
				onclick={() => landmark && onvisit?.(landmark)}
				onmouseenter={() => onpeek?.(home)}
				onmouseleave={() => onpeek?.(null)}
				onfocus={() => onpeek?.(home)}
				onblur={() => onpeek?.(null)}
			>
				<span style:color={seat.color}><Icon name={seat.icon as IconName} size={12} /></span>
				<span class="flex flex-col min-w-0 flex-1">
					<span class="font-mono text-[0.55rem] truncate">{seat.seat} · {seat.name}</span>
					<span
						class="font-mono text-[0.46rem] tracking-[0.1em] uppercase"
						style:color={TERRITORIES[home].color}
					>
						{TERRITORIES[home].name}
					</span>
				</span>
				<Icon name="eye" size={11} />
			</button>
		{/each}

		<span class="font-mono text-[0.46rem] leading-snug text-[var(--fg-dim)]">
			Stands you on the ground a seat holds. It does not show you what they can
			see from it — that is the game.
		</span>
	</div>
</Panel>
