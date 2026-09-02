<script lang="ts">
	import type { Snippet } from 'svelte';

	interface CollapsibleProps {
		/** Controls whether the content is visible. Bindable. */
		open?: boolean;
		/** Renders the trigger element. Receives `{ open, toggle }` so the
		 *  caller can wire up any button or custom element as the trigger. */
		trigger: Snippet<[{ open: boolean; toggle: () => void }]>;
		children: Snippet;
	}

	let { open = $bindable(false), trigger, children }: CollapsibleProps = $props();

	function toggle() {
		open = !open;
	}
</script>

<div>
	{@render trigger({ open, toggle })}
	<!--
		CSS grid-row trick: animates to true content height with no max-height cap.
		grid-template-rows transitions smoothly between 0fr and 1fr.
	-->
	<div
		class="grid transition-[grid-template-rows] duration-[250ms] ease-[ease]"
		style:grid-template-rows={open ? '1fr' : '0fr'}
	>
		<div class="overflow-hidden">
			{@render children()}
		</div>
	</div>
</div>
