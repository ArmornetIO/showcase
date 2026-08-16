<script lang="ts">
	import type { Snippet } from 'svelte';
	import GlowOutline from './GlowOutline.svelte';

	export type ChipColor =
		| 'default'
		| 'accent'
		| 'success'
		| 'warn'
		| 'error'
		| 'cyan'
		| 'blue'
		| 'critical'
		| 'get'
		| 'post'
		| 'delete'
		| 'patch';

	export type ChipLook = 'ghost' | 'filled';

	interface ChipProps {
		look?: ChipLook;
		color?: ChipColor;
		pulse?: boolean;
		/** Wraps the chip in an animated RGB conic-gradient outline. */
		outline?: 'rgb';
		href?: string;
		target?: string;
		rel?: string;
		children: Snippet;
	}

	let { look = 'ghost', color = 'default', pulse = false, outline, href, target, rel, children }: ChipProps = $props();

	const GHOST: Record<ChipColor, string> = {
		default:  'text-[var(--fg-dim)] border-[rgba(156,163,175,0.3)]',
		accent:   'text-[var(--accent)] border-[rgba(94,234,212,0.35)]',
		success:  'text-[var(--palette-emerald-l)] border-[rgba(52,211,153,0.35)]',
		warn:     'text-[var(--palette-amber)] border-[rgba(252,211,77,0.4)]',
		error:    'text-[var(--palette-red)] border-[rgba(252,165,165,0.4)]',
		cyan:     'text-[var(--palette-cyan-l)] border-[rgba(34,211,238,0.35)]',
		blue:     'text-[var(--palette-blue-l)] border-[rgba(56,189,248,0.35)]',
		critical: 'text-[var(--palette-red)] border-[rgba(252,165,165,0.5)]',
		get:      'text-[var(--method-get-fg)] border-[var(--method-get-fg)]/30',
		post:     'text-[var(--method-post-fg)] border-[var(--method-post-fg)]/30',
		delete:   'text-[var(--method-delete-fg)] border-[var(--method-delete-fg)]/30',
		patch:    'text-[var(--method-patch-fg)] border-[var(--method-patch-fg)]/30',
	};

	const FILLED: Record<ChipColor, string> = {
		default:  'bg-[var(--surface-raised)] text-[var(--fg-dim)] border-[var(--border)]',
		accent:   'bg-[var(--accent-faint)] text-[var(--accent)] border-[rgba(94,234,212,0.4)]',
		success:  'bg-[rgba(52,211,153,0.1)] text-[var(--palette-emerald-l)] border-[rgba(52,211,153,0.35)]',
		warn:     'bg-[rgba(252,211,77,0.1)] text-[var(--palette-amber)] border-[rgba(252,211,77,0.4)]',
		error:    'bg-[rgba(252,165,165,0.1)] text-[var(--palette-red)] border-[rgba(252,165,165,0.4)]',
		cyan:     'bg-[rgba(34,211,238,0.1)] text-[var(--palette-cyan-l)] border-[rgba(34,211,238,0.35)]',
		blue:     'bg-[rgba(56,189,248,0.1)] text-[var(--palette-blue-l)] border-[rgba(56,189,248,0.35)]',
		critical: 'bg-[rgba(252,165,165,0.1)] text-[var(--palette-red)] border-[rgba(252,165,165,0.5)]',
		get:      'bg-[var(--method-get-bg)] text-[var(--method-get-fg)] border-[var(--method-get-fg)]/30',
		post:     'bg-[var(--method-post-bg)] text-[var(--method-post-fg)] border-[var(--method-post-fg)]/30',
		delete:   'bg-[var(--method-delete-bg)] text-[var(--method-delete-fg)] border-[var(--method-delete-fg)]/30',
		patch:    'bg-[var(--method-patch-bg)] text-[var(--method-patch-fg)] border-[var(--method-patch-fg)]/30',
	};

	const PULSE_DOT: Record<ChipColor, string> = {
		default:  'bg-[rgba(156,163,175,0.6)]',
		accent:   'bg-[var(--accent)]',
		success:  'bg-[var(--palette-emerald)]',
		warn:     'bg-[var(--palette-amber)]',
		error:    'bg-[var(--palette-red)]',
		cyan:     'bg-[var(--palette-cyan)]',
		blue:     'bg-[var(--palette-blue)]',
		critical: 'bg-[var(--palette-red)]',
		get:      'bg-[var(--method-get-fg)]',
		post:     'bg-[var(--method-post-fg)]',
		delete:   'bg-[var(--method-delete-fg)]',
		patch:    'bg-[var(--method-patch-fg)]',
	};

	const colorCls = $derived(
		outline === 'rgb'
			? 'text-white border-transparent bg-transparent'
			: look === 'filled'
				? FILLED[color]
				: GHOST[color]
	);
	const dotCls = $derived(PULSE_DOT[color]);
	// max-w-full + overflow-hidden + text-ellipsis: a chip used as a link with
	// a long URL, or with unexpectedly long body text, truncates inside the
	// chip instead of pushing the surrounding row past the container edge.
	// whitespace-nowrap is preserved so the chip body itself never wraps to
	// two lines — long content turns into an ellipsis at the chip boundary.
	// `chip-body` is a stable, non-styling hook the ItemFrames map targets so a
	// chip's text shimmers during a pre-load frame. See lib/frames/frames.ts.
	const baseCls = $derived(
		look === 'ghost'
			? 'chip-body inline-flex items-center gap-[5px] font-[var(--mono)] text-[0.625rem] font-medium tracking-[0.15em] px-2 py-1 rounded-[2px] uppercase whitespace-nowrap border leading-none max-w-full overflow-hidden text-ellipsis'
			: 'chip-body inline-flex items-center gap-[5px] font-[var(--mono)] text-[0.7rem] tracking-[0.05em] uppercase px-2.5 py-[3px] border rounded-full whitespace-nowrap leading-none max-w-full overflow-hidden text-ellipsis'
	);
</script>

{#snippet chip()}
	{#if href}
	<a {href} {target} {rel} class="{baseCls} {colorCls}">
		{#if pulse}
			<span class="inline-block w-[6px] h-[6px] rounded-full animate-pulse shrink-0 {dotCls}" aria-hidden="true"></span>
		{/if}
		{@render children()}
	</a>
	{:else}
	<span class="{baseCls} {colorCls}">
		{#if pulse}
			<span class="inline-block w-[6px] h-[6px] rounded-full animate-pulse shrink-0 {dotCls}" aria-hidden="true"></span>
		{/if}
		{@render children()}
	</span>
	{/if}
{/snippet}

{#if outline === 'rgb'}
	<GlowOutline>{@render chip()}</GlowOutline>
{:else}
	{@render chip()}
{/if}
