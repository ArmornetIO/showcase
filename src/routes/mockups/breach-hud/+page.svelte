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
	// `ConnectionBanner` and `RefusalNotice` are not mounted any more. Both were
	// floating panels at the top of the screen saying things about the bottom of
	// the screen — the bar is the surface that reports what is happening this
	// round, so a dropped table and a refused move are rows in it now. See
	// `notice.ts`.
	import ObjectiveLine from '$examples/breach/hud/ObjectiveLine.svelte';
	// ── The top bar is gone ──────────────────────────────────────────────────
	// `Ticker` carried six things across the top of the screen and four of them
	// were already somewhere better:
	//
	//   the four seat chips  →  the hero stack names every seat AND lights the
	//                           acting one, in the same column, with their
	//                           standing next to them
	//   "to act: <name>"     →  the same "NOW" badge, said once instead of twice
	//   the five heat pips   →  every building already wears its region's heat,
	//                           against the building the number is about
	//   round + turn clock   →  the mast, at the top of the seat plate, at 28px
	//                           instead of the 0.62rem the strip gave them
	//
	// What was left — rules and watch — is two buttons that open things, which
	// is a cog cluster, not a strip. So the strip goes and the board gets its
	// top 40px back.
	// The initiative order the chips carried survives as the mast's ORDER rail —
	// which is what let the strip's copy of it go rather than merely move.
	// ── The three surfaces, redesigned ───────────────────────────────────────
	// `PlayTicker`, `SeatClock` and `MyStats` were three separate opinions about
	// what colour "now" is — the ticker in the armed card's kind-hue, the clock
	// in the acting seat's with its own warning ramp, the seat panel in YOUR hue
	// with a third copy of that ramp. `hudState` is one ladder all three derive
	// off, so when it goes amber the whole HUD goes amber in the same frame.
	import { hudState } from './hud-state.js';
	// One card holding both halves — `SeatPlate` and `Breech` are its content and
	// are not mounted directly any more.
	import BattleCentre from './BattleCentre.svelte';
	import TopClock from './TopClock.svelte';
	import TurnVignette from './TurnVignette.svelte';
	// The region for things that HAPPEN, as opposed to the panels that answer
	// standing questions. Empty by default and that is correct in the game — so
	// the loop below poses a verdict through it, because an empty region is the
	// one thing a layout page cannot show you.
	import GameEventsOverlay from '$examples/breach/hud/GameEventsOverlay.svelte';
	// The roster table, replaced. Local to the mockup on purpose: this is the
	// design being argued for, and the game keeps its panel until it wins.
	import TableStrip from './TableStrip.svelte';
	import LeadChange from './LeadChange.svelte';
	// The payload-path ladder and the target sheet, replaced by ONE panel. They
	// answered half a question each: the ladder knew which rungs were held and
	// nothing about their condition, the sheet knew everything about whichever
	// single building you last clicked.
	import BuildingStack from '$examples/breach/hud/BuildingStack.svelte';
	// The battle log, as a kill feed. Driven off `match.feed` like everything
	// else here — `LogEntry` carries the card, the building and the delta as
	// values now, so there is nothing left for a mockup row type to add.
	import LogFeed from '$examples/breach/hud/LogFeed.svelte';

	const match = new BreachMatch();

	// Never connected on purpose. `live` is false from construction, which is the
	// one state that makes the banner say something — a healthy socket is silent,
	// so a mockup holding a working one would show an empty slot.
	const socket = new TableSocket('mockup');

	// ── The notice, on a timer ───────────────────────────────────────────────
	// The socket is never connected, which used to be the point: a healthy one is
	// silent, so a mockup holding a working socket showed an empty slot.
	//
	// That stopped working when the notice moved INTO the bar. A permanently
	// broken socket means the bar permanently says "reconnecting" and the sentence
	// it exists to show — card, target, odds — is never on screen. So the fault is
	// handed to the bar in a window instead: mostly the real sentence, and every
	// so often the interruption taking it over, which is the pair worth seeing.
	let noticeOn = $state(false);

	// One ladder, three surfaces. Derived once here and passed down rather than
	// recomputed in each — three `$derived`s off the same pure function would
	// agree, but passing it makes "they cannot disagree" structural.
	const hud = $derived(hudState(match));

	// ── The "your turn" moment ───────────────────────────────────────────────
	// Fires on the RISING edge of `isMyTurn`, held 900ms. `seen` is a plain
	// `let`, not `$state`: an effect that writes state it also reads is an
	// effect that re-runs itself, and this one only ever needs to remember what
	// it saw last.
	let takeover = $state(false);
	let vignette = $state(0);
	let seen = false;

	$effect(() => {
		const mine = match.isMyTurn && match.stage === 'play' && !match.winner && !match.busy;
		if (mine === seen) return;
		seen = mine;
		if (!mine) {
			takeover = false;
			vignette = 0;
			return;
		}
		takeover = true;
		vignette = 0.35;
		// The plate hands the space back to the sentence; the wash settles to a
		// level it holds for the rest of the turn. 1080ms of ceremony total —
		// under the ~1.2s at which a player starts hunting for the information
		// themselves.
		const drop = setTimeout(() => (takeover = false), 900);
		const settle = setTimeout(() => (vignette = 0.18), 1080);
		return () => {
			clearTimeout(drop);
			clearTimeout(settle);
		};
	});

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
		// `actor` is the seat, `who` is the person in it — the engine carries both
		// and the announcement prints them side by side, so seeding one string for
		// the pair reads "MAINTAINER MAINTAINER". `who` matches the roster seeded
		// above, because the feed and the card naming the same move differently is
		// the drift this whole page exists to catch.
		const CAST = [
			{ key: 'divergence', name: 'Release Divergence', actor: 'maintainer', who: 'you', outcome: 'clean' },
			{ key: 'implant', name: 'Sleeper Implant', actor: 'state', who: 'demonstrator', outcome: 'partial' },
			{ key: 'living', name: 'Living off the Land', actor: 'state', who: 'demonstrator', outcome: 'critical' },
			{ key: 'harden', name: 'Harden', actor: 'architect', who: 'priya', outcome: 'fail' }
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
			// The announcement opens on the same beat as the effect, exactly as
			// `#stage` opens it — same fields, same clock, so the overlay cannot
			// tell this apart from a real resolution.
			match.verdict = {
				id: shot,
				faction: 'red',
				actor: move.who,
				seat: move.actor,
				card: move.name,
				target: target.name,
				territory: target.territory,
				word: fx.word,
				hue: fx.hue,
				fogged: false,
				sealed: false,
				roll: null,
				throws: true,
				stage: 'cast'
			};
			// Advanced by PATCH, never rebuilt — `id` has to survive all four
			// stages or the card restarts its entrance animation three times per
			// resolution. Same reason the engine's own `#say` is a patch.
			const say = (patch: Partial<NonNullable<typeof match.verdict>>) => {
				if (match.verdict) match.verdict = { ...match.verdict, ...patch };
			};
			setTimeout(() => say({ stage: 'rolling' }), BEATS.diceStart);
			setTimeout(
				() =>
					say({
						stage: 'settled',
						roll: {
							dice: [4, move.outcome === 'critical' ? 6 : 2],
							total: move.outcome === 'critical' ? 10 : 6,
							hit: move.outcome !== 'fail',
							outcome: move.outcome,
							margin: move.outcome === 'fail' ? -2 : 3
						}
					}),
				BEATS.diceSettle
			);
			// The hit lands on the verdict beat, same as the engine's.
			setTimeout(() => {
				say({ stage: 'done' });
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
			// Both torn down on the unlock beat, together, exactly as `#stage` tears
			// them down — a verdict left standing after its effect is gone is a
			// state the game never produces.
			setTimeout(() => {
				match.activeFx = null;
				match.verdict = null;
			}, BEATS.unlock);
		}, 5200);

		// ── The table, taking turns ──────────────────────────────────────────
		// Half this HUD only exists in states a your-turn pose cannot reach: the
		// waiting plate, the hollow AP pips, the drained loadout — and the
		// takeover, which is an EDGE and so cannot be posed at all, only
		// crossed. So the mockup passes the chair round the table.
		//
		// `activeKey` is the seat the engine itself reads through `activeKlass`,
		// and `isMyTurn` derives off it — so setting it here crosses exactly the
		// edge a real handoff crosses. Nothing watches for a mockup.
		let turn = 0;
		const hands = setInterval(() => {
			turn = (turn + 1) % match.seatOrder.length;
			match.activeKey = match.seatOrder[turn];
			match.phase = turn;
			// Once round the table, the connection drops for three seconds so the
			// bar's interruption state is on screen without owning it.
			if (turn === 0) {
				noticeOn = true;
				setTimeout(() => (noticeOn = false), 3000);
			}
		}, 7000);

		return () => {
			clearInterval(cycle);
			clearInterval(hands);
			stop();
		};
	});
</script>

<svelte:head>
	<title>BREACH HUD — layout</title>
</svelte:head>

<!-- `--play-h` / `--play-gap` / `--play-block` are published here for the same
     reason the game publishes them: the felt sits exactly on top of the ticker,
     and a pair of hard-coded rems that drift leave either a gap under the strip
     or a bar drawn over it. Same numbers as `Breach.svelte`. -->
<div
	class="relative flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]"
	style:--play-h="76px"
	style:--play-gap="14px"
	style:--play-block="104px"
>
	<TurnVignette color={match.seat.color} level={vignette} />
	<div class="relative min-h-0 flex-1">
		<!-- Top-centre column: connection, refusal, objective — one measured stack,
		     because the globe's insets are driven off its height. -->
		<div
			class="flex flex-col items-center gap-2
			       xl:absolute xl:top-4 xl:left-1/2 xl:z-[3] xl:max-w-[min(96vw,62rem)] xl:-translate-x-1/2"
		>
			<!-- The clock, top centre, above everything else in this column. It is
			     the number a player looks up for without being prompted, and the
			     rail is where you go to read something deliberately — which is how
			     it ended up somewhere nobody could find it. -->
			<!-- The two sides either side of the score, the way a fixture board has
			     always drawn them. The strip used to sit UNDER the clock as one run of
			     four chips, which put an enemy next to your ally and made the split
			     something you had to read off the flags. -->
			<div class="flex items-start gap-2">
				<TableStrip {match} faction="red" />
				<TopClock {match} state={hud} />
				<TableStrip {match} faction="blue" />
			</div>
		</div>

		<!-- Left column: what has happened. -->
		<div
			class="flex flex-col gap-3 xl:absolute xl:top-4 xl:bottom-7 xl:left-4 xl:z-[3]
			       xl:w-[clamp(210px,18vw,250px)] xl:pointer-events-none"
		>
			<!-- Above the feed rather than inside it: the log is fogged and derived
			     from rows this viewer can prove, and a lead is a fact about the board
			     that every seat can see. It leaves after a few seconds — the
			     scoreboard is the standing record. -->
			<LeadChange {match} />
			<!-- The feed takes what is left of the column and scrolls inside it, so a
			     long match cannot push the seats off the top. The `max-h` is the
			     game's: below `xl` the column is in normal flow and an unbounded feed
			     would run off the page. -->
			<LogFeed {match} class="max-h-[40vh] min-h-0 flex-1 xl:max-h-none" />
		</div>

	<!-- Right column: the objective ladder, and under it whatever just happened.
		     `overflow-x-clip` on the ladder rather than leaving it to compute —
		     setting only `overflow-y` forces the other axis to `auto`, and any child
		     that leans a pixel right grows a horizontal scrollbar. -->
		<div
			class="flex flex-col gap-3 xl:absolute xl:top-4 xl:bottom-7 xl:right-4 xl:z-[3]
			       xl:w-[clamp(260px,25vw,340px)] xl:pointer-events-none"
		>
		<!-- Not `flex-1`: that made the ladder eat the column and pushed the two
			     strips below it to the floor, a screen away from what they are about.
			     It sizes to content and scrolls only if it outgrows the space, and the
			     spacer at the end takes whatever is left. -->
			<div class="flex min-h-0 shrink flex-col gap-3 xl:overflow-y-auto xl:overflow-x-clip">
				<BuildingStack {match} />
			</div>

			<!-- ── The dice, under the buildings ──────────────────────────────────
			     This floated in its own region to the LEFT of this column, because
			     the column was full — the seat plate held the bottom of it. That plate
			     is in the battle centre now, so the events land here instead of
			     hovering over the board beside the thing they are about.

			     A resolution is always AT a building, and the building it hit is in
			     the ladder directly above. `shrink-0` because the ladder is what
			     should give when the column is tight: a rung scrolled out of view is
			     recoverable, a verdict that never draws is missed entirely. -->
		<!-- The objective, as a strip under the ladder it is about. It floated top
			     centre in a panel of its own, which put "take 4 more links" a screen
			     away from the four links. Same width as the buildings by being IN the
			     column, so the two stay in step without a shared measurement. -->
			<div
				class="shrink-0 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elev,#0b0f16)_86%,transparent)]
				       px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md"
			>
				<ObjectiveLine {match} />
			</div>

			<div class="shrink-0">
				<GameEventsOverlay {match} class="w-full" />
			</div>

			<span class="flex-1"></span>
		</div>

		<!-- ── No felt ────────────────────────────────────────────────────────────
		     The game draws a full-width gradient across the bottom to back its card
		     fan. This page has no fan, so the gradient was backing nothing — and a
		     dark band spanning the whole floor is exactly what turns a floating
		     panel into a FOOTER. Every other surface here hovers over the board on
		     its own; the strip should too, and without the band behind it, it does.
-->

		<!-- ── THE BATTLE CENTRE ─────────────────────────────────────────────────
		     Your seat and the move you are making, stacked and centred on the
		     screen: who you are on top, what you are about to do underneath.

		     They were in two different corners — the plate pinned bottom-right, the
		     bar bound between the rails — which meant the two things a player uses
		     on their own turn were the furthest apart on the board. Centred, they
		     are one object with one silhouette, and the rails go back to being what
		     they are: reference you consult, not controls you drive.

		     The socket and any refusal go INTO the bar rather than floating
		     anywhere: it is already the "what is happening right now" surface, so a
		     dropped table is the same kind of sentence as whose turn it is. -->
		<BattleCentre
			{match}
			state={hud}
			{takeover}
			socket={noticeOn ? socket : null}
			refusal={null}
			class="absolute bottom-6 left-1/2 z-[6] w-[min(94vw,54rem)] -translate-x-1/2"
		/>

	</div>
</div>
