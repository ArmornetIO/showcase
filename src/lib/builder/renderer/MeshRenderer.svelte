<script lang="ts">
	// Mesh pieces that only exist inside a canvas. An edge has no standalone
	// component, so the preview builds the smallest scene that can show one:
	// two nodes and the link between them, with dragging and drawing off.
	import Canvas from '$lib/primitives/canvas/Canvas.svelte';
	import CameraControls from '$lib/primitives/canvas/CameraControls.svelte';
	import MeshStudio from '$lib/mesh-studio/MeshStudio.svelte';
	import PieceCrest from '$lib/mesh-studio/pieces/PieceCrest.svelte';
	import type { EdgeStyle, DataType } from '$lib/primitives/canvas/canvas.types.js';
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props, h }: RendererProps = $props();
	const { b, e, n, s } = accessors(() => props);

	const edgeStyle = $derived(e('style', 'energy') as EdgeStyle);
	// Only energy edges carry a payload type; the others have nothing to colour.
	const dataType = $derived(edgeStyle === 'energy' ? (e('dataType', 'query') as DataType) : undefined);
</script>

{#if componentId === 'CanvasEdge'}
	<div style:width="100%" style:height="{h || 160}px" style:position="relative">
		<Canvas fitOnLoad>
			<MeshStudio
				concept="instrument"
				nodes={[
					{ id: 'a', label: 'A', type: 'agentic', state: 'healthy', r: 36, x: 70, y: 80 },
					{ id: 'b', label: 'B', type: 'agentic', state: 'healthy', r: 36, x: 230, y: 80 }
				]}
				edges={[
					{
						id: 'ab',
						from: 'a',
						to: 'b',
						style: edgeStyle,
						dataType,
						active: edgeStyle === 'energy'
					}
				]}
				showGrid={b('showGrid', false)}
				allowNodeDrag={false}
				allowLinkDraw={false}
			/>
			<CameraControls />
		</Canvas>
	</div>
{/if}

<!-- A crest needs no canvas — that is the whole point of it — so unlike the edge
     above there is no scene to build, only the solid at its own size. -->
{#if componentId === 'PieceCrest'}
	<PieceCrest
		piece={e('piece', 'house')}
		color={s('color', 'var(--accent)')}
		offline={b('offline', false)}
		size={n('size', 46)}
	/>
{/if}
