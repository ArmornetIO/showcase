<script lang="ts">
	// ── God mode · an Insider Threat match, through one player ────────────────
	// The office as the followed player sees it — their view, their reactions,
	// the cues those carry — and a cue to send any of them. The server decides
	// what reaches whom (internal/breach/spectate.go, linehub handleBreachCue);
	// this only says which seat to follow and which cue to send.
	import { HudCard, IconButton, Tooltip, type IconName } from 'showcase';
	import InsiderThreat from '../InsiderThreat.svelte';
	import type { TableSocket } from '../net.svelte.js';
	import { OFFICE_DATA, type OfficeCueKey } from '../internal/office.gen.js';
	import { DEFAULT_APPEARANCE, resolve } from '../internal/appearance.js';
	import { recordDressed, recordReactions } from '../internal/sim.svelte.js';

	interface Props {
		socket: TableSocket;
		onstop: () => void;
	}
	let { socket, onstop }: Props = $props();

	/** Typed by the catalog, so a cue added to office.yaml without an icon is a
	 *  compile error here rather than a blank button. */
	const ICON: Record<OfficeCueKey, IconName> = {
		flicker_out: 'power',
		red_alarm: 'alert-triangle',
		blackout: 'eye-off',
		blood_red: 'activity',
		candles_gutter: 'flame',
		lightning: 'zap'
	};
	const CUES = Object.keys(OFFICE_DATA.cues) as OfficeCueKey[];

	const office = $derived(socket.view?.office);
	const players = $derived(office?.players ?? []);

	/** Everybody the camera can see: people by their relayed poses, bots where
	 *  the office says they stand. The followed player is among them — their
	 *  pose is where the camera goes. */
	const others = $derived([
		...Object.entries(socket.poses).map(([seat, p]) => ({ ...p, seat })),
		...players.flatMap((p) =>
			p.bot && p.at && !p.escorted ? [{ x: p.at.x, y: 0, z: p.at.z, yaw: 0, seat: p.seatId }] : []
		)
	]);

	/** Each seat as its player dressed it. Bare, as the players see each other. */
	const figures = $derived(
		Object.fromEntries(
			(socket.view?.lobby.seats ?? []).flatMap((s) =>
				s.occupant.kind === 'open'
					? []
					: [[s.id, resolve(s.appearance ?? DEFAULT_APPEARANCE, { key: s.id, name: s.occupant.name ?? s.id })]]
			)
		)
	);
	$effect(() => recordReactions(socket.reactions));
	$effect(() => {
		const seats = socket.view?.lobby.seats ?? [];
		recordDressed(Object.keys(figures), (id) => seats.find((s) => s.id === id)?.appearance ?? DEFAULT_APPEARANCE);
	});
</script>

<InsiderThreat {others} {office} {figures} reactions={socket.reactions} follow={socket.following} />

<div class="watch">
	<HudCard dense eyebrow="GOD MODE · WATCHING" title={players.find((p) => p.seatId === socket.following)?.handle ?? '—'}>
		<ul class="players">
			{#each players as p (p.seatId)}
				<li>
					<button class="player" class:on={p.seatId === socket.following} onclick={() => socket.follow(p.seatId)}>
						<span class="seat">{p.seatId}</span>
						{p.handle}{p.bot ? ' · bot' : ''}{p.escorted ? ' · out' : ''}
					</button>
				</li>
			{/each}
		</ul>
		<div class="cues">
			{#each CUES as key (key)}
				<Tooltip content={key.replace('_', ' ')} placement="bottom">
					<IconButton
						icon={ICON[key]}
						label="Send {key} to {socket.following}"
						variant="bordered"
						disabled={!socket.following}
						onclick={() => socket.cue(socket.following, key)}
					/>
				</Tooltip>
			{/each}
		</div>
		<button class="stop" onclick={onstop}>Stop watching</button>
	</HudCard>
</div>

<style>
	.watch {
		position: fixed;
		top: var(--sp-4);
		right: var(--sp-4);
		width: 240px;
		z-index: 1;
	}
	.players {
		display: grid;
		gap: var(--sp-1);
		margin: 0 0 var(--sp-3);
		padding: 0;
		list-style: none;
	}
	.player,
	.stop {
		width: 100%;
		padding: var(--sp-1) var(--sp-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: var(--t-micro);
		text-align: left;
		cursor: pointer;
	}
	.player.on {
		border-color: var(--accent);
		color: var(--fg);
	}
	.seat {
		color: var(--accent);
		margin-right: var(--sp-1);
	}
	.cues {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin-bottom: var(--sp-3);
	}
</style>
