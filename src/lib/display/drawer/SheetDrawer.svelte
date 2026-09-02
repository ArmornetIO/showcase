<script lang="ts" module>
	export type SheetDrawerSize = 'sm' | 'md' | 'lg' | 'xl';
	/** `scroll` — the sheet scrolls its body. `fill` — the body is a flex column
	 *  the child fills and scrolls itself (tables with sticky headers). */
	export type SheetDrawerBody = 'scroll' | 'fill';

	// ── Handoff between sheets ───────────────────────────────────────────────────
	// Sheets share one visual layer. When one replaces another — the vendor
	// register handing off to the vendor editor — the scrim never actually goes
	// away, so replaying the slide-in reads as "dismissed, then a second sheet
	// arrived" instead of "this panel changed what it is showing". A handoff is an
	// open that lands while another sheet is live, OR within a frame of one
	// closing: the two toggle in the same flush and effect order between sibling
	// components is not guaranteed, so neither check alone is sufficient.
	const HANDOFF_MS = 80;
	let liveSheets = 0;
	let lastClosedAt = -Infinity;
</script>

<script lang="ts">
	// ── SheetDrawer — the generic right-hand sheet ────────────────────────────────
	// The content-agnostic sibling of IncidentDrawer: same scrim, same slide-in
	// sheet, same Esc / scrim-click dismissal — but the body is yours. Reach for it
	// when a surface needs a *working* panel (a register, a form, a queue) rather
	// than a centred Modal that steals the whole viewport.
	//
	// Layout contract: the header is pinned and the body scrolls, so a table dropped
	// in here keeps its own sticky chrome instead of pushing the close button off
	// screen. `actions` sits in the header rail for controls that belong to the
	// sheet as a whole (New / Import / Refresh); `footer` pins under the body.
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		open: boolean;
		/** Sheet heading. */
		title: string;
		/** Small mono label above the title — what KIND of surface this is. */
		eyebrow?: string;
		/** Sheet width: sm 440 · md 640 · lg 900 · xl 1200 (all capped at 96vw). */
		size?: SheetDrawerSize;
		/** Who scrolls — the sheet (default) or the body's own child. */
		body?: SheetDrawerBody;
		/** Drop the body gutter so the content meets the sheet edges — for content
		 *  that IS the sheet (a table, a list) rather than sitting on it. */
		flush?: boolean;
		/** Whether Esc and a scrim click close the sheet. Set false for a sheet
		 *  holding unsaved work — a stray click shouldn't discard a long form; the
		 *  header close button still fires `onclose` so it stays escapable. */
		dismissible?: boolean;
		onclose: () => void;
		/** Controls pinned to the header rail, left of the close button. */
		actions?: Snippet;
		/** Sheet body — scrolls independently of the header. */
		children: Snippet;
		/** Pinned under the body, e.g. a save/cancel rail. */
		footer?: Snippet;
	}

	let {
		open,
		title,
		eyebrow,
		size = 'md',
		body = 'scroll',
		flush = false,
		dismissible = true,
		onclose,
		actions,
		children,
		footer
	}: Props = $props();

	// Resolved BEFORE the DOM update so the class is on the element's first frame —
	// set it afterwards and the entrance animation has already begun.
	let handoff = $state(false);
	$effect.pre(() => {
		if (open) handoff = liveSheets > 0 || performance.now() - lastClosedAt < HANDOFF_MS;
	});

	$effect(() => {
		if (!open) return;
		liveSheets += 1;
		return () => {
			liveSheets -= 1;
			lastClosedAt = performance.now();
		};
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape' || !open || !dismissible) return;
		// A sheet is a working panel, so it routinely opens a <dialog> on top of
		// itself (an editor, a confirm). Those live in the top layer and handle
		// their own Escape — but the keydown still reaches window, which would
		// close the sheet out from under them. One Escape, one dismissal.
		if (document.querySelector('dialog[open]')) return;
		onclose();
	}}
/>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="scrim"
		class:sd-handoff={handoff}
		onclick={() => dismissible && onclose()}
		role="presentation"
	></div>
	<aside class="drawer size-{size}" class:sd-handoff={handoff} aria-label={title}>
		<header class="sd-head">
			<div class="sd-titles">
				{#if eyebrow}<span class="sd-eyebrow">{eyebrow}</span>{/if}
				<h2 class="sd-title">{title}</h2>
			</div>
			<div class="sd-rail">
				{#if actions}<div class="sd-actions">{@render actions()}</div>{/if}
				<button class="sd-close" onclick={onclose} aria-label="Close">
					<Icon name="x" size={18} strokeWidth={2} />
				</button>
			</div>
		</header>

		<div class="sd-body body-{body}" class:sd-flush={flush}>{@render children()}</div>

		{#if footer}
			<footer class="sd-foot">{@render footer()}</footer>
		{/if}
	</aside>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(3, 6, 10, 0.55);
		backdrop-filter: blur(2px);
		z-index: 40;
		animation: sd-fade 160ms ease;
	}
	.drawer {
		/* Published so flush content can paint its own sticky chrome (a table head)
		   in the sheet's colour instead of guessing at a card token and banding. */
		--sheet-surface: #0b1017;
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 41;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: linear-gradient(160deg, var(--sheet-surface), #070b10);
		border-left: 1px solid var(--border);
		box-shadow: -24px 0 60px -20px rgba(0, 0, 0, 0.7);
		animation: sd-slide 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.size-sm {
		width: min(440px, 96vw);
	}
	.size-md {
		width: min(640px, 96vw);
	}
	.size-lg {
		width: min(900px, 96vw);
	}
	.size-xl {
		width: min(1200px, 96vw);
	}
	@keyframes sd-fade {
		from {
			opacity: 0;
		}
	}
	@keyframes sd-slide {
		from {
			transform: translateX(30px);
			opacity: 0;
		}
	}
	.sd-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
		padding: 1.2rem 1.4rem 0.9rem;
		border-bottom: 1px solid var(--border);
	}
	.sd-titles {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}
	.sd-eyebrow {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.sd-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--fg);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* The rail can be a whole control bar, so it takes the room it needs and the
	   title truncates — but the close button never gets squeezed out of reach. */
	.sd-rail {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}
	.sd-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.sd-close {
		display: flex;
		flex-shrink: 0;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 5px;
		color: var(--fg-muted);
		cursor: pointer;
	}
	.sd-close:hover {
		color: var(--fg);
		border-color: var(--accent);
	}
	.sd-body {
		flex: 1;
		min-height: 0;
		padding: 1.1rem 1.4rem 1.6rem;
	}
	.body-scroll {
		overflow-y: auto;
	}
	/* The child owns the scroll — keep it boxed so a sticky table header sticks
	   to the sheet rather than sliding under the pinned header. */
	.body-fill {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.sd-flush {
		padding: 0;
	}

	/* Handoff — the panel is already on screen and staying put, so the shell holds
	   still and only the contents change over. Declared after .scrim/.drawer so it
	   wins on source order at equal specificity. */
	.sd-handoff {
		animation: none;
	}
	.sd-handoff .sd-head,
	.sd-handoff .sd-body,
	.sd-handoff .sd-foot {
		animation: sd-swap 140ms ease;
	}
	@keyframes sd-swap {
		from {
			opacity: 0;
		}
	}
	.sd-foot {
		flex-shrink: 0;
		padding: 0.9rem 1.4rem;
		border-top: 1px solid var(--border);
	}
</style>
