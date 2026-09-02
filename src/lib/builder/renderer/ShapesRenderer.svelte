<script lang="ts">
	// Rectangle, Ellipse and Line — the wireframe scaffolding. Like `Text`, none
	// of these is backed by a library component: a shape carries no meaning, and
	// the moment it is a Card or a Divider it starts claiming some.
	//
	// Drawn as SVG rather than divs because a Line needs a diagonal and an
	// Ellipse needs a real curve; a border-radius trick gets the ellipse but not
	// the stroke behaviour, and two rendering models for three shapes is one too
	// many. The SVG fills the item's box, so resizing the item resizes the shape.
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props, w, h }: RendererProps = $props();
	const { s, n } = accessors(() => props);

	/** The item's box. 0 means "size yourself", which a shape cannot do — it has
	 *  no content to be sized by — so these fall back to the registry defaults. */
	const width = $derived(w || (componentId === 'Ellipse' ? 140 : 200));
	const height = $derived(h || (componentId === 'Ellipse' ? 140 : componentId === 'Line' ? 40 : 120));

	const strokeW = $derived(n('strokeWidth', 1));
	// `e()` narrows to the fallback's literal type, so comparisons against the
	// other options are type errors — read the enum as a plain string instead.
	const dashStyle = $derived(s('dash', 'solid'));
	const dash = $derived(
		dashStyle === 'dashed'
			? `${strokeW * 6} ${strokeW * 4}`
			: dashStyle === 'dotted'
				? `${strokeW} ${strokeW * 3}`
				: undefined
	);
	const fill = $derived(s('fill', 'none'));
	const stroke = $derived(s('stroke', '#94A3B8'));

	/** Strokes straddle the path, so a shape drawn at the exact edge loses half
	 *  its outline to the viewBox. Inset by half the stroke. */
	const pad = $derived(strokeW / 2);

	const linePoints = $derived.by(() => {
		const o = s('orientation', 'horizontal');
		if (o === 'vertical') return { x1: width / 2, y1: pad, x2: width / 2, y2: height - pad };
		if (o === 'diagonal') return { x1: pad, y1: height - pad, x2: width - pad, y2: pad };
		return { x1: pad, y1: height / 2, x2: width - pad, y2: height / 2 };
	});
</script>

{#if componentId === 'Image'}
	{#if s('src', '')}
		<img
			class="shape-img"
			src={s('src', '')}
			alt={s('alt', '')}
			style:object-fit={s('fit', 'contain')}
			style:border-radius="{n('radius', 2)}px"
			style:opacity={n('opacity', 1)}
			draggable="false"
		/>
	{:else}
		<!-- An image item with no source is a placeholder, not an error: the props
		     panel is where a URL gets pasted in. -->
		<div class="shape-img-empty">no image source</div>
	{/if}
{:else}
	<svg
		class="shape"
		width={width}
		height={height}
		viewBox="0 0 {width} {height}"
		style:opacity={n('opacity', 1)}
		aria-hidden="true"
	>
	{#if componentId === 'Rectangle'}
		<rect
			x={pad}
			y={pad}
			width={Math.max(0, width - strokeW)}
			height={Math.max(0, height - strokeW)}
			rx={n('radius', 2)}
			{fill}
			{stroke}
			stroke-width={strokeW}
			stroke-dasharray={dash}
		/>
	{:else if componentId === 'Ellipse'}
		<ellipse
			cx={width / 2}
			cy={height / 2}
			rx={Math.max(0, width / 2 - pad)}
			ry={Math.max(0, height / 2 - pad)}
			{fill}
			{stroke}
			stroke-width={strokeW}
			stroke-dasharray={dash}
		/>
	{:else if componentId === 'Line'}
		<line
			x1={linePoints.x1}
			y1={linePoints.y1}
			x2={linePoints.x2}
			y2={linePoints.y2}
			{stroke}
			stroke-width={strokeW}
			stroke-dasharray={dash}
			stroke-linecap="round"
		/>
	{/if}
	</svg>
{/if}

<style>
	.shape {
		display: block;
		width: 100%;
		height: 100%;
	}

	.shape-img {
		display: block;
		width: 100%;
		height: 100%;
		/* The item's box is the frame; `object-fit` decides what the picture does
		   inside it, which is why resizing an image never distorts unless `fill`
		   is chosen deliberately. */
		user-select: none;
	}

	.shape-img-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border: 1px dashed var(--border, rgba(148, 163, 184, 0.4));
		border-radius: 2px;
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
	}
</style>
