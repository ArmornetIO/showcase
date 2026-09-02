<script lang="ts">
	// ── Pick a side ──────────────────────────────────────────────────────────
	// The gate every arrival passes through, and the reason the seat stopped
	// being a control.
	//
	// A seat is red or blue before anybody sits in it, so "join red" resolves to
	// "take the first free red seat" — which means the team's capacity is not a
	// rule written down anywhere, it is just how many chairs that side has. A
	// full side cannot be chosen because there is nothing to give you.
	//
	// Shown to anybody holding no chair. That includes somebody who arrived on a
	// link ten seconds ago and the host of a table nobody has joined yet: both
	// have exactly one decision to make and it is this one.

	import { SIDES } from './sides.js';
	import type { Faction } from '../internal/rules.js';
	import type { BreachLobby } from '../internal/lobby.svelte.js';

	interface Props {
		lobby: BreachLobby;
		/** Null while the table is still being opened — the sides are shown, and
		 *  refuse, because a room you cannot join yet is clearer than a spinner. */
		onpick: ((side: Faction) => void) | null;
		/** Live invite link, once the host has one to give. */
		invite?: string | null;
		copied?: boolean;
		oncopy?: () => void;
	}

	let { lobby, onpick, invite = null, copied = false, oncopy }: Props = $props();
</script>

<div class="picker">
	<header>
		<div class="kicker">Breach · {lobby.seats.length} seats</div>
		<h1>Pick a side</h1>
		<p>Your seat and your turn order fall out of the choice. The character comes later.</p>
	</header>

	<div class="sides">
		{#each ['red', 'blue'] as const as f}
			{@const n = lobby.countOn(f)}
			{@const full = n.taken >= n.total}
			<button
				type="button"
				class="side"
				class:full
				style:--sc={SIDES[f].tone}
				disabled={full || !onpick}
				onclick={() => onpick?.(f)}
			>
				<span class="bar"></span>
				<span class="name">{SIDES[f].label}</span>
				<span class="call">{SIDES[f].call}</span>
				<span class="blurb">{SIDES[f].blurb}</span>

				<!-- Seats as pips, not a fraction. "2/2" is a number you read;
				     two filled dots is a thing you see. -->
				<span class="seats">
					{#each lobby.seatsOn(f) as seat (seat.id)}
						<span class="pip" class:taken={seat.occupant.kind !== 'open'} class:bot={seat.occupant.kind === 'ai'}
						></span>
					{/each}
					<span class="count">{full ? 'side full' : `${n.total - n.taken} open`}</span>
				</span>
			</button>
		{/each}
	</div>

	{#if !onpick}
		<p class="note">Opening the table…</p>
	{:else if invite}
		<div class="invite">
			<span class="label">Invite</span>
			<code>{invite}</code>
			<button type="button" onclick={oncopy}>{copied ? 'copied' : 'copy'}</button>
		</div>
	{/if}
</div>

<style>
	.picker {
		width: min(760px, 100%);
		margin: auto;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		padding: 2rem 1.5rem;
	}
	.kicker {
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 0.56rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--fg-dim, #64748b);
	}
	h1 {
		font-size: 2rem;
		font-weight: 900;
		margin: 0.35rem 0 0;
	}
	header p {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--fg-dim, #94a3b8);
	}
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.75rem;
	}
	.side {
		position: relative;
		text-align: left;
		padding: 1.1rem 1.1rem 1.1rem 1.4rem;
		border-radius: 12px;
		border: 1px solid var(--border, rgb(255 255 255 / 0.1));
		background: rgb(255 255 255 / 0.02);
		cursor: pointer;
		overflow: hidden;
		transition: all 0.18s;
	}
	.side:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--sc) 60%, transparent);
		background: linear-gradient(100deg, color-mix(in srgb, var(--sc) 16%, transparent), transparent 72%);
		transform: translateY(-2px);
	}
	.side:disabled {
		cursor: default;
	}
	.side.full {
		opacity: 0.42;
	}
	.bar {
		position: absolute;
		inset: 0 auto 0 0;
		width: 4px;
		background: var(--sc);
	}
	.name {
		display: block;
		font-size: 1.35rem;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--sc);
	}
	.call {
		display: block;
		font-size: 0.8rem;
		color: var(--fg, #e2e8f0);
		margin-top: 2px;
	}
	.blurb {
		display: block;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--fg-dim, #94a3b8);
		margin-top: 0.5rem;
	}
	.seats {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 0.85rem;
	}
	.pip {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--sc) 55%, transparent);
	}
	.pip.taken {
		background: var(--sc);
	}
	.pip.bot {
		background: color-mix(in srgb, var(--sc) 45%, transparent);
	}
	.count {
		margin-left: 6px;
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim, #64748b);
	}
	.note {
		margin: 0;
		font-size: 0.75rem;
		color: var(--fg-dim, #64748b);
	}
	.invite {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		border-radius: 8px;
		border: 1px solid var(--border, rgb(255 255 255 / 0.1));
		background: rgb(255 255 255 / 0.02);
	}
	.invite .label {
		font-size: 0.53rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim, #64748b);
	}
	.invite code {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.72rem;
		color: var(--fg, #e2e8f0);
	}
	.invite button {
		border: 1px solid var(--border, rgb(255 255 255 / 0.12));
		background: transparent;
		color: var(--fg-dim, #94a3b8);
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 0.65rem;
		cursor: pointer;
	}
</style>
