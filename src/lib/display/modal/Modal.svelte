<script lang="ts">
	import type { Snippet } from 'svelte';

	export type ModalVariant = 'default' | 'danger' | 'warn' | 'success' | 'agentic';
	export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

	interface ModalProps {
		open: boolean;
		title?: string;
		variant?: ModalVariant;
		size?: ModalSize;
		/** Show the × close button and allow Escape to dismiss. */
		closable?: boolean;
		onclose?: () => void;
		children: Snippet;
		/** Optional footer — action buttons go here. */
		footer?: Snippet;
	}

	let {
		open,
		title,
		variant = 'default',
		size = 'md',
		closable = true,
		onclose,
		children,
		footer
	}: ModalProps = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	// Drive the native dialog open/close state from the `open` prop.
	$effect(() => {
		if (!dialogEl) return;
		if (open) {
			if (!dialogEl.open) dialogEl.showModal();
		} else {
			if (dialogEl.open) dialogEl.close();
		}
	});

	// Propagate native close (Escape key) back to parent.
	function handleClose() {
		onclose?.();
	}

	// `closable={false}` has to refuse Escape, not just hide the × — otherwise the
	// native dialog closes itself while `open` stays true, the $effect above never
	// re-runs (nothing it reads changed), and the content is gone with no way back.
	// That is unrecoverable for a modal showing something readable exactly once,
	// which is the case this prop exists for.
	function handleCancel(e: Event) {
		if (!closable) e.preventDefault();
	}

	// Click on the backdrop (the <dialog> element itself) closes the modal.
	function handleBackdropClick(e: MouseEvent) {
		if (!closable) return;
		if (e.target === dialogEl) onclose?.();
	}

	const VARIANT_VARS: Record<ModalVariant, Record<string, string>> = {
		default: {
			'--m-border': 'var(--border-strong)',
			'--m-accent': 'var(--accent)',
			'--m-accent-bg': 'rgba(94, 234, 212, 0.04)',
			'--m-bar': 'transparent'
		},
		danger: {
			'--m-border': 'rgba(252, 165, 165, 0.45)',
			'--m-accent': '#FCA5A5',
			'--m-accent-bg': 'rgba(252, 165, 165, 0.04)',
			'--m-bar': 'rgba(252, 165, 165, 0.55)'
		},
		warn: {
			'--m-border': 'rgba(252, 211, 77, 0.4)',
			'--m-accent': '#FCD34D',
			'--m-accent-bg': 'rgba(252, 211, 77, 0.04)',
			'--m-bar': 'rgba(252, 211, 77, 0.55)'
		},
		success: {
			'--m-border': 'rgba(52, 211, 153, 0.4)',
			'--m-accent': '#34D399',
			'--m-accent-bg': 'rgba(52, 211, 153, 0.04)',
			'--m-bar': 'rgba(52, 211, 153, 0.55)'
		},
		agentic: {
			'--m-border': 'rgba(196, 168, 255, 0.4)',
			'--m-accent': '#C4A8FF',
			'--m-accent-bg': 'rgba(196, 168, 255, 0.06)',
			'--m-bar':    'rgba(196, 168, 255, 0.55)'
		}
	};

	const cssVars = $derived(
		Object.entries(VARIANT_VARS[variant])
			.map(([k, v]) => `${k}:${v}`)
			.join(';')
	);
</script>

<!-- Native <dialog> gives us focus-trap + Escape for free. -->
<dialog
	bind:this={dialogEl}
	class="modal size-{size}"
	style={cssVars}
	onclose={handleClose}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
>
	<div class="modal-inner">
		<!-- Top accent bar (non-default variants) -->
		{#if variant !== 'default'}
			<div class="accent-bar" aria-hidden="true"></div>
		{/if}

		<!-- Header -->
		{#if title || closable}
			<div class="modal-header">
				{#if title}
					<h2 class="modal-title">{title}</h2>
				{/if}
				{#if closable}
					<button class="modal-close" onclick={onclose} aria-label="Close" type="button">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		<!-- Body -->
		<div class="modal-body">
			{@render children()}
		</div>

		<!-- Footer -->
		{#if footer}
			<div class="modal-footer">
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>

<style>
	/* ── Native dialog reset + backdrop ──────────────────────────────────── */
	.modal {
		/* Reset browser defaults */
		margin: auto;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--fg);
		outline: none;
		overflow: visible; /* let .modal-inner handle overflow */
		max-height: 90vh;
	}

	/* Glassmorphism backdrop — ::backdrop supported in all modern browsers */
	.modal::backdrop {
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(3px);
	}

	/* Entry animation on open */
	.modal[open] {
		animation: modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* ── Sizes ───────────────────────────────────────────────────────────── */
	.size-sm .modal-inner { max-width: 360px; }
	.size-md .modal-inner { max-width: 480px; }
	.size-lg .modal-inner { max-width: 640px; }
	.size-xl .modal-inner { max-width: 920px; }

	/* ── Inner card ──────────────────────────────────────────────────────── */
	.modal-inner {
		position: relative;
		width: 90vw;
		background: #080b10;
		border: 1px solid var(--m-border);
		clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
		box-shadow:
			0 30px 80px -16px rgba(0, 0, 0, 0.85),
			0 0 50px -20px rgba(95, 234, 213, 0.4);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		overflow: hidden;
	}

	/* Cut-corner accent trace — top-left horizontal + vertical gradient lines */
	.modal-inner::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 44px;
		height: 1px;
		background: linear-gradient(90deg, var(--m-accent), transparent);
		pointer-events: none;
		z-index: 1;
	}
	.modal-inner::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 1px;
		height: 44px;
		background: linear-gradient(180deg, var(--m-accent), transparent);
		pointer-events: none;
		z-index: 1;
	}

	/* ── Mobile: bottom-sheet ────────────────────────────────────────────── */
	@media (max-width: 639px) {
		.modal { margin-bottom: 0; }
		.modal-inner {
			margin-top: auto;
			margin-bottom: 0;
			width: 100%;
			clip-path: none;
			border-radius: 1rem 1rem 0 0;
		}
	}

	/* ── Accent bar — top edge for danger/warn/success/agentic ──────────── */
	.accent-bar {
		height: 2px;
		background: var(--m-bar);
		box-shadow: 0 0 12px var(--m-bar);
		flex-shrink: 0;
	}

	/* ── Header ──────────────────────────────────────────────────────────── */
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 22px 26px 16px;
		flex-shrink: 0;
	}
	.modal-title {
		font-family: var(--mono-display);
		font-size: 19px;
		font-weight: 700;
		color: var(--fg);
		margin: 0;
		line-height: 1.2;
	}
	.modal-close {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.modal-close svg {
		width: 15px;
		height: 15px;
	}
	.modal-close:hover {
		color: var(--m-accent);
		border-color: var(--m-accent);
	}
	.modal-close:active {
		transform: scale(0.9);
	}

	/* ── Body ────────────────────────────────────────────────────────────── */
	.modal-body {
		padding: 8px 26px 20px;
		overflow-y: auto;
		max-height: calc(90vh - 140px);
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}

	/* ── Footer ──────────────────────────────────────────────────────────── */
	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 14px;
		padding: 18px 26px 22px;
		flex-shrink: 0;
	}
</style>
