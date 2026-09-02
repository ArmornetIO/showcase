<script lang="ts">
	// ── The refusal notice ───────────────────────────────────────────────────────
	// What the server said no to, said out loud.
	//
	// Deliberately not the connection banner. A refused move and a dropped
	// connection are opposite facts — one means the table heard you and declined,
	// the other means it never heard you at all — and putting "not your turn"
	// where "you are disconnected" goes teaches a player to ignore both.
	//
	// It expires on its own. A refusal is about a board that has since moved on,
	// so a line that stays until it is dismissed is a line that is wrong by the
	// time anybody reads it.
	import { Icon } from 'showcase';

	interface Props {
		/** The refusal to show. Null, or a new string, is the whole API. */
		message: string | null;
		/** Called when it has had its time. The owner clears the message. */
		onexpire?: () => void;
		/** How long it stays. */
		ms?: number;
		class?: string;
	}

	let { message, onexpire, ms = 4500, class: cls = '' }: Props = $props();

	// Re-armed per message, so two refusals in a row show for their own time
	// each rather than the second inheriting what was left of the first.
	$effect(() => {
		if (!message) return;
		const id = setTimeout(() => onexpire?.(), ms);
		return () => clearTimeout(id);
	});
</script>

{#if message}
	<div
		class="flex items-center gap-2 rounded-lg border px-3 py-1.5 backdrop-blur-md
		       shadow-[0_8px_28px_rgba(0,0,0,0.4)] pointer-events-none {cls}"
		style:color="#FBBF24"
		style:border-color="color-mix(in srgb, #FBBF24 45%, transparent)"
		style:background="color-mix(in srgb, #FBBF24 12%, var(--bg-elev, #0b0f16))"
		role="status"
		aria-live="polite"
	>
		<Icon name="alert-triangle" size={12} />
		<span class="font-mono text-[0.6rem] tracking-[0.08em] uppercase">{message}</span>
	</div>
{/if}
