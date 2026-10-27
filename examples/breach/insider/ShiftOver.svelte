<script lang="ts">
	// ── The end of a shift ───────────────────────────────────────────────────────
	// Insider Threat in GameOver's frame. The whole match is one hidden fact, so
	// the picture is that fact undone: the insider, in their own clothes, under
	// the light. Under it the race both sides were running — the worm's steps
	// against the clock — and the staff as they really were.
	import { Figure, Pips } from 'showcase';
	import GameOver from '../hud/GameOver.svelte';
	import { kitFor } from '../hud/kit.js';
	import { klassByKey } from '../internal/rules.js';
	import { OFFICE_DATA } from '../internal/office.gen.js';
	import type { OfficeView } from '../wire.gen.js';
	import type { FigureLook } from './figures.js';
	import { clock, shiftOutcome, SIDE_TONE, votesAgainst, type Side } from './shift.js';

	interface Props {
		office: OfficeView;
		/** This reader's own character; everybody else is drawn in their kit. */
		look?: FigureLook;
		onclose: () => void;
		/** Back to the lobby. Absent for a reader who may not end the table. */
		onleave?: () => void;
	}

	let { office, look, onclose, onleave }: Props = $props();

	const D = OFFICE_DATA;
	const player = (seat: string) => office.players.find((p) => p.seatId === seat);
	const job = (seat: string) => D.archetypes.find((a) => a.key === player(seat)?.archetype)?.name ?? '';
	const handle = (seat: string) => player(seat)?.handle ?? seat;
	const who = (seat: string) => [handle(seat), job(seat)].filter(Boolean).join(' · ');

	const o = $derived(shiftOutcome(office, D.milestones.length, who));
	const mine = $derived(office.me?.seatId ?? '');
	/** Seconds the shift ran, and of how many. */
	const ran = $derived(D.tunables.matchS - Math.ceil(Number(office.leftMs) / 1000));
	const trial = $derived(office.lastMeeting);

	const sideOf = (insider: boolean): Side => (insider ? 'insider' : 'loyal');
	const lookOf = (seat: string, klassKey: string, side: Side): FigureLook =>
		seat === mine && look ? look : { skin: klassByKey(klassKey), art: { worn: kitFor(klassKey), trim: SIDE_TONE[side] } };
	const unmasked = $derived(office.reveal.find((r) => r.insider));

	// The game is over and the page underneath still holds the mouse; this
	// screen's buttons are unreachable until it lets go.
	$effect(() => {
		if (document.pointerLockElement) document.exitPointerLock();
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		onclose();
	}}
/>

{#if o}
	<GameOver
		eyebrow="shift over"
		claim={o.claim}
		tone={o.tone}
		winTone={o.winTone}
		verdict={o.verdict}
		event={o.event}
		sentence={o.sentence}
		again={onleave && { label: 'back to the lobby', run: onleave }}
		{onclose}
		closeLabel="look around"
	>
		{#snippet art()}
			<!-- The unmask: whoever it was, standing in red light. -->
			{#if unmasked}
				{@const f = lookOf(unmasked.seatId, unmasked.klassKey, 'insider')}
				<span
					class="relative h-[132px] w-[104px] shrink-0"
					style:filter="drop-shadow(0 0 18px color-mix(in srgb, {SIDE_TONE.insider} 55%, transparent))"
				>
					<Figure klass={f.skin} crop="hero" shadow ground={SIDE_TONE.insider} art={f.art} />
					<span
						class="absolute bottom-0 left-1/2 -translate-x-1/2 rounded border px-1.5 py-0.5 font-mono text-[0.5rem] font-black tracking-[0.16em] whitespace-nowrap uppercase"
						style:color={SIDE_TONE.insider}
						style:border-color="color-mix(in srgb, {SIDE_TONE.insider} 60%, transparent)"
						style:background="color-mix(in srgb, {SIDE_TONE.insider} 22%, var(--bg-elev, #0b0f16))"
					>
						the insider
					</span>
				</span>
			{/if}
		{/snippet}

		<!-- ── The race ──────────────────────────────────────────────────────────
		     The two clocks the match was really about, side by side for the first
		     time: during play each side could read only its own. -->
		<div class="flex flex-col gap-1.5">
			<span class="font-mono text-[0.5rem] tracking-[0.18em] text-[var(--fg-dim)] uppercase">/ the race</span>
			<div class="grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-3 gap-y-2 font-mono text-[0.62rem]">
				<span class="text-[0.5rem] font-black tracking-[0.14em] uppercase" style:color={SIDE_TONE.insider}>worm</span>
				<Pips total={D.milestones.length} filled={office.wormShown} shape="diamond" size={10} gap={4} color={SIDE_TONE.insider} hollow label="Worm {office.wormShown} of {D.milestones.length}" />
				<b class="text-right tabular-nums">{office.wormShown}/{D.milestones.length}</b>

				<span class="text-[0.5rem] font-black tracking-[0.14em] uppercase" style:color={SIDE_TONE.loyal}>clock</span>
				<span class="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
					<span class="block h-full rounded-full" style:width="{(100 * ran) / D.tunables.matchS}%" style:background={SIDE_TONE.loyal}></span>
				</span>
				<b class="text-right tabular-nums">{clock(ran)}/{clock(D.tunables.matchS)}</b>
			</div>
		</div>

		<!-- ── The staff ─────────────────────────────────────────────────────────
		     Everybody as they really were, and how their shift ended. -->
		<div class="flex flex-col gap-1.5">
			<span class="font-mono text-[0.5rem] tracking-[0.18em] text-[var(--fg-dim)] uppercase">/ the staff</span>
			<div class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1.5 font-mono text-[0.62rem]">
				{#each office.reveal as r (r.seatId)}
					{@const side = sideOf(r.insider)}
					{@const f = lookOf(r.seatId, r.klassKey, side)}
					{@const p = player(r.seatId)}
					{@const tried = trial?.escorted === r.seatId ? votesAgainst(trial.votes, r.seatId) : null}
					<span
						class="h-7 w-7 overflow-hidden rounded-full border"
						style:border-color="color-mix(in srgb, {SIDE_TONE[side]} 60%, transparent)"
					>
						<Figure klass={f.skin} crop="chip" art={f.art} />
					</span>
					<span class="flex min-w-0 flex-col">
						<b class="truncate" style:color={r.seatId === mine ? 'var(--fg)' : 'var(--fg-muted)'}>
							{handle(r.seatId)}{r.seatId === mine ? ' · you' : ''}{p?.bot ? ' · bot' : ''}
						</b>
						<span class="truncate text-[var(--fg-dim)]">{job(r.seatId)} — {klassByKey(r.klassKey).name}</span>
					</span>
					<span class="text-[0.56rem] tracking-[0.12em] text-[var(--fg-dim)] uppercase">
						{#if p?.escorted}escorted{tried ? ` · ${tried.for}/${tried.cast}` : ''}{:else}on the floor{/if}
					</span>
					<span
						class="rounded border px-1.5 py-0.5 text-center text-[0.5rem] font-black tracking-[0.14em] uppercase"
						style:color={SIDE_TONE[side]}
						style:border-color="color-mix(in srgb, {SIDE_TONE[side]} 50%, transparent)"
						style:opacity={o?.winner === side ? 1 : 0.55}
					>
						{side}
					</span>
				{/each}
			</div>
		</div>
	</GameOver>
{/if}
