<script lang="ts">
	// ── The lobby ────────────────────────────────────────────────────────────────
	// A table with four chairs, not a menu with four options. You see who else is
	// here, which side they are on, and whether they are ready — and then the
	// characters are issued rather than shopped for.
	//
	// The whole screen is driven by `BreachLobby`; this file decides only how a
	// seat looks in each of its four states (open, waiting, on the clock, issued).
	import { Button, Icon, Panel, type IconName } from 'showcase';
	import {
		ASSIGNMENT_MODES,
		rosterFor,
		type AssignmentMode,
		type LobbySeat
	} from './internal/lobby.svelte.js';
	import { BreachLobby } from './internal/lobby.svelte.js';
	import type { Klass } from './internal/rules.js';
	import SkillGrid from './parts/SkillGrid.svelte';
	import PassiveNote from './parts/PassiveNote.svelte';

	interface Props {
		lobby: BreachLobby;
		/** Called with the character issued to the local player. */
		onstart: (klassKey: string) => void;
	}

	let { lobby, onstart }: Props = $props();

	const you = $derived(lobby.you);
	const yourKlass = $derived(lobby.klassAt(lobby.youSeatId));
	const onTheClock = $derived(lobby.draftSeatId === lobby.youSeatId);
	const sideTone = (side: string) => (side === 'red' ? '#FB7185' : '#38BDF8');
</script>

<!-- One chair. Four visual states and no branching anywhere else. -->
{#snippet chair(seat: LobbySeat)}
	{@const klass = lobby.klassAt(seat.id)}
	{@const mine = seat.id === lobby.youSeatId}
	{@const clock = lobby.draftSeatId === seat.id}
	{@const tone = sideTone(seat.side)}
	<button
		type="button"
		disabled={lobby.phase !== 'waiting' || seat.occupant.kind !== 'open'}
		onclick={() => lobby.moveTo(seat.id)}
		title={seat.occupant.kind === 'open' ? `Take seat ${seat.id}` : seat.id}
		class="relative flex flex-col gap-2 w-[212px] p-3 rounded-xl border text-left transition-all
		       disabled:cursor-default enabled:hover:-translate-y-0.5"
		class:animate-pulse={clock && seat.occupant.kind !== 'human'}
		style:border-color={mine
			? `color-mix(in srgb, ${tone} 70%, transparent)`
			: clock
				? 'color-mix(in srgb, var(--accent) 60%, transparent)'
				: 'var(--border)'}
		style:background={klass
			? `linear-gradient(180deg, color-mix(in srgb, ${klass.color} 14%, var(--bg-elev, #0b0f16)) 0%, var(--bg-elev, #0b0f16) 65%)`
			: 'color-mix(in srgb, var(--fg) 3%, transparent)'}
	>
		<!-- Side, as a stripe. Two of these are yours before anyone has a name. -->
		<span
			class="absolute inset-y-3 left-0 w-[3px] rounded-full"
			style:background={tone}
			style:opacity={mine ? 1 : 0.5}
		></span>

		<div class="flex items-center gap-2 pl-1.5">
			<span class="font-mono text-[0.6rem] font-bold tracking-widest" style:color={tone}>
				{seat.id}
			</span>
			{#if mine}
				<span
					class="font-mono text-[0.44rem] font-bold tracking-[0.16em] uppercase px-1 py-px rounded"
					style:color={tone}
					style:background="color-mix(in srgb, {tone} 18%, transparent)">you</span
				>
			{/if}
			<span class="flex-1"></span>
			{#if seat.occupant.kind === 'human'}
				<span
					class="font-mono text-[0.46rem] tracking-[0.14em] uppercase"
					style:color={seat.occupant.ready ? '#34D399' : 'var(--fg-dim)'}
				>
					{seat.occupant.ready ? 'ready' : 'waiting'}
				</span>
			{:else if seat.occupant.kind === 'ai'}
				<span class="font-mono text-[0.46rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">
					demonstrator
				</span>
			{/if}
		</div>

		<!-- The character, or the absence of one. An un-issued chair shows a
		     face-down card rather than an empty box — something is coming. -->
		{#if klass}
			<div class="flex items-center gap-2 pl-1.5">
				<span
					class="grid place-items-center w-8 h-8 rounded-full border shrink-0"
					style:color={klass.color}
					style:border-color="color-mix(in srgb, {klass.color} 45%, transparent)"
					style:background="color-mix(in srgb, {klass.color} 14%, transparent)"
				>
					<Icon name={klass.icon as IconName} size={16} />
				</span>
				<div class="flex flex-col min-w-0">
					<span class="font-mono text-[0.68rem] font-bold truncate" style:color={klass.color}>
						{klass.name}
					</span>
					<span class="font-mono text-[0.46rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">
						{klass.faction === 'red' ? 'intrusion' : 'defence'} · {klass.resource}
					</span>
				</div>
			</div>
		{:else}
			<div class="flex items-center gap-2 pl-1.5">
				<span
					class="grid place-items-center w-8 h-8 rounded-full border border-dashed shrink-0
					       border-[var(--border)] text-[var(--fg-dim)]"
				>
					<Icon name={seat.occupant.kind === 'open' ? 'plus' : 'user'} size={15} />
				</span>
				<span class="font-mono text-[0.58rem] text-[var(--fg-dim)]">
					{#if seat.occupant.kind === 'open'}
						open seat
					{:else if clock}
						choosing…
					{:else}
						awaiting issue
					{/if}
				</span>
			</div>
		{/if}
	</button>
{/snippet}

<div class="fixed inset-0 z-[70] overflow-y-auto bg-[var(--bg,#05080d)]">
	<div class="min-h-full flex flex-col items-center justify-center gap-6 px-6 py-10">
		<header class="flex flex-col items-center gap-2 text-center">
			<h1 class="m-0 font-mono text-[1.4rem] font-bold tracking-[0.4em]">BREACH</h1>
			<p class="m-0 font-mono text-[0.62rem] tracking-[0.2em] uppercase text-[var(--fg-dim)]">
				{#if lobby.phase === 'waiting'}
					Waiting for the table · {lobby.filled}/4 seated
				{:else if lobby.phase === 'issuing'}
					Issuing characters
				{:else if lobby.phase === 'drafting'}
					{onTheClock ? 'Your pick' : 'Draft in progress'}
				{:else}
					Table set
				{/if}
			</p>
		</header>

		<!-- The table, two chairs a side, facing. -->
		<div class="flex flex-col items-center gap-3">
			<div class="flex flex-wrap justify-center gap-3">
				{#each lobby.seats.filter((s) => s.side === 'red') as seat (seat.id)}
					{@render chair(seat)}
				{/each}
			</div>

			<div class="flex items-center gap-3 w-full max-w-[30rem]">
				<span class="flex-1 h-px bg-[var(--border)]"></span>
				<span class="font-mono text-[0.5rem] tracking-[0.3em] uppercase text-[var(--fg-dim)]">
					2 v 2
				</span>
				<span class="flex-1 h-px bg-[var(--border)]"></span>
			</div>

			<div class="flex flex-wrap justify-center gap-3">
				{#each lobby.seats.filter((s) => s.side === 'blue') as seat (seat.id)}
					{@render chair(seat)}
				{/each}
			</div>
		</div>

		<!-- ── Table settings ──────────────────────────────────────────────────── -->
		{#if lobby.phase === 'waiting'}
			<Panel title="table settings" padding="dense" class="w-[min(92vw,34rem)]">
				<div class="flex flex-col gap-3">
					<div class="flex flex-col gap-1.5">
						<span class="font-mono text-[0.5rem] tracking-[0.16em] uppercase text-[var(--fg-dim)]">
							character issue
						</span>
						<div class="flex flex-wrap gap-1.5">
							{#each ASSIGNMENT_MODES as option (option.id)}
								<Button
									shape="pill"
									size="xs"
									tone="accent"
									pressed={lobby.mode === option.id}
									onclick={() => (lobby.mode = option.id as AssignmentMode)}
								>
									{option.label}
								</Button>
							{/each}
						</div>
						<span class="font-mono text-[0.52rem] leading-snug text-[var(--fg-dim)]">
							{ASSIGNMENT_MODES.find((m) => m.id === lobby.mode)?.blurb}
						</span>
					</div>

					<div class="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border)]">
						<Button size="xs" variant="ghost" onclick={() => lobby.fillWithAI()}>
							fill empty seats
						</Button>
						<Button
							size="xs"
							variant="ghost"
							onclick={() => lobby.toggleReady()}
							disabled={you?.occupant.kind !== 'human'}
						>
							{you?.occupant.kind === 'human' && you.occupant.ready ? 'not ready' : 'ready'}
						</Button>
						<span class="flex-1"></span>
						<Button
							size="xs"
							variant="primary"
							disabled={!lobby.canStart}
							onclick={() => void lobby.issue()}
						>
							{lobby.everyoneHere ? 'issue characters' : `waiting · ${lobby.filled}/4`}
						</Button>
					</div>
				</div>
			</Panel>
		{/if}

		<!-- ── Your pick ───────────────────────────────────────────────────────── -->
		{#if lobby.phase === 'drafting' && onTheClock}
			{@const pool = lobby.poolFor(lobby.yourSide)}
			<Panel
				title={lobby.mode === 'pick' ? 'choose your character' : 'your pick'}
				padding="dense"
				class="w-[min(92vw,44rem)]"
			>
				<div class="flex flex-wrap justify-center gap-3">
					{#each pool as klass (klass.key)}
						{@render option(klass)}
					{/each}
				</div>
			</Panel>
		{/if}

		<!-- ── Issued ──────────────────────────────────────────────────────────── -->
		{#if lobby.phase === 'ready' && yourKlass}
			<Panel padding="dense" class="w-[min(92vw,34rem)]">
				<div class="flex flex-col items-center gap-3 text-center">
					<span class="font-mono text-[0.5rem] tracking-[0.24em] uppercase text-[var(--fg-dim)]">
						you have been issued
					</span>
					<div class="flex items-center gap-3">
						<span
							class="grid place-items-center w-12 h-12 rounded-full border shrink-0"
							style:color={yourKlass.color}
							style:border-color="color-mix(in srgb, {yourKlass.color} 50%, transparent)"
							style:background="color-mix(in srgb, {yourKlass.color} 16%, transparent)"
						>
							<Icon name={yourKlass.icon as IconName} size={22} />
						</span>
						<div class="flex flex-col items-start">
							<span class="font-mono text-[0.95rem] font-bold" style:color={yourKlass.color}>
								{yourKlass.name}
							</span>
							<span class="font-mono text-[0.55rem] text-[var(--fg-dim)]">
								{yourKlass.tagline}
							</span>
						</div>
					</div>
					<div class="w-full max-w-[20rem] flex flex-col gap-2">
						<SkillGrid klass={yourKlass} size="sm" />
						<PassiveNote klass={yourKlass} />
					</div>
					<div class="flex items-center gap-2">
						<Button size="xs" variant="ghost" onclick={() => lobby.reset()}>redraw</Button>
						<Button size="xs" variant="primary" onclick={() => onstart(yourKlass.key)}>
							take the table →
						</Button>
					</div>
				</div>
			</Panel>
		{/if}
	</div>
</div>

<!-- A character on offer during a draft or a free pick. -->
{#snippet option(klass: Klass)}
	<button
		type="button"
		onclick={() => lobby.choose(klass.key)}
		class="flex flex-col gap-2 w-[212px] p-3 rounded-xl border text-left transition-all hover:-translate-y-1"
		style:border-color="color-mix(in srgb, {klass.color} 35%, var(--border))"
		style:background="linear-gradient(180deg, color-mix(in srgb, {klass.color} 12%, var(--bg-elev, #0b0f16)) 0%, var(--bg-elev, #0b0f16) 60%)"
	>
		<div class="flex items-center gap-2">
			<span
				class="grid place-items-center w-8 h-8 rounded-full border shrink-0"
				style:color={klass.color}
				style:border-color="color-mix(in srgb, {klass.color} 45%, transparent)"
				style:background="color-mix(in srgb, {klass.color} 14%, transparent)"
			>
				<Icon name={klass.icon as IconName} size={16} />
			</span>
			<div class="flex flex-col min-w-0">
				<span class="font-mono text-[0.7rem] font-bold" style:color={klass.color}>
					{klass.name}
				</span>
				<span class="font-mono text-[0.46rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]">
					{klass.resource}
				</span>
			</div>
		</div>
		<span class="font-mono text-[0.54rem] leading-snug text-[var(--fg-dim)]">{klass.tagline}</span>
		<SkillGrid {klass} size="sm" />
	</button>
{/snippet}
