<script lang="ts">
	import DevCog from '$lib/devcog/DevCog.svelte';
	import type { FlagSnapshot } from '$lib/devcog/flags/engine.js';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

	const DEMO_FLAGS = [
		{ key: 'marketing', label: 'Marketing pages' },
		{ key: 'product', label: 'Product & pricing' },
		{ key: 'docs', label: 'Documentation' },
		{ key: 'auth', label: 'Login & signup' },
		{ key: 'console', label: 'Console' }
	];

	let devSnap = $state<FlagSnapshot[]>(
		DEMO_FLAGS.map((f, i) => ({
			key: f.key,
			enabled: i % 2 === 0,
			source: i === 1 ? 'server' : i === 3 ? 'override' : 'env'
		}))
	);
	let devMode = $state('both');
	const DEV_MODES = ['marketing', 'both', 'app'] as const;

	function devToggle(key: string, enabled: boolean) {
		devSnap = devSnap.map((f) => (f.key === key ? { ...f, enabled, source: 'override' } : f));
	}

	function devModeChange(m: string) {
		devMode = m;
	}
</script>

<svelte:head>
	<title>Dev — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="DevCog">
		<h3 class="component-name">DevCog</h3>
		<p class="component-desc">Development-only floating panel for toggling feature flags and switching between app modes (<code class="demo-code">marketing/both/app</code>). Renders as a <code class="demo-code">position: fixed</code> gear icon — the parent container needs <code class="demo-code">transform: scale(1)</code> to scope it in this demo. Gate on <code class="demo-code">DEV</code> env var so it never ships to production.</p>

		<div class="demo-row">
			<span class="demo-label">mode</span>
			<code class="demo-code">{devMode}</code>
		</div>

		<div class="demo-row" style="align-items: flex-start;">
			<span class="demo-label">flags</span>
			<div style="display: flex; flex-direction: column; gap: 0.3rem;">
				{#each devSnap as f (f.key)}
					<code class="demo-code">{f.key}: {f.enabled ? 'on' : 'off'} ({f.source})</code>
				{/each}
			</div>
		</div>

		<!-- transform scopes position:fixed children to this box -->
		<div class="devcog-preview">
			<span class="devcog-preview-hint">// click the gear</span>
			<DevCog
				snap={devSnap}
				mode={devMode}
				modes={DEV_MODES}
				flagLabel={(key) => DEMO_FLAGS.find((f) => f.key === key)?.label}
				onToggle={devToggle}
				onModeChange={devModeChange}
				showPerf
			/>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2rem;
	}

	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 88px;
		flex-shrink: 0;
	}

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.devcog-preview {
		position: relative;
		height: 120px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		/* transform creates a new containing block, scoping position:fixed children */
		transform: translateZ(0);
		overflow: hidden;
	}
	.devcog-preview-hint {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		pointer-events: none;
		user-select: none;
	}
</style>
