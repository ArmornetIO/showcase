<script lang="ts">
	// ── ScenePalette — a card grid of real components, dragged onto the canvas ──
	// You see the thing, you drag the thing. No hover step: a palette you have to
	// interrogate one row at a time is a list with extra work, and browsing is the
	// whole job here.
	//
	// Supersedes `builder-enhancements.md` §3.4 ("hover to see a tooltip popover"),
	// which is the weaker shape — it hides the answer behind an interaction.
	//
	// Previews are REAL components through the builder's own `ComponentRenderer`,
	// mounted lazily: ~60 live Svelte components is a lot to instantiate to look at
	// six of them, so an IntersectionObserver mounts only what has scrolled into
	// view. Same drag contract as the builder's toolbox (`component-id`).
	import { onMount } from 'svelte';
	import ComponentRenderer from '../builder/ComponentRenderer.svelte';
	import { REGISTRY, type ComponentMeta } from '../builder/registry.js';
	import { componentChannelStats } from './component-channels.js';

	let { onAdd }: { onAdd?: (componentId: string) => void } = $props();

	let query = $state('');
	let visible = $state(new Set<string>());
	let scroller = $state<HTMLDivElement | undefined>();
	const cards = new Map<string, HTMLElement>();

	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const map = new Map<string, ComponentMeta[]>();
		for (const meta of REGISTRY) {
			if (!meta.placeable) continue;
			if (q && !meta.label.toLowerCase().includes(q) && !meta.id.toLowerCase().includes(q)) continue;
			if (!map.has(meta.category)) map.set(meta.category, []);
			map.get(meta.category)!.push(meta);
		}
		return [...map.entries()].map(([category, items]) => ({ category, items }));
	});

	const total = $derived(REGISTRY.filter((r) => r.placeable).length);
	const shown = $derived(groups.reduce((n, g) => n + g.items.length, 0));
	const channelCount = componentChannelStats().channels;

	/** Registry defaults — the same values the builder drops a fresh one with, so
	 *  the thumbnail is honest about what you will actually get. */
	function defaults(meta: ComponentMeta): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const [k, def] of Object.entries(meta.props)) out[k] = def.default;
		return out;
	}

	/** Authored at its real width and scaled down, never reflowed — a component
	 *  squeezed into 120px would show a layout it never actually has.
	 *
	 *  `defaultW: 0` means "intrinsic width", so those render at their natural
	 *  size; laying them out at 260 and scaling by width alone sliced the tall
	 *  ones. Height is measured after mount and the scale corrects for it. */
	const THUMB_W = 118;
	const THUMB_H = 62;
	const LAYOUT_W = 260;

	function widthFor(meta: ComponentMeta): number {
		return meta.defaultW || LAYOUT_W;
	}

	let heights = $state(new Map<string, number>());

	function fitScale(meta: ComponentMeta): number {
		const h = heights.get(meta.id) ?? 0;
		const byW = THUMB_W / widthFor(meta);
		const byH = h > 0 ? THUMB_H / h : 1;
		return Math.max(0.18, Math.min(1, byW, byH));
	}

	/** `offsetHeight` is LAYOUT height — CSS transforms don't affect it — so the
	 *  natural height reads correctly no matter what scale is already applied. */
	function measure(el: HTMLElement, id: string) {
		requestAnimationFrame(() => {
			const h = el.offsetHeight;
			if (h > 0 && Math.abs((heights.get(id) ?? 0) - h) > 1) {
				const next = new Map(heights);
				next.set(id, h);
				heights = next;
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
			},
		};
	}

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				let changed = false;
				const next = new Set(visible);
				for (const e of entries) {
					const id = (e.target as HTMLElement).dataset.cid;
					// Mount on entry and never unmount: scrolling back up should not
					// re-instantiate, and the ceiling is the palette length.
					if (id && e.isIntersecting && !next.has(id)) {
						next.add(id);
						changed = true;
					}
				}
				if (changed) visible = next;
			},
			{ root: scroller, rootMargin: '240px 0px' },
		);
		for (const el of cards.values()) observer.observe(el);
		return () => observer?.disconnect();
	});
</script>

<div class="hd">
	<span class="sec">COMPONENTS · {shown}/{total}</span>
	<input class="q" placeholder="search…" bind:value={query} />
</div>

<div class="scroll" bind:this={scroller}>
	{#each groups as g (g.category)}
		<div class="grp">{g.category}</div>
		<div class="grid">
			{#each g.items as meta (meta.id)}
				<div
					class="card"
					data-cid={meta.id}
					draggable="true"
					ondragstart={(e) => {
						e.dataTransfer?.setData('component-id', meta.id);
						e.dataTransfer!.effectAllowed = 'copy';
					}}
					ondblclick={() => onAdd?.(meta.id)}
					title="{meta.id} — drag onto the canvas, or double-click to drop it in the middle"
					role="presentation"
					use:register={meta.id}
				>
					<div class="thumb">
						{#if visible.has(meta.id)}
							<div
								class="thumb-in"
								style:transform="scale({fitScale(meta)})"
								style:width="{widthFor(meta)}px"
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
							<div class="skel"></div>
						{/if}
					</div>
					<div class="lbl">{meta.label}</div>
				</div>
			{/each}
		</div>
	{/each}

	{#if !groups.length}<div class="cap">nothing matches “{query}”</div>{/if}
	<div class="cap">
		Drag a card onto the canvas to place it there. Double-click drops it centre.
		<br />
		Every one of these has <b>{channelCount}</b> animatable props derived from
		<code>registry.ts</code> — select it and press <b>A</b>.
	</div>
</div>

<style>
	.hd {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 0.5rem 0 0.35rem;
		background: var(--bg);
	}
	.sec {
		display: block;
		margin-bottom: 0.3rem;
		padding-bottom: 0.15rem;
		font-size: 0.55rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.q {
		width: 100%;
		padding: 0.26rem 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font: inherit;
		font-size: 0.66rem;
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding-bottom: 1rem;
	}

	.grp {
		margin: 0.5rem 0 0.25rem;
		font-size: 0.52rem;
		letter-spacing: 0.14em;
		color: var(--fg-dim);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3rem;
	}

	.card {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.35rem;
		background: rgba(255, 255, 255, 0.03);
		overflow: hidden;
		cursor: grab;
	}
	.card:hover {
		border-color: var(--accent);
		background: rgba(95, 234, 212, 0.08);
	}
	.card:active {
		cursor: grabbing;
	}

	.thumb {
		height: 4.4rem;
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
	.thumb-in {
		transform-origin: center center;
		flex: none;
	}
	.skel {
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

	.lbl {
		padding: 0.22rem 0.35rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.58rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--fg);
	}

	.cap {
		font-size: 0.56rem;
		line-height: 1.45;
		color: var(--fg-dim);
		margin: 0.5rem 0;
	}
	.cap code,
	.cap b {
		font-family: var(--mono);
		color: var(--fg);
		font-weight: 500;
	}
</style>
