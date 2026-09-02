<script lang="ts">
	// Dev-cog control for `Panel`'s `shape` — the header/outline composition.
	// Lives beside the primitive it drives, like `FrameDevControls` and
	// `GlobeDevControls`, and drops into a host's `qaContent`.
	//
	// It borrows the cog's existing element inspector rather than arming its own:
	// `nits.pickOnce` hands the next clicked element here instead of opening the
	// note popup, so there is one armed-click mode in the product and not two
	// fighting for the same clicks.
	//
	// Why this is a dev instrument and not a view control, by the line the cog
	// keeps forcing: a card's shape is a design decision that ships in the source,
	// not something an operator sets and keeps. What this buys is the comparison
	// you cannot get from a specimen strip — a shape that looks decisive alone is
	// often noise in a column of six, and the only honest test is changing one on
	// a real page with real content in it.
	//
	// Nothing is persisted. The classes are swapped on the live element and the
	// next reload is back to what the source says.
	import type { NitsController } from '../../devcog/index.js';
	import {
		PANEL_SHAPES,
		applyPanelShape,
		readPanelShape,
		type PanelShape
	} from './panel-shape.js';

	let { nits }: { nits: NitsController } = $props();

	let target = $state<HTMLElement | null>(null);
	/** What the target wore when it was picked, so `revert` is a real undo. */
	let original = $state<PanelShape>('default');
	let shape = $state<PanelShape>('default');
	/** Re-shape every panel on the page instead of the one picked. */
	let all = $state(false);
	let missed = $state(false);

	function pick() {
		missed = false;
		nits.pickOnce((el) => {
			// The click usually lands on a label INSIDE the card, so walk up. A card
			// is not always an ancestor though — `tab` and `pill` position their
			// header outside the panel box — so fall back to a containing panel.
			const panel = (el.closest('.panel') ?? el.querySelector('.panel')) as HTMLElement | null;
			if (!panel) {
				missed = true;
				return;
			}
			target = panel;
			original = readPanelShape(panel);
			shape = original;
		});
	}

	function targets(): HTMLElement[] {
		if (all) return [...document.querySelectorAll<HTMLElement>('.panel')];
		return target ? [target] : [];
	}

	function set(next: PanelShape) {
		shape = next;
		for (const el of targets()) applyPanelShape(el, next);
	}

	function step(d: -1 | 1) {
		const i = PANEL_SHAPES.findIndex((s) => s.value === shape);
		set(PANEL_SHAPES[(i + d + PANEL_SHAPES.length) % PANEL_SHAPES.length].value);
	}

	function revert() {
		for (const el of targets()) applyPanelShape(el, original);
		shape = original;
	}

	const meta = $derived(PANEL_SHAPES.find((s) => s.value === shape) ?? PANEL_SHAPES[0]);
	const armed = $derived(nits.inspecting && nits.borrowed);
</script>

<section class="ps">
	<div class="ps-head">
		<span class="ps-label">// panel shape</span>
		{#if target || all}
			<div class="ps-acts">
				<button class="ps-ghost" onclick={() => step(-1)} aria-label="Previous shape">‹</button>
				<button class="ps-ghost" onclick={() => step(1)} aria-label="Next shape">›</button>
				<button class="ps-ghost" onclick={revert}>revert</button>
			</div>
		{/if}
	</div>

	<button class="qa-fill-btn" class:armed onclick={pick}>
		{armed ? 'Click a card…' : target ? 'Pick another card' : 'Pick a card'}
	</button>

	{#if missed}
		<p class="ps-msg">That is not inside a Panel — pick a card.</p>
	{/if}

	{#if target || all}
		<div class="ps-grid">
			{#each PANEL_SHAPES as s (s.value)}
				<button
					class="ps-chip"
					aria-pressed={shape === s.value}
					title={s.description}
					onclick={() => set(s.value)}
				>
					{s.label}
				</button>
			{/each}
		</div>
		<p class="ps-msg">{meta.description}</p>
		<label class="ps-all">
			<input type="checkbox" bind:checked={all} />
			apply to every panel on the page
		</label>
	{/if}
</section>

<style>
	/* Matches the drawer's own section chrome. `QaSection` is deliberately not
	   exported — a host tool wears the same padding and rule by hand. */
	.ps {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
	}
	.ps-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.ps-label {
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ps-acts {
		display: flex;
		gap: 4px;
	}
	.ps-ghost {
		padding: 2px 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		cursor: pointer;
	}
	.ps-ghost:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.qa-fill-btn.armed {
		color: var(--accent);
		border-color: var(--accent);
	}

	.ps-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		margin-top: 8px;
	}
	.ps-chip {
		padding: 4px 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: none;
		color: var(--fg-muted);
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		text-transform: uppercase;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ps-chip:hover {
		color: var(--fg);
	}
	.ps-chip[aria-pressed='true'] {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.ps-msg {
		margin: 8px 0 0;
		font-size: 0.66rem;
		line-height: 1.4;
		color: var(--fg-dim);
	}
	.ps-all {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		color: var(--fg-dim);
		cursor: pointer;
	}
</style>
