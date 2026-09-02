<script lang="ts">
	// ── Brand — the mark, and the scene that builds it ───────────────────────────
	// The forge shipped as one 1100-line page in `mockups/`, which meant the only
	// way to see any part of it was to watch the whole thing go past. It is six
	// components now and this page is where each of them can be looked at on its
	// own — the floor without a mark on it, the lamp without a scene around it,
	// the rings with no collapse to justify them.
	//
	// One clock for the small demos, because a page of four independent rAF loops
	// is four independent timelines and the reader cannot tell what is a phase
	// difference and what is a bug.
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import LogoForgeStudio from '$lib/brand/LogoForgeStudio.svelte';
	import ForgeFloor from '$lib/brand/ForgeFloor.svelte';
	import ForgeMark from '$lib/brand/ForgeMark.svelte';
	import RimLight from '$lib/brand/RimLight.svelte';
	import ShockRings from '$lib/brand/ShockRings.svelte';
	import SparkField from '$lib/brand/SparkField.svelte';
	import { markGeometry, seatPlan } from '$lib/brand/forge.js';

	const { A, EDGES } = markGeometry();

	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			clock += Math.min(64, now - last);
			last = now;
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

	// ── ForgeMark ────────────────────────────────────────────────────────────
	let spinTurns = $state(0);
	let ignite = $state(0);
	const MARK = 220;

	// ── SparkField ───────────────────────────────────────────────────────────
	// Mounted lazily: the seat plan is a thousand-point contour walk, and a page
	// that builds one on load pays for it whether or not the reader scrolls this
	// far.
	let sparksOn = $state(false);
	let sparkT = $state(0);
	const targets = $derived(sparksOn ? seatPlan().targets : []);
	$effect(() => {
		if (!sparksOn) return;
		sparkT = 0;
		const id = setInterval(() => {
			sparkT = sparkT > 3400 ? 0 : sparkT + 16;
		}, 16);
		return () => clearInterval(id);
	});

	// ── ShockRings ───────────────────────────────────────────────────────────
	// Re-fired on a loop rather than on a button, so the reader can compare the
	// three without having to hit anything in time with themselves. The period is
	// barely longer than the longest of them: a loop with dead air in it reads as
	// three effects that are broken most of the time.
	const RING_LOOP = 1600;
	const ringT = $derived(clock % RING_LOOP);
	/** Small, so a reach of 210 box units is a circle inside the cell rather than
	 *  a shock that leaves the frame on its second visible ring. */
	const RING_SIZE = 150;

	// ── RimLight ─────────────────────────────────────────────────────────────
	let lampManual = $state(false);
	let lampX = $state(100);
	const lamp = $derived({
		x: lampManual ? lampX : -40 + ((clock / 2400) % 1) * 290,
		y: 108 + 26 * Math.sin(clock / 1700),
		z: 150
	});
</script>

<svelte:head><title>Brand — UI Lib</title></svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="LogoForgeStudio LogoForge">
		<h3 class="component-name">LogoForgeStudio</h3>
		<p class="component-desc">
			The title scene, with its clock exposed. <code class="demo-code">LogoForge</code> takes the
			mark from the flat crest it ships as to the forged cut it also ships as, and builds the
			transition out of the contours both of them are cut from — so nothing here is a second
			drawing of the logo that could drift from the first. It plays once wherever it runs (the
			breach lobby puts it in front of the setup screen and does not offer a pause), which is why
			the scrubber lives here and not there.
		</p>
		<p class="component-desc">
			Jump between beats with the chips or <kbd class="demo-kbd">1</kbd>–<kbd class="demo-kbd"
				>5</kbd
			>. The one to watch is the end of <strong>spin</strong>: the figure is a true 120° tripod, so a
			whole number of turns lands every satellite back on the pixel the flat logo draws it at, and the
			last frame of the spin IS the logo.
		</p>
		<div class="stage stage--tall">
			<LogoForgeStudio />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ForgeMark">
		<h3 class="component-name">ForgeMark</h3>
		<p class="component-desc">
			The crest with its figure taken off. <code class="demo-code">ArmornetLogo</code> is one object,
			which is right everywhere it ships and wrong for the one thing this needs: turning the mesh while
			the shield holds still. <code class="demo-code">loose</code> splits them — the wall is drawn through
			<code class="demo-code">ArmornetCrestMesh</code> with a transparent mesh colour, and the figure
			is redrawn here at whatever azimuth it has been turned to.
		</p>
		<p class="component-desc">
			It also reconciles the two artboards. The line crest is authored in a 24-unit box and the
			forged cut in 200×220, so drawing both at "the same size" puts two shields 36% apart —
			<code class="demo-code">size</code> here means what it means on
			<code class="demo-code">ArmornetCrestChrome</code>, which is what lets one cross-fade onto the
			other and land on itself.
		</p>
		<div class="row">
			<div class="cell">
				<ForgeMark size={MARK} />
				<span class="cell-label">shipped · loose=false</span>
			</div>
			<div class="cell">
				<ForgeMark size={MARK} loose spin={spinTurns * Math.PI * 2} {ignite} pulse={0.72 + 0.28 * Math.sin(clock / 260)} />
				<span class="cell-label">loose · spin {spinTurns.toFixed(2)} turns · ignite {ignite.toFixed(2)}</span>
			</div>
		</div>
		<div class="knobs">
			<label>spin <input type="range" min="0" max="2" step="0.01" bind:value={spinTurns} /></label>
			<label>ignite <input type="range" min="0" max="1" step="0.01" bind:value={ignite} /></label>
		</div>
		<p class="component-desc mt-3">
			Park <code class="demo-code">spin</code> on a whole number and the two panels are the same
			picture. Anything between and the near satellite is drawn larger and last — a tripod turning
			is the one moment the figure has a near side and a far side, and painting in declaration order
			throws that away.
		</p>
	</ShowcaseBlock>

	<ShowcaseBlock component="RimLight">
		<h3 class="component-name">RimLight</h3>
		<p class="component-desc">
			One light at a real place in front of the mark, and every surface term read off it: the streak
			on the face, each contour shaded by its own angle to the source, a specular walking each ball
			joint, a hotspot where the lamp projects onto each tube. Take the lamp away and all of it goes
			dark together — that agreement is what the eye reads as "lit", and the cut this replaced had a
			bright shape crossing edges that glowed at a constant, which read as a filter over a picture.
		</p>
		<div class="stage stage--lit">
			<RimLight size={300} edges={EDGES} {lamp} figure={A.fig} shield={A.outer} />
		</div>
		<div class="knobs">
			<label><input type="checkbox" bind:checked={lampManual} /> drive the lamp</label>
			<label>
				x <input type="range" min="-60" max="260" step="1" bind:value={lampX} disabled={!lampManual} />
			</label>
		</div>
		<p class="component-desc mt-3">
			Drag the lamp across and watch which edges answer. The highlight travels around the silhouette
			rather than pulsing everywhere at once, because brightness is a shading term per segment — and
			the joints keep their speculars small, since a specular is a reflection of the source and one
			drawn any bigger stops reading as a highlight and starts reading as a pupil.
		</p>
	</ShowcaseBlock>

	<ShowcaseBlock component="ShockRings">
		<h3 class="component-name">ShockRings</h3>
		<p class="component-desc">
			Rings off a point — a shock leaving a place, or falling into one. Three near-identical blocks
			of this lived inline in the forge scene and differed only in numbers. Time is ms
			<em>since the event</em>, not a scene clock, so a scrubbable host gets a scrubbable shock and
			an interactive one passes <code class="demo-code">now - firedAt</code>.
		</p>
		<div class="row">
			<div class="cell">
				<ShockRings size={RING_SIZE} cx={A.ox} cy={A.oy} t={ringT} />
				<span class="cell-label">out · cubic · the hub taking</span>
			</div>
			<div class="cell">
				<ShockRings
					size={RING_SIZE}
					cx={A.ox}
					cy={A.oy}
					t={ringT}
					stagger={[0, 70, 150]}
					duration={620}
					from={10}
					reach={460}
					ease="quint"
					peak={0.85}
					tail={1.7}
					width={[0.8, 9]}
					leadColor="#ffffff"
					blend
				/>
				<span class="cell-label">out · quint · the detonation</span>
			</div>
			<div class="cell">
				<ShockRings
					size={RING_SIZE}
					cx={A.ox}
					cy={A.oy}
					t={ringT}
					direction="in"
					count={1}
					duration={440}
					from={0}
					reach={300}
					peak={0.55}
					width={[0.6, 3.4]}
				/>
				<span class="cell-label">in · the collapse</span>
			</div>
		</div>
		<p class="component-desc mt-3">
			The middle one is the only one that reads as a hit, and the difference is
			<code class="demo-code">tail</code>: at 1.7 the whole ring's life is in its first third. The
			right-hand one is the only thing in the forge that travels inward, which is exactly why it
			reads at all.
		</p>
	</ShowcaseBlock>

	<ShowcaseBlock component="SparkField">
		<h3 class="component-name">SparkField</h3>
		<p class="component-desc">
			Comet trails that converge on seats and burst on contact. The forge seats them along the
			contours the chrome cut is actually made of, at a spacing finer than the eye resolves, and
			ranks them by radius from the hub — so the silhouette is <em>drawn</em>, core first and wall
			last, rather than filled. A scatter inside the shield gets a cloud that happens to be
			shield-sized and reads as nothing, because a silhouette is what the eye resolves a shape from.
		</p>
		{#if sparksOn}
			<!-- No sizing wrapper. `SparkField` is `inset: 0; margin: auto` at a fixed
			     width and height, which centres it on whatever positioned box it is
			     in whether or not that box is big enough — so the centred stage is
			     all it needs, and a wrapper only moves the anchor off centre. -->
			<div class="stage stage--lit">
				<SparkField size={300} t={sparkT} {targets} repeat={1} reach={50} decay={0.4} />
			</div>
		{:else}
			<div class="stage stage--lit">
				<button class="load" onclick={() => (sparksOn = true)}>
					build the seat plan and run it
				</button>
			</div>
		{/if}
		<p class="component-desc mt-3">
			Behind a button because the seat plan is a thousand-point contour walk and a sorted rank of
			it. <code class="demo-code">seatPlan()</code> memoises, so the cost is paid once per page and
			the forge above shares it — but a page that pays it on load pays it for readers who never
			scroll this far.
		</p>
	</ShowcaseBlock>

	<ShowcaseBlock component="ForgeFloor">
		<h3 class="component-name">ForgeFloor</h3>
		<p class="component-desc">
			Converging rails and a haze band. A solid needs somewhere to be standing — a mark on a flat
			field is a sticker, and no amount of shading on the mark fixes it, because what the eye is
			missing is the ground. No transform and no camera: two families of straight lines, spaced the
			way a receding plane spaces them, faded out before the horizon so the vanishing point is
			implied rather than drawn.
		</p>
		<div class="stage stage--floor">
			<ForgeFloor />
		</div>
	</ShowcaseBlock>
</div>

<style>
	.stage {
		position: relative;
		height: 420px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg);
	}
	.stage--tall {
		height: 720px;
	}
	/* `demoVariantPlugin` injects an inline-flex wrapper around every component
	   inside a ShowcaseBlock, at build time and invisibly in source. An
	   inline-flex box shrink-wraps, so a demo that FILLS its stage rather than
	   having an intrinsic size collapses to nothing inside it — which is what the
	   studio and the floor both did, silently, on stages that still drew their
	   own borders.
	   The centre-anchored demos (the mark, the lamp, the rings, the sparks) each
	   resolve against the wrapper's CENTRE, which the grid has already put in the
	   middle of the stage, so they need none of this. */
	.stage--tall :global(.demo-variant),
	.stage--floor :global(.demo-variant) {
		position: absolute;
		inset: 0;
		padding: 0;
	}
	/* The lamp and the sparks are both bright things on a dark field — on the page
	   ground they are washed out, and what they do is invisible. */
	.stage--lit,
	.stage--floor {
		height: 340px;
		display: grid;
		place-items: center;
		background: radial-gradient(120% 90% at 50% 34%, #10202a 0%, #070a10 46%, #03050a 100%);
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.75rem;
	}
	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 280px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: radial-gradient(120% 90% at 50% 34%, #10202a 0%, #070a10 46%, #03050a 100%);
	}
	.cell-label {
		position: absolute;
		left: 10px;
		bottom: 8px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}

	.knobs {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		margin-top: 0.75rem;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		color: var(--fg-dim);
	}
	.knobs label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.knobs input[type='range'] {
		accent-color: var(--accent);
	}

	.load {
		padding: 6px 14px;
		border-radius: 6px;
		border: 1px solid var(--border-accent, var(--accent));
		background: var(--accent-faint, rgba(94, 234, 212, 0.1));
		color: var(--accent);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		cursor: pointer;
	}
</style>
