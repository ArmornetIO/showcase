<script lang="ts">
	/**
	 * Turns one canvas item into the real component.
	 *
	 * This file is only the dispatcher: it resolves the registry id to a render
	 * group (`renderer/groups.ts`) and mounts that group's renderer. The branches
	 * themselves live one per family in `renderer/` — see that folder's README
	 * for what each group owns and how to add a component.
	 *
	 * Consumers: the builder canvas (`CompositorLayer`), the scene stage and
	 * palette, and the theme studio preview. All of them pass the same props, so
	 * a component only has to be taught to the renderer once.
	 */
	import { groupFor } from './renderer/groups.js';
	import type { RendererProps } from './renderer/types.js';

	interface Props extends RendererProps {
		/** CSS declarations applied to the wrapper, e.g. theme studio overrides. */
		styleOverrides?: Record<string, string>;
	}

	let { componentId, props, w, h, styleOverrides }: Props = $props();

	const overrideStyle = $derived(
		styleOverrides && Object.keys(styleOverrides).length
			? Object.entries(styleOverrides)
					.map(([k, v]) => `${k}:${v}`)
					.join(';')
			: ''
	);

	const group = $derived(groupFor(componentId));
</script>

<div class="cr-wrapper" style={overrideStyle || undefined}>
	{#if group}
		{@const Renderer = group.component}
		<Renderer {componentId} {props} {w} {h} />
	{:else}
		<div class="unknown">Unknown: {componentId}</div>
	{/if}
</div>

<style>
	/* `display: contents` so the wrapper never joins the layout — the item's own
	   box on the canvas is the one that matters. */
	.cr-wrapper {
		display: contents;
	}

	.unknown {
		padding: 8px;
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
		border: 1px dashed var(--border);
	}
</style>
