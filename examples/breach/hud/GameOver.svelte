<script lang="ts">
	// ── The end of a match, any mode ─────────────────────────────────────────────
	// The frame every BREACH mode ends in: which side won and by which condition,
	// what that means for the reader, and the only two things left to do. What a
	// mode can show only once it is decided — the card game's unfogged path, the
	// office's unmasked insider — is its own, so it arrives as the `art` and
	// `children` regions rather than as props this frame would grow per mode.
	//
	// Dismissible on purpose. The final board is the trophy and a screen you
	// cannot get out from in front of is one you learn to close without reading.
	import type { Snippet } from 'svelte';
	import { Icon } from 'showcase';
	import { plateFill, PLATE_SHADOW_UP, gemEdge, gemFill } from './hud-state.js';

	interface Props {
		/** The chip: "match over", "shift over". */
		eyebrow: string;
		/** How the winning side won, as the rules name it. */
		claim: string;
		/** The reader's verdict hue: green when they took it, red when not. */
		tone: string;
		/** The winning side's own hue, for naming the side rather than the result. */
		winTone: string;
		/** What happened to the reader. Short — it is set in 2rem black. */
		verdict: string;
		/** What happened, from the board's chair. */
		event: string;
		sentence?: string;
		/** The picture beside the verdict. */
		art: Snippet;
		/** What only this mode can show now that nothing is hidden. */
		children?: Snippet;
		/** The way on — focused, so Enter takes it. Absent for a reader who may
		 *  not, and the frame says nothing it cannot do. */
		again?: { label: string; run: () => void };
		/** Dismiss. Owned by the caller, which also owns Escape: a page with an
		 *  overlay ladder must not have this close on the same press as another. */
		onclose: () => void;
		closeLabel: string;
	}

	let { eyebrow, claim, tone, winTone, verdict, event, sentence, art, children, again, onclose, closeLabel }: Props =
		$props();

	let primary = $state<HTMLButtonElement>();
	let close = $state<HTMLButtonElement>();
	$effect(() => (primary ?? close)?.focus());
</script>

<!-- `safe center`: a plainly-centred overflowing item has a top no scroll
     position can reach. Padding carries the safe areas because the scroller is
     pinned to all four edges of a notched frame. -->
<div
	class="fixed inset-0 z-[80] grid justify-items-center [align-items:safe_center]
	       overflow-y-auto overscroll-contain
	       bg-[color-mix(in_srgb,var(--bg,#05080d)_78%,transparent)] backdrop-blur-md"
	style="padding: calc(1.5rem + var(--safe-t, 0px)) calc(1rem + var(--safe-r, 0px))
	       calc(1.5rem + var(--safe-b, 0px)) calc(1rem + var(--safe-l, 0px));"
	role="presentation"
	onclick={onclose}
>
	<!-- The card stops the click that would close the screen behind it. -->
	<div
		class="pointer-events-auto flex w-full max-w-[40rem] flex-col gap-4 rounded-xl border p-4 sm:p-6"
		style:border-color="color-mix(in srgb, {tone} 42%, transparent)"
		style:background={plateFill(tone, 14)}
		style:box-shadow="{PLATE_SHADOW_UP}, 0 0 60px color-mix(in srgb, {tone} 22%, transparent)"
		role="presentation"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- WHO won, in the winner's hue: a fact about the board. Only the verdict
		     under it is about the reader. -->
		<div class="flex items-center gap-2">
			<span
				class="rounded border px-1.5 py-0.5 font-mono text-[0.56rem] font-black tracking-[0.16em] uppercase"
				style:color={winTone}
				style:border-color={gemEdge(winTone)}
				style:background={gemFill(winTone)}
			>
				{eyebrow}
			</span>
			<span class="font-mono text-[0.6rem] tracking-[0.14em] text-[var(--fg-dim)] uppercase">
				{claim}
			</span>
			<span class="flex-1"></span>
			<!-- Negative margin so the 44px touch target does not set the height of
			     a header row of 0.56rem type. -->
			<button
				type="button"
				class="-my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
				onclick={onclose}
				aria-label="close"
			>
				<Icon name="x" size={16} />
			</button>
		</div>

		<!-- The verdict, and under it the event: what happened to YOU, then what
		     happened. A reader who loses still deserves to be told how. -->
		<div class="flex items-center gap-4">
			{@render art()}
			<span class="flex min-w-0 flex-col gap-1">
				<b
					class="font-mono text-[2rem] leading-none font-black tracking-[0.02em] uppercase"
					style:color={tone}
					style:text-shadow="0 0 38px color-mix(in srgb, {tone} 45%, transparent)"
				>
					{verdict}
				</b>
				<span class="font-mono text-[0.8rem] leading-snug text-[var(--fg)]">
					{event}
				</span>
			</span>
		</div>

		{#if sentence}
			<p class="m-0 font-mono text-[0.68rem] leading-relaxed text-[var(--fg-dim)]">
				{sentence}
			</p>
		{/if}

		<div class="h-px w-full bg-[var(--border)]"></div>

		{@render children?.()}

		<!-- Wraps rather than crushing: at 375px the two buttons and the keyboard
		     hint shared one row and each word broke over two lines. -->
		<div class="flex flex-wrap items-center gap-2 pt-1">
			{#if again}
				<button
					bind:this={primary}
					type="button"
					onclick={again.run}
					class="min-h-[44px] rounded-lg border-2 px-4 py-2 font-mono text-[0.68rem] font-black tracking-[0.14em] uppercase transition-all"
					style:color={tone}
					style:border-color="color-mix(in srgb, {tone} 70%, transparent)"
					style:background="color-mix(in srgb, {tone} 18%, transparent)"
					style:box-shadow="0 0 22px color-mix(in srgb, {tone} 30%, transparent)"
				>
					{again.label}
				</button>
			{/if}
			<button
				bind:this={close}
				type="button"
				onclick={onclose}
				class="min-h-[44px] rounded-lg border px-4 py-2 font-mono text-[0.68rem] font-bold tracking-[0.14em] text-[var(--fg-muted)] uppercase transition-colors hover:text-[var(--fg)]"
				style:border-color="var(--border)"
			>
				{closeLabel}
			</button>
			<span class="flex-1"></span>
			<span class="font-mono text-[0.52rem] tracking-[0.14em] text-[var(--fg-dim)] uppercase">
				{again ? 'enter · ' + again.label + ' · ' : ''}esc to close
			</span>
		</div>
	</div>
</div>
