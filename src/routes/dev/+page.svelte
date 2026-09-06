<script lang="ts">
	import DevCog from '$lib/devcog/DevCog.svelte';
	import ControlRow from '$lib/devcog/controls/ControlRow.svelte';
	import Seg from '$lib/devcog/controls/Seg.svelte';
	import Fader from '$lib/devcog/controls/Fader.svelte';
	import FaderBank from '$lib/devcog/controls/FaderBank.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

	// A host contributes groups, not one flat panel — this demo is the smallest
	// thing that shows the seam: one live group and one gated one, so the rail's
	// dimmed-but-present state is visible without a globe on the page.
	let quality = $state('balanced');
	let density = $state(1.25);
	let bloom = $state(0.4);
	let trails = $state(18);
</script>

<svelte:head>
	<title>Dev — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="DevCog">
		<h3 class="component-name">DevCog</h3>
		<p class="component-desc">Development-only floating cluster: arm the element inspector, or open the console. The console is one surface with a group rail — a host contributes <code class="demo-code">ToolGroup</code>s and the built-in CAPTURE and PERF groups are merged in by <code class="demo-code">order</code>. Feature flags are no longer here; they live on the host's admin page behind <code class="demo-code">flagsHref</code>. Renders as <code class="demo-code">position: fixed</code>, so the demo box below needs a <code class="demo-code">transform</code> to scope it. Gate on <code class="demo-code">DEV</code> so it never ships.</p>

		<div class="demo-row">
			<span class="demo-label">quality</span>
			<code class="demo-code">{quality}</code>
		</div>

		<div class="demo-row">
			<span class="demo-label">values</span>
			<code class="demo-code">density {density.toFixed(2)}× · bloom {bloom.toFixed(2)} · trails {trails}</code>
		</div>

		<!-- transform scopes position:fixed children to this box -->
		<div class="devcog-preview">
			<span class="devcog-preview-hint">// click the cog</span>

			{#snippet demoGroup()}
				<div class="demo-group">
					<ControlRow
						label="quality"
						detail="Preset for the three dials below. Custom is whatever you last dragged them to."
					>
						<Seg
							options={[
								{ value: 'low', label: 'Low' },
								{ value: 'balanced', label: 'Bal' },
								{ value: 'high', label: 'High' }
							]}
							value={quality}
							onchange={(v) => (quality = v)}
						/>
					</ControlRow>

					<FaderBank>
						<Fader
							label="density"
							value={density}
							min={0.5}
							max={3}
							step={0.25}
							reference={1.25}
							format={(v) => `${v.toFixed(2)}×`}
							detail="Device-pixel ceiling. The tick is the measured sweet spot."
							oninput={(v) => (density = v)}
						/>
						<Fader
							label="bloom"
							value={bloom}
							min={0}
							max={1}
							step={0.05}
							format={(v) => v.toFixed(2)}
							oninput={(v) => (bloom = v)}
						/>
						<Fader
							label="trails"
							value={trails}
							min={0}
							max={60}
							applies="reload"
							detail="Ring size is fixed at context creation, so this one needs a reload."
							oninput={(v) => (trails = v)}
						/>
					</FaderBank>
				</div>
			{/snippet}

			{#snippet gatedGroup()}
				<p>unreachable — the group is gated</p>
			{/snippet}

			<DevCog
				groups={[
					{ id: 'demo', label: 'DEMO', glyph: '▤', order: 10, content: demoGroup },
					{
						id: 'globe',
						label: 'GLOBE',
						glyph: '◍',
						order: 30,
						available: false,
						gate: 'Needs a registered globe on the page.',
						content: gatedGroup
					}
				]}
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

	.demo-group {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
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
