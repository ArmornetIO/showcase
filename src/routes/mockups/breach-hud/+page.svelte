<script lang="ts">
	// ── BREACH · the HUD, with the game taken out from under it ──────────────────
	// Every piece of chrome the match floats over the globe, in the place it
	// floats there, and nothing else. No globe and no card fan — what is left is
	// the frame the game is read through, which is the one thing you cannot look
	// at while a globe is turning behind it.
	//
	// The dais IS in, despite standing where the character does: every ring,
	// pip and glyph on it is HUD — the turn clock, standing, action points, the
	// four skills, the upgrade track and the hero power. The figure that used to
	// stand in front of it is the part that is gone.
	//
	// These are the REAL panels driven by a real `BreachMatch`, not redrawings of
	// them. A mockup that copies the markup is a second set of pixels somebody
	// has to keep in step; this one can only go stale if the game does.
	//
	// The positioning wrappers are lifted verbatim from `Breach.svelte`, down to
	// the `xl:` breakpoint the floating layout is gated on — so what this shows
	// at 1280px and above is the arrangement, not an impression of it.
	import { onMount } from 'svelte';
	import { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import { CHAIN } from '$examples/breach/internal/rules.js';
	import { BEATS, fxFor } from '$examples/breach/internal/fx.js';
	import { TableSocket } from '$examples/breach/net.svelte.js';
	import PlayTicker from '$examples/breach/hud/PlayTicker.svelte';
	import ConnectionBanner from '$examples/breach/hud/ConnectionBanner.svelte';
	import ObjectiveLine from '$examples/breach/hud/ObjectiveLine.svelte';
	import RefusalNotice from '$examples/breach/hud/RefusalNotice.svelte';
	import Ticker from '$examples/breach/hud/Ticker.svelte';
	// The roster table, replaced. Local to the mockup on purpose: this is the
	// design being argued for, and the game keeps its panel until it wins.
	import HeroStack from '$examples/breach/hud/HeroStack.svelte';
	// The payload-path ladder and the target sheet, replaced by ONE panel. They
	// answered half a question each: the ladder knew which rungs were held and
	// nothing about their condition, the sheet knew everything about whichever
	// single building you last clicked.
	import BuildingStack from '$examples/breach/hud/BuildingStack.svelte';
	// The dais, unpacked into a corner panel. Same numbers, each next to the word
	// for it — see the file for why the medallion had to stop being a medallion.
	import MyStats from '$examples/breach/hud/MyStats.svelte';
	// The battle log, as a kill feed. Driven off `match.feed` like everything
	// else here — `LogEntry` carries the card, the building and the delta as
	// values now, so there is nothing left for a mockup row type to add.
	import LogFeed from '$examples/breach/hud/LogFeed.svelte';

	const match = new BreachMatch();

	// Never connected on purpose. `live` is false from construction, which is the
	// one state that makes the banner say something — a healthy socket is silent,
	// so a mockup holding a working one would show an empty slot.
	const socket = new TableSocket('mockup');

	// Held rather than shown-then-cleared: in play these are transient, and the
	// point of this page is to see all of them at rest at the same time.
	const REFUSAL = 'Not your turn — the Architect is still acting.';

	onMount(() => {
		const stop = match.start();
		void match.takeSeat('maintainer').then(() => {
			// The panels that only exist once you have picked something. Read off
			// the live match rather than hardcoded, so they survive a rebalance.
			//
			// Armed AND aimed at the first rung specifically: the action bar has
			// four states and only that one draws the odds, which is the half of
			// it worth looking at. Any later rung is out of order and the bar
			// shows the refusal instead.
			match.selectedId = CHAIN[0]?.id ?? null;

			// The hand is dealt at random, so "the first card" is a coin toss over
			// whether the bar shows its odds or a refusal. Ask the engine which of
			// them is actually legal here instead of hoping: `blockReason` and
			// `odds` are derived off the armed pair, so arming and then reading
			// back is the cheapest legal-move search there is.
			const hand = match.handOf(match.seat.key);
			const playable =
				hand.find((c) => {
					match.armedKey = c.key;
					return !match.blockReason && !!match.odds;
				}) ?? hand[0];
			match.armedKey = playable?.key ?? null;
			match.inspectKey = playable?.key ?? null;

			// Who is holding the other three. A local table names nobody, which
			// leaves every card in the stack saying "waiting" — and three of the
			// same word is the one thing the old roster panel got right to avoid.
			// Both kinds seeded on purpose: the person line has two shapes.
			match.players = {
				architect: { name: 'priya', kind: 'human' },
				state: { name: 'demonstrator', kind: 'ai' },
				hunter: { name: 'sam', kind: 'human' }
			};

			// ── A board mid-match ────────────────────────────────────────────
			// Round one is five identical untouched buildings, which is the one
			// state the buildings panel has nothing to say about. So the mockup
			// is posed a few turns in: two rungs taken, one of them dug in, a
			// wall knocked down, another reinforced, and two regions gone loud.
			//
			// Every field written here is one the engine owns and writes itself —
			// `barFor` reads all of it back, so what the panel draws is what it
			// would draw in a real match at this position, not a fixture.
			match.footholds = [
				{
					structure_id: CHAIN[0].id,
					seat_key: 'maintainer',
					persistent: true,
					revealed: true,
					sleeper: false,
					placed_round: 2,
					staged: false
				},
				{
					structure_id: CHAIN[1].id,
					seat_key: 'state',
					persistent: false,
					revealed: false,
					sleeper: true,
					placed_round: 4,
					staged: true
				}
			];
			// The delta `hardeningOf` adds to the printed number: the Forge has
			// been reinforced, the Silos softened. Both directions on screen at
			// once is the point — the bar reads as CONDITION, not strength.
			match.hardened = { forge: 2, silos: -5 };
			match.heat = { staging: 0, outlands: 22, commons: 71, foundry: 8, marches: 0 };
			match.round = 5;

			// Figures on the board. Without these every row reads EMPTY and the
			// contested line — the one that answers "who is actually standing on
			// it" — never draws. The Checkpoint is deliberately BOTH: red is in
			// and blue is still posted, which is the only interesting shape a
			// two-count can take.
			//
			// Blue garrison units also feed `hardeningOf`, so posting them here
			// moves the bars above. That coupling is the engine's and it is the
			// reason to seed real units rather than fake the pip counts.
			// Indexed off CHAIN rather than typed as ids: the rung a building sits
			// on is stable, its id is not — step 1 is `forum` and reads
			// "Maintainer Circle", which is exactly the pair a hand-typed id gets
			// wrong.
			match.garrison = [
				[CHAIN[0].id, 'red', 'implant', 'ghost', '#F472B6'],
				[CHAIN[1].id, 'red', 'implant', 'ghost', '#F472B6'],
				[CHAIN[2].id, 'blue', 'garrison', 'brute', '#38BDF8'],
				[CHAIN[2].id, 'blue', 'garrison', 'brute', '#38BDF8'],
				[CHAIN[4].id, 'blue', 'garrison', 'drone', '#38BDF8'],
				[CHAIN[4].id, 'red', 'implant', 'runner', '#F472B6']
			].map(([structureId, faction, leaves, shape, hue], i) => ({
				uid: `mock-${i}`,
				structureId: structureId as string,
				faction: faction as 'red' | 'blue',
				leaves: leaves as 'implant' | 'garrison',
				shape: shape as 'runner' | 'brute' | 'drone' | 'ghost',
				hue: hue as string,
				revealed: true,
				phase: i * 0.7
			}));
		});

		// ── The attack tell, on a loop ───────────────────────────────────────
		// A mockup is a still frame, and the two things worth looking at here are
		// not: the row pulsing while a building is being resolved against, and
		// the bar moving when it lands. So the page plays them.
		//
		// It drives the SAME fields a real resolution drives — `activeFx` for the
		// pulse, `hardened` for the number, `ping()` for the word — on roughly the
		// beat clock `#stage` uses. Nothing here is a special path the panel knows
		// about: swap this loop for a real match and the panel cannot tell.
		// It also writes the kill feed, through `match.push` and the engine's own
		// row shape — a fixture the feed could tell from a real match is a fixture
		// that will drift away from one.
		let rung = 2;
		let shot = 0;
		const CAST = [
			{ key: 'divergence', name: 'Release Divergence', actor: 'maintainer', outcome: 'clean' },
			{ key: 'implant', name: 'Sleeper Implant', actor: 'state', outcome: 'partial' },
			{ key: 'living', name: 'Living off the Land', actor: 'state', outcome: 'critical' },
			{ key: 'harden', name: 'Harden', actor: 'architect', outcome: 'fail' }
		] as const;

		const cycle = setInterval(() => {
			const target = CHAIN[rung];
			const move = CAST[shot % CAST.length];
			rung = (rung + 1) % CHAIN.length;
			shot += 1;
			const fx = fxFor(move.key, 'red');
			match.activeFx = {
				id: Date.now(),
				fromId: null,
				toId: target.id,
				fx,
				fogged: false,
				outcome: 'pending',
				beats: BEATS,
				startedAt: performance.now()
			};
			// The hit lands on the verdict beat, same as the engine's.
			setTimeout(() => {
				const delta = move.outcome === 'fail' ? 0 : move.outcome === 'critical' ? -3 : -1;
				match.hardened = {
					...match.hardened,
					[target.id]: (match.hardened[target.id] ?? 0) + delta
				};
				match.ping(target.id, 'tick');
				// A quarter of them arrive anonymous, which is what a blue seat sees
				// of red's quiet work and the state the feed has to look right in.
				// Withheld by OMISSION, exactly as `#played` withholds — the region
				// survives and everything sharper than it does not, so this poses the
				// fogged row rather than describing one.
				const fogged = shot % 4 === 0;
				match.push('all', {
					round: match.round,
					where: target.territory,
					...(fogged
						? {}
						: {
								actor: move.actor,
								actorSee: 'all',
								card: move.key,
								structure: target.id,
								delta,
								outcome: move.outcome
							}),
					when: `R${match.round} · ${move.name}`,
					title: 'struck',
					subject: target.name,
					icon: 'zap',
					tone: 'bad'
				});
			}, BEATS.verdict);
			setTimeout(() => (match.activeFx = null), BEATS.unlock);
		}, 5200);

		return () => {
			clearInterval(cycle);
			stop();
		};
	});
</script>

<svelte:head>
	<title>BREACH HUD — layout</title>
</svelte:head>

<div class="relative flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
	<div class="relative min-h-0 flex-1">
		<Ticker {match} onrules={() => {}} />

		<!-- Top-centre column: connection, refusal, objective — one measured stack,
		     because the globe's insets are driven off its height. -->
		<div
			class="flex flex-col items-center gap-2
			       xl:absolute xl:top-14 xl:left-1/2 xl:z-[3] xl:max-w-[min(92vw,54rem)] xl:-translate-x-1/2"
		>
			<ConnectionBanner {socket} />
			<RefusalNotice message={REFUSAL} ms={Number.MAX_SAFE_INTEGER} />

			<div
				class="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
				       px-3 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md
				       xl:flex-nowrap xl:whitespace-nowrap"
			>
				<ObjectiveLine {match} />
			</div>
		</div>

		<!-- Left column: who else is at the table, and what has happened. -->
		<div
			class="flex flex-col gap-3 xl:absolute xl:top-14 xl:bottom-[6.5rem] xl:left-4 xl:z-[3]
			       xl:w-[clamp(210px,18vw,250px)] xl:pointer-events-none"
		>
			<HeroStack {match} />
			<!-- The feed takes what is left of the column and scrolls inside it, so a
			     long match cannot push the seats off the top. -->
			<div class="flex min-h-0 flex-1 flex-col"><LogFeed {match} /></div>
		</div>

		<!-- Right column: the objective ladder, the sheet for whatever is picked,
		     and — pushed to the bottom of the column — my own seat. The dais used
		     to hold that last one in the middle of the board, stacked under the
		     card sheet and the action bar, which is three unrelated things
		     competing for the one strip of screen a player is already looking at. -->
		<div
			class="flex flex-col gap-3 xl:absolute xl:top-14 xl:bottom-4 xl:right-4 xl:z-[3]
			       xl:w-[clamp(260px,25vw,340px)] xl:pointer-events-none"
		>
			<!-- My seat is the one panel in this column that must never be cut off:
			     it is where the numbers you spend live. So it is `shrink-0` and the
			     two above it take the squeeze — a ladder scrolled by a notch still
			     reads, a hero power sliced off the bottom edge does not. -->
			<!-- `overflow-x-clip` rather than leaving it to compute: setting only
			     `overflow-y` forces the other axis to `auto`, so ANY child that
			     leans a pixel right — a lift, a shadow-bearing badge, a long name —
			     grows a horizontal scrollbar in a column that should never have
			     one. `clip` refuses the scrollbar without making a scroll container.
			     The stack reserves its own runway, so this clips nothing today; it
			     is here so the next thing added cannot reintroduce it. -->
			<div class="flex min-h-0 flex-1 flex-col gap-3 xl:overflow-y-auto xl:overflow-x-clip">
				<BuildingStack {match} />
			</div>
			<div class="shrink-0"><MyStats {match} /></div>
		</div>

		<!-- The bottom of the screen, in one strip. The card sheet and the action
		     bar used to be two floating panels here, each appearing and vanishing
		     on its own schedule; they are one permanent, fixed-height ticker now. -->
		<PlayTicker
			{match}
			class="absolute bottom-[14px] left-1/2 z-[6] h-[52px] w-[min(94vw,52rem)] -translate-x-1/2"
		/>

		<!-- The felt. Shorter than the game's, because what it is backing is now a
		     card sheet and a bar rather than a fanned hand and a standing figure. -->
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[11rem]"
			style:background="linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)"
		></div>
	</div>
</div>
