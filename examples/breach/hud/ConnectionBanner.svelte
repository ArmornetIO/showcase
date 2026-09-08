<script lang="ts">
	// ── The connection banner ────────────────────────────────────────────────────
	// What the board cannot say for itself: that it has stopped being true.
	//
	// The lobby already reports the socket while it is on screen — but it
	// unmounts the moment the match starts, and everything after that point is
	// exactly when a player has something to lose. Without this, a dropped
	// connection during a match is a board that quietly stops moving: no error,
	// no spinner, just three other people apparently thinking for a very long
	// time. This says so, and offers the one useful button.
	import { Button } from 'showcase';
	import type { TableSocket } from '../net.svelte.js';
	import { socketNotice } from './notice.js';

	interface Props {
		socket: TableSocket | null;
		class?: string;
	}

	let { socket, class: cls = '' }: Props = $props();

	// The wording is NOT derived here. The battle centre says the same thing
	// during a match and this says it in the lobby, and the two are on screen at
	// different times — so a drift between them would only ever be noticed by
	// somebody who had already lost their connection once.
	const notice = $derived(socketNotice(socket));

	// The banner is one line where the card has two, so the quiet half is joined
	// on rather than dropped: at this size there is room, and "your move may not
	// have landed" is the half that tells you what to do about it.
	const message = $derived(
		notice ? (notice.detail ? `${notice.text} — ${notice.detail}` : notice.text) : ''
	);

	// A pulse implies motion. It is honest while a fast retry is still coming and
	// a lie once the socket has settled into a long wait — which is exactly when
	// the button appears, so the two switch together.
	const hue = $derived(notice?.tone ?? '#FBBF24');
</script>

{#if notice}
	<div
		class="flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md
		       shadow-[0_8px_28px_rgba(0,0,0,0.4)] pointer-events-auto {cls}"
		style:color={hue}
		style:border-color="color-mix(in srgb, {hue} 45%, transparent)"
		style:background="color-mix(in srgb, {hue} 12%, var(--bg-elev, #0b0f16))"
		role="status"
		aria-live="polite"
	>
		<span
			class="h-1.5 w-1.5 rounded-full shrink-0"
			class:animate-pulse={!notice.retryable}
			style:background={hue}
		></span>

		<span class="font-mono text-[0.6rem] tracking-[0.08em] uppercase">
			{message}
		</span>

		{#if notice.retryable}
			<Button size="xs" variant="ghost" onclick={() => socket?.retry()}>try again</Button>
		{/if}
	</div>
{/if}
