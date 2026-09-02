<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// ICON STUDIO — a bench for the icon set and the four crest cuts.
	//
	// Fourth of the builder's studios and deliberately the same shape as the
	// character one: a bare <dialog> rather than `Modal` (Modal is title/body/
	// footer at a fixed size; this is a full-bleed stage), header of wordmark ·
	// pills · close, one live subject in the middle, generated panel on the
	// right.
	//
	// THE PANEL IS NOT HAND-WRITTEN. `icon-knobs.ts` declares what each mark
	// exposes and `BackdropControls` draws it — the same panel the Möbius
	// backdrop and the Character Studio use. What this replaced was a page of
	// hand-cut sliders and toggle rows that only ever covered the chrome cut,
	// while the other three marks got frozen variant grids: three props deep,
	// no combinations, and nothing to catch a renamed option.
	//
	// The glyph picker is hand-rolled on purpose. `Icon`'s `name` is a
	// two-hundred-value union — a `choice` knob would draw two hundred segments
	// — and it is a subject, not a setting: it is which thing you are looking
	// at, the same way the character pills are.

	import { untrack } from 'svelte';
	import BackdropControls from '../backdrop/BackdropControls.svelte';
	import { knobKey, type Knob } from '../backdrop/backdrop-tokens.js';
	import { downloadPng, downloadSvg, rasterSize } from '../dev/svg-export.js';
	import Icon, { ICONS, type IconName } from './Icon.svelte';
	import ArmornetCrest from './ArmornetCrest.svelte';
	import ArmornetCrestHub from './ArmornetCrestHub.svelte';
	import ArmornetCrestMesh, { type CrestMeshShape } from './ArmornetCrestMesh.svelte';
	import ArmornetCrestChrome, { type ChromeShape } from './ArmornetCrestChrome.svelte';
	import {
		filename,
		MARKS,
		readKnobs,
		snippet,
		COLOR_TOKEN,
		MESH_TOKEN,
		type MarkId
	} from './icon-knobs.js';

	interface Props {
		open: boolean;
		/** Which mark the studio opens on — every block on the icons page has its
		 *  own way in, and landing on the wrong one is a hunt. */
		mark?: MarkId;
		/** Which glyph, when the way in was a cell of the icon grid: you clicked
		 *  `fingerprint`, so `fingerprint` is what is on the stage. */
		icon?: IconName;
		/** Same idea for the shield grids: you clicked `merlon`, so the shield
		 *  knob opens on `merlon` rather than on the mark's default. */
		shape?: CrestMeshShape;
		onclose: () => void;
	}

	let { open, mark = 'icon', icon, shape, onclose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let i = $state(0);

	const current = $derived(MARKS[i]);
	const base = $derived(current.knobs());
	let knobs = $state<Knob[]>(MARKS[0].knobs());
	const s = $derived(readKnobs(knobs));

	/** Reopening on a different block reseats the panel; reopening on the same
	 *  one keeps whatever was tuned, so a close is not a loss. */
	// Everything this effect touches — `i`, `knobs`, `glyph` — it also has to be
	// able to write, so every read of them is untracked. Reading `knobs` here
	// tracked and then seeding into it is a write-to-what-you-read loop, and
	// since `seedShape` rebuilds the array it never converges on its own.
	$effect(() => {
		if (!open) return;
		if (icon) glyph = icon;
		const n = MARKS.findIndex((m) => m.id === mark);
		if (n >= 0 && n !== untrack(() => i)) pick(n, shape);
		else if (shape) seedShape(shape);
	});

	function pick(n: number, seed?: CrestMeshShape) {
		i = n;
		knobs = MARKS[n].knobs();
		if (seed) seedShape(seed);
	}

	/** Reseat the shield knob on the silhouette the grid was clicked on. Applied
	 *  AFTER the mark's knobs are rebuilt, or it would be overwritten by them. */
	function seedShape(next: string) {
		const cur = untrack(() => knobs);
		const at = cur.findIndex(
			(k) => k.kind === 'choice' && k.prop === 'shape' && k.options.includes(next)
		);
		// Bailing when it already holds `next` is what terminates the effect: no
		// write, no re-run.
		if (at < 0 || cur[at].value === next) return;
		const out = cur.slice();
		out[at] = { ...cur[at], value: next } as Knob;
		knobs = out;
	}

	const step = (d: number) => pick((i + d + MARKS.length) % MARKS.length);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	/**
	 * The mesh colour follows the mark colour until it is moved on its own.
	 *
	 * Without this, changing `color` leaves a mint mesh inside a violet crest —
	 * which is the two-tone placement `meshColor` exists for, arrived at by
	 * accident. Every mark here is monochrome by default and the panel has to
	 * say so.
	 */
	function apply(next: Knob[]) {
		const was = knobs.find((k) => k.kind === 'color' && k.token === COLOR_TOKEN);
		const now = next.find((k) => k.kind === 'color' && k.token === COLOR_TOKEN);
		const mesh = knobs.find((k) => k.kind === 'color' && k.token === MESH_TOKEN);
		const linked = was && mesh && was.value === mesh.value && now && now.value !== was.value;
		knobs = linked
			? next.map((k) => (knobKey(k) === knobKey(mesh) ? ({ ...k, value: now.value } as Knob) : k))
			: next;
	}

	// ── The glyph, for the Icon mark ────────────────────────────────────────
	const NAMES = Object.keys(ICONS) as IconName[];
	let glyph = $state<IconName>('shield-check');
	let filter = $state('');
	const shown = $derived(
		filter.trim() ? NAMES.filter((n) => n.includes(filter.trim().toLowerCase())) : NAMES
	);

	// ── Export ──────────────────────────────────────────────────────────────
	// The stage IS the artwork: lifting the rendered <svg> rather than
	// re-deriving one from the props is what guarantees the file matches what
	// you tuned, filters and all.
	let stageEl = $state<HTMLDivElement | null>(null);
	let scale = $state(4);

	const svgEl = () => stageEl?.querySelector('svg') as SVGSVGElement | null;

	/** Live readout, so nobody exports a 96px asset into a 1920px deck. */
	const px = $derived.by(() => {
		const svg = svgEl();
		if (!svg) return null;
		void s.size;
		void scale;
		void i;
		const { w, h } = rasterSize(svg, scale);
		return `${w}×${h}`;
	});

	function saveSvg() {
		const svg = svgEl();
		if (svg) downloadSvg(svg, filename(current, knobs, base, 'svg'));
	}

	function savePng() {
		const svg = svgEl();
		if (svg) downloadPng(svg, filename(current, knobs, base, 'png'), scale);
	}

	const code = $derived(
		current.id === 'icon'
			? `<Icon name="${glyph}" size={${s.size}}${s.strokeWidth === 1.5 ? '' : ` strokeWidth={${s.strokeWidth}}`} />`
			: snippet(current, knobs, base)
	);

	// Only the two shield-bearing marks get the card picker; the rest have short
	// option sets where the word is the clearer control.
	const hasShieldKnob = $derived(current.id === 'mesh' || current.id === 'chrome');

	const groups = $derived({
		colour: base.some((k) => k.group === 'colour'),
		shape: base.some((k) => k.group === 'shape'),
		light: base.some((k) => k.group === 'light')
	});
</script>

<dialog
	class="is-modal"
	bind:this={dialogEl}
	aria-labelledby="is-wordmark"
	{onclose}
	onkeydown={(e) => {
		if (e.target !== dialogEl) return;
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
	}}
	onclick={(e) => {
		if (e.target === dialogEl) onclose();
	}}
>
	<div class="is-shell" style:--ink={current.id === 'icon' ? s.ink : s.color}>
		<div class="is-header">
			<span class="is-wordmark" id="is-wordmark">ICON STUDIO</span>
			<div class="is-pills">
				{#each MARKS as m, n (m.id)}
					<button class="is-pill" class:on={n === i} onclick={() => pick(n)}>{m.name}</button>
				{/each}
			</div>
			<span class="is-spacer"></span>
			<button class="is-close" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="is-body">
			<button class="is-arrow" onclick={() => step(-1)} aria-label="Previous mark">‹</button>

			<div class="is-stage">
				<div class="is-glow"></div>
				<!-- The checker is the only honest background for an asset exported
				     on transparency — a flat panel makes a light halo invisible. -->
				<div class="is-art" bind:this={stageEl} style:color={s.ink}>
					{#if current.id === 'icon'}
						<Icon name={glyph} size={s.size} strokeWidth={s.strokeWidth} />
					{:else if current.id === 'crest'}
						<ArmornetCrest
							size={s.size}
							color={s.color}
							meshColor={s.meshColor}
							mesh={s.mesh}
							glow={s.glow}
						/>
					{:else if current.id === 'hub'}
						<ArmornetCrestHub
							size={s.size}
							color={s.color}
							look={s.look}
							spokes={s.spokes}
							tethers={s.tethers}
							glow={s.glow}
						/>
					{:else if current.id === 'mesh'}
						<ArmornetCrestMesh
							size={s.size}
							color={s.color}
							meshColor={s.meshColor}
							shape={s.shape as CrestMeshShape}
							variant={s.variant}
							innerWall={s.innerWall}
							glow={s.glow}
						/>
					{:else}
						<ArmornetCrestChrome
							size={s.size}
							shape={s.shape}
							glow={s.glow}
							bloom={s.bloom}
							traces={s.traces}
							rim={s.rim}
							emboss={s.emboss}
							tethers={s.tethers}
							breakout={s.breakout}
						/>
					{/if}
				</div>
			</div>

			<button class="is-arrow" onclick={() => step(1)} aria-label="Next mark">›</button>

			<aside class="is-panel">
				<!-- Shields are the one option set you cannot pick by name — thirty
				     silhouettes whose differences are entirely visual. Every other
				     choice knob keeps its word chips. The thumbnails are drawn bare
				     (no halo, no inner wall) so the row compares SILHOUETTES; a grid
				     of glowing marks at 26px is a grid of glowing blobs. -->
				{#snippet shieldCards(prop: string, option: string)}
					{#if prop === 'shape'}
						{#if current.id === 'chrome' && option === 'traced'}
							<ArmornetCrestChrome size={34} glow={false} traces={false} emboss={false} />
						{:else if current.id === 'chrome'}
							<ArmornetCrestChrome
								size={34}
								shape={option as ChromeShape}
								glow={false}
								traces={false}
								emboss={false}
							/>
						{:else}
							<ArmornetCrestMesh
								size={34}
								shape={option as CrestMeshShape}
								glow={false}
								innerWall={false}
							/>
						{/if}
					{/if}
				{/snippet}

				{#snippet section(title: string, group: 'colour' | 'shape' | 'light')}
					<div class="is-group">
						<div class="is-group-h">{title}</div>
						<BackdropControls
							{knobs}
							{group}
							defaults={base}
							showReset={false}
							hideAlpha
							optionPreview={group === 'shape' && hasShieldKnob ? shieldCards : undefined}
							onchange={apply}
						/>
					</div>
				{/snippet}

				{#if groups.colour}{@render section('Palette', 'colour')}{/if}

				{#if current.id === 'icon'}
					<div class="is-group">
						<div class="is-group-h">Glyph</div>
						<input
							class="is-filter"
							placeholder="filter — {NAMES.length} icons"
							spellcheck="false"
							bind:value={filter}
						/>
						<div class="is-glyphs">
							{#each shown as n (n)}
								<button
									class="is-glyph"
									class:on={n === glyph}
									title={n}
									aria-label={n}
									onclick={() => (glyph = n)}
								>
									<Icon name={n} size={18} strokeWidth={s.strokeWidth} />
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if groups.shape}{@render section('Shape', 'shape')}{/if}
				{#if groups.light}{@render section('Light', 'light')}{/if}

				<button class="is-reset" onclick={() => (knobs = current.knobs())}>Reset</button>
			</aside>
		</div>

		<div class="is-foot">
			<div class="is-name">
				<b>{current.name}</b>
				<i>{current.note}</i>
			</div>

			<code class="is-code">{code}</code>

			<div class="is-export">
				<button class="is-btn is-btn--go" onclick={savePng}>
					<Icon name="save" size={13} /> PNG
				</button>
				<div class="is-scale" role="group" aria-label="PNG resolution">
					{#each [1, 2, 4, 8] as n (n)}
						<button
							class="is-chip"
							class:on={scale === n}
							aria-pressed={scale === n}
							onclick={() => (scale = n)}>{n}×</button
						>
					{/each}
				</div>
				<button class="is-btn" onclick={saveSvg}>
					<Icon name="save" size={13} /> SVG
				</button>
				<span
					class="is-px"
					title="Both export the stage as-is, on transparency — no background is painted. PNG bakes the glow and emboss filters, so they survive tools that drop them; SVG is for Figma, Illustrator and the web."
					>{px ?? ''}</span
				>
			</div>
		</div>
	</div>
</dialog>

<style>
	.is-modal {
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
	.is-modal::backdrop {
		background: rgba(3, 6, 10, 0.6);
		backdrop-filter: blur(4px);
	}
	.is-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.is-header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.is-wordmark {
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		white-space: nowrap;
	}
	.is-spacer {
		flex: 1;
	}
	.is-pills {
		display: flex;
		gap: 4px;
	}
	.is-pill {
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s;
	}
	.is-pill:hover {
		color: var(--fg);
		border-color: color-mix(in srgb, var(--ink) 50%, transparent);
	}
	.is-pill.on {
		color: var(--ink);
		border-color: var(--ink);
		background: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	.is-close {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 6px;
		width: 28px;
		height: 28px;
		cursor: pointer;
	}
	.is-close:hover {
		color: var(--fg);
	}

	.is-body {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: stretch;
	}
	.is-arrow {
		width: 64px;
		flex: none;
		border: none;
		background: transparent;
		color: var(--fg-dim);
		font-size: 2rem;
		cursor: pointer;
		transition: color 0.15s;
	}
	.is-arrow:hover {
		color: var(--ink);
	}
	.is-stage {
		position: relative;
		flex: 1;
		min-width: 0;
		display: grid;
		place-items: center;
		overflow: auto;
	}
	.is-glow {
		position: absolute;
		inset: 20%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--ink) 10%, transparent),
			transparent 70%
		);
		pointer-events: none;
	}
	.is-art {
		position: relative;
		display: grid;
		place-items: center;
		padding: 24px;
		border-radius: 10px;
		background-image:
			linear-gradient(45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
			linear-gradient(-45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.03) 75%),
			linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.03) 75%);
		background-size: 16px 16px;
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
	}

	.is-panel {
		width: 340px;
		flex: none;
		border-left: 1px solid var(--border);
		padding: 14px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.is-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.is-group-h {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.is-filter {
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--input-bg);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.62rem;
		outline: none;
	}
	.is-filter:focus {
		border-color: var(--border-accent);
	}
	.is-glyphs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
		gap: 3px;
		max-height: 190px;
		overflow-y: auto;
	}
	.is-glyph {
		display: grid;
		place-items: center;
		height: 32px;
		border: 1px solid transparent;
		border-radius: 5px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.is-glyph:hover {
		color: var(--fg);
		border-color: var(--border);
	}
	.is-glyph.on {
		color: var(--ink);
		border-color: color-mix(in srgb, var(--ink) 60%, transparent);
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.is-reset {
		align-self: flex-start;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.is-reset:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}

	.is-foot {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
	.is-name {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 180px;
	}
	.is-name b {
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		color: var(--ink);
	}
	.is-name i {
		font-style: normal;
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.is-code {
		flex: 1;
		min-width: 0;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border-radius: 4px;
		padding: 5px 8px;
		overflow-x: auto;
		white-space: nowrap;
	}
	.is-export {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.is-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		cursor: pointer;
	}
	.is-btn:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.is-btn--go {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.is-btn--go:hover {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.is-scale {
		display: flex;
	}
	.is-chip {
		padding: 4px 7px;
		border: 1px solid var(--border);
		border-left-width: 0;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.56rem;
		cursor: pointer;
	}
	.is-chip:first-child {
		border-left-width: 1px;
		border-radius: 5px 0 0 5px;
	}
	.is-chip:last-child {
		border-radius: 0 5px 5px 0;
	}
	.is-chip.on {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.is-px {
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--fg-dim);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
