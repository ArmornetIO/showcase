<script lang="ts">
	// ── God mode · spectate ──────────────────────────────────────────────────────
	// Every live table on the server, and the fog lifted on whichever one you are
	// watching.
	//
	// This is a GALLERY, not a seat. It is the one surface in the example that
	// deliberately sees what no player may: both hands, every foothold, the whole
	// log. That hole is cut server-side (internal/breach/spectate.go) and opened
	// only for a god admin — this file cannot widen it, and asking to watch as
	// anybody else is refused before a byte of board is built.
	//
	// It lives here, with the game, rather than in app-ui. The example owns every
	// component BREACH has; a host that wants this on a god-admin page imports it
	// and mounts it, the same way the route mounts `Breach`.
	import { onMount } from 'svelte';
	import { Button, Icon, Panel } from 'showcase';
	import { listLiveTables, type LiveTable } from '../api.js';
	import { TableSocket, type SpectatableMatchView } from '../net.svelte.js';
	import { klassByKey } from '../internal/rules.js';

	interface Props {
		/** Start watching this table immediately, skipping the picker. */
		tableID?: string;
	}

	let { tableID }: Props = $props();

	/** How often the listing refreshes. A table changes when somebody sits down,
	 *  which is a human-speed event — a faster poll would only cost requests. The
	 *  table you are WATCHING is not polled at all; it pushes. */
	const REFRESH_MS = 5000;

	let tables = $state<LiveTable[]>([]);
	let listError = $state<string | null>(null);
	let loaded = $state(false);

	let socket = $state<TableSocket | null>(null);
	let watching = $state<string | null>(null);

	onMount(() => {
		const controller = new AbortController();
		void refresh(controller.signal);
		const timer = setInterval(() => void refresh(controller.signal), REFRESH_MS);
		if (tableID) watch(tableID);
		return () => {
			controller.abort();
			clearInterval(timer);
			socket?.close();
		};
	});

	async function refresh(signal?: AbortSignal) {
		try {
			tables = await listLiveTables(signal);
			listError = null;
		} catch (err) {
			if (signal?.aborted) return;
			listError = err instanceof Error ? err.message : 'could not list tables';
		} finally {
			loaded = true;
		}
	}

	function watch(id: string) {
		if (watching === id) return;
		socket?.close();
		watching = id;
		const s = new TableSocket(id, { spectate: true });
		s.connect();
		socket = s;
	}

	function stop() {
		socket?.close();
		socket = null;
		watching = null;
	}

	const view = $derived(socket?.view ?? null);
	const match = $derived((view?.match ?? null) as SpectatableMatchView | null);
	/** Present only when the server agreed this is a spectator. A board without it
	 *  is somebody's fogged view and must never be labelled omniscient. */
	const omniscient = $derived(match?.omniscient === true);
	const seated = $derived(view?.lobby.seats.filter((s) => s.occupant.kind !== 'open') ?? []);

	/** Elapsed time, in the coarsest unit that is still true. */
	function ago(iso: string): string {
		const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
		if (secs < 60) return `${secs}s`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m`;
		return `${Math.floor(secs / 3600)}h`;
	}

	const PHASE_TONE: Record<string, string> = {
		setup: '#38BDF8',
		select: '#FBBF24',
		playing: '#34D399',
		complete: 'var(--fg-dim)'
	};
	const sideTone = (side: string) => (side === 'red' ? '#FB7185' : '#38BDF8');
</script>

<div class="flex flex-col gap-3 h-full p-4 text-[var(--fg)]">
	<div class="flex items-baseline gap-3">
		<h2 class="m-0 font-mono text-sm font-semibold tracking-[0.04em]">
			Spectate <span class="text-[var(--fg-dim)]">· god mode</span>
		</h2>
		<span class="font-mono text-[0.65rem] text-[var(--fg-dim)]">
			{tables.length} live table{tables.length === 1 ? '' : 's'} · nothing here is in the database
		</span>
		<div class="ml-auto">
			<Button variant="ghost" onclick={() => refresh()}>Refresh</Button>
		</div>
	</div>

	{#if listError}
		<div
			class="rounded-lg border border-[rgba(252,165,165,0.4)] px-3 py-2 font-mono text-xs text-[var(--palette-red,#f87171)]"
		>
			{listError}
		</div>
	{/if}

	<div class="grid gap-3 min-h-0 flex-1 lg:grid-cols-[minmax(240px,320px)_1fr]">
		<!-- ── The rail: what is running ─────────────────────────────────────── -->
		<div class="flex flex-col gap-2 min-h-0 overflow-y-auto">
			{#if !loaded}
				<p class="font-mono text-xs text-[var(--fg-dim)] py-6 text-center">Loading…</p>
			{:else if tables.length === 0}
				<div class="flex flex-col items-center gap-2 py-12 text-center text-[var(--fg-dim)]">
					<Icon name="table" size={24} />
					<p class="m-0 font-mono text-[0.68rem] tracking-[0.1em] uppercase">No tables are open</p>
					<p class="m-0 font-mono text-[0.68rem]">
						One appears the moment somebody opens a table.
					</p>
				</div>
			{:else}
				{#each tables as t (t.id)}
					<button
						type="button"
						onclick={() => watch(t.id)}
						class="text-left rounded-lg border px-3 py-2 transition-colors"
						class:border-[var(--accent)]={watching === t.id}
						style:border-color={watching === t.id ? 'var(--accent)' : 'var(--border)'}
						style:background={watching === t.id
							? 'color-mix(in srgb, var(--accent) 10%, transparent)'
							: 'transparent'}
					>
						<div class="flex items-center gap-2">
							<span
								class="font-mono text-[0.55rem] font-bold tracking-[0.14em] uppercase px-1 py-px rounded"
								style:color={PHASE_TONE[t.phase]}
								style:background="color-mix(in srgb, {PHASE_TONE[t.phase]} 16%, transparent)"
							>
								{t.phase}
							</span>
							<code class="font-mono text-[0.68rem] font-semibold">{t.id}</code>
							{#if t.idle}
								<span class="ml-auto font-mono text-[0.6rem] text-[var(--palette-amber,#fbbf24)]">
									idle {ago(t.last_activity)}
								</span>
							{:else}
								<span class="ml-auto font-mono text-[0.6rem] text-[var(--fg-dim)]">
									{ago(t.last_activity)} ago
								</span>
							{/if}
						</div>
						<div class="mt-1 flex flex-wrap gap-x-3 font-mono text-[0.6rem] text-[var(--fg-dim)]">
							<span>host <span class="text-[var(--fg)]">{t.host_name}</span></span>
							<span>seats <span class="text-[var(--fg)]">{t.filled}/{t.seats}</span></span>
							<span>here <span class="text-[var(--fg)]">{t.present}/{t.players}</span></span>
							<span>{t.size} · {t.mode}</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>

		<!-- ── The gallery: the table you are watching ───────────────────────── -->
		<div class="min-h-0 overflow-y-auto">
			{#if !watching}
				<div
					class="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--fg-dim)]"
				>
					<Icon name="eye" size={28} />
					<p class="m-0 font-mono text-[0.7rem] tracking-[0.1em] uppercase">Pick a table</p>
					<p class="m-0 font-mono text-xs">
						Watching does not seat you. Nobody at the table is told you are here.
					</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					<div class="flex items-center gap-3">
						<code class="font-mono text-xs font-semibold">{watching}</code>
						<span class="font-mono text-[0.62rem] text-[var(--fg-dim)]">{socket?.status}</span>
						{#if omniscient}
							<span
								class="font-mono text-[0.55rem] font-bold tracking-[0.14em] uppercase px-1.5 py-px rounded
								       text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
							>
								fog lifted
							</span>
						{/if}
						<div class="ml-auto"><Button variant="ghost" onclick={stop}>Stop watching</Button></div>
					</div>

					{#if socket?.lastError}
						<div
							class="rounded-lg border border-[rgba(252,165,165,0.4)] px-3 py-2 font-mono text-xs text-[var(--palette-red,#f87171)]"
						>
							{socket.lastError.message}
						</div>
					{/if}

					<!-- Who is at it. Public information anyway — it is who is sitting where. -->
					<Panel>
						<p
							class="m-0 mb-2 font-mono text-[0.58rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]"
						>
							The table
						</p>
						{#if seated.length === 0}
							<p class="m-0 font-mono text-xs text-[var(--fg-dim)]">Nobody has sat down yet.</p>
						{:else}
							<div class="flex flex-wrap gap-2">
								{#each seated as seat (seat.id)}
									{@const tone = sideTone(seat.side)}
									<div
										class="rounded-lg border px-2.5 py-1.5 min-w-[8.5rem]"
										style:border-color="color-mix(in srgb, {tone} 40%, transparent)"
									>
										<div class="flex items-center gap-1.5">
											<span
												class="font-mono text-[0.55rem] font-bold tracking-[0.14em]"
												style:color={tone}>{seat.id}</span
											>
											{#if seat.occupant.kind === 'ai'}
												<span class="font-mono text-[0.5rem] uppercase text-[var(--fg-dim)]">ai</span>
											{:else if seat.occupant.ready}
												<span
													class="font-mono text-[0.5rem] uppercase text-[var(--palette-emerald-l,#34d399)]"
													>ready</span
												>
											{/if}
										</div>
										<div class="font-mono text-[0.68rem]">{seat.occupant.name ?? '—'}</div>
										{#if seat.klass_key}
											<div class="font-mono text-[0.6rem] text-[var(--fg-dim)]">
												{klassByKey(seat.klass_key).name}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</Panel>

					{#if match}
						<!-- Where the match is. -->
						<Panel>
							<div class="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.68rem]">
								<span class="text-[var(--fg-dim)]"
									>round <span class="text-[var(--fg)]">{match.round}</span></span
								>
								<span class="text-[var(--fg-dim)]">
									on the clock
									<span class="text-[var(--fg)]"
										>{match.active_key ? klassByKey(match.active_key).name : '—'}</span
									>
								</span>
								{#if match.over}
									<span class="text-[var(--accent)]">over — {match.winner} took it</span>
								{/if}
								{#if match.chain_held?.length}
									<span class="text-[var(--fg-dim)]">
										chain <span class="text-[var(--fg)]">{match.chain_held.length}</span>
									</span>
								{/if}
							</div>
						</Panel>

						<!-- The payoff: what everybody is holding. A player is never sent
						     this, which is why it is the thing worth showing here. -->
						{#if match.hands}
							<Panel>
								<p
									class="m-0 mb-2 font-mono text-[0.58rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]"
								>
									Hands — every seat
								</p>
								<div class="grid gap-2 sm:grid-cols-2">
									{#each Object.entries(match.hands) as [key, hand] (key)}
										{@const k = klassByKey(key)}
										{@const tone = sideTone(k.faction)}
										<div
											class="rounded-lg border px-2.5 py-2"
											style:border-color="color-mix(in srgb, {tone} 34%, transparent)"
										>
											<div class="flex items-center gap-2">
												<span class="font-mono text-[0.66rem] font-semibold" style:color={tone}
													>{k.name}</span
												>
												<span class="font-mono text-[0.58rem] text-[var(--fg-dim)]">
													ap {match.ap?.[key] ?? 0} · res {match.res?.[key] ?? 0}
												</span>
											</div>
											<ul class="m-0 mt-1 list-none p-0 flex flex-col gap-0.5">
												{#each hand as card (card.key)}
													<li class="flex items-baseline gap-2 font-mono text-[0.62rem]">
														<span
															class="text-[var(--fg-dim)] w-6 shrink-0"
															class:text-[var(--accent)]={card.playable}>{card.ap}ap</span
														>
														<span>{card.name}</span>
														<span class="text-[var(--fg-dim)] text-[0.56rem]">{card.skill}</span>
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							</Panel>
						{/if}

						<!-- The estate, unfogged: what is standing where. -->
						{#if match.sites?.length}
							<Panel>
								<p
									class="m-0 mb-2 font-mono text-[0.58rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]"
								>
									The estate
								</p>
								<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
									{#each match.sites as site (site.id)}
										<div
											class="flex items-baseline gap-2 font-mono text-[0.62rem]"
											class:opacity-50={!site.held && !site.sealed}
										>
											<span class="text-[var(--fg)]">{site.id}</span>
											<span class="text-[var(--fg-dim)]">h{site.hardening}</span>
											{#if site.red > 0}
												<span style:color={sideTone('red')}>●{site.red}</span>
											{/if}
											{#if site.blue > 0}
												<span style:color={sideTone('blue')}>●{site.blue}</span>
											{/if}
											{#if site.sealed}
												<span class="text-[var(--palette-amber,#fbbf24)]">sealed</span>
											{/if}
										</div>
									{/each}
								</div>
							</Panel>
						{/if}

						<!-- Both halves of the conversation. A seat only ever sees its own. -->
						{#if match.log?.length}
							<Panel>
								<p
									class="m-0 mb-2 font-mono text-[0.58rem] tracking-[0.14em] uppercase text-[var(--fg-dim)]"
								>
									Feed — both sides
								</p>
								<ul class="m-0 list-none p-0 flex flex-col gap-1 max-h-[16rem] overflow-y-auto">
									{#each match.log.slice().reverse() as entry (entry.id)}
										<li class="flex items-baseline gap-2 font-mono text-[0.62rem]">
											<span class="text-[var(--fg-dim)] shrink-0">{entry.when}</span>
											<span>{entry.title}</span>
											<span class="text-[var(--fg-dim)]">{entry.subject}</span>
										</li>
									{/each}
								</ul>
							</Panel>
						{/if}
					{:else}
						<Panel>
							<p class="m-0 font-mono text-xs text-[var(--fg-dim)]">
								No match yet — this table is still filling.
							</p>
						</Panel>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
