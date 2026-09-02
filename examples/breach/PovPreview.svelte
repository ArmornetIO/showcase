<script lang="ts">
	// ── PovPreview — the first-person shots, with nobody playing ──────────────────
	// A rig for looking at a cutaway on its own: pick a card, watch the shot, and
	// swap which character is inside it. It exists because the shots are the most
	// expensive thing on the board and the least reachable — one of them fires on
	// a card that costs a Handler their whole turn, so "does the new one read?"
	// used to mean playing until somebody drew it.
	//
	// ── Why this stands up a REAL globe ──────────────────────────────────────────
	// The obvious rig is a fake: `MeshHandle` is six functions, and forty lines of
	// trigonometry satisfies all six. That was the first version of this and it
	// lied in the way that matters. The shot's whole method is that it does not
	// own a camera — it walks the globe's own pose down to the surface and lets
	// the perspective divide do the work — so a preview with a hand-rolled
	// projection is previewing a different projection. The framing came out wrong,
	// the node boxes grew at the wrong rate, and the one bug it did surface (a
	// conduit riser collapsing once the target fills the frame) it surfaced by
	// accident.
	//
	// So it mounts the same `MeshCanvas` the board mounts, with the board's own
	// structures, terrain, footprints and territory colours. What is missing is
	// only the match: no seats, no cards in hand, no rules. The shot cannot tell,
	// because a shot is only ever handed a `Scene`.

	import { untrack } from 'svelte';
	import {
		MeshCanvas,
		makeTerrain,
		type CanvasCamera,
		type CharacterSkin,
		type MeshLayoutId,
		type StudioNode
	} from 'showcase';
	import { CORE_ID, ROSTER, STRUCTURES, cardNameFor } from './internal/rules.js';
	import { CARD_FX } from './internal/fx.js';
	import { POV_CARDS } from './internal/cinema.js';
	import { groupKeyOf, nodeFootprint, styleOf } from './board-view.js';
	import FirstPerson, { type MeshHandle } from './FirstPerson.svelte';

	interface Props {
		/** Who is inside the shot. The reason this component takes a skin rather
		 *  than a klass key: the studio hands over a character wearing whatever
		 *  the palette knobs currently say, which is not any roster entry. */
		skin: CharacterSkin;
		/** The suit grey, from the same knobs. */
		suit?: string;
		/** How long the held beat runs. On the board this is however long the
		 *  resolution takes; here there is no resolution, so it is a setting. */
		holdMs?: number;
	}

	let { skin, suit, holdMs = 2400 }: Props = $props();

	let mesh = $state<MeshHandle | null>(null);
	let camera = $state<CanvasCamera>();
	let pov = $state<FirstPerson | null>(null);
	let layout = $state<MeshLayoutId>('globe');

	/**
	 * Every card that has a cutaway, with the name and colour it wears in the
	 * game — read out of `POV_CARDS`, `cardNameFor` and `CARD_FX` rather than
	 * listed here.
	 *
	 * That indirection is the whole value of the rig. A hand-written list of
	 * shots is a list that silently stops matching the game the first time
	 * somebody adds a card, and a preview that disagrees with the board is worse
	 * than no preview: it is a second opinion nobody asked for.
	 */
	const CUTS = Object.entries(POV_CARDS).map(([key, cut]) => ({
		key,
		shot: cut!.shot,
		draft: !!cut!.draft,
		name: cardNameFor(key),
		fx: CARD_FX[key]
	}));

	let picked = $state(CUTS[0]?.key ?? '');
	let loop = $state(true);
	let playing = $state(false);

	/** Two real structures, as far apart as the board has. The shot is mostly
	 *  about crossing ground, so an origin next door to the target has the
	 *  camera arrive before the body has done anything. */
	const from = STRUCTURES[0];
	const target =
		[...STRUCTURES].reverse().find((s) => s.territory !== from.territory) ?? STRUCTURES[1];

	/** The board's own terrain settings and seed. Same ground, so a shot judged
	 *  here is a shot over the ground it will actually cross. */
	const terrain = makeTerrain({ seed: 20260809, octaves: 4, frequency: 9, gain: 0.5 });

	/** The board's globe minus the match. `state` is fixed rather than derived
	 *  from footholds because there are none — a preview showing every building
	 *  degraded would be inventing a game state to look at. */
	const nodes: StudioNode[] = [
		{
			id: CORE_ID,
			type: 'control-plane',
			state: 'healthy',
			label: 'PROTECTED CORE',
			iconKey: 'crestlink',
			glyphAsBody: true,
			x: 0,
			y: 0,
			r: 42
		},
		...STRUCTURES.map(
			(s): StudioNode => ({
				id: s.id,
				type: 'agentic',
				state: 'healthy',
				label: s.name,
				x: 0,
				y: 0,
				r: 26
			})
		)
	];

	/**
	 * A stand-in for the board's shortlist.
	 *
	 * `unmask` names whoever holds the target, and there is no match here to hold
	 * anything. Red's two seats are the honest set — Attribution is `on: ['red']`
	 * — and the answer is fixed rather than random so a shot played twice is the
	 * same shot twice, which is the only way to judge a change to it.
	 */
	const previewLineup = {
		suspects: ROSTER.filter((k) => k.faction === 'red'),
		answer: 0
	};

	function sceneFor(key: string) {
		const c = CUTS.find((x) => x.key === key);
		if (!c) return null;
		return {
			fromId: from.id,
			structureId: target.id,
			actor: skin.name.replace(/^The /, ''),
			seat: 'STUDIO',
			subject: target.name,
			origin: from.name,
			card: c.name,
			word: c.fx.word,
			hue: c.fx.hue,
			power: c.fx.power,
			powerLabel: c.fx.powerLabel,
			skin,
			suit,
			lineup: c.shot === 'unmask' ? previewLineup : undefined,
			shot: c.shot
		};
	}

	/**
	 * One playing shot at a time, and a token rather than a flag to enforce it.
	 *
	 * `play()` is a chain of awaited beats several seconds long, so a second
	 * click lands while the first run is still inside it — and a boolean checked
	 * after each await is read by BOTH runs. The counter means only the newest
	 * caller ever matches, and every older loop falls out at its next check
	 * without needing to be told.
	 */
	let run = 0;

	async function start(key: string) {
		const id = ++run;
		picked = key;
		playing = true;
		pov?.cut();
		while (run === id) {
			const scene = sceneFor(key);
			if (!scene || !pov) break;
			await pov.play(scene, holdMs);
			if (!loop) break;
			// A gap between takes. Looping a cutaway with no seam makes the exit
			// and the next entrance read as one continuous move, which is exactly
			// the thing the shot is not.
			await new Promise((r) => setTimeout(r, 500));
		}
		if (run === id) playing = false;
	}

	function stop() {
		run++;
		playing = false;
		pov?.cut();
	}

	/**
	 * Swapping the character mid-take restarts it, because the body is the thing
	 * being previewed — waiting out a four-second shot to see the one you just
	 * clicked is the whole friction this rig exists to remove.
	 *
	 * `untrack` is not defensive here, it is the fix. Reading `playing` and
	 * `picked` in the effect body made this depend on the two values `start`
	 * writes, so clicking a card re-entered the effect, which bumped `run`, which
	 * made the in-flight take abandon itself and `cut()` the camera — the shot
	 * died two seconds in, every time, with nothing in the console. Only `skin`
	 * and `suit` may retrigger a restart; everything else is read, not watched.
	 */
	$effect(() => {
		skin;
		suit;
		untrack(() => {
			if (playing) start(picked);
		});
	});

	$effect(() => () => stop());
</script>

<div class="pv">
	<!-- The stage. `data-node` boxes and the overlay must share a coordinate
	     space, so these are siblings in one positioned box — the same arrangement
	     BoardStage uses, and for the same reason. -->
	<div class="pv-stage">
		<MeshCanvas
			bind:this={mesh}
			bind:camera
			bind:layout
			{nodes}
			hubId={CORE_ID}
			globeLabel="Shot preview"
			globeFill={0.9}
			radiusOf={nodeFootprint}
			autoRotate
			autoRotateSpeed={0.0016}
			axialTilt={(23 * Math.PI) / 180}
			insetLeafLabels
			typeLabels={false}
			{groupKeyOf}
			globeTerritories
			territoryOf={styleOf}
			{terrain}
			glPieces
		/>
		<FirstPerson bind:this={pov} {mesh} {camera} />
	</div>

	<div class="pv-bar">
		{#each CUTS as c (c.key)}
			<button
				class="pv-cut"
				class:on={picked === c.key && playing}
				class:draft={c.draft}
				style:--cc={c.fx.hue}
				onclick={() => start(c.key)}
			>
				<b>{c.name}</b>
				<!-- A borrowed shot says so on the button. The whole reason the table
				     carries `draft` is that an unmarked stand-in is indistinguishable
				     from a decision, and this is the screen where somebody would make
				     that mistake. -->
				<i>{c.draft ? `${c.shot} · unstyled` : c.shot}</i>
			</button>
		{/each}

		<span class="pv-gap"></span>

		<label class="pv-loop">
			<input type="checkbox" bind:checked={loop} />
			loop
		</label>
		<button class="pv-stop" onclick={stop} disabled={!playing}>Stop</button>
	</div>

	{#if !playing}
		<p class="pv-hint">Pick a card. The shot plays with whichever character is selected.</p>
	{/if}
</div>

<style>
	.pv {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.pv-stage {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		border-radius: 0.5rem;
		background: #04070d;
	}

	.pv-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.pv-gap {
		flex: 1;
	}

	.pv-cut {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--cc) 35%, transparent);
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--cc) 8%, transparent);
		color: var(--cc);
		cursor: pointer;
		font: inherit;
		line-height: 1.1;
	}

	.pv-cut:hover {
		background: color-mix(in srgb, var(--cc) 16%, transparent);
	}

	.pv-cut.draft {
		border-style: dashed;
		opacity: 0.75;
	}

	.pv-cut.on {
		background: color-mix(in srgb, var(--cc) 24%, transparent);
		border-color: var(--cc);
	}

	.pv-cut b {
		font-size: 0.72rem;
		font-weight: 600;
	}

	.pv-cut i {
		font-size: 0.56rem;
		font-style: normal;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.65;
	}

	.pv-loop {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted, #8b98ad);
	}

	.pv-stop {
		padding: 0.35rem 0.7rem;
		border: 1px solid #2b3446;
		border-radius: 0.3rem;
		background: transparent;
		color: var(--muted, #8b98ad);
		cursor: pointer;
		font: inherit;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.pv-stop:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pv-hint {
		margin: 0;
		font-size: 0.66rem;
		color: var(--muted, #8b98ad);
	}
</style>
