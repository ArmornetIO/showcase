<script lang="ts">
	// ── MeshViewControls — the "View" popover for a mesh canvas ───────────────────
	// One control for everything that changes what's on the canvas. The ARRANGEMENT
	// picker is generic (every mesh offers the same five layouts, named for what the
	// operator gets), so it lives here. Anything page-specific — folding, status /
	// mode filters — is a snippet the caller drops in below the picker.
	import type { Snippet } from 'svelte';
	import Button from '../../primitives/Button.svelte';
	import Icon from '../../icons/Icon.svelte';
	import MeshLayoutPicker from './MeshLayoutPicker.svelte';
	import type { MeshLayoutId } from './mesh-layout.js';

	interface Props {
		layout: MeshLayoutId;
		/** Badge on the button — e.g. how many filters the caller has applied. */
		count?: number;
		open?: boolean;
		/** Extra popover content below the arrangement picker (filters, folding…). */
		children?: Snippet;
	}

	let {
		layout = $bindable('grouped'),
		count = 0,
		open = $bindable(false),
		children
	}: Props = $props();
</script>

<div class="relative">
	<Button variant="ghost" size="sm" onclick={() => (open = !open)}>
		<Icon name="settings" size={11} />
		View{count ? ` (${count})` : ''}
	</Button>
	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute right-0 top-full mt-1 z-30 w-72 p-3 rounded border border-[var(--border)]
			       bg-[var(--bg)] shadow-lg flex flex-col gap-3"
		>
			<MeshLayoutPicker bind:value={layout} />

			{@render children?.()}
		</div>
	{/if}
</div>
