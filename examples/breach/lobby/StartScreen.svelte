<script lang="ts">
	// ── The start screen ────────────────────────────────────────────────────────
	// What a visitor sees after the title and before anything is asked of them.
	// It used to be nothing: a signed-out visitor went from the title card
	// straight to the sign-in stepper, so somebody arriving from a post was asked
	// for an account before being shown what the game is.
	//
	// It answers "what is this, and would I want to play it" with the game's own
	// pieces rather than a picture of them: the real board (the same globe the
	// match is played on, at rest), the four seats as the characters they are,
	// and the win conditions in the rulebook's words. Play is the one decision on
	// it; Learn more opens the longer version without leaving the page.
	//
	// The frame — bar, dock, dialogs, the phone layout — is `start/StartShell`,
	// shared with Insider Threat's screen; this file is Breach's part of it.
	import { DEFAULT_ART, Figure, MeshCanvas, makeTerrain, prefersReducedMotion } from 'showcase';
	import type { MeshLayoutId } from 'showcase';
	import { BreachMatch, HAND_SIZE, HORIZON } from '../internal/match.svelte.js';
	import {
		CHAIN,
		CORE_ID,
		ROSTER,
		klassByKey,
		moveByKey,
		structureById,
		type Faction,
		type Klass
	} from '../internal/rules.js';
	import { SIDE_TONE } from '../internal/badge.js';
	import { kitFor } from '../hud/kit.js';
	import { boardEdges, boardNodes, groupKeyOf, nodeFootprint, styleOf } from '../board-view.js';
	import BoardFx from '../Board.svelte';
	import type { MeshHandle } from '../FirstPerson.svelte';
	import { getLeaderboard, rulesHref } from '../api.js';
	import StartShell, {
		type HeroBox,
		type StartLearn,
		type StartStep,
		type StartTitle
	} from './start/StartShell.svelte';
	import SidePanel from './start/SidePanel.svelte';

	interface Props {
		/** `false` when the host knows the visitor is signed out, so Play is
		 *  honest about leading to the sign-in step. `null` is a host with no
		 *  accounts (the standalone build), where Play goes straight in. */
		account: boolean | null;
		/** Play was pressed and the page is on its way to sign in. */
		leaving?: boolean;
		/** Mount the globe. Held back while the title is over this screen, so
		 *  the board's fly-in plays when it can be seen rather than under the
		 *  curtain, and the two scenes never draw at once. */
		globe?: boolean;
		onplay: () => void;
		titles?: readonly StartTitle[];
	}

	let { account, leaving = false, globe = true, onplay, titles }: Props = $props();

	let layout = $state<MeshLayoutId>('globe');
	let mesh = $state<MeshHandle | null>(null);

	// The globe is fitted to the part of the stage the headline and the dock
	// leave free, the way the board is fitted around the HUD. On one column the
	// globe has a block of its own and nothing floats over it.
	//
	// The canvas only re-fits when these insets CHANGE, and it fits once before
	// it has measured itself. So nothing is passed until the box is measured,
	// and every side carries a margin proportional to the box: a resize, or the
	// first real measurement, changes the insets and re-centres the globe. With
	// constant insets a phone kept the first, unmeasured fit, zoomed into a corner.
	function insetsFor(b: HeroBox) {
		if (!b.w || !b.h) return undefined;
		// Both sides count, so a change in either one (a scrollbar arriving, say)
		// moves the margin and earns a re-fit.
		const pad = Math.round((b.w + b.h) * 0.01);
		return b.wide
			? { top: pad, right: Math.round(b.headW * 0.92), bottom: b.dockH + 10, left: pad }
			: { top: pad, right: pad, bottom: pad, left: pad };
	}

	// The board's own seed, so this is the ground the match is played on.
	const terrain = makeTerrain({ seed: 20260809, octaves: 4, frequency: 9, gain: 0.5 });
	const still = prefersReducedMotion();

	// ── Red's opening, on a loop ─────────────────────────────────────────────
	// The globe plays real attacks, so a visitor sees what a move looks like
	// before deciding to make one.
	//
	// On a board of its own, never the table the visitor is about to sit at: a
	// demo that took footholds on the lobby's match would start the game three
	// links down. Posed, as the front page's panel is (app-ui BreachHud): its
	// remote declines, so nothing but the replay below can move it, and
	// `perform` with dice is the game's own path for replaying a ruled move.
	const demo = new BreachMatch();
	demo.remote = { commit: () => {}, endTurn: () => {}, newMatch: () => {} };

	/** One link at a time, each card a real red attack that is legal on its
	 *  building. Double six so every take lands: the panel is advertising the
	 *  move, not the odds. */
	const SCRIPT = [
		{ actor: 'maintainer', card: 'extension', target: 'forum' },
		{ actor: 'state', card: 'sleeper', target: 'archive' },
		{ actor: 'maintainer', card: 'divergence', target: 'forge' }
	];
	const DICE: [number, number] = [6, 6];
	const TURN_MS = 1100;
	const REST_MS = 2600;
	const RESET_MS = 5000;

	function pose() {
		demo.stage = 'play';
		demo.size = '2v2';
		demo.round = 1;
		demo.seatKey = 'maintainer';
		demo.phase = 0;
		demo.yourTurn = true;
		demo.busy = false;
		demo.pending = false;
		demo.winner = null;
		demo.activeFx = null;
		demo.verdict = null;
		demo.selectedId = null;
		demo.armedKey = null;
		demo.garrison = [];
		demo.footholds = [];
		demo.pings = [];
		demo.chip = {};
		demo.hardened = {};
		demo.softened = {};
		demo.heat = { staging: 0, outlands: 0, commons: 0, foundry: 0, marches: 0 };
		demo.ap = { maintainer: 9, state: 9, architect: 3, hunter: 3 };
	}
	pose();

	const nodes = $derived(boardNodes(demo));
	const edges = $derived(boardEdges(demo));
	const held = $derived(new Set(demo.chainHeld.map((s) => s.id)));

	/** Turn the globe until `id` faces the eye, on our own clock and at the
	 *  current distance: `flyToNode` dives onto the building, and this screen
	 *  wants the whole world in frame while the strike lands. */
	function turnTo(m: MeshHandle, id: string, alive: () => boolean): Promise<void> {
		const from = m.cameraPose();
		// A gentle lift: the default tilt is tuned for a dive, and from orbit it
		// parks the building on the top edge, under the bar.
		const to = m.poseFacing(id, { distance: from.viewDistance, tilt: 0.22 });
		if (!to) return Promise.resolve();
		const t0 = performance.now();
		return new Promise((done) => {
			const step = (now: number) => {
				if (!alive()) return done();
				const u = Math.min(1, (now - t0) / TURN_MS);
				const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
				m.setCameraPose({
					yaw: from.yaw + (to.yaw - from.yaw) * e,
					pitch: from.pitch + (to.pitch - from.pitch) * e,
					viewDistance: from.viewDistance
				});
				if (u < 1) requestAnimationFrame(step);
				else done();
			};
			requestAnimationFrame(step);
		});
	}

	// Runs while the board is on screen; stops when the screen goes, and does
	// not start for a reader who asked for stillness.
	$effect(() => {
		const m = mesh;
		if (!globe || still || !m) return;
		let live = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const alive = () => live;
		const sleep = (ms: number) =>
			new Promise<void>((r) => {
				timer = setTimeout(r, ms);
			});
		(async () => {
			// The fly-in first: seizing the camera cuts it short.
			await sleep(2600);
			while (live) {
				for (const beat of SCRIPT) {
					if (!live) return;
					const release = m.seizeCamera();
					try {
						await turnTo(m, beat.target, alive);
						if (!live) return;
						await demo.perform(
							klassByKey(beat.actor),
							moveByKey(beat.card)!,
							structureById(beat.target)!,
							DICE
						);
					} finally {
						release();
					}
					await sleep(REST_MS);
				}
				await sleep(RESET_MS);
				if (live) pose();
			}
		})();
		return () => {
			live = false;
			clearTimeout(timer);
		};
	});

	interface Side {
		id: Faction;
		label: string;
		role: string;
		goal: string;
		klasses: Klass[];
	}
	const SIDES: Side[] = [
		{
			id: 'red',
			label: 'Red',
			role: 'The Outlaws',
			goal: `Hold all ${CHAIN.length} links of the payload path at once.`,
			klasses: ROSTER.filter((k) => k.faction === 'red')
		},
		{
			id: 'blue',
			label: 'Blue',
			role: 'The Enforcers',
			goal: `Hold them off until the end of round ${HORIZON}.`,
			klasses: ROSTER.filter((k) => k.faction === 'blue')
		}
	];

	/** The Architect on the slimmer runner build. The game's brute stands short
	 *  and wide beside the other three; the brand hub's face-off poster made the
	 *  same swap (Kaitlyn, 2026-10-16). Identity, colour and kit stay his. */
	const figureOf = (k: Klass): Klass => (k.key === 'architect' ? { ...k, shape: 'runner' } : k);

	/** Each side faces the middle, as they do on the versus screen. */
	const artFor = (k: Klass) => ({
		worn: kitFor(k.key),
		trim: k.color,
		yaw: k.faction === 'red' ? DEFAULT_ART.yaw : -DEFAULT_ART.yaw
	});

	const LINES = ['Break the chain.', 'Or buy the time.'] as const;

	const STEPS: StartStep[] = [
		{ icon: 'layers', title: 'Pick a card', text: `You hold ${HAND_SIZE}. Each one is a real attack or defense.` },
		{ icon: 'hand', title: 'Drop it on a building', text: 'The board lights up everywhere it can go.' },
		{ icon: 'die', title: 'Roll 2d6', text: 'Beat the building’s wall and the move lands.' }
	];

	const LEARN: StartLearn = {
		title: 'How Breach plays',
		lede: `Breach is a 2v2 card game played on a globe. Two attackers try to get a payload through ${CHAIN.length} buildings; two defenders try to hold them off for ${HORIZON} rounds while finding out what is already inside. Every card is a real software supply chain attack or defense.`,
		wins: [
			{
				label: 'Red wins',
				tone: SIDE_TONE.red,
				text: `by holding all ${CHAIN.length} links of the payload path at the same time.`
			},
			{ label: 'Blue wins', tone: SIDE_TONE.blue, text: `by surviving to the end of round ${HORIZON}.` }
		],
		sections: [
			{
				title: 'A turn',
				steps: [
					`Pick a card from your hand of ${HAND_SIZE}. The board lights up every building it can be played on.`,
					'Drop it on a building. Your figures cross the map to it.',
					"Roll 2d6. Attacks roll against the building's wall; everything else against the card's own target.",
					'Each player gets 3 action points a round, so most turns are three small moves or one big one.'
				]
			},
			{
				title: 'Red plays in the dark',
				text: "Blue doesn't see red's footholds until blue finds them, or until red gets loud enough to give them away. Red's cards raise the heat in a region; let it get too hot and everything hidden there is revealed."
			},
			{ title: 'Meet the agents', body: agents }
		]
	};

	const rules = rulesHref();
</script>

<StartShell
	name="Breach"
	{titles}
	lines={LINES}
	live={globe}
	{account}
	{leaving}
	{onplay}
	{rules}
	howTitle="How a turn plays"
	steps={STEPS}
	versus={[
		{ label: 'Red', tone: 'var(--red)' },
		{ label: 'Blue', tone: 'var(--blue)' }
	]}
	facts={['2v2', `${HORIZON} rounds`, 'Play with friends or bots']}
	path={{ title: 'The payload path', steps: CHAIN, lit: held, tone: 'var(--red)' }}
	learn={LEARN}
	standings={getLeaderboard}
	sidesLabel="The two sides"
>
	{#snippet tagline()}An immersive <b>security awareness training</b> experience.{/snippet}

	{#snippet sides()}
		{#each SIDES as side (side.id)}
			<SidePanel tone={SIDE_TONE[side.id]} label={side.label} role={side.role} goal={side.goal}>
				<div class="lineup">
					{#each side.klasses as k (k.key)}
						<figure>
							<div class="fig">
								<Figure klass={figureOf(k)} crop="hero" shadow ground={SIDE_TONE[side.id]} art={artFor(k)} />
							</div>
							<figcaption>
								<b style:color={k.color}>{k.name.replace(/^The /, '')}</b>
								<span>{k.tagline}</span>
							</figcaption>
						</figure>
					{/each}
				</div>
			</SidePanel>
		{/each}
	{/snippet}

	{#snippet hero(box)}
		{#if globe}
			<MeshCanvas
				bind:this={mesh}
				bind:layout
				{nodes}
				{edges}
				hubId={CORE_ID}
				globeLabel="Breach start screen"
				globeFill={0.96}
				hudInsets={insetsFor(box)}
				radiusOf={nodeFootprint}
				autoRotate={!still}
				autoRotateSpeed={0.0022}
				axialTilt={(23 * Math.PI) / 180}
				globeIntro={!still}
				insetLeafLabels
				typeLabels={false}
				{groupKeyOf}
				globeTerritories
				territoryOf={styleOf}
				{terrain}
				glPieces
			/>
			<!-- The game's own strike, dice and verdict, drawn over the live node
			     boxes. A sibling of the canvas for the reason it is in BoardStage:
			     it measures `[data-node]` and must share the canvas's space. -->
			<BoardFx
				active={demo.activeFx}
				foggedAnchorId={demo.foggedAnchorId}
				garrison={demo.visibleGarrison}
				pings={demo.pings}
				severed={demo.severedLinks}
			/>
		{/if}
	{/snippet}
</StartShell>

{#snippet agents()}
	<ul class="agents">
		{#each ROSTER as k (k.key)}
			<li style:--tone={SIDE_TONE[k.faction]}>
				<span class="chip"><Figure klass={figureOf(k)} crop="chip" art={artFor(k)} /></span>
				<span>
					<b style:color={k.color}>{k.name}</b>
					<em>{k.faction === 'red' ? 'Red · The Outlaws' : 'Blue · The Enforcers'}</em>
					<span>{k.tagline}</span>
				</span>
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	/* Two rows the figures share through subgrid: one for the bodies, one for
	   the captions. Each figure used to lay out its own, so a tagline that ran
	   to three lines shrank its figure and dropped its name below the other's. */
	.lineup {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr auto;
		gap: 6px 8px;
		min-height: 0;
	}
	figure {
		grid-row: span 2;
		display: grid;
		grid-template-rows: subgrid;
		min-height: 0;
		margin: 0;
	}
	.fig {
		min-height: 90px;
	}
	.fig :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	figcaption {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 2px;
		text-align: center;
	}
	figcaption b {
		font-size: 0.8rem;
		font-weight: 800;
	}
	figcaption span {
		font-size: 0.66rem;
		line-height: 1.3;
		color: var(--fg-dim, #97a3aa);
	}

	/* ── Learn more: the agents ─────────────────────────────────────────── */
	.agents {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.agents li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 10px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--tone) 25%, transparent);
	}
	.chip {
		flex: none;
		width: 44px;
		height: 44px;
		overflow: hidden;
		border-radius: 50%;
		background: color-mix(in srgb, var(--tone) 14%, transparent);
	}
	.chip :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.agents li > span:last-child {
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-size: 0.78rem;
	}
	.agents em {
		font-style: normal;
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim, #97a3aa);
	}
	.agents li > span:last-child > span {
		color: var(--fg-dim, #97a3aa);
	}

	@media (max-width: 640px) {
		.fig {
			height: 150px;
		}
		.agents {
			grid-template-columns: 1fr;
		}
	}
</style>
