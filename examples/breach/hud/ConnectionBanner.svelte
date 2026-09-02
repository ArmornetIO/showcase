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

	interface Props {
		socket: TableSocket | null;
		class?: string;
	}

	let { socket, class: cls = '' }: Props = $props();

	// A local game has no socket and nothing to report. Neither does a healthy
	// one — this is silent until it is not.
	//
	// `waiting` is the second kind of "not". A socket reports that it is open,
	// never that anybody is answering on it, so an open connection to a server
	// that has stopped replying is the one failure `live` calls healthy.
	const showing = $derived(!!socket && (!socket.live || socket.waiting));
	const mute = $derived(!!socket?.live && socket.waiting);

	// Only connection-level failures belong here. A refused move also lands in
	// `lastError`, and letting that speak for the socket would put "not your
	// turn" where "you are disconnected" should be.
	const fault = $derived(
		socket?.lastError && ['unreachable', 'evicted'].includes(socket.lastError.code)
			? socket.lastError
			: null
	);

	// Two different sentences. "Reconnecting" is a promise that this is about to
	// resolve itself, and after enough failures that promise stops being honest:
	// the socket parks on a long interval, and a player deserves to be told they
	// are waiting on something rather than watching a spinner.
	const message = $derived(
		mute
			? 'the table has not answered — your move may not have landed'
			: fault
				? fault.message
				: socket?.status === 'connecting'
					? 'connecting to the table…'
					: 'reconnecting — the board you are looking at may be out of date'
	);

	// Offered whenever nothing is going to happen without it: an eviction never
	// retries itself, a stalled socket is half a minute away from its next
	// attempt, and a connection nobody is answering will never notice on its own.
	const retryable = $derived(!!fault || mute);
	const hue = $derived(fault ? '#FB7185' : '#FBBF24');
</script>

{#if showing}
	<div
		class="flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md
		       shadow-[0_8px_28px_rgba(0,0,0,0.4)] pointer-events-auto {cls}"
		style:color={hue}
		style:border-color="color-mix(in srgb, {hue} 45%, transparent)"
		style:background="color-mix(in srgb, {hue} 12%, var(--bg-elev, #0b0f16))"
		role="status"
		aria-live="polite"
	>
		<!-- Pulsing while there is still a fast retry coming; steady once the
		     socket has settled into a long wait, because a pulse implies motion
		     that is no longer happening. -->
		<span
			class="h-1.5 w-1.5 rounded-full shrink-0"
			class:animate-pulse={!fault && !mute}
			style:background={hue}
		></span>

		<span class="font-mono text-[0.6rem] tracking-[0.08em] uppercase">
			{message}
		</span>

		{#if retryable}
			<Button size="xs" variant="ghost" onclick={() => socket?.retry()}>try again</Button>
		{/if}
	</div>
{/if}
