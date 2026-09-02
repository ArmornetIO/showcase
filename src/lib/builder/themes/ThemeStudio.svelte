<script lang="ts">
	// Theme Studio — pick a component, restyle its tokens, hand the result to an
	// agent as a prompt (or drop it straight onto the builder canvas).
	//
	// The shell only wires things together: state lives in studio.svelte.ts, the
	// prompt text in prompt.ts, the palettes in defaults.ts, and each region of
	// the chrome in its own component.
	//
	// It uses a bare <dialog> rather than display/modal/Modal.svelte because Modal is
	// shaped around a title + body + footer at a fixed size, and this is a
	// full-bleed workspace whose header carries the theme picker. The part worth
	// reusing is the native element itself, which brings the focus trap and
	// Escape handling that a <div role="dialog"> has to reimplement by hand.
	import ComponentRenderer from '../ComponentRenderer.svelte';
	import PropEditor from '../PropEditor.svelte';
	import { builder } from '../store.svelte.js';
	import { THEMES } from '$lib/theme/themes.js';
	import { ThemeStudioState } from './studio.svelte.js';
	import { applyPreviewRadius } from './preview-radius.js';
	import ComponentRail from './ComponentRail.svelte';
	import SwatchBar from './SwatchBar.svelte';
	import StudioControls from './StudioControls.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}
	let { open, onclose }: Props = $props();

	const studio = new ThemeStudioState();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let previewEl = $state<HTMLDivElement | null>(null);
	let copied = $state(false);

	// Drive the native dialog from the `open` prop.
	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	// Paint the studio's theme onto the preview element, so the preview shows the
	// palette being edited rather than the one the surrounding page is using.
	// Defaults are re-applied on every run, which is what makes clearing an
	// override restore the original value.
	$effect(() => {
		if (!previewEl) return;
		for (const [key, val] of Object.entries(studio.themeDefaults)) {
			previewEl.style.setProperty(key, val);
		}
		for (const [key, val] of Object.entries(studio.overrides)) {
			previewEl.style.setProperty(key, val);
		}
	});

	// Radius cannot ride on a custom property: components own their corners
	// through `rounded-*` classes. See preview-radius.ts.
	$effect(() => {
		if (!previewEl) return;
		const radius = studio.borderRadius;
		const _tab = studio.tab; // re-apply when the preview remounts
		const _id = studio.componentId;
		applyPreviewRadius(previewEl, radius);
	});

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(studio.prompt);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* clipboard unavailable — leave the button idle */
		}
	}

	function addToCanvas() {
		if (!studio.componentId) return;
		builder.addItem(studio.componentId, 220, 220);
		const newId = builder.selectedId;
		if (newId) {
			if (studio.changedProps.length > 0) builder.setItemProps(newId, studio.props);
			if (Object.keys(studio.overrides).length > 0) {
				builder.setStyleOverrides(newId, { ...studio.overrides });
			}
		}
		onclose();
	}
</script>

<dialog
	class="ts-modal"
	bind:this={dialogEl}
	aria-labelledby="ts-wordmark"
	onclose={onclose}
	onclick={(e) => {
		// Clicking the backdrop means the click landed on the dialog itself.
		if (e.target === dialogEl) onclose();
	}}
>
	<div class="ts-shell">
		<!-- ── Header ───────────────────────────────────────────────────────── -->
		<div class="ts-header">
			<span class="ts-wordmark" id="ts-wordmark">◈ THEME STUDIO</span>

			<div class="ts-theme-pills">
				{#each THEMES as t (t.key)}
					<button
						class="ts-pill"
						class:active={studio.theme === t.key}
						aria-pressed={studio.theme === t.key}
						onclick={() => studio.setTheme(t.key)}
					>
						<span class="ts-pill-dot" style="background:{t.swatch[1]}"></span>
						{t.label}
					</button>
				{/each}
			</div>

			<div class="ts-header-end">
				{#if studio.hasChanges}
					<button class="ts-link-btn" onclick={() => studio.reset()}>Reset</button>
				{/if}
				<button class="ts-close" onclick={onclose} aria-label="Close">
					<svg
						width="11"
						height="11"
						viewBox="0 0 11 11"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<path d="M1 1l9 9M10 1l-9 9" />
					</svg>
				</button>
			</div>
		</div>

		<!-- ── Body ──────────────────────────────────────────────────────────── -->
		<div class="ts-body">
			<ComponentRail
				selectedId={studio.componentId}
				onselect={(id) => studio.selectComponent(id)}
			/>

			<div class="ts-main">
				{#if studio.componentId && studio.meta}
					<div class="ts-preview" bind:this={previewEl}>
						{#if studio.tab === 'component'}
							<ComponentRenderer
								componentId={studio.componentId}
								props={studio.props}
								w={studio.meta.defaultW || 240}
								h={studio.meta.defaultH || 80}
							/>
						{:else}
							<pre class="ts-prompt-pre">{studio.prompt}</pre>
						{/if}

						{#if studio.hasChanges}
							<div class="ts-preview-tabs">
								<button
									class="ts-tab"
									class:active={studio.tab === 'component'}
									onclick={() => (studio.requestedTab = 'component')}>Preview</button
								>
								<button
									class="ts-tab"
									class:active={studio.tab === 'prompt'}
									onclick={() => (studio.requestedTab = 'prompt')}>Prompt</button
								>
							</div>
						{/if}
					</div>
				{:else}
					<div class="ts-empty">
						<div class="ts-empty-icon">◈</div>
						<p>Select a component to start styling</p>
					</div>
				{/if}

				<div class="ts-bottom-bar">
					{#if studio.meta}
						<SwatchBar
							controls={studio.colorControls}
							valueOf={(t) => studio.valueOf(t)}
							isOverridden={(t) => studio.isOverridden(t)}
							onpick={(token, value) => studio.setToken(token, value)}
						/>
					{:else}
						<div class="ts-swatch-empty">
							<span class="ts-swatch-hint">← select a component to see its controls</span>
						</div>
					{/if}

					<StudioControls
						showRadius={studio.hasRadiusControl && !!studio.meta}
						borderRadius={studio.borderRadius}
						hasChanges={studio.hasChanges}
						canAdd={!!studio.componentId}
						{copied}
						onradius={(px) => studio.setRadius(px)}
						oncopy={copyPrompt}
						onadd={addToCanvas}
					/>
				</div>
			</div>

			{#if studio.meta && Object.keys(studio.meta.props).length > 0}
				<div class="ts-props-rail">
					<div class="ts-props-heading">PROPS</div>
					<div class="ts-props-scroll">
						<PropEditor
							meta={studio.meta}
							values={studio.props}
							onchange={(key, value) => studio.setProp(key, value)}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>
</dialog>

<style>
	/* ── Shell ───────────────────────────────────────────────────────────────── */
	.ts-modal {
		position: fixed;
		top: 6%;
		left: 4%;
		right: 4%;
		bottom: 6%;
		width: auto;
		max-width: none;
		height: auto;
		max-height: none;
		padding: 0;
		background: var(--bg);
		border: 1px solid var(--border-strong);
		box-shadow: 0 32px 80px -24px rgba(0, 0, 0, 0.7);
		overflow: hidden;
		color: var(--fg);
	}
	.ts-modal::backdrop {
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
	}

	.ts-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	/* ── Header ──────────────────────────────────────────────────────────────── */
	.ts-header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.ts-wordmark {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--accent);
		flex-shrink: 0;
	}

	.ts-theme-pills {
		display: flex;
		gap: 4px;
		flex: 1;
	}

	.ts-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		font-size: 0.72rem;
		font-family: var(--sans);
		color: var(--fg-muted);
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.14s;
		white-space: nowrap;
	}
	.ts-pill:hover {
		color: var(--fg);
		background: var(--surface-raised);
	}
	.ts-pill.active {
		color: var(--fg);
		background: var(--surface-strong);
		border-color: var(--border);
	}

	.ts-pill-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.ts-header-end {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ts-link-btn {
		font-size: 0.72rem;
		color: var(--fg-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px 6px;
		transition: color 0.12s;
	}
	.ts-link-btn:hover {
		color: var(--fg);
	}

	.ts-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.12s;
	}
	.ts-close:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}

	/* ── Body ────────────────────────────────────────────────────────────────── */
	.ts-body {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.ts-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	/* ── Props rail ──────────────────────────────────────────────────────────── */
	.ts-props-rail {
		width: 196px;
		flex-shrink: 0;
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.ts-props-heading {
		font-family: var(--mono);
		font-size: 0.45rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 10px 12px 6px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.ts-props-scroll {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	/* ── Preview area ────────────────────────────────────────────────────────── */
	.ts-preview {
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px;
		background: var(--bg);
	}

	.ts-prompt-pre {
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 20px 24px;
		font-family: var(--mono);
		font-size: 0.65rem;
		line-height: 1.8;
		color: var(--fg-muted);
		background: transparent;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
	}

	.ts-preview-tabs {
		position: absolute;
		top: 12px;
		right: 16px;
		display: flex;
		gap: 2px;
	}

	.ts-tab {
		padding: 4px 10px;
		font-size: 0.62rem;
		font-family: var(--mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 3px;
		cursor: pointer;
		transition: all 0.12s;
	}
	.ts-tab:hover {
		color: var(--fg);
	}
	.ts-tab.active {
		color: var(--accent);
		border-color: var(--border-accent);
	}

	/* ── Empty states ────────────────────────────────────────────────────────── */
	.ts-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: var(--fg-dim);
	}

	.ts-empty-icon {
		font-size: 1.8rem;
		opacity: 0.3;
	}

	.ts-empty p {
		font-size: 0.82rem;
		margin: 0;
	}

	.ts-swatch-empty {
		display: flex;
		align-items: center;
		padding: 20px 24px 16px;
	}

	.ts-swatch-hint {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.15em;
		color: var(--fg-dim);
		opacity: 0.5;
	}

	/* ── Bottom bar ──────────────────────────────────────────────────────────── */
	.ts-bottom-bar {
		flex-shrink: 0;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
	}
</style>
