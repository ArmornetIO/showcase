<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		title?: string;
		content: string;
		/**
		 * Copy-to-clipboard button. A block someone is meant to RUN needs it —
		 * CodeBlock already had one, which was pushing callers into the wrong
		 * component for a curl sample just to get the button.
		 */
		copy?: boolean;
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
		/**
		 * One command on one line — `$ cmd` with its actions as icons at the end.
		 * For a command someone runs, where a header bar and traffic lights are
		 * more chrome than content. Ignores `chrome`, `title` and `dense`.
		 */
		inline?: boolean;
		/**
		 * A file to download instead of running the command — the same thing,
		 * fetched by the browser. Shown as a download icon beside copy.
		 */
		download?: { href: string; label: string };
		/** `inline` only: the glyph before the content — `$` for a command,
		 *  `''` for a value you paste rather than run. */
		prompt?: string;
		/** `inline` only: a named cell before the content (`id`, `secret`). */
		label?: string;
		/** `inline` only: a control in the leading cell — e.g. a platform picker
		 *  that decides which command and download the bar offers. Wins over `label`. */
		lead?: Snippet;
		class?: string;
	}

	let {
		title,
		content,
		copy = false,
		chrome = true,
		dense = false,
		maxHeight,
		inline = false,
		download,
		prompt = '$',
		label,
		lead,
		class: cls = ''
	}: Props = $props();

	// Reverts on a timer rather than staying green: the button is the only
	// feedback, so it has to be reusable a second time without a remount.
	let copied = $state(false);

	async function copyContent() {
		await navigator.clipboard.writeText(content);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

{#snippet copyButton()}
	<button
		class="flex items-center gap-1 font-(family-name:--mono) text-[0.62rem] tracking-[0.08em] text-[var(--fg-dim)] hover:text-[var(--accent)] bg-transparent border-0 cursor-pointer"
		onclick={copyContent}
		aria-label="Copy to clipboard"
	>
		<Icon name={copied ? 'check' : 'copy'} size={11} />
		{copied ? 'Copied' : 'Copy'}
	</button>
{/snippet}

{#snippet iconAction(icon: 'copy' | 'check' | 'download', label: string)}
	<Icon name={icon} size={14} />
	<span class="sr-only">{label}</span>
{/snippet}

{#if inline}
	<!-- A segmented bar: every part is a full-height cell behind a divider, so
	     the actions read as buttons rather than glyphs floating in the text. -->
	{@const cell = 'flex items-center self-stretch shrink-0 border-l border-[rgba(94,234,212,0.15)]'}
	{@const act = `${cell} justify-center w-9 bg-transparent cursor-pointer text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-faint)] transition-colors`}
	<div
		class="flex items-stretch h-9 border border-[rgba(94,234,212,0.15)] r-inset overflow-hidden bg-[rgba(3,7,18,0.8)] {cls}"
	>
		<!-- One fixed width for every leading cell, so stacked bars (a command
		     over an id over a secret) share a column edge instead of each value
		     starting wherever its own label happened to end. -->
		{#if lead}
			<div class="flex items-stretch self-stretch shrink-0 w-24 bg-[var(--accent-faint)]">
				{@render lead()}
			</div>
		{:else if label}
			<span
				class="flex items-center shrink-0 w-24 px-3 bg-[var(--accent-faint)] font-(family-name:--mono) text-[0.6rem] tracking-[0.14em] uppercase text-[var(--fg-muted)] select-none"
				>{label}</span
			>
		{/if}
		<div
			class="flex flex-1 min-w-0 items-center gap-2 px-3 {lead || label
				? 'border-l border-[rgba(94,234,212,0.15)]'
				: ''}"
		>
			{#if prompt}
				<span
					class="shrink-0 font-(family-name:--mono) text-[0.72rem] text-[var(--accent)] select-none"
					aria-hidden="true">{prompt}</span
				>
			{/if}
			<pre
				class="flex-1 min-w-0 m-0 font-(family-name:--mono) text-[0.72rem] leading-none text-[var(--fg-muted)] whitespace-pre overflow-x-auto">{content}</pre>
		</div>
		{#if copy}
			<button class={act} onclick={copyContent} title={copied ? 'Copied' : 'Copy to clipboard'}>
				{@render iconAction(copied ? 'check' : 'copy', copied ? 'Copied' : 'Copy to clipboard')}
			</button>
		{/if}
		{#if download}
			<a class={act} href={download.href} download title={download.label}>
				{@render iconAction('download', download.label)}
			</a>
		{/if}
	</div>
{:else}
<div class="border border-[rgba(94,234,212,0.15)] r-inset overflow-hidden bg-[rgba(3,7,18,0.8)] {cls}">
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
					class="font-(family-name:--mono) text-[0.625rem] tracking-[0.1em] text-[var(--fg-dim)] ml-auto mr-auto {copy
						? ''
						: 'pr-6'}"
				>{title}</span>
			{/if}
			{#if copy}
				<span class="ml-auto">{@render copyButton()}</span>
			{/if}
		</div>
	{:else if title || copy}
		<div
			class="flex items-center justify-between gap-2 px-3 py-2 border-b border-[rgba(94,234,212,0.1)] font-(family-name:--mono) text-[0.625rem] tracking-[0.1em] text-[var(--fg-dim)]"
		>
			<span>{title ?? ''}</span>
			{#if copy}{@render copyButton()}{/if}
		</div>
	{/if}
	<pre
		class="m-0 font-(family-name:--mono) text-[var(--fg-muted)] overflow-x-auto tab-[2] {dense
			? 'px-3 py-3 text-[0.62rem] leading-[1.6] whitespace-pre-wrap break-all'
			: 'px-6 py-5 text-[0.8125rem] leading-[1.7] whitespace-pre'}"
		style={maxHeight ? `max-height:${maxHeight};overflow-y:auto` : undefined}
	>{content}</pre>
</div>
{/if}
