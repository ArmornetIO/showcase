<script lang="ts">
	// ── Appearance, as one panel ─────────────────────────────────────────────
	// Everything that changes how the app looks, in one place: the palette that
	// used to live in the theme popover, the three onboarding picks, and the five
	// advanced groups that used to be a 27-row column with a description on every
	// row. Two ideas make one panel out of that:
	//
	//   · An ICON RAIL, so exactly one group is on screen and the panel's height
	//     is a constant no matter how many backdrops or themes ship. The old
	//     column grew with the catalogue and nothing bounded it.
	//   · A PREVIEW STAGE in the same place in every pane, showing the real
	//     thing — the live Backdrop, the real Flourish, the real exit transition,
	//     the actual nav gutter. A mocked swatch is one more thing to keep in
	//     sync with a catalogue that moves.
	//
	// Selection is the onboarding step's `‹ value ›` switcher, kept deliberately:
	// stepping is the cheap move (one click to the neighbour, no aiming, and the
	// stage answers immediately), and the value opens the whole list for the far
	// move. One control that does both beats a grid of tiles that does neither.
	//
	// Nothing here is saved to an org — every one of these is a per-browser
	// preference owned by a store, so there is no save button and no dirty state.
	import Icon, { type IconName } from '../icons/Icon.svelte';
	import IconToolbar, { type IconToolbarItem } from '../layout/IconToolbar.svelte';
	import Backdrop from '../backdrop/Backdrop.svelte';
	import Flourish from '../motion/Flourish.svelte';
	import StepSwitcher from '../primitives/forms/StepSwitcher.svelte';
	import type { ChoiceOption } from '../primitives/forms/choice.types.js';
	import { BACKDROPS, parseStack, type BackdropId } from '../backdrop/backdrops.js';
	import { FLOURISHES, type FlourishKind } from '../motion/effects.js';
	import { EXITS, type ExitKind } from '../motion/exits.js';
	import {
		advancedSettings,
		type NavStyleChoice,
		type RadiusChoice
	} from './store.svelte.js';
	import { appearance, type AppearanceMode } from '../theme/appearance.svelte.js';
	import { theme } from '../theme/store.svelte.js';
	import { getTheme, type ThemeChoice } from '../theme/themes.js';

	interface Props {
		/**
		 * Draw the panel's own border, background and shadow. Off when a popover
		 * already provides them — otherwise the two frames nest and the panel wears
		 * a second outline nobody asked for.
		 */
		framed?: boolean;
	}

	let { framed = true }: Props = $props();

	type GroupId = 'theme' | 'surface' | 'corners' | 'backdrop' | 'nav' | 'motion';

	let group = $state<GroupId>('theme');

	const RAIL: Array<{ id: GroupId; icon: IconName; label: string; hint: string }> = [
		{ id: 'theme', icon: 'palette', label: 'Theme', hint: 'What it is painted in' },
		{ id: 'surface', icon: 'layers', label: 'Surface', hint: 'How panels are painted' },
		{ id: 'corners', icon: 'shapes', label: 'Corners', hint: 'How surfaces are cut' },
		{ id: 'backdrop', icon: 'layout-template', label: 'Backdrop', hint: 'The ground behind it' },
		{ id: 'nav', icon: 'git-branch', label: 'Side nav', hint: 'How the tree is drawn' },
		{ id: 'motion', icon: 'zap', label: 'Motion', hint: 'How the UI moves' }
	];

	const railItems = $derived<IconToolbarItem[]>(
		RAIL.map((r) => ({
			icon: r.icon,
			label: r.label,
			active: group === r.id,
			onclick: () => (group = r.id)
		}))
	);
	const current = $derived(RAIL.find((r) => r.id === group)!);

	// ── Theme ───────────────────────────────────────────────────────────────
	// 'system' leads: it is the only choice that is not a palette, so "I don't
	// want to decide" is the first thing you can pick.
	// `theme.available` rather than `THEMES`: a host can turn the light palettes
	// off, and an option the store will not honour is worse than no option.
	const THEME_OPTIONS = $derived<ChoiceOption[]>([
		{
			value: 'system',
			label: 'System',
			description: theme.allowLight ? 'Follows your OS setting.' : 'Dark while light is off.'
		},
		...theme.available.map((t) => ({ value: t.key, label: t.label, description: t.description }))
	]);
	// The swatch has to show a real palette and `system` does not name one, so it
	// previews whatever system currently resolves to.
	const themeSwatch = $derived(getTheme(theme.resolved).swatch);

	// ── Surface ─────────────────────────────────────────────────────────────
	const SURFACE_OPTIONS: ChoiceOption[] = [
		{ value: 'flat', label: 'Flat', description: 'Opaque panels on a plain field.' },
		{ value: 'glass', label: 'Glass', description: 'Frosted panels over a drifting ground.' }
	];

	// ── Corners ─────────────────────────────────────────────────────────────
	const RADII: Array<ChoiceOption & { value: RadiusChoice; r: string }> = [
		{ value: 'sharp', label: 'Sharp', description: 'Squared off. Corners read as cuts.', r: '0px' },
		{ value: 'soft', label: 'Soft', description: 'The shipped default.', r: '6px' },
		{ value: 'round', label: 'Round', description: 'Generous curves on every surface.', r: '14px' }
	];
	const radiusPreview = $derived(RADII.find((x) => x.value === advancedSettings.radius) ?? RADII[1]);

	// ── Backdrop ────────────────────────────────────────────────────────────
	// Straight from the registry, so one added to `backdrop/backdrops.ts` shows up
	// here with no edit and one removed cannot leave a dead option behind. The
	// cost note rides along because a backdrop is a per-frame expense and a person
	// should get to choose knowing that rather than find out on a slow laptop.
	const BACKDROP_OPTIONS: ChoiceOption[] = BACKDROPS.map((b) => ({
		value: b.id,
		label: b.label,
		description: b.cost === 'heavy' ? `${b.description} Runs hot.` : b.description
	}));
	// `parseStack` reads the stored value, so a stack authored in the Backdrop
	// Studio shows its bottom layer here rather than showing nothing selected. It
	// returns `[]` for `none`, which is a real option, so that case maps onto it.
	const activeBackdrop = $derived<BackdropId>(
		(parseStack(advancedSettings.backdrop)[0] as BackdropId) ?? 'none'
	);

	// ── Side nav ────────────────────────────────────────────────────────────
	// An axis crossed with the palette rather than a palette of its own, like
	// Surface and Corners: this is how the tree is DRAWN, not what colour it is.
	const NAV_OPTIONS: ChoiceOption[] = [
		{ value: 'plain', label: 'Plain', description: 'Indent and chevrons. The shipped default.' },
		{ value: 'graph', label: 'Graph', description: 'A commit graph — branches descend and merge back.' }
	];

	// ── Motion ──────────────────────────────────────────────────────────────
	// Selection flourish and overlay exit share a pane: both answer "how does this
	// move", and neither is long enough to earn a rail slot of its own.
	//
	// `none` is prepended rather than living in FLOURISHES — the catalogue is the
	// list of effects, and "no effect" is the absence of one.
	const FLOURISH_OPTIONS: ChoiceOption[] = [
		{ value: 'none', label: 'None', description: 'No effect on select.' },
		...FLOURISHES.map((f) => ({ value: f.value, label: f.label, description: f.description }))
	];
	const EXIT_OPTIONS: ChoiceOption[] = EXITS.map((e) => ({
		value: e.value,
		label: e.label,
		description: e.description
	}));

	// Bumping the trigger replays the effect; it starts at 0 so opening the panel
	// never fires an unprompted burst.
	let navTrigger = $state(0);
	let panelOpen = $state(true);
	let replayTimer: ReturnType<typeof setTimeout> | undefined;
	const exitSpec = $derived(advancedSettings.exit);
	const exitMotion = $derived(exitSpec.transition);

	function pickFlourish(v: string) {
		advancedSettings.setNavFlourish(v as FlourishKind);
		if (v !== 'none') navTrigger += 1;
	}

	function pickExit(v: string) {
		advancedSettings.setOverlayExit(v as ExitKind);
		replayExit();
	}

	function replayExit() {
		clearTimeout(replayTimer);
		panelOpen = false;
		// Out long enough to read as having left, rather than flickering.
		replayTimer = setTimeout(() => (panelOpen = true), exitSpec.duration + 220);
	}

	$effect(() => () => clearTimeout(replayTimer));

	// ── Caption ─────────────────────────────────────────────────────────────
	// One line, fixed height, always describing the value the stage is showing.
	// The old panel printed a description under all 27 rows at once, which is the
	// same information and none of it read.
	function describe(options: ChoiceOption[], value: string): string | undefined {
		return options.find((o) => o.value === value)?.description;
	}
	const caption = $derived(
		(group === 'theme'
			? describe(THEME_OPTIONS, theme.choice)
			: group === 'surface'
				? describe(SURFACE_OPTIONS, appearance.mode)
				: group === 'corners'
					? describe(RADII, advancedSettings.radius)
					: group === 'backdrop'
						? describe(BACKDROP_OPTIONS, activeBackdrop)
						: group === 'nav'
							? describe(NAV_OPTIONS, advancedSettings.navStyle)
							: describe(FLOURISH_OPTIONS, advancedSettings.navFlourish)) ?? current.hint
	);
</script>

<div class="ap" class:ap--framed={framed}>
	<header class="ap-head">
		<span class="ap-title">Appearance</span>
		<button type="button" class="ap-reset" onclick={() => advancedSettings.reset()}>
			<Icon name="rotate-ccw" size={11} />
			Reset
		</button>
	</header>

	<div class="ap-rail">
		<IconToolbar items={railItems} orientation="horizontal" />
		<span class="ap-group">
			<span class="ap-group-name">{current.label}</span>
			<span class="ap-group-hint">{current.hint}</span>
		</span>
	</div>

	<!-- One stage, in one place, in every pane. Moving it per group would make the
	     panel jump on every rail click. -->
	<div class="ap-stage">
		{#if group === 'theme'}
			<div class="stage-split">
				<!-- The four palette colours read as one object rather than four dots —
				     a miniature of the theme, hairlined like the rest of the chrome. -->
				<span class="th-swatch" aria-hidden="true">
					{#each themeSwatch as c (c)}
						<span class="th-band" style="background:{c}"></span>
					{/each}
				</span>
				<span class="th-name">{theme.resolved}</span>
			</div>
		{:else if group === 'surface'}
			<!-- The ground is not decoration: glass is only legible over something,
			     and a frosted panel on a flat field looks exactly like a flat one. -->
			<div class="surf-stage">
				<span class="surf-ground"></span>
				<span class="surf-demo" class:is-glass={appearance.mode === 'glass'}>
					<span class="surf-line"></span>
					<span class="surf-line is-short"></span>
				</span>
			</div>
		{:else if group === 'corners'}
			<!-- A card, a control and a field, all cut the same way — the setting
			     reaches every one of them, so showing one would undersell it. -->
			<div class="stage-split" style="--r:{radiusPreview.r}">
				<span class="corner-card"></span>
				<span class="corner-btn">OK</span>
				<span class="corner-field"></span>
			</div>
		{:else if group === 'backdrop'}
			<!-- One live instance, ever. A grid of thumbnails would be a dozen
			     per-frame costs paid to browse a settings menu. -->
			<div class="bd-stage">
				<Backdrop id={activeBackdrop} strength={advancedSettings.backdropStrength} />
				<span class="bd-name">{activeBackdrop === 'none' ? 'No backdrop' : activeBackdrop}</span>
			</div>
		{:else if group === 'nav'}
			<!-- Both drawings side by side, the live one lit: this is the only
			     setting whose subject is off-screen behind the popover, so a preview
			     that showed just the current state would be unreadable as a choice. -->
			<div class="stage-split nav-stage">
				{#each NAV_OPTIONS as o (o.value)}
					<span
						class="nav-demo"
						class:is-graph={o.value === 'graph'}
						class:is-on={advancedSettings.navStyle === o.value}
					>
						<span class="nd-row nd-row--0"><i class="nd-mark"></i></span>
						<span class="nd-row nd-row--1"><i class="nd-mark"></i></span>
						<span class="nd-row nd-row--1 is-last"><i class="nd-mark"></i></span>
					</span>
				{/each}
			</div>
		{:else}
			<div class="stage-split">
				<button type="button" class="mo-nav" title="Replay" onclick={() => (navTrigger += 1)}>
					<Icon name="shield" size={12} />
					<span>Overview</span>
					<Flourish
						kind={advancedSettings.navFlourish}
						trigger={navTrigger}
						anchorX="16px"
						anchorY="50%"
					/>
				</button>
				<button type="button" class="mo-exit" title="Replay the exit" onclick={replayExit}>
					{#if panelOpen}
						<span class="mo-panel" out:exitMotion={{ duration: exitSpec.duration }}>
							<span class="mo-line"></span>
							<span class="mo-line is-short"></span>
							<span class="mo-line"></span>
						</span>
					{/if}
				</button>
			</div>
		{/if}
	</div>

	<!-- Property rows: label · switcher, the shape the onboarding step uses, so
	     someone meeting this panel has already met the idiom. -->
	<div class="ap-pane">
		{#if group === 'theme'}
			<div class="row">
				<span class="row-k"><Icon name="sun" size={11} /> Palette</span>
				<StepSwitcher
					options={THEME_OPTIONS}
					value={theme.choice}
					onpick={(v) => theme.set(v as ThemeChoice)}
					label="Theme"
					width="150px"
					wrap
				/>
			</div>
		{:else if group === 'surface'}
			<div class="row">
				<span class="row-k"><Icon name="layers" size={11} /> Panels</span>
				<StepSwitcher
					options={SURFACE_OPTIONS}
					value={appearance.mode}
					onpick={(v) => appearance.set(v as AppearanceMode)}
					label="Surface"
					width="150px"
					wrap
				/>
			</div>
		{:else if group === 'corners'}
			<div class="row">
				<span class="row-k"><Icon name="shapes" size={11} /> Radius</span>
				<StepSwitcher
					options={RADII}
					value={advancedSettings.radius}
					onpick={(v) => advancedSettings.setRadius(v as RadiusChoice)}
					label="Corners"
					width="150px"
					wrap
				/>
			</div>
		{:else if group === 'backdrop'}
			<div class="row">
				<span class="row-k"><Icon name="layout-template" size={11} /> Art</span>
				<StepSwitcher
					options={BACKDROP_OPTIONS}
					value={activeBackdrop}
					onpick={(v) => advancedSettings.setBackdrop(v)}
					label="Backdrop"
					width="150px"
					wrap
				/>
			</div>
			{#if activeBackdrop !== 'none'}
				<!-- Strength, not just on/off: a backdrop is a per-frame cost on a dense
				     page, and turning it down has to be possible without turning it off. -->
				<div class="row">
					<span class="row-k"><Icon name="activity" size={11} /> Strength</span>
					<input
						class="row-range"
						type="range"
						min="0.1"
						max="1"
						step="0.05"
						value={advancedSettings.backdropStrength}
						oninput={(e) => advancedSettings.setBackdropStrength(Number(e.currentTarget.value))}
						aria-label="Backdrop strength"
					/>
					<span class="row-v">{Math.round(advancedSettings.backdropStrength * 100)}%</span>
				</div>
			{/if}
		{:else if group === 'nav'}
			<div class="row">
				<span class="row-k"><Icon name="git-branch" size={11} /> Tree</span>
				<StepSwitcher
					options={NAV_OPTIONS}
					value={advancedSettings.navStyle}
					onpick={(v) => advancedSettings.setNavStyle(v as NavStyleChoice)}
					label="Side nav"
					width="150px"
					wrap
				/>
			</div>
		{:else}
			<div class="row">
				<span class="row-k"><Icon name="star" size={11} /> Selection</span>
				<StepSwitcher
					options={FLOURISH_OPTIONS}
					value={advancedSettings.navFlourish}
					onpick={pickFlourish}
					label="Selection effect"
					width="150px"
					wrap
				/>
			</div>
			<div class="row">
				<span class="row-k"><Icon name="layers" size={11} /> Overlay</span>
				<StepSwitcher
					options={EXIT_OPTIONS}
					value={advancedSettings.overlayExit}
					onpick={pickExit}
					label="Overlay exit"
					width="150px"
					wrap
				/>
			</div>
		{/if}
	</div>

	<!-- Fixed height: the caption changes with every step, and a footer that grew
	     with the sentence would resize the panel under the pointer. -->
	<footer class="ap-foot">{caption}</footer>
</div>

<style>
	.ap {
		display: flex;
		flex-direction: column;
		width: 372px;
		overflow: hidden;
	}
	.ap--framed {
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		background: var(--bg);
		box-shadow:
			0 12px 32px -8px rgba(0, 0, 0, 0.35),
			0 0 0 1px var(--border);
	}

	.ap-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.5rem 0.4rem 0.7rem;
		border-bottom: 1px solid var(--border);
	}
	.ap-title {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.ap-reset {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.4rem;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.ap-reset:hover {
		color: var(--accent);
		border-color: var(--border);
	}

	.ap-rail {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid var(--border);
	}
	.ap-group {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.ap-group-name {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--fg);
		line-height: 1.1;
	}
	.ap-group-hint {
		font-size: 0.66rem;
		color: var(--fg-dim);
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ap-stage {
		height: 76px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--fg) 3%, transparent);
		overflow: hidden;
	}
	.stage-split {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	/* ── Theme ─────────────────────────────────────────────────────────────── */
	.th-swatch {
		display: flex;
		border-radius: var(--radius-control);
		overflow: hidden;
		border: 1px solid var(--border);
	}
	.th-band {
		width: 1.4rem;
		height: 2.6rem;
	}
	.th-name {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	/* ── Surface ───────────────────────────────────────────────────────────── */
	.surf-stage {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
	.surf-ground {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				60% 120% at 20% 30%,
				color-mix(in srgb, var(--accent) 30%, transparent),
				transparent 70%
			),
			repeating-linear-gradient(
				62deg,
				color-mix(in srgb, var(--fg) 10%, transparent) 0 2px,
				transparent 2px 11px
			);
	}
	.surf-demo {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.35rem;
		width: 150px;
		height: 50px;
		padding: 0 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		/* --surface-raised is translucent; over the ground that reads as a second
		   kind of glass. Compositing it onto --bg is what makes flat flat. */
		background:
			linear-gradient(var(--surface-raised), var(--surface-raised)),
			var(--bg);
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.surf-demo.is-glass {
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		backdrop-filter: blur(7px) saturate(1.4);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.surf-line {
		height: 0.3rem;
		border-radius: var(--radius-hairline);
		background: color-mix(in srgb, var(--fg) 30%, transparent);
	}
	.surf-line.is-short {
		width: 45%;
		background: color-mix(in srgb, var(--accent) 65%, transparent);
	}

	/* ── Corners ───────────────────────────────────────────────────────────── */
	.corner-card {
		width: 62px;
		height: 46px;
		border: 1px solid var(--border);
		border-radius: var(--r);
		background: var(--surface-raised);
	}
	.corner-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--accent);
		border-radius: var(--r);
		background: var(--accent-faint);
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
	}
	.corner-field {
		width: 74px;
		height: 24px;
		border: 1px solid var(--border);
		border-radius: var(--r);
		background: color-mix(in srgb, var(--fg) 6%, transparent);
	}

	/* ── Backdrop ──────────────────────────────────────────────────────────── */
	.bd-stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.bd-name {
		position: absolute;
		left: 0.6rem;
		bottom: 0.45rem;
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	/* ── Side nav ──────────────────────────────────────────────────────────── */
	.nav-stage {
		gap: 1.4rem;
	}
	.nav-demo {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		width: 74px;
		opacity: 0.4;
		transition: opacity 0.15s;
	}
	.nav-demo.is-on {
		opacity: 1;
	}
	.nd-row {
		position: relative;
		display: block;
		height: 0.34rem;
		border-radius: var(--radius-hairline);
		background: color-mix(in srgb, var(--fg) 22%, transparent);
	}
	.nav-demo.is-on .nd-row--0 {
		background: color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.nd-row--1 {
		margin-left: 1.1rem;
	}
	/* Plain: the mark is the chevron column — a tick to the left of the row. */
	.nd-mark {
		position: absolute;
		left: -0.7rem;
		top: 50%;
		width: 0.28rem;
		height: 0.28rem;
		transform: translateY(-50%);
		border-radius: 50%;
		background: color-mix(in srgb, var(--fg) 30%, transparent);
	}
	/* Graph: the same mark becomes an elbow off a trunk, and the last row's
	   trunk stops at it — the branch/merge shape in miniature. */
	.nav-demo.is-graph .nd-mark {
		left: -0.75rem;
		top: -0.63rem;
		width: 0.5rem;
		height: 0.95rem;
		border-radius: 0;
		border-left: 1px solid color-mix(in srgb, var(--fg) 40%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--fg) 40%, transparent);
		background: none;
		transform: none;
	}
	.nav-demo.is-graph .nd-row--0 .nd-mark {
		display: none;
	}
	.nav-demo.is-graph .nd-row--1:not(.is-last) .nd-mark {
		height: 1.3rem;
	}

	/* ── Motion ────────────────────────────────────────────────────────────── */
	.mo-nav {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.28rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--accent-faint);
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.62rem;
		cursor: pointer;
	}
	.mo-exit {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		/* Fixed box: the exit removes the panel, and a collapsing trigger would
		   leave nothing to click for the replay. */
		min-width: 92px;
		min-height: 40px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.mo-panel {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
		width: 92px;
		padding: 0.4rem 0.45rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: color-mix(in srgb, var(--fg) 7%, transparent);
	}
	.mo-line {
		height: 0.28rem;
		border-radius: var(--radius-hairline);
		background: color-mix(in srgb, var(--fg) 22%, transparent);
	}
	.mo-line.is-short {
		width: 55%;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	/* ── Rows ──────────────────────────────────────────────────────────────── */
	/* Fixed height, centred: every pane is the same box however many rows it
	   holds, so switching groups never resizes the popover under the pointer. */
	.ap-pane {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.5rem 0.6rem;
		height: 96px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 34px;
	}
	.row-k {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex: none;
		width: 88px;
		font-family: var(--mono);
		font-size: 0.64rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.row-range {
		flex: 1 1 auto;
		min-width: 0;
	}
	.row-v {
		font-family: var(--mono);
		font-size: 0.65rem;
		font-variant-numeric: tabular-nums;
		color: var(--fg-dim);
		width: 2.4rem;
		text-align: right;
	}

	.ap-foot {
		height: 30px;
		display: flex;
		align-items: center;
		padding: 0 0.7rem;
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--fg) 3%, transparent);
		font-size: 0.68rem;
		color: var(--fg-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
