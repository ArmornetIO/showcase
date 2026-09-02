<script lang="ts">
	import { docsLayout, type NavPos, type TocPos, type MetaPos } from './docsLayout.svelte.js';
	import Icon from '../icons/Icon.svelte';

	let open = $state(false);

	// ── Option sets ─────────────────────────────────────────────────────────────
	// Layout icons for nav/toc positions are bespoke rect shapes — no icon
	// equivalent in the library set, so they stay as inline SVG paths.
	const ICON_LEFT = `<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="12" y="3" width="9" height="18" rx="1"/>`;
	const ICON_RIGHT = `<rect x="3" y="3" width="9" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>`;
	const ICON_ABOVE = `<rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="9" width="18" height="12" rx="1"/>`;
	const ICON_BELOW = `<rect x="3" y="3" width="18" height="12" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/>`;

	const navOptions: { id: NavPos; title: string; icon: string }[] = [
		{ id: 'left', title: 'Left', icon: ICON_LEFT },
		{ id: 'right', title: 'Right', icon: ICON_RIGHT },
		{ id: 'hidden', title: 'Hide', icon: '' }
	];

	const tocOptions: { id: TocPos; title: string; icon: string }[] = [
		{ id: 'left', title: 'Left', icon: ICON_LEFT },
		{ id: 'right', title: 'Right', icon: ICON_RIGHT },
		{ id: 'hidden', title: 'Hide', icon: '' }
	];

	const metaOptions: { id: MetaPos; title: string; icon: string }[] = [
		{ id: 'above', title: 'Above content', icon: ICON_ABOVE },
		{ id: 'below', title: 'Below content', icon: ICON_BELOW },
		{ id: 'hidden', title: 'Hide', icon: '' }
	];

	// ── Live wireframe ────────────────────────────────────────────────────────────
	const slotLabel = $derived({
		left: docsLayout.nav === 'left' ? 'Nav' : docsLayout.toc === 'left' ? 'TOC' : '',
		right: docsLayout.nav === 'right' ? 'Nav' : docsLayout.toc === 'right' ? 'TOC' : ''
	});

	function isTocConflict(id: TocPos): boolean {
		return (id === 'left' && docsLayout.nav === 'left') || (id === 'right' && docsLayout.nav === 'right');
	}
</script>

<!-- ── Floating trigger ─────────────────────────────────────────────────────── -->
<button
	class="dld-trigger"
	class:active={open}
	onclick={() => (open = !open)}
	title="Layout settings"
	aria-label="Layout settings"
	aria-expanded={open}
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="3" width="7" height="7" rx="1" />
		<rect x="14" y="3" width="7" height="7" rx="1" />
		<rect x="3" y="14" width="7" height="7" rx="1" />
		<rect x="14" y="14" width="7" height="7" rx="1" />
	</svg>
</button>

{#if open}
	<div class="dld-backdrop" role="presentation" onclick={() => (open = false)}></div>

	<div class="dld-panel" role="dialog" aria-label="Layout settings">
		<!-- Header -->
		<div class="dld-header">
			<span class="dld-title">Layout</span>
			<button class="dld-close" onclick={() => (open = false)} aria-label="Close">
				<Icon name="x" size={14} />
			</button>
		</div>

		<!-- Wireframe preview -->
		<div class="dld-preview">
			<div
				class="dld-wf"
				style:grid-template-columns="{slotLabel.left ? '28px' : '6px'} 1fr {slotLabel.right ? '28px' : '6px'}"
			>
				<div class="dld-wf-left" class:occupied={!!slotLabel.left}>
					{#if slotLabel.left}<span>{slotLabel.left}</span>{/if}
				</div>
				<div class="dld-wf-center"><span>Doc</span></div>
				<div class="dld-wf-right" class:occupied={!!slotLabel.right}>
					{#if slotLabel.right}<span>{slotLabel.right}</span>{/if}
				</div>
			</div>
		</div>

		<!-- Controls -->
		<div class="dld-controls">
			<div class="dld-row">
				<span class="dld-row-label">Navigation</span>
				<div class="dld-btns">
					{#each navOptions as opt (opt.id)}
						<button
							class="dld-btn"
							class:active={docsLayout.nav === opt.id}
							title={opt.title}
							onclick={() => docsLayout.set({ nav: opt.id })}
						>
							{#if opt.icon}
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html opt.icon}
								</svg>
							{:else}
								<Icon name="eye-off" size={14} />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="dld-row">
				<span class="dld-row-label">Contents</span>
				<div class="dld-btns">
					{#each tocOptions as opt (opt.id)}
						{@const conflict = isTocConflict(opt.id)}
						<button
							class="dld-btn"
							class:active={docsLayout.toc === opt.id}
							disabled={conflict}
							title={conflict ? 'Conflicts with Nav position' : opt.title}
							onclick={() => docsLayout.set({ toc: opt.id })}
						>
							{#if opt.icon}
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html opt.icon}
								</svg>
							{:else}
								<Icon name="eye-off" size={14} />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="dld-row">
				<span class="dld-row-label">Metadata</span>
				<div class="dld-btns">
					{#each metaOptions as opt (opt.id)}
						<button
							class="dld-btn"
							class:active={docsLayout.meta === opt.id}
							title={opt.title}
							onclick={() => docsLayout.set({ meta: opt.id })}
						>
							{#if opt.icon}
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html opt.icon}
								</svg>
							{:else}
								<Icon name="eye-off" size={14} />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="dld-row">
				<span class="dld-row-label">Breadcrumbs</span>
				<button
					class="dld-toggle"
					class:on={docsLayout.breadcrumbs}
					onclick={() => docsLayout.set({ breadcrumbs: !docsLayout.breadcrumbs })}
					role="switch"
					aria-checked={docsLayout.breadcrumbs}
					aria-label="Toggle breadcrumbs"
				>
					<span class="dld-toggle-knob"></span>
				</button>
			</div>
		</div>

		<div class="dld-footer">
			<button class="dld-reset" onclick={() => docsLayout.reset()}>
				<Icon name="rotate-ccw" size={12} />
				Reset defaults
			</button>
		</div>
	</div>
{/if}

<style>
	.dld-trigger {
		position: fixed;
		bottom: 1.25rem;
		right: 1.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-surface);
		border: 1px solid var(--border);
		background: var(--bg-elev);
		color: var(--fg-dim);
		cursor: pointer;
		z-index: 60;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		transition:
			color 0.12s,
			border-color 0.12s,
			background 0.12s;
	}
	.dld-trigger:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.dld-trigger.active {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.dld-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
	}
	.dld-panel {
		position: fixed;
		bottom: 4rem;
		right: 1.25rem;
		width: 264px;
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.5),
			0 0 0 1px var(--accent-line);
		z-index: 60;
		overflow: hidden;
	}
	.dld-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
	}
	.dld-title {
		font-family: var(--mono);
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.dld-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: none;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: var(--radius-control);
		transition:
			color 0.12s,
			background 0.12s;
	}
	.dld-close:hover {
		color: var(--fg);
		background: var(--surface-strong);
	}

	/* Wireframe preview */
	.dld-preview {
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border);
	}
	.dld-wf {
		display: grid;
		grid-template-areas: 'left center right';
		width: 100%;
		height: 60px;
		border-radius: var(--radius-control);
		overflow: hidden;
		border: 1px solid var(--border);
		gap: 1px;
		background: var(--border);
		transition: grid-template-columns 0.2s ease;
	}
	.dld-wf > div {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		overflow: hidden;
	}
	.dld-wf > div span {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.dld-wf-left {
		grid-area: left;
	}
	.dld-wf-center {
		grid-area: center;
		background: var(--surface-raised) !important;
	}
	.dld-wf-right {
		grid-area: right;
	}
	.dld-wf > div.occupied {
		background: var(--accent-faint-strong);
	}
	.dld-wf > div.occupied span {
		color: var(--accent);
	}

	/* Controls */
	.dld-controls {
		padding: 0.625rem 0;
	}
	.dld-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.45rem 1rem;
	}
	.dld-row-label {
		font-size: 0.82rem;
		color: var(--fg-muted);
		flex-shrink: 0;
	}
	.dld-btns {
		display: flex;
		gap: 2px;
	}
	.dld-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-control);
		border: 1px solid transparent;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		transition:
			color 0.12s,
			background 0.12s,
			border-color 0.12s;
	}
	.dld-btn:hover:not(:disabled) {
		color: var(--fg);
		background: var(--surface-strong);
	}
	.dld-btn.active {
		color: var(--accent);
		background: var(--accent-faint-strong);
		border-color: var(--accent);
	}
	.dld-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Toggle switch */
	.dld-toggle {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: var(--radius-surface);
		border: 1px solid var(--border-strong);
		background: var(--surface-strong);
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
		flex-shrink: 0;
	}
	.dld-toggle.on {
		background: var(--accent-faint-strong);
		border-color: var(--accent);
	}
	.dld-toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--fg-dim);
		transition:
			transform 0.15s,
			background 0.15s;
	}
	.dld-toggle.on .dld-toggle-knob {
		transform: translateX(16px);
		background: var(--accent);
	}

	.dld-footer {
		padding: 0.625rem 1rem 0.75rem;
		border-top: 1px solid var(--border);
	}
	.dld-reset {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--fg-dim);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: color 0.12s;
	}
	.dld-reset:hover {
		color: var(--fg);
	}
</style>
