<script lang="ts">
	import type { AlertBladeVariant } from './alertBlade.svelte.js';

	interface AlertBladeProps {
		id: string;
		title?: string;
		message: string;
		variant?: AlertBladeVariant;
		duration?: number;
		action?: { label: string; onclick: () => void };
		ondismiss: (id: string) => void;
	}

	let {
		id,
		title,
		message,
		variant = 'info',
		duration = 5000,
		action,
		ondismiss
	}: AlertBladeProps = $props();

	const COLORS: Record<
		AlertBladeVariant,
		{
			blade: string;
			icon: string;
			iconBg: string;
			border: string;
			glow: string;
		}
	> = {
		info: {
			blade: '#5FEAD5',
			icon: '#5FEAD5',
			iconBg: 'rgba(95,234,213,0.12)',
			border: 'rgba(95,234,213,0.3)',
			glow: 'rgba(95,234,213,0.12)'
		},
		success: {
			blade: '#34D399',
			icon: '#34D399',
			iconBg: 'rgba(52,211,153,0.12)',
			border: 'rgba(52,211,153,0.3)',
			glow: 'rgba(52,211,153,0.12)'
		},
		warn: {
			blade: '#FCD34D',
			icon: '#FCD34D',
			iconBg: 'rgba(252,211,77,0.12)',
			border: 'rgba(252,211,77,0.3)',
			glow: 'rgba(252,211,77,0.12)'
		},
		danger: {
			blade: '#FCA5A5',
			icon: '#FCA5A5',
			iconBg: 'rgba(252,165,165,0.12)',
			border: 'rgba(252,165,165,0.3)',
			glow: 'rgba(252,165,165,0.12)'
		}
	};

	const c = $derived(COLORS[variant]);

	$effect(() => {
		if (duration <= 0) return;
		const t = setTimeout(() => ondismiss(id), duration);
		return () => clearTimeout(t);
	});
</script>

<div
	class="blade variant-{variant}"
	style:--blade-color={c.blade}
	style:--blade-icon={c.icon}
	style:--blade-icon-bg={c.iconBg}
	style:--blade-border={c.border}
	style:--blade-glow={c.glow}
	role="alert"
	aria-live="assertive"
>
	<span class="blade-bar" aria-hidden="true"></span>

	<div class="blade-icon" aria-hidden="true">
		{#if variant === 'info'}
			<svg
				width="13"
				height="13"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
			>
				<circle cx="8" cy="8" r="6.5" />
				<path d="M8 7v4.5" />
				<circle cx="8" cy="5" r=".5" fill="currentColor" />
			</svg>
		{:else if variant === 'success'}
			<svg
				width="13"
				height="13"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="8" cy="8" r="6.5" />
				<path d="M5.5 8.5l2 2 3.5-4" />
			</svg>
		{:else if variant === 'warn'}
			<svg
				width="13"
				height="13"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M8 2.5L14 13H2L8 2.5z" />
				<path d="M8 6.5v3" />
				<circle cx="8" cy="11" r=".5" fill="currentColor" />
			</svg>
		{:else}
			<svg
				width="13"
				height="13"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
			>
				<circle cx="8" cy="8" r="6.5" />
				<path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
			</svg>
		{/if}
	</div>

	<div class="blade-body">
		{#if title}
			<div class="blade-title">{title}</div>
		{/if}
		<div class="blade-message">{message}</div>
		{#if action}
			<button class="blade-action" onclick={action.onclick}>{action.label}</button>
		{/if}
	</div>

	<button class="blade-close" onclick={() => ondismiss(id)} aria-label="Dismiss">
		<svg
			width="9"
			height="9"
			viewBox="0 0 9 9"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		>
			<path d="M1 1l7 7M8 1L1 8" />
		</svg>
	</button>

	{#if duration > 0}
		<div class="blade-progress" style:animation-duration="{duration}ms"></div>
	{/if}
</div>

<style>
	.blade {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: 360px;
		max-width: calc(100vw - 48px);
		padding: 14px 14px 18px 16px;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.97), rgba(3, 7, 18, 0.99));
		backdrop-filter: blur(16px);
		border: 1px solid var(--blade-border);
		border-radius: var(--radius-inset);
		overflow: hidden;
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.04) inset,
			0 8px 32px -8px rgba(0, 0, 0, 0.7),
			0 0 20px -10px var(--blade-glow);
	}

	.blade-bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--blade-color);
		box-shadow: 0 0 8px var(--blade-color);
	}

	.blade-icon {
		flex-shrink: 0;
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--blade-icon-bg);
		border: 1px solid var(--blade-border);
		border-radius: var(--radius-hairline);
		color: var(--blade-icon);
	}

	.blade-body {
		flex: 1;
		min-width: 0;
		padding-top: 2px;
	}
	.blade-title {
		font-family: var(--sans-brand);
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.2;
		margin-bottom: 3px;
	}
	/* --fg-muted, not --fg-dim: the blade's own near-black face drops --fg-dim to
	   ~4:1, under AA, and a toast is read once in passing or not at all — there
	   is no second look to recover the sentence from. 500 because JetBrains Mono
	   ships one self-hosted, so the extra stem weight is a real face rather than
	   a synthetic smear. */
	.blade-message {
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--fg-muted);
		line-height: 1.55;
	}
	.blade-action {
		margin-top: 8px;
		padding: 3px 10px;
		background: transparent;
		border: 1px solid var(--blade-border);
		border-radius: var(--radius-hairline);
		color: var(--blade-icon);
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.blade-action:hover {
		background: var(--blade-icon-bg);
		border-color: var(--blade-color);
	}

	.blade-close {
		flex-shrink: 0;
		margin-top: 2px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-hairline);
		color: var(--fg-muted);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.blade-close:hover {
		color: var(--blade-icon);
		border-color: var(--blade-border);
	}

	.blade-progress {
		position: absolute;
		left: 3px;
		right: 0;
		bottom: 0;
		height: 2px;
		background: var(--blade-color);
		opacity: 0.45;
		transform-origin: left;
		animation: blade-progress linear forwards;
	}
	@keyframes blade-progress {
		from {
			transform: scaleX(1);
		}
		to {
			transform: scaleX(0);
		}
	}
</style>
