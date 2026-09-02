<script lang="ts">
	// ── Setting the table ────────────────────────────────────────────────────
	// What the game master does BEFORE anybody else can see the room.
	//
	// The old screen opened a table the moment you asked for a link, which put
	// the size and the assignment mode on the same screen as three other people
	// already sitting down — so changing either was changing the game under
	// players who had already agreed to the last one. Splitting it means the
	// host settles the rules while the room is still empty, and the invite is
	// the moment those rules become everybody's.
	//
	// Nothing here is sent per-keystroke: the config travels once, with the
	// request that opens the table.

	import { MATCH_SIZES, type MatchSize } from '../internal/rules.js';
	import { ASSIGNMENT_MODES, type AssignmentMode } from '../internal/lobby.svelte.js';
	import { rulesHref } from '../api.js';

	// The first screen a new player sees is the right place to admit that this
	// game has rules nobody has read. Resolved on mount rather than at module
	// load: the showcase server-renders its routes, and `location` is not there.
	let rules = $state('');
	$effect(() => {
		rules = rulesHref();
	});

	/** The two answers to "whose chair is it". A pair of cards rather than a
	 *  switch, because the other two settings on this screen are pairs of cards
	 *  and a lone toggle among them reads as a different kind of decision. */
	const CHAIR_RULES = [
		{
			on: false,
			label: 'Play your chair',
			blurb: 'The character you are dealt is the one you play, for the whole match.'
		},
		{
			on: true,
			label: 'Change chairs',
			blurb:
				'Get up mid-match and take a chair a demonstrator is playing. Never a chair somebody is in.'
		}
	];

	interface Props {
		size: MatchSize;
		mode: AssignmentMode;
		/** Whether a player may take a demonstrator's chair mid-match. */
		takeover: boolean;
		busy?: boolean;
		error?: string | null;
		onsize: (s: MatchSize) => void;
		onmode: (m: AssignmentMode) => void;
		ontakeover: (v: boolean) => void;
		/** Open the table and hand back a link. The point of no return: after
		 *  this the rules are fixed and the room is real. */
		onopen: () => void;
		/** Play it alone, right now, against demonstrators. */
		onsolo: () => void;
	}

	let {
		size,
		mode,
		takeover,
		busy = false,
		error = null,
		onsize,
		onmode,
		ontakeover,
		onopen,
		onsolo
	}: Props = $props();
</script>

<div class="setup">
	<header>
		<div class="kicker">Breach · table setup</div>
		<h1>Set the table</h1>
		<p>
			Settle the rules while the room is still empty. Opening the table locks them in and gives
			you a link to send.
		</p>
		{#if rules}
			<a class="rules" href={rules}>Never played? Read the rules &amp; the deck →</a>
		{/if}
	</header>

	<section>
		<div class="label">Match size</div>
		<div class="cards">
			{#each MATCH_SIZES as s (s.id)}
				<button type="button" class="card" class:on={size === s.id} onclick={() => onsize(s.id)}>
					<span class="name">{s.label}</span>
					<span class="blurb">{s.blurb}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<div class="label">How characters are handed out</div>
		<div class="cards">
			{#each ASSIGNMENT_MODES as m (m.id)}
				<button type="button" class="card" class:on={mode === m.id} onclick={() => onmode(m.id)}>
					<span class="name">{m.label}</span>
					<span class="blurb">{m.blurb}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<div class="label">Whose chair is it</div>
		<div class="cards">
			{#each CHAIR_RULES as rule (rule.label)}
				<button
					type="button"
					class="card"
					class:on={takeover === rule.on}
					onclick={() => ontakeover(rule.on)}
				>
					<span class="name">{rule.label}</span>
					<span class="blurb">{rule.blurb}</span>
				</button>
			{/each}
		</div>
		<!-- Said here rather than discovered later: the chairs at a real table
		     belong to the people in them, and the server seats those. -->
		<p class="note">Applies to the chairs demonstrators are playing, on a table you play alone.</p>
	</section>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<footer>
		<button type="button" class="primary" disabled={busy} onclick={onopen}>
			{busy ? 'opening…' : 'Open the table'}
		</button>
		<button type="button" class="ghost" onclick={onsolo}>Play alone</button>
	</footer>
</div>

<style>
	.setup {
		width: min(680px, 100%);
		margin: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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
		font-size: 1.9rem;
		font-weight: 900;
		letter-spacing: 0.02em;
		margin: 0.35rem 0 0;
	}
	header p {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--fg-dim, #94a3b8);
		max-width: 46ch;
	}
	.rules {
		display: inline-block;
		margin-top: 0.65rem;
		font-family: var(--mono, ui-monospace, monospace);
		font-size: 0.68rem;
		color: var(--accent, #5eead4);
		text-decoration: none;
		border-bottom: 1px solid color-mix(in srgb, var(--accent, #5eead4) 40%, transparent);
	}
	.rules:hover {
		border-bottom-color: var(--accent, #5eead4);
	}
	.label {
		font-size: 0.55rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--fg-dim, #64748b);
		margin-bottom: 0.6rem;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
	}
	.card {
		text-align: left;
		padding: 0.8rem 0.9rem;
		border-radius: 10px;
		border: 1px solid var(--border, rgb(255 255 255 / 0.1));
		background: rgb(255 255 255 / 0.02);
		cursor: pointer;
		transition: all 0.16s;
	}
	.card:hover {
		background: rgb(255 255 255 / 0.05);
	}
	.card.on {
		border-color: var(--accent, #5eead4);
		background: color-mix(in srgb, var(--accent, #5eead4) 12%, transparent);
	}
	.name {
		display: block;
		font-weight: 700;
		font-size: 0.9rem;
	}
	.blurb {
		display: block;
		margin-top: 3px;
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--fg-dim, #94a3b8);
	}
	.note {
		margin: 0.5rem 0 0;
		font-size: 0.68rem;
		color: var(--fg-dim, #64748b);
	}
	.error {
		margin: 0;
		font-size: 0.75rem;
		color: #fb7185;
	}
	footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.primary {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		border: none;
		background: var(--accent, #5eead4);
		color: #05070c;
		font-weight: 800;
		font-size: 0.8rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.primary:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.ghost {
		padding: 0.75rem 1.1rem;
		border-radius: 8px;
		border: 1px solid var(--border, rgb(255 255 255 / 0.12));
		background: transparent;
		color: var(--fg-dim, #94a3b8);
		font-size: 0.75rem;
		cursor: pointer;
	}
	.ghost:hover {
		color: var(--fg, #e2e8f0);
	}
</style>
