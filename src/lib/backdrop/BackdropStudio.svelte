<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// BACKDROP STUDIO — the authoring tool for animated backdrops.
	//
	// A dialog launched from the builder, not a page. It follows ThemeStudio's
	// shape deliberately, region for region, because the two tools do the same
	// job on different subjects:
	//
	//   header       wordmark · composition pills · reset · close
	//   left rail    the strips, as a list — ThemeStudio's ComponentRail
	//   main         the live stage — ThemeStudio's preview
	//   bottom bar   the selected strip's controls — ThemeStudio's SwatchBar
	//   right rail   palette and floor, which belong to the whole backdrop
	//
	// It uses a bare <dialog> rather than `Modal` for the same reason ThemeStudio
	// does: Modal is shaped around title/body/footer at a fixed size, and this is
	// a full-bleed workspace. The native element brings the focus trap and Escape
	// handling a `<div role="dialog">` has to reimplement.
	//
	// The earlier version hid every control behind floating popovers. That suits a
	// stage you mostly want to LOOK at; it suits authoring badly, because you
	// cannot see a slider and its effect at the same time.
	//
	// TWO THINGS THIS USED NOT TO DO, both of which made it a Möbius editor with
	// five pictures bolted on rather than a backdrop studio:
	//
	//   STACKING. The composition pills were mutually exclusive, so Ash Drift's
	//   settling dust could not sit under Current Field's ink even though nothing
	//   in the rendering stopped it. They are toggles now, the selection is a
	//   `BackdropId[]`, and the left rail lists the resulting layers.
	//
	//   EDITING THE FAMILIES. Selecting one used to hide both rails and show the
	//   art, on the reasoning that a family "has no strips, so there is nothing
	//   for the rails to address". That was true of the STRIP rail and false of
	//   everything else: each family reads real custom properties and declares
	//   real props, none of which had a control anywhere. `FAMILY_KNOBS` declares
	//   them, and the same generated panel that draws the Möbius knobs draws
	//   those — per layer, because the families share token names.

	import { Icon } from 'showcase';
	import Canvas from '../primitives/canvas/Canvas.svelte';
	import type { CanvasCamera } from '../primitives/canvas/canvas-camera.js';
	import HorizonBackdrop from './HorizonBackdrop.svelte';
	import BackdropControls from './BackdropControls.svelte';
	import { resize, seedStrips, type StripSpec } from './strips.js';
	import { resolvePreset, type PresetId } from './presets.js';
	import {
		BACKDROPS,
		BLEND_MODES,
		DEFAULT_BLEND,
		formatStack,
		isFamily,
		isMobius,
		toggleStack,
		type BackdropId,
		type BlendMode,
		type FamilyId
	} from './backdrops.js';
	import { familyKnobs } from './family-knobs.js';
	import Backdrop from './Backdrop.svelte';
	import { defaultKnobs, toCss, toParams, type Knob } from './backdrop-tokens.js';

	/** Everything Apply hands back — one payload, so adding a field is one edit. */
	export interface BackdropApply {
		/** The stack in its stored form: comma-joined ids, bottom layer first. */
		stack: string;
		blend: BlendMode;
		/** The authored Möbius composition. Meaningless if the stack has none. */
		strips: StripSpec[];
		/** The Möbius palette and floor knobs, as a CSS declaration list. */
		tokens: string;
		/** Each edited family's knobs — declarations and props, keyed by id. */
		familyStyles: Record<string, string>;
		familyParams: Record<string, Record<string, number>>;
	}

	interface Props {
		open: boolean;
		/** Which composition to open on. */
		preset?: PresetId;
		onclose: () => void;
		/** Fired on Apply with everything authored here, for the caller to persist. */
		onapply?: (out: BackdropApply) => void;
	}
	let { open, preset: initial = 'mr robot', onclose, onapply }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	// Drive the native dialog from the `open` prop.
	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	let camera = $state<CanvasCamera | undefined>();
	let preset = $state<PresetId>(initial);
	let strips = $state<StripSpec[]>(resolvePreset(initial).strips);
	let selectedId = $state<string>(resolvePreset(initial).strips[0]?.id ?? '');
	let knobs = $state<Knob[]>(defaultKnobs());
	let labels = $state(true);
	let rainbow = $state(resolvePreset(initial).rainbow ?? false);
	let rainbowSpeed = $state(resolvePreset(initial).rainbowSpeed ?? 18);
	let copied = $state(false);
	let showOutput = $state(false);

	/** Palette overrides from the loaded preset — a vibe's colours are its own. */
	let presetTokens = $state<Record<string, string>>(resolvePreset(initial).tokens ?? {});

	/**
	 * What the stage is showing, bottom layer first, and which one the rails are
	 * addressing.
	 *
	 * A list rather than a single id: backdrops are layers, and the interesting
	 * looks are combinations — dust under ink, a Möbius chain over strata.
	 * `active` is the one being EDITED, which is a separate question from what is
	 * visible, exactly as selecting a strip is.
	 */
	let stack = $state<BackdropId[]>([initial]);
	let active = $state<BackdropId>(initial);
	let blend = $state<BlendMode>(DEFAULT_BLEND);

	/**
	 * Per-family knobs, seeded the first time a family joins the stack.
	 *
	 * Kept per family rather than per layer because a family appears at most once
	 * — `parseStack` collapses duplicates, since a family stacked on itself is a
	 * second per-frame cost for no visible change.
	 */
	let famKnobs = $state<Partial<Record<FamilyId, Knob[]>>>({});

	const editable = $derived(isMobius(active));
	const activeFamily = $derived(isFamily(active) ? active : null);
	const activeKnobs = $derived(activeFamily ? (famKnobs[activeFamily] ?? []) : []);

	/** Each family's knobs in the two forms `Backdrop` consumes. */
	const familyStyles = $derived(
		Object.fromEntries(Object.entries(famKnobs).map(([id, ks]) => [id, toCss(ks as Knob[])]))
	);
	const familyParams = $derived(
		Object.fromEntries(Object.entries(famKnobs).map(([id, ks]) => [id, toParams(ks as Knob[])]))
	);

	/**
	 * Toggle a backdrop in or out of the stack.
	 *
	 * The one exclusion left is between MÖBIUS compositions: this studio edits a
	 * single `strips` array, so two of them in one stack would mean one authored
	 * composition and one that silently ignored every edit. Picking a second
	 * replaces the first. Families have no such constraint — they carry their own
	 * knobs, so any number can coexist.
	 */
	function pick(id: BackdropId) {
		let next = toggleStack(stack, id);
		const added = next.includes(id);
		if (added && isMobius(id)) next = next.filter((x) => x === id || !isMobius(x));
		stack = next;

		if (!added) {
			// Dropping the layer you were editing moves the rails to the top of
			// what is left, rather than leaving them pointed at nothing.
			if (active === id) active = next[next.length - 1] ?? 'none';
			return;
		}
		if (isFamily(id) && !famKnobs[id]) famKnobs = { ...famKnobs, [id]: familyKnobs(id) };
		if (isMobius(id)) load(id);
		active = id;
	}

	/** Drop entries for layers the stack no longer holds. */
	function onlyInStack<T>(map: Record<string, T>): Record<string, T> {
		return Object.fromEntries(
			Object.entries(map).filter(([id]) => stack.includes(id as BackdropId))
		);
	}

	/** Replace the active family's knobs. Nothing else in the stack moves. */
	function setFamilyKnobs(next: Knob[]) {
		if (!activeFamily) return;
		famKnobs = { ...famKnobs, [activeFamily]: next };
	}

	function load(id: PresetId) {
		preset = id;
		const out = resolvePreset(id);
		strips = out.strips;
		// `null` means the preset has no opinion about colour, which differs from
		// an empty palette — leave the current one alone.
		presetTokens = out.tokens ?? {};
		if (out.rainbow !== null) rainbow = out.rainbow;
		if (out.rainbowSpeed !== null) rainbowSpeed = out.rainbowSpeed;
		selectedId = strips[0]?.id ?? '';
	}

	/**
	 * Knob CSS first, the preset's palette after — so a vibe's colours win on
	 * load, and a knob the person then moves wins again, because moving it drops
	 * that token from the preset set.
	 */
	const css = $derived(
		[toCss(knobs), ...Object.entries(presetTokens).map(([k, v]) => `${k}: ${v}`)].join('; ')
	);
	const selected = $derived(strips.find((s) => s.id === selectedId) ?? strips[0]);

	/** Every per-strip control, declared once so the bar is not hand-written. */
	const FIELDS: {
		key: keyof StripSpec;
		label: string;
		min: number;
		max: number;
		step: number;
		unit?: string;
	}[] = [
		{ key: 'left', label: 'X', min: 0, max: 100, step: 0.5, unit: '%' },
		{ key: 'top', label: 'Y', min: 0, max: 100, step: 0.5, unit: '%' },
		{ key: 'size', label: 'Size', min: 8, max: 110, step: 1, unit: 'vw' },
		{ key: 'spin', label: 'Bearing', min: -180, max: 180, step: 1, unit: '°' },
		{ key: 'band', label: 'Band', min: 40, max: 190, step: 5 },
		{ key: 'pitch', label: 'Pitch', min: 10, max: 85, step: 1, unit: '°' },
		{ key: 'yaw', label: 'Yaw', min: -90, max: 90, step: 1, unit: '°' },
		{ key: 'rungs', label: 'Slats', min: 6, max: 80, step: 1 },
		{ key: 'belt', label: 'Belt', min: 0.4, max: 10, step: 0.2, unit: 's' },
		{ key: 'period', label: 'Lap', min: 4, max: 90, step: 1, unit: 's' },
		{ key: 'traffic', label: 'Travellers', min: 0, max: 6, step: 1 },
		{ key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.05 },
		{ key: 'fade', label: 'End fade', min: 0, max: 0.5, step: 0.02 },
		{ key: 'fadeAngle', label: 'Fade axis', min: 0, max: 360, step: 5, unit: '°' },
		{ key: 'blur', label: 'Defocus', min: 0, max: 8, step: 0.1, unit: 'px' },
		{ key: 'fxSize', label: 'FX size', min: 0, max: 24, step: 0.5 },
		{ key: 'fxStrength', label: 'FX strength', min: 0, max: 2, step: 0.05 },
		{ key: 'energySpeed', label: 'Energy speed', min: 0.2, max: 8, step: 0.1, unit: 's' }
	];

	/**
	 * The mesh's own edge styles — the vocabulary a line between two agents uses.
	 * `encrypted` and `pulse` carry no dash by design, so they render solid.
	 */
	const ENERGY: StripSpec['energy'][] = [
		'none',
		'energy',
		'pulse',
		'dashed',
		'degraded',
		'blocked',
		'latent',
		'scanning',
		'encrypted'
	];

	/**
	 * The SvgFx treatments. Its docs warn lit effects need a shoulder to catch
	 * the light and these are hairlines — `chrome` and `emboss` want a large FX
	 * size here or they read as nothing.
	 */
	const FX: StripSpec['fx'][] = ['none', 'glow', 'outline', 'emboss', 'chrome', 'engrave'];

	function setStrip<K extends keyof StripSpec>(key: K, value: StripSpec[K]) {
		strips = strips.map((s) => (s.id === selectedId ? { ...s, [key]: value } : s));
	}

	function setCount(n: number) {
		strips = resize(strips, n);
		if (!strips.some((s) => s.id === selectedId)) selectedId = strips[strips.length - 1]?.id ?? '';
	}

	/** A knob edit wins over the loaded vibe's palette for that one token. */
	function setKnobs(next: Knob[]) {
		const touched = next.find((k, i) => k.value !== knobs[i]?.value);
		if (
			touched &&
			(touched.kind === 'color' || touched.kind === 'range') &&
			presetTokens[touched.token]
		) {
			const { [touched.token]: _dropped, ...rest } = presetTokens;
			presetTokens = rest;
		}
		knobs = next;
	}

	/** `<input type="color">` speaks opaque hex only; rgba() has to be reduced. */
	function hexOf(v: string): string {
		const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
		if (!m) return /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : '#5eead4';
		const h = (n: string) =>
			Math.max(0, Math.min(255, Math.round(Number(n))))
				.toString(16)
				.padStart(2, '0');
		return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
	}

	/** Rounded to the control's own step — `8.8661517333` is undictatable. */
	function show(v: number, step: number): string {
		return (Math.round(v / step) * step).toFixed(step < 1 ? 2 : 0);
	}

	/**
	 * What Apply hands back, and what the JSON block shows — one derived value,
	 * so the thing you copy and the thing you place cannot disagree.
	 */
	const payload = $derived<BackdropApply>({
		stack: formatStack(stack),
		blend,
		// Empty unless a Möbius layer is actually in the stack. `strips` survives
		// removing that layer — deliberately, so toggling it back does not lose
		// the edit — but handing it to a caller with nothing to draw it means the
		// placed item carries a composition it will never render.
		strips: stack.some(isMobius) ? strips : [],
		tokens: css,
		// Same rule for the family knobs: keep them in `famKnobs` so a layer can
		// be toggled back without losing its tuning, but hand out only the ones
		// the stack still paints.
		familyStyles: onlyInStack(familyStyles),
		familyParams: onlyInStack(familyParams)
	});

	const block = $derived(
		[
			`// backdrop: ${payload.stack}${stack.length > 1 ? ` (blend: ${blend})` : ''}`,
			editable ? `\n// strips\n${JSON.stringify(strips, null, 2)}` : '',
			Object.keys(familyParams).length
				? `\n\n// layer knobs\n${JSON.stringify({ styles: familyStyles, params: familyParams }, null, 2)}`
				: '',
			`\n\n:root {\n${css
				.split('; ')
				.map((d) => `\t${d};`)
				.join('\n')}\n}`
		].join('')
	);

	async function copy() {
		try {
			await navigator.clipboard.writeText(block);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard is permission-gated; the block is on screen and selectable.
			copied = false;
		}
	}
</script>

<dialog
	class="bs-modal"
	bind:this={dialogEl}
	aria-labelledby="bs-wordmark"
	onclose={onclose}
	onclick={(e) => {
		// A click that lands on the dialog itself landed on its backdrop.
		if (e.target === dialogEl) onclose();
	}}
>
	<div class="bs-shell">
		<!-- ── Header ───────────────────────────────────────────────────────── -->
		<div class="bs-header">
			<span class="bs-wordmark" id="bs-wordmark">◐ BACKDROP STUDIO</span>

			<!-- Compositions, as pills. The direct analogue of ThemeStudio's theme
			     picker: the top-level choice, always visible, never in a menu.
			     TOGGLES, not a radio group — a pressed pill is a layer on the
			     stage, and pressing a second adds it rather than replacing. -->
			<div class="bs-pills">
				{#each BACKDROPS.filter((b) => b.id !== 'none') as b (b.id)}
					{@const on = stack.includes(b.id)}
					<button
						class="bs-pill"
						class:active={on}
						class:editing={on && active === b.id}
						aria-pressed={on}
						title="{b.description} · {b.cost}"
						onclick={() => pick(b.id)}
					>
						{b.label}
					</button>
				{/each}
			</div>

			<div class="bs-header-end">
				<button
					class="bs-icon-btn"
					class:on={labels}
					onclick={() => (labels = !labels)}
					title="Toggle strip labels"
					aria-label="Toggle strip labels"><Icon name="eye" size={14} /></button
				>
				<button
					class="bs-icon-btn"
					class:on={rainbow}
					onclick={() => (rainbow = !rainbow)}
					title="Hue flow along the chain"
					aria-label="Hue flow along the chain"><Icon name="palette" size={14} /></button
				>
				<button
					class="bs-icon-btn"
					class:on={showOutput}
					onclick={() => (showOutput = !showOutput)}
					title="Show the composition JSON"
					aria-label="Show the composition JSON"><Icon name="code" size={14} /></button
				>
				<button class="bs-link-btn" onclick={() => load(preset)}>Reset</button>
				<button class="bs-close" onclick={onclose} aria-label="Close">✕</button>
			</div>
		</div>

		<!-- ── Body ─────────────────────────────────────────────────────────── -->
		<div class="bs-body" style={css}>
			<!--
				Left rail: the stack, then — when the layer being edited is a Möbius
				composition — its strips. Two lists rather than one, because they are
				two different things: a layer is a whole backdrop, a strip is a part
				of one, and collapsing them would make "delete" ambiguous.
			-->
			<div class="bs-rail">
				<div class="bs-rail-head">Layers</div>
				{#if stack.length === 0}
					<div class="bs-empty-rail">nothing selected</div>
				{/if}
				<!-- Reversed: the list reads top-of-stack first, the way a layers
				     panel does, while `stack` itself stays bottom-first because that
				     is paint order. -->
				{#each [...stack].reverse() as id (id)}
					{@const meta = BACKDROPS.find((b) => b.id === id)}
					<div class="bs-layer" class:on={active === id}>
						<button class="bs-layer-pick" onclick={() => (active = id)}>
							{meta?.label ?? id}
						</button>
						<button class="bs-layer-x" title="Remove layer" aria-label="Remove {id}" onclick={() => pick(id)}
							>✕</button
						>
					</div>
				{/each}

				{#if editable}
				<div class="bs-rail-head">Strips</div>
				{#each strips as s (s.id)}
					<button
						class="bs-rail-row"
						class:on={selectedId === s.id}
						onclick={() => (selectedId = s.id)}
					>
						<span>{s.id}</span>
						<span class="bs-dim">{Math.round(s.size)}vw</span>
					</button>
				{/each}
				<div class="bs-rail-btns">
					<button class="bs-mini" onclick={() => setCount(strips.length + 1)}>+ add</button>
					{#if strips.length > 1}
						<button class="bs-mini" onclick={() => setCount(strips.length - 1)}>− del</button>
					{/if}
				</div>
				<button class="bs-mini bs-wide" onclick={() => (strips = seedStrips(strips.length))}>
					Reseed
				</button>
				{/if}
			</div>

			<div class="bs-main">
				<!-- The stage. A STATIC canvas: a background is authored against a
				     fixed frame, and a draggable view would make every position you
				     set relative to wherever the camera happened to be. -->
				<div class="bs-stage">
					<!--
						The whole stack, through the same dispatcher the app and the
						builder use. It used to render `HorizonBackdrop` directly for a
						composition and `Backdrop` for a family, which meant the studio's
						stage and every real call site were two different code paths — so
						what you tuned here was not quite what shipped.

						`strength` is deliberately NOT passed: the Floor knob writes
						`--backdrop-strength` onto `.bs-body`, and a prop would override
						it on every layer and make that slider do nothing.
					-->
					<Canvas bind:camera allowPan={false} minZoom={1} maxZoom={1}>
						<Backdrop
							id={stack}
							{blend}
							{strips}
							{labels}
							{rainbow}
							{rainbowSpeed}
							params={familyParams}
							styles={familyStyles}
							selected={selectedId}
							onselect={(id) => (selectedId = id)}
						/>
					</Canvas>

					{#if showOutput}
						<pre class="bs-out">{block}</pre>
					{/if}
				</div>

				<!-- Bottom bar: the selected strip. ThemeStudio's SwatchBar. -->
				{#if editable}
				<div class="bs-bottom">
					{#if selected}
						<div class="bs-bottom-head">
							<span class="bs-strip-id">{selected.id}</span>

							<div class="bs-choice">
								<span class="bs-fl">Effect</span>
								{#each FX as f (f)}
									<button
										class="bs-tab"
										class:on={selected.fx === f}
										onclick={() => setStrip('fx', f)}>{f}</button
									>
								{/each}
							</div>

							<div class="bs-choice">
								<span class="bs-fl">Energy</span>
								{#each ENERGY as e (e)}
									<button
										class="bs-tab"
										class:on={selected.energy === e}
										onclick={() => setStrip('energy', e)}>{e}</button
									>
								{/each}
							</div>

							<div class="bs-choice">
								<span class="bs-fl">Colour</span>
								<input
									type="color"
									value={hexOf(selected.fxColor)}
									oninput={(e) => setStrip('fxColor', (e.currentTarget as HTMLInputElement).value)}
									aria-label="Effect colour"
								/>
								{#if selected.energy !== 'none'}
									<input
										type="color"
										value={hexOf(selected.energyColor)}
										oninput={(e) =>
											setStrip('energyColor', (e.currentTarget as HTMLInputElement).value)}
										aria-label="Energy colour"
									/>
								{/if}
							</div>
						</div>

						<!-- Sliders wrap rather than scroll: eighteen controls in one
						     horizontal scroller means hunting, and the whole point of
						     this layout is seeing the control and its effect together. -->
						<div class="bs-fields">
							{#each FIELDS as f (f.key)}
								<label class="bs-field">
									<span class="bs-fl">{f.label}</span>
									<input
										type="range"
										min={f.min}
										max={f.max}
										step={f.step}
										value={selected[f.key] as number}
										oninput={(e) =>
											setStrip(f.key, Number((e.currentTarget as HTMLInputElement).value) as never)}
									/>
									<span class="bs-fv">{show(selected[f.key] as number, f.step)}{f.unit ?? ''}</span>
								</label>
							{/each}
						</div>
					{:else}
						<div class="bs-empty">← select a strip to see its controls</div>
					{/if}
				</div>
				{/if}
			</div>

			<!--
				Right rail: what belongs to a whole LAYER rather than to one strip.

				Which knobs those are depends on the layer being edited, which is the
				change that made the families editable at all. The Floor group stays
				put in both cases — opacity and cell size are the stack's, not any one
				member's.
			-->
			<div class="bs-props">
				{#if stack.length > 1}
					<div class="bs-rail-head">Blend</div>
					<div class="bs-choice bs-choice--wrap">
						{#each BLEND_MODES as m (m)}
							<button class="bs-tab" class:on={blend === m} onclick={() => (blend = m)}>{m}</button>
						{/each}
					</div>
					<p class="bs-note">
						How every layer above the bottom one composites. These are dark plates, so
						<code>normal</code> makes the top one cover the rest and the stack reads as one backdrop.
					</p>
				{/if}

				{#if activeFamily}
					{@const meta = BACKDROPS.find((b) => b.id === activeFamily)}
					<div class="bs-rail-head">{meta?.label ?? activeFamily} · colour</div>
					<BackdropControls
						knobs={activeKnobs}
						group="colour"
						defaults={familyKnobs(activeFamily)}
						showReset={false}
						onchange={setFamilyKnobs}
					/>
					<div class="bs-rail-head">{meta?.label ?? activeFamily} · form</div>
					<BackdropControls
						knobs={activeKnobs}
						group="shape"
						defaults={familyKnobs(activeFamily)}
						showReset={false}
						onchange={setFamilyKnobs}
					/>
					<div class="bs-rail-head">{meta?.label ?? activeFamily} · motion</div>
					<BackdropControls
						knobs={activeKnobs}
						group="motion"
						defaults={familyKnobs(activeFamily)}
						showReset={false}
						onchange={setFamilyKnobs}
					/>
				{:else if editable}
					<div class="bs-rail-head">Palette</div>
					<BackdropControls {knobs} group="colour" showReset={false} onchange={setKnobs} />
				{/if}

				<div class="bs-rail-head">Floor</div>
				<BackdropControls {knobs} group="floor" showReset={false} onchange={setKnobs} />
			</div>
		</div>

		<!-- ── Footer ───────────────────────────────────────────────────────── -->
		<div class="bs-foot">
			<span class="bs-dim">
				{stack.length} layer{stack.length === 1 ? '' : 's'} · {active}{editable
					? ` · ${strips.length} strips`
					: ''}
			</span>
			<span class="bs-spacer"></span>
			<button class="bs-mini" onclick={copy}>{copied ? 'Copied' : 'Copy JSON'}</button>
			<button class="bs-mini" onclick={onclose}>Close</button>
			<button
				class="bs-mini bs-primary"
				onclick={() => {
					onapply?.(payload);
					onclose();
				}}>Apply to canvas</button
			>
		</div>
	</div>
</dialog>

<style>
	.bs-modal {
		width: 96vw;
		height: 92vh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
	}
	.bs-modal::backdrop {
		background: rgba(3, 6, 10, 0.6);
		backdrop-filter: blur(4px);
	}
	.bs-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	/* ── Header ──────────────────────────────────────────────────────────── */
	.bs-header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.bs-wordmark {
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		white-space: nowrap;
	}
	.bs-pills {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.bs-pill {
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		cursor: pointer;
		white-space: nowrap;
	}
	.bs-pill:hover {
		color: var(--fg);
	}
	.bs-pill.active {
		color: var(--accent);
		border-color: var(--border-accent);
		background: var(--accent-faint);
	}
	/* A pressed pill says "this layer is on the stage"; the ring says "and it is
	   the one the rails are editing". Two different facts, so two different
	   marks — using the same one for both is what made a multi-select read as a
	   broken radio group. */
	.bs-pill.editing {
		box-shadow: 0 0 0 1px var(--border-accent);
	}
	.bs-header-end {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}
	.bs-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.bs-icon-btn:hover {
		color: var(--fg);
		border-color: var(--border);
	}
	.bs-icon-btn.on {
		color: var(--accent);
		border-color: var(--border-accent);
		background: var(--accent-faint);
	}
	.bs-link-btn {
		font-size: 0.72rem;
		color: var(--fg-muted);
		background: transparent;
		border: 0;
		cursor: pointer;
	}
	.bs-link-btn:hover {
		color: var(--fg);
	}
	.bs-close {
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.bs-close:hover {
		color: var(--fg);
		border-color: var(--accent);
	}

	/* ── Body ────────────────────────────────────────────────────────────── */
	.bs-body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.bs-rail {
		width: 160px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px;
		border-right: 1px solid var(--border);
		overflow-y: auto;
	}
	.bs-rail-head {
		font-family: var(--mono);
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--fg-dim);
		margin: 4px 0 6px;
	}
	.bs-rail-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		cursor: pointer;
	}
	.bs-rail-row:hover {
		color: var(--fg);
		background: var(--surface-raised);
	}
	.bs-rail-row.on {
		color: var(--accent);
		background: var(--accent-faint);
	}
	/* A layer row is a pick target plus a remove, so it cannot be one <button>
	   the way a strip row is. */
	.bs-layer {
		display: flex;
		align-items: center;
		border-radius: 6px;
	}
	.bs-layer:hover {
		background: var(--surface-raised);
	}
	.bs-layer.on {
		background: var(--accent-faint);
	}
	.bs-layer-pick {
		flex: 1;
		min-width: 0;
		padding: 6px 8px;
		border: 0;
		background: transparent;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.62rem;
		text-align: left;
		text-transform: uppercase;
		cursor: pointer;
	}
	.bs-layer.on .bs-layer-pick {
		color: var(--accent);
	}
	.bs-layer-x {
		padding: 6px 8px;
		border: 0;
		background: transparent;
		color: var(--fg-dim);
		font-size: 0.6rem;
		cursor: pointer;
	}
	.bs-layer-x:hover {
		color: var(--palette-red);
	}
	.bs-empty-rail {
		padding: 6px 8px;
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}

	.bs-rail-btns {
		display: flex;
		gap: 4px;
		margin-top: 8px;
	}
	.bs-wide {
		margin-top: 4px;
	}

	.bs-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}
	.bs-stage {
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}
	.bs-out {
		position: absolute;
		right: 12px;
		top: 12px;
		z-index: 5;
		max-width: 34rem;
		max-height: 70%;
		overflow: auto;
		margin: 0;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		font-family: var(--mono);
		font-size: 0.56rem;
		line-height: 1.55;
		color: var(--fg-muted);
	}

	/* ── Bottom bar ──────────────────────────────────────────────────────── */
	.bs-bottom {
		flex-shrink: 0;
		max-height: 38%;
		overflow-y: auto;
		padding: 10px 14px 12px;
		border-top: 1px solid var(--border);
		background: var(--bg-elev);
	}
	.bs-bottom-head {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.bs-strip-id {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
		text-transform: uppercase;
	}
	.bs-choice {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}
	.bs-choice input[type='color'] {
		width: 28px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}
	.bs-tab {
		padding: 3px 7px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.55rem;
		text-transform: uppercase;
		cursor: pointer;
	}
	.bs-tab:hover {
		color: var(--fg);
	}
	.bs-tab.on {
		color: var(--accent);
		background: var(--accent-faint);
	}

	/* Three columns of sliders: eighteen in one row would need a scroller, and
	   hunting in a scroller defeats seeing the control beside its effect. */
	.bs-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 2px 18px;
	}
	.bs-field {
		display: grid;
		grid-template-columns: 4.6rem minmax(0, 1fr) 3.4rem;
		align-items: center;
		gap: 8px;
	}
	.bs-fl {
		font-family: var(--mono);
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.bs-fv {
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--fg-muted);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.bs-empty {
		padding: 18px;
		text-align: center;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}

	/* ── Right rail ──────────────────────────────────────────────────────── */
	/* Wide enough that a slider is worth dragging. The controls stack their own
	   label and track, so this is the width of one full-length track plus its
	   swatch — not the sum of three squeezed columns. */
	.bs-choice--wrap {
		flex-wrap: wrap;
	}
	.bs-note {
		margin: 6px 2px 2px;
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}
	.bs-note code {
		font-family: var(--mono);
		font-size: 0.9em;
	}

	.bs-props {
		width: 340px;
		flex-shrink: 0;
		padding: 10px 12px;
		border-left: 1px solid var(--border);
		overflow-y: auto;
	}

	/* ── Footer ──────────────────────────────────────────────────────────── */
	.bs-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		height: 46px;
		padding: 0 14px;
		border-top: 1px solid var(--border);
	}
	.bs-spacer {
		flex: 1;
	}
	.bs-dim {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.bs-mini {
		padding: 6px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
		white-space: nowrap;
	}
	.bs-mini:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.bs-primary {
		color: var(--accent);
		border-color: var(--border-accent);
		background: var(--accent-faint);
	}
</style>
