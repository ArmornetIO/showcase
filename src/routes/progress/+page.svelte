<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import ProgressBar from '$lib/display/progress/ProgressBar.svelte';
	import Icon from '$lib/icons/Icon.svelte';

	let progressType = $state<'linear' | 'stepped' | 'stacked' | 'radial'>('linear');
	let progressVariant = $state<'accent' | 'success' | 'warn' | 'error'>('accent');
	let progressSize = $state<'sm' | 'md' | 'lg'>('md');
	let progressIndeterminate = $state(false);
</script>

<svelte:head>
	<title>Progress — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="ProgressBar">
		<h3 class="component-name">ProgressBar</h3>
		<p class="component-desc">Unified progress primitive — <code class="demo-code">type</code> controls the display shape (<code class="demo-code">linear</code>, <code class="demo-code">stepped</code>, <code class="demo-code">stacked</code>, <code class="demo-code">radial</code>), <code class="demo-code">variant</code> controls the fill color. Note: <code class="demo-code">SteppedProgress</code>, <code class="demo-code">StackedBar</code>, and <code class="demo-code">RadialProgress</code> also exist as standalone exports for cases where you only need one shape without the type-switching overhead.</p>

		<div class="blade-ctrl">
			<!-- Type -->
			<div class="bc-group">
				<span class="bc-label">TYPE</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						class:bc-active={progressType === 'linear'}
						title="Linear"
						onclick={() => { progressType = 'linear'; }}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1.5" y="5" width="10" height="3" rx="1.5" fill="currentColor" fill-opacity="0.22"/>
							<rect x="1.5" y="5" width="6.5" height="3" rx="1.5" fill="currentColor"/>
						</svg>
					</button>
					<button
						class="bc-btn"
						class:bc-active={progressType === 'stepped'}
						title="Stepped"
						onclick={() => { progressType = 'stepped'; progressIndeterminate = false; }}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1" y="5" width="2.2" height="3" rx="0.5" fill="currentColor"/>
							<rect x="4.1" y="5" width="2.2" height="3" rx="0.5" fill="currentColor"/>
							<rect x="7.2" y="5" width="2.2" height="3" rx="0.5" fill="currentColor"/>
							<rect x="10.3" y="5" width="1.7" height="3" rx="0.5" fill="currentColor" fill-opacity="0.25"/>
						</svg>
					</button>
					<button
						class="bc-btn"
						class:bc-active={progressType === 'stacked'}
						title="Stacked"
						onclick={() => { progressType = 'stacked'; progressIndeterminate = false; }}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1.5" y="5" width="4" height="3" rx="1" fill="currentColor"/>
							<rect x="5.5" y="5" width="3" height="3" fill="currentColor" fill-opacity="0.55"/>
							<rect x="8.5" y="5" width="3" height="3" rx="1" fill="currentColor" fill-opacity="0.28"/>
						</svg>
					</button>
					<button
						class="bc-btn"
						class:bc-active={progressType === 'radial'}
						title="Radial"
						onclick={() => { progressType = 'radial'; }}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="2" stroke-opacity="0.22"/>
							<path d="M 6.5 2.5 A 4 4 0 1 1 3.4 9.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
						</svg>
					</button>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Variant -->
			<div class="bc-group">
				<span class="bc-label">VARIANT</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						class:bc-active={progressVariant === 'accent'}
						title="Accent"
						onclick={() => (progressVariant = 'accent')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<circle cx="6.5" cy="6.5" r="3.5" fill="currentColor"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-success"
						class:bc-active={progressVariant === 'success'}
						title="Success"
						onclick={() => (progressVariant = 'success')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/>
							<path d="M 4 6.5 L 6 8.5 L 9.5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-warn"
						class:bc-active={progressVariant === 'warn'}
						title="Warn"
						onclick={() => (progressVariant = 'warn')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<path d="M 6.5 1.5 L 11.5 11 L 1.5 11 Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
							<line x1="6.5" y1="4.5" x2="6.5" y2="7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
							<circle cx="6.5" cy="9.2" r="0.65" fill="currentColor"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-danger"
						class:bc-active={progressVariant === 'error'}
						title="Error"
						onclick={() => (progressVariant = 'error')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/>
							<path d="M 4.5 4.5 L 8.5 8.5 M 8.5 4.5 L 4.5 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
						</svg>
					</button>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Size -->
			<div class="bc-group">
				<span class="bc-label">SIZE</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						class:bc-active={progressSize === 'sm'}
						title="Small"
						disabled={progressType === 'stepped'}
						onclick={() => (progressSize = 'sm')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1.5" y="5.75" width="10" height="1.5" rx="0.75" fill="currentColor" fill-opacity="0.22"/>
							<rect x="1.5" y="5.75" width="6" height="1.5" rx="0.75" fill="currentColor"/>
						</svg>
					</button>
					<button
						class="bc-btn"
						class:bc-active={progressSize === 'md'}
						title="Medium"
						disabled={progressType === 'stepped'}
						onclick={() => (progressSize = 'md')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1.5" y="5.25" width="10" height="2.5" rx="1.25" fill="currentColor" fill-opacity="0.22"/>
							<rect x="1.5" y="5.25" width="6" height="2.5" rx="1.25" fill="currentColor"/>
						</svg>
					</button>
					<button
						class="bc-btn"
						class:bc-active={progressSize === 'lg'}
						title="Large"
						disabled={progressType === 'stepped'}
						onclick={() => (progressSize = 'lg')}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1.5" y="4.5" width="10" height="4" rx="2" fill="currentColor" fill-opacity="0.22"/>
							<rect x="1.5" y="4.5" width="6" height="4" rx="2" fill="currentColor"/>
						</svg>
					</button>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- State -->
			<div class="bc-group">
				<span class="bc-label">STATE</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						class:bc-active={progressIndeterminate}
						title="Indeterminate"
						disabled={progressType === 'stepped' || progressType === 'stacked'}
						onclick={() => (progressIndeterminate = !progressIndeterminate)}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
							<rect x="1.5" y="5" width="10" height="3" rx="1.5" fill="currentColor" fill-opacity="0.22"/>
							<rect x="3.5" y="5" width="3.5" height="3" rx="0.5" fill="currentColor"/>
							<rect x="7.5" y="5" width="2" height="3" rx="0.5" fill="currentColor" fill-opacity="0.5"/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label"
				>{progressType} · {progressIndeterminate && progressType !== 'stepped' && progressType !== 'stacked'
					? 'indeterminate'
					: progressVariant + ' · ' + progressSize}</span
			>
			{#if progressType === 'linear'}
				<div class="demo-items demo-items--wide" style="width:100%;">
					<ProgressBar
						value={72}
						label="Risk Score"
						showPercent
						variant={progressVariant}
						size={progressSize}
						indeterminate={progressIndeterminate}
					/>
				</div>
			{:else if progressType === 'stepped'}
				<div class="demo-items demo-items--wide" style="width:100%;">
					<ProgressBar
						type="stepped"
						steps={['Scope', 'Assess', 'Remediate', 'Close']}
						current={2}
						stepStyle="blocks"
						label="Assessment Pipeline"
						showCount
						variant={progressVariant}
						size={progressSize}
					/>
				</div>
			{:else if progressType === 'stacked'}
				<div class="demo-items demo-items--wide" style="width:100%;">
					<ProgressBar
						type="stacked"
						label="Risk Distribution"
						size={progressSize}
						segments={[
							{ label: 'Critical', value: 3, variant: 'error' },
							{ label: 'High', value: 8, variant: 'warn' },
							{ label: 'Medium', value: 12, variant: 'accent' },
							{ label: 'Low', value: 17, variant: 'success' }
						]}
					/>
				</div>
			{:else}
				<div class="demo-items" style="display:flex;justify-content:center;width:100%;">
					<ProgressBar
						type="radial"
						value={72}
						label="Score"
						variant={progressVariant}
						diameter={progressSize === 'sm' ? 56 : progressSize === 'lg' ? 112 : 80}
						strokeWidth={progressSize === 'sm' ? 4 : progressSize === 'lg' ? 9 : 6}
						indeterminate={progressIndeterminate}
					/>
				</div>
			{/if}
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

	.demo-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.demo-items--wide {
		flex: 1;
		min-width: 0;
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

	.blade-ctrl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.bc-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bc-label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		color: var(--fg-muted, rgba(156, 163, 175, 0.45));
	}
	.bc-btns {
		display: flex;
		gap: 4px;
	}
	.bc-sep {
		width: 1px;
		height: 44px;
		background: rgba(255, 255, 255, 0.07);
		flex-shrink: 0;
		align-self: center;
	}
	.bc-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.06);
	}
	.bc-btn.bc-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}
	.bc-btn.bc-success {
		color: #34d399;
		border-color: rgba(52, 211, 153, 0.3);
	}
	.bc-btn.bc-success:hover {
		background: rgba(52, 211, 153, 0.1);
		border-color: rgba(52, 211, 153, 0.6);
	}
	.bc-btn.bc-warn {
		color: #fcd34d;
		border-color: rgba(252, 211, 77, 0.3);
	}
	.bc-btn.bc-warn:hover {
		background: rgba(252, 211, 77, 0.1);
		border-color: rgba(252, 211, 77, 0.6);
	}
	.bc-btn.bc-danger {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.3);
	}
	.bc-btn.bc-danger:hover {
		background: rgba(252, 165, 165, 0.1);
		border-color: rgba(252, 165, 165, 0.6);
	}
</style>
