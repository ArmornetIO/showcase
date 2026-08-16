<script lang="ts">
	interface Props {
		title?: string;
		content: string;
		/**
		 * The macOS-style traffic lights. They frame a block as a terminal
		 * session — turn them off when the block is just a value being shown
		 * (a compiled config, an API response), not a thing you typed.
		 */
		chrome?: boolean;
		/** Tighter type and padding, for narrow columns like a sidebar rail. */
		dense?: boolean;
		/** CSS length that caps the body's height and scrolls the overflow. */
		maxHeight?: string;
		class?: string;
	}

	let {
		title,
		content,
		chrome = true,
		dense = false,
		maxHeight,
		class: cls = ''
	}: Props = $props();
</script>

<div class="border border-[rgba(94,234,212,0.15)] rounded-[3px] overflow-hidden bg-[rgba(3,7,18,0.8)] {cls}">
	{#if chrome}
		<div
			class="flex items-center gap-1.5 px-4 py-2.5 border-b border-[rgba(94,234,212,0.1)] bg-[rgba(15,23,42,0.6)]"
			aria-hidden="true"
		>
			<span class="w-[10px] h-[10px] rounded-full shrink-0 bg-[#ff5f57]"></span>
			<span class="w-[10px] h-[10px] rounded-full shrink-0 bg-[#febc2e]"></span>
			<span class="w-[10px] h-[10px] rounded-full shrink-0 bg-[#28c840]"></span>
			{#if title}
				<span
					class="font-[var(--mono)] text-[0.625rem] tracking-[0.1em] text-[var(--fg-dim)] ml-auto mr-auto pr-6"
				>{title}</span>
			{/if}
		</div>
	{:else if title}
		<div
			class="px-3 py-2 border-b border-[rgba(94,234,212,0.1)] font-[var(--mono)] text-[0.625rem] tracking-[0.1em] text-[var(--fg-dim)]"
		>
			{title}
		</div>
	{/if}
	<pre
		class="m-0 font-[var(--mono)] text-[var(--fg-muted)] overflow-x-auto tab-[2] {dense
			? 'px-3 py-3 text-[0.62rem] leading-[1.6] whitespace-pre-wrap break-all'
			: 'px-6 py-5 text-[0.8125rem] leading-[1.7] whitespace-pre'}"
		style={maxHeight ? `max-height:${maxHeight};overflow-y:auto` : undefined}
	>{content}</pre>
</div>
