<script lang="ts">
	import type { Snippet } from 'svelte';

	export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'ghost-danger' | 'solid' | 'solid-ghost' | 'app-solid';
	export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
	/**
	 * `chip` is the console's cut-corner button. `pill` is a compact rounded
	 * control for dense inline choices — it resets the chip's uppercase
	 * tracking and clip-path, so `variant` no longer applies to it; reach for
	 * `tone` instead.
	 */
	export type ButtonShape = 'chip' | 'pill';
	/** Hue a `pill` carries on hover and while `pressed`. Resting stays neutral. */
	export type ButtonTone = 'neutral' | 'success' | 'danger' | 'accent';

	interface ButtonProps {
		variant?: ButtonVariant;
		size?: ButtonSize;
		shape?: ButtonShape;
		tone?: ButtonTone;
		/**
		 * Marks a `pill` as the active choice — fills it with `tone` and sets
		 * aria-pressed, so a set of pills reads as a toggle group.
		 */
		pressed?: boolean;
		disabled?: boolean;
		loading?: boolean;
		/** When set, renders as `<a>`; otherwise renders as `<button>`. */
		href?: string;
		/** Anchor target — forwarded to `<a>` only. */
		target?: '_self' | '_blank' | '_parent' | '_top';
		/** Stretches the button to fill its container. */
		full?: boolean;
		type?: 'button' | 'submit' | 'reset';
		/** Associates the button with a form by id — forwarded to `<button form>`. */
		form?: string;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'ghost',
		size = 'md',
		shape = 'chip',
		tone = 'neutral',
		pressed,
		disabled = false,
		loading = false,
		href,
		target,
		full = false,
		type = 'button',
		form,
		class: cls = '',
		onclick,
		children
	}: ButtonProps = $props();

	// A pill draws from `tone`, so its `variant` class is dropped rather than
	// layered under it — otherwise the chip's clip-path and tracking bleed through.
	const cls_ = $derived(
		`btn ${shape === 'pill' ? 'btn-pill' : `btn-${variant}`} btn-${size} tone-${tone} ${
			pressed ? 'is-pressed' : ''
		} ${full ? 'btn-full' : ''} ${cls}`
	);
</script>

{#if href}
	<a {href} {target} class={cls_} {onclick}>
		{#if loading}<span class="btn-spinner" aria-hidden="true"></span>{/if}
		{@render children()}
	</a>
{:else}
	<button {type} {form} {disabled} {onclick} class={cls_} aria-busy={loading} aria-pressed={pressed}>
		{#if loading}<span class="btn-spinner" aria-hidden="true"></span>{/if}
		{@render children()}
	</button>
{/if}

<style>
	/* ── Base ─────────────────────────────────────────────────────────────── */
	.btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		cursor: pointer;
		border: none;
		text-decoration: none;
		white-space: nowrap;
		transition:
			filter 0.3s ease,
			transform 0.3s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			background 0.2s ease,
			box-shadow 0.2s ease;
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		pointer-events: none;
	}
	.btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.btn-full {
		display: flex;
		width: 100%;
		clip-path: none;
		border-radius: 2px;
	}

	/* ── Sizes (console chip scale) ───────────────────────────────────────── */
	.btn-xs { font-size: 0.6rem;  padding: 0.2rem 0.5rem; }
	.btn-sm { font-size: 0.62rem; padding: 0.55rem 1rem; }
	.btn-md { font-size: 0.72rem; padding: 0.85rem 1.5rem; }
	.btn-lg { font-size: 0.8rem;  padding: 1.05rem 2rem; }

	/* ── Primary — mint gradient, cut-corner chip ─────────────────────────── */
	.btn-primary {
		background: linear-gradient(135deg, var(--accent-soft), var(--accent) 50%, var(--accent-emerald));
		color: var(--text-onaccent);
		clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
	}
	.btn-primary:hover {
		filter: drop-shadow(0 0 8px rgba(94, 234, 212, 0.6)) drop-shadow(0 0 22px rgba(94, 234, 212, 0.35));
		transform: translateY(-1px);
	}
	.btn-primary:active { transform: translateY(0); filter: none; }

	/* ── Ghost — outlined chip ────────────────────────────────────────────── */
	.btn-ghost {
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		color: var(--accent-soft);
		font-weight: 600;
		clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
	}
	.btn-ghost:hover {
		border-color: var(--accent);
		background: var(--accent-faint);
		color: var(--accent);
	}

	/* ── Danger — pink-red chip ───────────────────────────────────────────── */
	.btn-danger {
		background: var(--surface-raised);
		border: 1px solid rgba(251, 113, 133, 0.45);
		color: var(--palette-red);
		font-weight: 600;
		clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
	}
	.btn-danger:hover {
		border-color: rgba(251, 113, 133, 0.85);
		color: var(--palette-red-l);
		background: rgba(251, 113, 133, 0.1);
	}

	/* ── Ghost-danger — transparent background, red border ──────────────── */
	.btn-ghost-danger {
		background: transparent;
		border: 1px solid rgba(248, 113, 113, 0.4);
		color: var(--palette-red);
		letter-spacing: 0.14em;
		clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
	}
	.btn-ghost-danger:hover {
		background: rgba(248, 113, 113, 0.1);
		border-color: var(--palette-red);
	}

	/* ── App-solid — console cut-corner chip, tighter tracking ──────────── */
	.btn-app-solid {
		background: linear-gradient(135deg, var(--accent-soft), var(--accent) 55%, var(--accent-emerald));
		color: var(--text-onaccent);
		clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
		font-size: 13px;
		padding: 13px 24px;
		gap: 9px;
		text-transform: none;
		letter-spacing: 0.02em;
		transition: filter 0.25s ease, transform 0.2s ease;
	}
	.btn-app-solid:hover {
		filter: drop-shadow(0 0 8px rgba(95, 234, 213, 0.55));
		transform: translateY(-1px);
	}
	.btn-app-solid:active { transform: translateY(0); filter: none; }
	.btn-app-solid.btn-sm { font-size: 11px; padding: 9px 16px; }
	.btn-app-solid.btn-lg { font-size: 15px; padding: 16px 30px; }

	/* ── Solid — marketing pill, gradient fill ────────────────────────────── */
	.btn-solid {
		background: linear-gradient(135deg, var(--accent-soft), var(--accent) 50%, var(--accent-emerald));
		color: var(--text-onaccent);
		font-family: var(--sans-brand);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
		padding: 0.7rem 1.4rem;
		border-radius: 999px;
	}
	.btn-solid:hover {
		filter: drop-shadow(0 0 12px rgba(94, 234, 212, 0.5));
	}

	/* ── Solid-ghost — marketing pill, outlined ───────────────────────────── */
	.btn-solid-ghost {
		background: transparent;
		border: 1px solid var(--border-strong);
		color: var(--accent);
		font-family: var(--sans-brand);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
		padding: 0.7rem 1.4rem;
		border-radius: 999px;
	}
	.btn-solid-ghost:hover {
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	/* ── Size overrides for marketing pills (smaller padding for sm/lg) ───── */
	.btn-solid.btn-sm,
	.btn-solid-ghost.btn-sm { font-size: 0.85rem; padding: 0.5rem 1.1rem; }
	.btn-solid.btn-lg,
	.btn-solid-ghost.btn-lg { font-size: 1.1rem; padding: 0.9rem 1.7rem; }

	/* ── Loading spinner ──────────────────────────────────────────────────── */
	.btn-spinner {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		border: 1.5px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── Pill — compact rounded control for dense inline choices ──────────── */
	/* Resets the chip language (clip-path, uppercase, heavy tracking) so a pill
	   reads as a quiet choice rather than a call to action. Resting is neutral
	   whatever the tone: the hue is what CHOOSING costs, so it appears on hover
	   and stays while pressed. Declared after the variants so it wins on order. */
	.btn-pill {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 999px;
		clip-path: none;
		color: var(--fg-dim);
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0.04em;
	}
	.btn-pill:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.btn-pill.tone-success:hover {
		color: var(--palette-emerald-l);
		border-color: color-mix(in srgb, var(--palette-emerald) 60%, transparent);
	}
	.btn-pill.tone-danger:hover {
		color: var(--palette-red);
		border-color: color-mix(in srgb, var(--palette-red) 60%, transparent);
	}
	.btn-pill.tone-accent:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	.btn-pill.is-pressed {
		color: var(--fg);
		border-color: var(--border-strong);
		background: rgba(255, 255, 255, 0.04);
	}
	.btn-pill.tone-success.is-pressed {
		color: var(--palette-emerald-l);
		border-color: var(--palette-emerald);
		background: color-mix(in srgb, var(--palette-emerald) 12%, transparent);
	}
	.btn-pill.tone-danger.is-pressed {
		color: var(--palette-red);
		border-color: var(--palette-red);
		background: color-mix(in srgb, var(--palette-red) 12%, transparent);
	}
	.btn-pill.tone-accent.is-pressed {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}
</style>
