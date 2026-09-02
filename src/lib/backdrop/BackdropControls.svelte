<script lang="ts">
	// The backdrop's control panel, generated from a knob list rather than
	// hand-written — so a knob cannot exist in the component without a control,
	// or the other way round.
	//
	// It draws whatever list it is handed: the Möbius backdrop's `defaultKnobs()`,
	// or a standalone family's entry in `FAMILY_KNOBS`. Nothing in here knows
	// which, which is the reason the families became editable at all — they
	// needed a declaration, not a second control panel.
	//
	// The swatch follows ThemeStudio's SwatchBar: a real `<input type="color">`
	// laid transparently over a square painted with the token's TRUE value, and
	// a pip when a control has been moved off its default. What it adds is an
	// alpha slider beside each swatch, because the native picker cannot carry
	// alpha and the whole backdrop is faint layers — SwatchBar's honest answer
	// (mark it `α`, warn that picking flattens it) is right for opaque theme
	// tokens and useless here.

	import type { Snippet } from 'svelte';
	import Toggle from '../primitives/forms/Toggle.svelte';
	import {
		defaultKnobs,
		isChanged,
		joinColor,
		knobKey,
		splitColor,
		type Knob,
		type KnobGroup
	} from './backdrop-tokens.js';

	interface Props {
		knobs: Knob[];
		/** Render only one popover's worth. Omit for the whole list. */
		group?: KnobGroup;
		/** The reset button belongs to the studio's toolbar, not every popover. */
		showReset?: boolean;
		/**
		 * What "unmodified" means for THIS list, and what Reset restores.
		 *
		 * A parameter because the panel now draws two different knob sets: the
		 * Möbius backdrop's, and whichever standalone family is selected.
		 * Comparing a family's knobs against the Möbius defaults would find no
		 * match for any of them and report the whole panel as untouched.
		 */
		defaults?: Knob[];
		/**
		 * Drop the alpha slider beside each swatch.
		 *
		 * Alpha is first-class for a backdrop — it is the difference between a
		 * backdrop and a foreground — and meaningless for a consumer that paints
		 * opaque solids, like the character renderer, where a translucent facet
		 * would just be a hole. Shipping the slider there anyway would be a
		 * control that does nothing, which this file's own rule calls worse than
		 * no control.
		 */
		hideAlpha?: boolean;
		/**
		 * Draw a choice knob's options as rendered previews instead of their names.
		 *
		 * A name is enough to pick between `hollow | weight | plated`. It is not
		 * enough to pick between thirty shield silhouettes — nobody can tell
		 * `crestnotch` from `crestkey` from the word. The panel stays ignorant of
		 * what it is drawing: the caller hands back a thumbnail for a given
		 * (prop, option) pair, and the panel just lays them out.
		 */
		optionPreview?: Snippet<[string, string]>;
		onchange: (next: Knob[]) => void;
	}

	let {
		knobs,
		group,
		showReset = true,
		defaults,
		hideAlpha = false,
		optionPreview,
		onchange
	}: Props = $props();

	const base = $derived(defaults ?? defaultKnobs());

	const shown = $derived(group ? knobs.filter((k) => k.group === group) : knobs);

	/** Which swatch has its palette open. One at a time. */
	let picking = $state<string | null>(null);

	const keyOf = knobKey;

	/**
	 * The design system's own accents, plus the neutral greys this backdrop
	 * actually lives in. A curated palette beats a full picker here: every
	 * useful value for a backdrop is either a token accent or a desaturated
	 * grey, and the hex field covers anything outside that.
	 */
	const PALETTE = [
		{ name: 'Mint', hex: '#5eead4' },
		{ name: 'Cyan', hex: '#22d3ee' },
		{ name: 'Emerald', hex: '#34d399' },
		{ name: 'Blue', hex: '#38bdf8' },
		{ name: 'Violet', hex: '#c4b5fd' },
		{ name: 'Amber', hex: '#fcd34d' },
		{ name: 'Orange', hex: '#fb923c' },
		{ name: 'Red', hex: '#fca5a5' },
		{ name: 'Sage', hex: '#96b2aa' },
		{ name: 'Slate', hex: '#7e968e' },
		{ name: 'Steel', hex: '#8a969c' },
		{ name: 'Bone', hex: '#e5edf0' }
	];

	function set(k: Knob, value: string | number | boolean) {
		onchange(knobs.map((x) => (keyOf(x) === keyOf(k) ? ({ ...x, value } as Knob) : x)));
	}

	function reset() {
		onchange(base.map((k) => ({ ...k })));
	}

	/** Rounded to the control's own step — `0.9000000000000001` is undictatable. */
	function fmt(value: number, step: number): string {
		const dp = step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0;
		return (Math.round(value / step) * step).toFixed(dp);
	}
</script>

<div class="panel">
	{#each shown as k (keyOf(k))}
		<div class="row" class:changed={isChanged(k, base)}>
			{#if k.kind === 'color'}
				{@const { hex, alpha } = splitColor(k.value)}
				<!--
					Deliberately NOT `<input type="color">`. That opens the OS colour
					panel, which on macOS is a large floating window — far bigger than
					the popover that launched it, and it covers the very stage you are
					tuning. A palette plus a hex field handles every case this
					backdrop actually has, inline, at the size of the control.
				-->
				<button
					class="swatch"
					title="{k.label}: {k.value}"
					aria-label="{k.label} colour"
					onclick={() => (picking = picking === keyOf(k) ? null : keyOf(k))}
				>
					<span class="square" style:background={k.value}>
						{#if isChanged(k, base)}<span class="pip"></span>{/if}
					</span>
				</button>

				<span class="meta" title={k.hint}>
					<span class="label">{k.label}</span>
				</span>

				<!-- Alpha is a first-class control, not a footnote: down here it is
				     the difference between a backdrop and a foreground. -->
				{#if !hideAlpha}
					<span class="ctrl">
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={alpha}
							oninput={(e) =>
								set(k, joinColor(hex, Number((e.currentTarget as HTMLInputElement).value)))}
							aria-label="{k.label} alpha"
						/>
						<span class="val">α {alpha.toFixed(2)}</span>
					</span>
				{/if}

				{#if picking === keyOf(k)}
					<div class="picker">
						<div class="hues">
							{#each PALETTE as p (p.hex)}
								<button
									class="chip"
									class:sel={p.hex.toLowerCase() === hex.toLowerCase()}
									style:background={p.hex}
									title={p.name}
									aria-label={p.name}
									onclick={() => set(k, joinColor(p.hex, alpha))}
								></button>
							{/each}
						</div>
						<label class="hexrow">
							<span>hex</span>
							<input
								class="hex"
								value={hex}
								spellcheck="false"
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value.trim();
									// Only commit a complete, valid hex — otherwise every
									// keystroke mid-typing would repaint with garbage.
									if (/^#[0-9a-f]{6}$/i.test(v)) set(k, joinColor(v, alpha));
								}}
							/>
						</label>
					</div>
				{/if}
			{:else if k.kind === 'toggle'}
				<span class="swatch-gap" aria-hidden="true">
					{#if isChanged(k, base)}<span class="pip pip--bare"></span>{/if}
				</span>

				<span class="meta" title={k.hint}>
					<span class="label">{k.label}</span>
				</span>

				<span class="ctrl ctrl--switch">
					<Toggle checked={k.value} label={k.label} onchange={(v) => set(k, v)} />
					<span class="val">{k.value ? 'on' : 'off'}</span>
				</span>
			{:else if k.kind === 'choice'}
				<span class="swatch-gap" aria-hidden="true">
					{#if isChanged(k, base)}<span class="pip pip--bare"></span>{/if}
				</span>

				<span class="meta" title={k.hint}>
					<span class="label">{k.label}</span>
				</span>

				<!-- Segmented rather than a <select>: the option set is short and the
				     whole point is seeing the alternatives you are not on. -->
				<span class="ctrl">
					<span class="seg" class:seg--cards={optionPreview} role="group" aria-label={k.label}>
						{#each k.options as o (o)}
							<button
								class="chip-opt"
								class:chip-opt--card={optionPreview}
								class:on={o === k.value}
								aria-pressed={o === k.value}
								title={o}
								onclick={() => set(k, o)}
							>
								{#if optionPreview}
									{@render optionPreview(k.prop, o)}
									<span class="chip-opt__name">{o}</span>
								{:else}
									{o}
								{/if}
							</button>
						{/each}
					</span>
				</span>
			{:else}
				<span class="swatch-gap" aria-hidden="true"></span>

				<span class="meta" title={k.hint}>
					<span class="label">{k.label}</span>
				</span>

				<span class="ctrl">
					<input
						type="range"
						min={k.min}
						max={k.max}
						step={k.kind === 'range' ? k.step : (k.step ?? 1)}
						value={k.value}
						oninput={(e) => set(k, Number((e.currentTarget as HTMLInputElement).value))}
						aria-label={k.label}
					/>
					<span class="val"
						>{fmt(k.value, k.kind === 'range' ? k.step : (k.step ?? 1))}{k.unit ?? ''}</span
					>
				</span>
			{/if}
		</div>
	{/each}

	{#if showReset}
		<button class="reset" onclick={reset}>Reset to defaults</button>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	/*
	 * Two lines, not three columns.
	 *
	 * This was `34px / 1fr / 190px` — about 250px of hard minimums before gaps,
	 * which is fine in a wide panel and unusable in the studio's 340px rail:
	 * the label column collapsed to a few characters and the hint wrapped to
	 * five lines. Stacking the control under its own label gives the slider the
	 * full width at any rail size, and the hint moves to a `title` so it costs
	 * no vertical space at all.
	 */
	.row {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		grid-template-areas:
			'swatch label'
			'ctrl   ctrl';
		align-items: center;
		gap: 4px 10px;
		padding: 6px 8px;
		border-radius: 6px;
	}
	.swatch,
	.swatch-gap {
		grid-area: swatch;
	}
	.meta {
		grid-area: label;
	}
	.ctrl {
		grid-area: ctrl;
	}
	.row.changed {
		background: color-mix(in srgb, var(--accent) 6%, transparent);
	}

	.swatch {
		position: relative;
		display: block;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	/* The palette drops under the row it belongs to, full width — the whole point
	   being that it never opens a window larger than its parent. */
	.picker {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 8px;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
	}
	.hues {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 5px;
	}
	.chip {
		height: 20px;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
	}
	.chip.sel {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.hexrow {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.hex {
		flex: 1;
		min-width: 0;
		padding: 4px 7px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--input-bg);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.62rem;
		outline: none;
	}
	.hex:focus {
		border-color: var(--border-accent);
	}
	.square {
		display: block;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 1px solid var(--border);
		position: relative;
		transition: transform 0.12s;
		/* A checker under the swatch, so a low-alpha colour reads as translucent
		   rather than as "a dark colour". Without it every faint token looks the
		   same and the alpha slider appears to do nothing. */
		background-image:
			linear-gradient(45deg, var(--border) 25%, transparent 25%),
			linear-gradient(-45deg, var(--border) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--border) 75%),
			linear-gradient(-45deg, transparent 75%, var(--border) 75%);
		background-size: 8px 8px;
		background-position:
			0 0,
			0 4px,
			4px -4px,
			-4px 0;
	}
	.swatch:hover .square {
		transform: scale(1.08);
	}
	.pip {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--fg);
		box-shadow: 0 0 0 1.5px var(--bg);
	}
	.swatch-gap {
		position: relative;
		width: 28px;
	}
	/* A switch and a segment have no swatch to carry the modified pip, so it
	   sits in the empty column instead — same place, same read. */
	.pip--bare {
		top: 50%;
		right: 10px;
		transform: translateY(-50%);
	}

	.ctrl--switch {
		gap: 10px;
	}
	.ctrl--switch .val {
		width: auto;
		text-align: left;
	}
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}
	.chip-opt {
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition:
			color 0.12s,
			border-color 0.12s,
			background 0.12s;
	}
	.chip-opt:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.chip-opt.on {
		color: var(--accent);
		border-color: var(--border-accent, var(--accent));
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	/* Card mode: a grid of thumbnails rather than a wrapping run of words. The
	   column count is fixed rather than auto-fit so the cards stay a constant
	   size — a picker whose tiles resize with the panel makes the thing you are
	   comparing the one thing that keeps changing. */
	.seg--cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}
	.chip-opt--card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 5px 2px 4px;
	}
	.chip-opt__name {
		font-size: 0.5rem;
		letter-spacing: 0.02em;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.label {
		font-size: 0.76rem;
		color: var(--fg);
	}
	.ctrl {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ctrl input {
		flex: 1;
		min-width: 0;
	}
	.val {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		width: 3.4rem;
		text-align: right;
	}

	.reset {
		align-self: flex-start;
		margin-top: 6px;
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
	.reset:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
</style>
