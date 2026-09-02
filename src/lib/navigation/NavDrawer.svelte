<script lang="ts">
	import type { Snippet } from 'svelte';

	interface NavDrawerProps {
		open: boolean;
		onclose?: () => void;
		children: Snippet;
	}

	let { open, onclose, children }: NavDrawerProps = $props();

	$effect(() => {
		document.body.style.overflow = open ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onclose?.();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
{#if open}
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[99]"
		onclick={onclose}
		aria-hidden="true"
	></div>
{/if}

<!-- Drawer panel -->
<div
	class="fixed left-0 top-0 bottom-0 w-[260px] z-[100] bg-[var(--bg-elev)] border-r border-[var(--border)] overflow-y-auto flex flex-col transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] {open
		? 'translate-x-0'
		: '-translate-x-full'}"
	aria-hidden={!open}
	inert={!open || undefined}
>
	{@render children()}
</div>
