<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// CHIP STUDIO — a bench for the chip's silhouette vocabulary.
	//
	// Same shape as the Icon Studio, for the same reasons: a bare <dialog>
	// rather than `Modal` (Modal is title/body/footer at a fixed size; this is a
	// full-bleed stage), header of wordmark · subject pills · close, one live
	// subject in the middle, generated panel on the right. The panel is NOT
	// hand-written — `chip-knobs.ts` declares it and `BackdropControls` draws it.
	//
	// TWO THINGS IT DOES THAT THE ICON STUDIO DOES NOT:
	//
	// · The subject pills are the SILHOUETTES, not sibling components. There is
	//   one Chip; what you are choosing between is what its shape says. Making
	//   the cut the top-level subject is what turns the vocabulary from a
	//   dropdown buried in a panel into the thing the studio is about.
	// · There is a context strip under the stage. A chip magnified to 5× on
	//   black always looks considered — the question that decides a silhouette is
	//   whether eight of them in a table row still read as eight labels, so the
	//   strip is not a nicety, it is the actual test.

	import { untrack } from 'svelte';
	import BackdropControls from '../../backdrop/BackdropControls.svelte';
	import type { Knob } from '../../backdrop/backdrop-tokens.js';
	import Icon from '../../icons/Icon.svelte';
	import Chip, { type ChipColor, type ChipCut, type ChipEdge, type ChipLead, type ChipLook, type ChipSize } from './Chip.svelte';
	import { CHIP_COLORS, CUT_NOTES, chipKnobs, chipSnippet, readChipKnobs } from './chip-knobs.js';

	interface Props {
		open: boolean;
		/** Which silhouette the studio opens on — every way in from the page has
		 *  its own, and landing on the wrong one is a hunt. */
		cut?: ChipCut;
		onclose: () => void;
	}

	let { open, cut, onclose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let knobs = $state<Knob[]>(chipKnobs());
	let label = $state('alpha open');
	let scale = $state(4);

	const base = chipKnobs();
	const s = $derived(readChipKnobs(knobs));
	const CUTS = $derived(
		(base.find((k) => k.kind === 'choice' && k.prop === 'cut') as { options: readonly string[] })
			.options
	);
	const i = $derived(CUTS.indexOf(s.cut));

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	/** Reopening from a different cell reseats the silhouette; reopening from the
	 *  same one keeps whatever was tuned, so a close is not a loss. */
	// Every read of `knobs` here is untracked: this effect also writes it, and a
	// tracked read would be a write-to-what-you-read loop.
	$effect(() => {
		if (!open || !cut) return;
		if (untrack(() => readChipKnobs(knobs).cut) !== cut) setCut(cut);
	});

	function setCut(next: string) {
		const cur = untrack(() => knobs);
		const at = cur.findIndex((k) => k.kind === 'choice' && k.prop === 'cut');
		if (at < 0 || cur[at].value === next) return;
		const out = cur.slice();
		out[at] = { ...cur[at], value: next } as Knob;
		knobs = out;
	}

	const step = (d: number) => setCut(CUTS[(i + d + CUTS.length) % CUTS.length]);

	const code = $derived(chipSnippet(knobs, base, label || 'label'));

	// The stage's props, in one place — the magnified chip, the six preview
	// thumbnails and the context strip all render the SAME tuning, or the strip
	// stops being a test of anything.
	const stage = $derived({
		look: s.look as ChipLook,
		color: s.color as ChipColor,
		cut: s.cut as ChipCut,
		cutSize: s.cutSize,
		edge: s.edge as ChipEdge,
		lead: s.lead as ChipLead,
		pulse: s.pulse,
		size: s.size as ChipSize
	});

	const ROWS = [
		{ vendor: 'stripe', crit: 'critical', color: 'critical' as ChipColor },
		{ vendor: 'datadog', crit: 'high', color: 'warn' as ChipColor },
		{ vendor: 'figma', crit: 'moderate', color: 'cyan' as ChipColor },
		{ vendor: 'linear', crit: 'low', color: 'success' as ChipColor }
	];
</script>

<dialog
	class="cs-modal"
	bind:this={dialogEl}
	aria-labelledby="cs-wordmark"
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
	<div class="cs-shell">
		<div class="cs-header">
			<span class="cs-wordmark" id="cs-wordmark">CHIP STUDIO</span>
			<div class="cs-pills">
				{#each CUTS as c (c)}
					<button class="cs-pill" class:on={c === s.cut} onclick={() => setCut(c)}>{c}</button>
				{/each}
			</div>
			<span class="cs-spacer"></span>
			<button class="cs-close" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="cs-body">
			<button class="cs-arrow" onclick={() => step(-1)} aria-label="Previous silhouette">‹</button>

			<div class="cs-stage">
				<div class="cs-glow"></div>

				<div class="cs-art">
					<!-- Magnified with `transform`, not by growing the type: the chip's
					     padding, tracking and 1.1px hairline are all tuned at ship size,
					     and re-deriving them at 5× would show a chip that does not exist. -->
					<div class="cs-zoom" style:transform="scale({scale})">
						<Chip {...stage}>{label || 'label'}</Chip>
					</div>
				</div>

				<div class="cs-scale" role="group" aria-label="Stage zoom">
					{#each [2, 3, 4, 5, 6] as n (n)}
						<button class="cs-z" class:on={scale === n} aria-pressed={scale === n} onclick={() => (scale = n)}>{n}×</button>
					{/each}
				</div>

				<!-- The real test. -->
				<div class="cs-context">
					<div class="cs-ctx-h">in a table</div>
					<table class="cs-table">
						<tbody>
							{#each ROWS as r (r.vendor)}
								<tr>
									<td>{r.vendor}</td>
									<td><Chip {...stage} color={r.color}>{r.crit}</Chip></td>
									<td><Chip {...stage} color="default">soc 2</Chip></td>
									<td class="cs-num">{r.vendor.length * 7}</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<div class="cs-ctx-h">in a row of eight</div>
					<div class="cs-strip">
						{#each CHIP_COLORS.slice(0, 8) as c (c)}
							<Chip {...stage} color={c}>{c}</Chip>
						{/each}
					</div>

					<div class="cs-ctx-h">inline, at ship size</div>
					<p class="cs-prose">
						The agent reported <Chip {...stage}>{label || 'label'}</Chip> at 04:12 and has held that
						state since.
					</p>
				</div>
			</div>

			<button class="cs-arrow" onclick={() => step(1)} aria-label="Next silhouette">›</button>

			<aside class="cs-panel">
				<!-- A silhouette cannot be picked by its name — `line` and `shield`
				     are words for two chamfer patterns nobody can tell apart until
				     they see them. Every other choice knob keeps its word chips. -->
				{#snippet cutCards(prop: string, option: string)}
					{#if prop === 'cut'}
						<Chip
							look={stage.look}
							color={stage.color}
							cut={option as ChipCut}
							cutSize={stage.cutSize}
							edge={stage.edge}>{option}</Chip
						>
					{/if}
				{/snippet}

				{#snippet section(title: string, group: 'colour' | 'shape' | 'light' | 'motion')}
					<div class="cs-group">
						<div class="cs-group-h">{title}</div>
						<BackdropControls
							{knobs}
							{group}
							defaults={base}
							showReset={false}
							hideAlpha
							optionPreview={group === 'shape' ? cutCards : undefined}
							onchange={(next) => (knobs = next)}
						/>
					</div>
				{/snippet}

				{@render section('Palette', 'colour')}
				{@render section('Shape', 'shape')}
				{@render section('Marker', 'light')}
				{@render section('Motion', 'motion')}

				<div class="cs-group">
					<div class="cs-group-h">Label</div>
					<input class="cs-input" spellcheck="false" placeholder="chip text" bind:value={label} />
				</div>

				<button class="cs-reset" onclick={() => (knobs = chipKnobs())}>Reset</button>
			</aside>
		</div>

		<div class="cs-foot">
			<div class="cs-name">
				<b>{s.cut}</b>
				<i>{CUT_NOTES[s.cut]}</i>
			</div>

			<code class="cs-code">{code}</code>

			<button
				class="cs-btn"
				onclick={() => navigator.clipboard?.writeText(code)}
				title="Copy the usage line"
			>
				<Icon name="copy" size={13} /> Copy
			</button>
		</div>
	</div>
</dialog>

<style>
	.cs-modal {
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
	.cs-modal::backdrop {
		background: rgba(3, 6, 10, 0.6);
		backdrop-filter: blur(4px);
	}
	.cs-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.cs-header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.cs-wordmark {
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		white-space: nowrap;
	}
	.cs-spacer {
		flex: 1;
	}
	.cs-pills {
		display: flex;
		gap: 4px;
	}
	.cs-pill {
		padding: 5px 12px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.15s;
	}
	.cs-pill:hover {
		color: var(--fg);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.cs-pill.on {
		color: var(--accent);
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.cs-close {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 6px;
		width: 28px;
		height: 28px;
		cursor: pointer;
	}
	.cs-close:hover {
		color: var(--fg);
	}

	.cs-body {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: stretch;
	}
	.cs-arrow {
		width: 56px;
		flex: none;
		border: none;
		background: transparent;
		color: var(--fg-dim);
		font-size: 2rem;
		cursor: pointer;
		transition: color 0.15s;
	}
	.cs-arrow:hover {
		color: var(--accent);
	}

	.cs-stage {
		flex: 1;
		min-width: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		padding: 28px 24px;
		overflow-y: auto;
	}
	.cs-glow {
		position: absolute;
		top: 60px;
		width: 320px;
		height: 160px;
		border-radius: 50%;
		background: radial-gradient(
			ellipse,
			color-mix(in srgb, var(--accent) 12%, transparent),
			transparent 70%
		);
		filter: blur(30px);
		pointer-events: none;
	}
	.cs-art {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 180px;
		width: 100%;
	}
	.cs-zoom {
		transform-origin: center;
	}

	.cs-scale {
		display: flex;
		gap: 4px;
	}
	.cs-z {
		padding: 3px 9px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.6rem;
		cursor: pointer;
	}
	.cs-z.on {
		color: var(--accent);
		border-color: var(--accent);
	}

	.cs-context {
		width: 100%;
		max-width: 620px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.cs-ctx-h {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.7;
		margin-top: 10px;
	}
	.cs-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg-dim);
	}
	.cs-table td {
		padding: 7px 10px;
		border-bottom: 1px solid var(--border);
	}
	.cs-num {
		text-align: right;
	}
	.cs-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.cs-prose {
		font-size: 0.8rem;
		line-height: 1.9;
		color: var(--fg-dim);
	}

	.cs-panel {
		width: 300px;
		flex: none;
		border-left: 1px solid var(--border);
		padding: 14px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.cs-group-h {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 8px;
	}
	.cs-input {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.7rem;
	}
	.cs-reset {
		margin-top: auto;
		padding: 7px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.cs-reset:hover {
		color: var(--fg);
	}

	.cs-foot {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
	.cs-name {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.cs-name b {
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.cs-name i {
		font-style: normal;
		font-size: 0.68rem;
		color: var(--fg-dim);
	}
	.cs-code {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		padding: 5px 9px;
		border-radius: 3px;
		white-space: nowrap;
		overflow-x: auto;
		max-width: 46%;
	}
	.cs-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		flex: none;
	}
	.cs-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
</style>
