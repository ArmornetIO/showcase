<script lang="ts">
	// The drawer/modal a triggerable component (Button, IconButton) can raise.
	// Split out so every triggerable renderer shares one copy of the wiring.
	import Modal from '$lib/layout/Modal.svelte';
	import NodeDrawer from '$lib/display/drawer/NodeDrawer.svelte';
	import type { MeshNodeType, NodeState } from '$lib/primitives/canvas.types.js';
	import { accessors } from './accessors.js';
	import type { Trigger } from './trigger.svelte.js';

	interface Props {
		trigger: Trigger;
		props: Record<string, unknown>;
	}

	let { trigger, props }: Props = $props();
	const { s, e } = accessors(() => props);
</script>

{#if trigger.kind === 'open-drawer'}
	<!-- Fixed portal: the drawer must escape the canvas item's transform. -->
	<div class="overlay-portal">
		<NodeDrawer
			open={trigger.drawerOpen}
			position={e('__drawerPosition', 'bottom')}
			type={e('__drawerType', 'control-plane') as MeshNodeType}
			icon={s('__drawerIcon', 'CP')}
			title={s('__drawerTitle', 'Node Details')}
			nodeId={s('__drawerNodeId', 'ctrl.plane.01')}
			nodeState={e('__drawerState', 'healthy') as NodeState}
			onclose={trigger.closeDrawer}
		/>
	</div>
{:else if trigger.kind === 'open-modal'}
	<Modal
		open={trigger.modalOpen}
		title={s('__modalTitle', 'Confirm Action')}
		variant={e('__modalVariant', 'default')}
		size={e('__modalSize', 'md')}
		onclose={trigger.closeModal}
	>
		{#snippet children()}
			<p class="modal-body">{s('__modalBody', '')}</p>
		{/snippet}
	</Modal>
{/if}

<style>
	.overlay-portal {
		position: fixed;
		inset: 0;
		z-index: 1000;
		pointer-events: none;
	}
	.overlay-portal > :global(*) {
		pointer-events: auto;
	}

	.modal-body {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--fg-muted);
		margin: 0;
		line-height: 1.6;
	}
</style>
