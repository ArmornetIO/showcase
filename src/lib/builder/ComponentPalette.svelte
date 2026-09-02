<script lang="ts">
	// ── ComponentPalette — the drag source, drawn as the components themselves ──
	// A palette of labels makes you remember what "Stat Tile" looks like; a palette
	// of the real thing makes you look. Every card is the actual component, mounted
	// through the builder's own `ComponentRenderer` with its registry defaults, so
	// the thumbnail is honest about what a drop will produce.
	//
	// ~60 live Svelte components is a lot to instantiate to browse six of them, so
	// an IntersectionObserver mounts only what has scrolled into view (and never
	// unmounts — scrolling back up should not re-instantiate).
	//
	// Shared by the builder toolbox and the scene palette: one drag contract
	// (`component-id`), one preview, one place to fix it.
	import { onMount } from 'svelte';
	import ComponentRenderer from './ComponentRenderer.svelte';
	import { REGISTRY, type ComponentMeta } from './registry.js';
	import { TEMPLATES, templateSource, type BuilderTemplate } from './templates.js';
	import { fuzzyRank } from '../fuzzy.js';

	interface Props {
		/** Double-click on a card — hosts that can place centre wire this up. */
		onAdd?: (componentId: string) => void;
		/** Search box + "N/M" counter. Off for hosts that own their own header. */
		showSearch?: boolean;
		placeholder?: string;
		/**
		 * Show the Templates tab. Off by default: a template is a whole canvas
		 * arrangement, which only makes sense where there is a canvas to drop it
		 * on — the scene palette has no use for it.
		 */
		showTemplates?: boolean;
		/** Apply a template at the canvas centre. */
		onTemplate?: (template: BuilderTemplate) => void;
	}

	let {
		onAdd,
		showSearch = true,
		placeholder = 'Search components…',
		showTemplates = false,
		onTemplate
	}: Props = $props();

	let tab = $state<'components' | 'templates'>('components');

	let query = $state('');
	let visible = $state(new Set<string>());
	let scroller = $state<HTMLDivElement | undefined>();
	const cards = new Map<string, HTMLElement>();

	/** Ranked with the same scorer the command palette uses, so "dnt" finds the
	 *  Donut Chart and "chart" puts Chart above Donut Chart. Registry order wins
	 *  for an empty query — that grouping is the browsing order. Categories are
	 *  kept and ordered by their best hit, rather than flattened, because
	 *  "which family is this in" is half of what the palette teaches. */
	const groups = $derived.by(() => {
		const ranked = fuzzyRank(
			query,
			REGISTRY.filter((m) => m.placeable),
			(m) => [
				[m.label, 0],
				[m.id, 40],
				[m.category, 260]
			]
		);
		const map = new Map<string, ComponentMeta[]>();
		for (const meta of ranked) {
			if (!map.has(meta.category)) map.set(meta.category, []);
			map.get(meta.category)!.push(meta);
		}
		return [...map.entries()].map(([category, items]) => ({ category, items }));
	});

	const total = $derived(REGISTRY.filter((r) => r.placeable).length);
	const shown = $derived(groups.reduce((n, g) => n + g.items.length, 0));

	/** Registry defaults — the same values the builder drops a fresh one with, so
	 *  the thumbnail matches what you actually get. */
	function defaults(meta: ComponentMeta): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const [k, def] of Object.entries(meta.props)) out[k] = def.default;
		return out;
	}

	/** Authored at its real width and scaled to fit, never reflowed — a component
	 *  squeezed into 100px would show a layout it never actually has.
	 *
	 *  `defaultW: 0` means "intrinsic width": those are laid out at `fit-content`
	 *  (capped, so a paragraph-shaped one does not run away) and measured, rather
	 *  than dropped into a 260px box where an icon renders as a speck in the
	 *  corner. Everything else is laid out at its registry width. */
	const THUMB_W = 100;
	const THUMB_H = 58;
	const LAYOUT_W = 260;

	/** Measured layout size per component, filled in after mount. */
	let sizes = $state(new Map<string, { w: number; h: number }>());

	function widthFor(meta: ComponentMeta): number {
		return meta.defaultW || sizes.get(meta.id)?.w || LAYOUT_W;
	}

	/** Clamped both ways: a wide component shrinks until it fits, and a tiny one
	 *  (an icon, a status dot) grows rather than sitting as a speck in the middle
	 *  of its card — but only to `MAX_SCALE`, past which a 12px glyph blown up
	 *  reads as a different component than the one you will get. */
	const MAX_SCALE = 1.7;

	function fitScale(meta: ComponentMeta): number {
		const size = sizes.get(meta.id);
		const byW = THUMB_W / widthFor(meta);
		const byH = size && size.h > 0 ? THUMB_H / size.h : MAX_SCALE;
		return Math.max(0.14, Math.min(MAX_SCALE, byW, byH));
	}

	/** `offsetWidth`/`offsetHeight` are LAYOUT box sizes — CSS transforms don't
	 *  affect them — so the natural size reads correctly no matter what scale is
	 *  already applied. */
	function measure(el: HTMLElement, id: string) {
		requestAnimationFrame(() => {
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			const prev = sizes.get(id);
			if (h > 0 && (!prev || Math.abs(prev.h - h) > 1 || Math.abs(prev.w - w) > 1)) {
				const next = new Map(sizes);
				next.set(id, { w, h });
				sizes = next;
			}
		});
		return { destroy() {} };
	}

	let observer: IntersectionObserver | undefined;

	function register(el: HTMLElement, id: string) {
		cards.set(id, el);
		observer?.observe(el);
		return {
			destroy() {
				observer?.unobserve(el);
				cards.delete(id);
			}
		};
	}

	/** The drag payload the canvas drop handler reads. */
	function dragStart(e: DragEvent, id: string) {
		e.dataTransfer?.setData('component-id', id);
		e.dataTransfer!.effectAllowed = 'copy';
	}

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				let changed = false;
				const next = new Set(visible);
				for (const e of entries) {
					const id = (e.target as HTMLElement).dataset.cid;
					if (id && e.isIntersecting && !next.has(id)) {
						next.add(id);
						changed = true;
					}
				}
				if (changed) visible = next;
			},
			{ root: scroller, rootMargin: '240px 0px' }
		);
		for (const el of cards.values()) observer.observe(el);
		return () => observer?.disconnect();
	});
</script>

{#if showTemplates}
	<div class="cp-tabs">
		<button
			class="cp-tab"
			class:cp-tab--on={tab === 'components'}
			onclick={() => (tab = 'components')}>COMPONENTS</button
		>
		<button
			class="cp-tab"
			class:cp-tab--on={tab === 'templates'}
			onclick={() => (tab = 'templates')}>TEMPLATES</button
		>
	</div>
{/if}

{#if tab === 'templates'}
	<div class="cp-scroll">
		{#each TEMPLATES as t (t.id)}
			<button class="cp-template" onclick={() => onTemplate?.(t)}>
				<span class="cp-template-name">
					{t.name}
					<!-- The route it was measured from, or PART. Without it the palette
					     cannot say which of these is a real screen — and the ones that
					     could not say turned out to be screens the product never had. -->
					{#if templateSource(t.id)}
						<span class="cp-template-src">{templateSource(t.id)}</span>
					{:else}
						<span class="cp-template-src cp-template-src--part">part</span>
					{/if}
				</span>
				<span class="cp-template-desc">{t.description}</span>
				<span class="cp-template-meta">
					{t.items.length} components{t.frame ? ` · ${t.frame.preset}` : ''}
				</span>
			</button>
		{/each}
		<p class="cp-template-note">
			A template drops in as ordinary components, grouped under its name. Nothing stays linked —
			ungroup it and the arrangement is yours.
		</p>
	</div>
{:else}
	{#if showSearch}
		<div class="cp-head">
			<span class="cp-count">COMPONENTS · {shown}/{total}</span>
			<input class="cp-search" type="search" {placeholder} bind:value={query} />
		</div>
	{/if}

	<div class="cp-scroll" bind:this={scroller}>
	{#each groups as g (g.category)}
		<div class="cp-group">{g.category}</div>
		<div class="cp-grid">
			{#each g.items as meta (meta.id)}
				<div
					class="cp-card"
					data-cid={meta.id}
					draggable="true"
					ondragstart={(e) => dragStart(e, meta.id)}
					ondblclick={() => onAdd?.(meta.id)}
					title="{meta.id} — drag onto the canvas{onAdd
						? ', or double-click to drop it in the middle'
						: ''}"
					role="presentation"
					use:register={meta.id}
				>
					<div class="cp-thumb">
						{#if visible.has(meta.id)}
							<div
								class="cp-thumb-in"
								class:cp-intrinsic={!meta.defaultW}
								style:transform="scale({fitScale(meta)})"
								style:width={meta.defaultW ? `${meta.defaultW}px` : undefined}
								use:measure={meta.id}
							>
								<ComponentRenderer
									componentId={meta.id}
									props={defaults(meta)}
									w={meta.defaultW}
									h={0}
								/>
							</div>
						{:else}
							<div class="cp-skel"></div>
						{/if}
					</div>
					<div class="cp-label">{meta.label}</div>
				</div>
			{/each}
		</div>
	{/each}

		{#if !groups.length}
			<div class="cp-empty">No components match “{query}”</div>
		{/if}
	</div>
{/if}

<style>
	/* ── Tabs ────────────────────────────────────────────────────────────────── */
	.cp-tabs {
		display: flex;
		gap: 2px;
		padding: 0.5rem 0 0;
	}
	.cp-tab {
		flex: 1;
		padding: 4px 6px;
		background: none;
		border: 1px solid transparent;
		border-radius: 2px;
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.cp-tab:hover {
		color: var(--accent);
	}
	.cp-tab--on {
		color: var(--accent);
		border-color: var(--border, rgba(94, 234, 212, 0.25));
		background: rgba(94, 234, 212, 0.06);
	}

	/* ── Templates ───────────────────────────────────────────────────────────── */
	.cp-template {
		display: flex;
		flex-direction: column;
		gap: 3px;
		width: 100%;
		margin-top: 0.4rem;
		padding: 8px;
		text-align: left;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
		border-radius: 0.35rem;
		cursor: pointer;
	}
	.cp-template:hover {
		border-color: var(--accent);
		background: rgba(94, 234, 212, 0.08);
	}
	.cp-template-name {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg);
	}
	.cp-template-desc {
		font-size: 9px;
		line-height: 1.4;
		color: var(--fg-muted, #9fb3c8);
	}
	.cp-template-src {
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.06em;
		color: var(--accent);
		background: var(--accent-faint);
		border-radius: 3px;
		padding: 1px 4px;
		margin-left: 0.4rem;
	}
	.cp-template-src--part {
		color: var(--fg-dim);
		background: var(--surface-raised);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.cp-template-meta {
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
	}
	.cp-template-note {
		margin: 0.8rem 0 0;
		font-size: 9px;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	.cp-head {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 0.5rem 0 0.4rem;
		background: var(--bg-elev, var(--bg, #0a1120));
	}
	.cp-count {
		display: block;
		margin-bottom: 0.3rem;
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.24em;
		color: var(--accent);
	}
	.cp-search {
		width: 100%;
		box-sizing: border-box;
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.15));
		border-radius: 2px;
		background: var(--bg, #060b14);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 11px;
		outline: none;
	}
	.cp-search:focus {
		border-color: var(--accent);
	}
	.cp-search::placeholder {
		color: var(--fg-dim);
	}

	.cp-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding-bottom: 1rem;
	}

	.cp-group {
		margin: 0.55rem 0 0.28rem;
		font-family: var(--mono);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.cp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(94px, 1fr));
		gap: 0.3rem;
	}

	.cp-card {
		border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
		border-radius: 0.35rem;
		background: rgba(255, 255, 255, 0.03);
		overflow: hidden;
		cursor: grab;
	}
	.cp-card:hover {
		border-color: var(--accent);
		background: rgba(94, 234, 212, 0.08);
	}
	.cp-card:active {
		cursor: grabbing;
	}

	.cp-thumb {
		height: 4.1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 0.3rem;
		/* The thumbnail is a picture of the component, not a control — clicks and
		   hovers belong to the card so the whole tile is one drag handle. */
		pointer-events: none;
	}
	/* Centre-origin so a fitted preview sits in the middle of its card rather
	   than hugging the corner. */
	.cp-thumb-in {
		transform-origin: center center;
		flex: none;
	}
	.cp-intrinsic {
		width: fit-content;
		max-width: 260px;
	}
	.cp-skel {
		width: 100%;
		height: 100%;
		border-radius: 0.2rem;
		background: linear-gradient(
			100deg,
			rgba(255, 255, 255, 0.03),
			rgba(255, 255, 255, 0.07),
			rgba(255, 255, 255, 0.03)
		);
	}

	.cp-label {
		padding: 0.22rem 0.35rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		font-family: var(--mono);
		font-size: 9px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--fg-muted, var(--fg));
	}

	.cp-empty {
		padding: 1rem 0;
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
	}
</style>
