<script lang="ts">
	// The QA drawer — the cog's second half. The flags popup answers "what is
	// this build serving?"; the drawer answers "what is wrong with this page?".
	// Built-in tooling is the nit batch; hosts extend it through `content`.
	import type { Snippet } from 'svelte';
	import DevIcon from '../DevIcon.svelte';
	import { ICON_CLOSE, ICON_CROSSHAIR } from '../icons.js';
	import type { NitsController } from './nits.svelte.js';
	import GhostButton from './GhostButton.svelte';
	import NitList from './NitList.svelte';
	import QaSection from './QaSection.svelte';

	interface QaDrawerProps {
		nits: NitsController;
		/** Host-supplied page actions, rendered above the nit batch. */
		content?: Snippet;
		onClose: () => void;
	}

	let { nits, content, onClose }: QaDrawerProps = $props();
</script>

<aside class="qa-drawer" data-devcog aria-label="QA tools">
	<header class="qa-header">
		<span class="qa-wordmark">◈ QA</span>

		<button
			class="qa-inspect-btn"
			class:active={nits.inspecting}
			aria-pressed={nits.inspecting}
			aria-label={nits.inspecting ? 'Stop inspecting' : 'Inspect element'}
			title={nits.inspecting ? 'Stop inspecting (Esc)' : 'Inspect element'}
			onclick={() => nits.toggleInspect()}
		>
			<DevIcon glyph={ICON_CROSSHAIR} />
		</button>

		<button class="qa-close" aria-label="Close QA panel" onclick={onClose}>
			<DevIcon glyph={ICON_CLOSE} size={11} strokeWidth={2.4} />
		</button>
	</header>

	<div class="qa-body">
		{#if content}
			<QaSection label="page actions">
				{@render content()}
			</QaSection>
		{/if}

		<QaSection label="nits{nits.count > 0 ? ` (${nits.count})` : ''}" grow>
			{#snippet actions()}
				{#if nits.count > 0}
					<GhostButton onclick={() => nits.clear()}>clear</GhostButton>
					<GhostButton accent onclick={() => nits.copyPrompt()}>
						{nits.copied ? '✓ copied' : 'copy prompt'}
					</GhostButton>
				{/if}
			{/snippet}
			<NitList {nits} />
		</QaSection>
	</div>
</aside>

<style>
	.qa-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 9996;
		width: 300px;
		background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-left: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
		display: flex;
		flex-direction: column;
		box-shadow: -8px 0 40px rgba(0, 0, 0, 0.4);
		animation: drawer-in 0.2s ease;
	}
	.qa-drawer::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
		opacity: 0.6;
	}

	@keyframes drawer-in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.qa-header {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 46px;
		padding: 0 14px 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.qa-wordmark {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--accent);
		flex: 1;
	}

	.qa-inspect-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 5px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		flex-shrink: 0;
	}
	.qa-inspect-btn:hover {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
		background: var(--accent-faint);
	}
	.qa-inspect-btn.active {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
		box-shadow: 0 0 8px var(--accent-glow);
		animation: inspect-pulse 2s ease-in-out infinite;
	}

	@keyframes inspect-pulse {
		0%,
		100% {
			box-shadow: 0 0 6px var(--accent-glow);
		}
		50% {
			box-shadow: 0 0 14px var(--accent-glow);
		}
	}

	.qa-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.12s, border-color 0.12s;
		flex-shrink: 0;
	}
	.qa-close:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}

	.qa-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
</style>
