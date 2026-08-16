<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';
	import ArmornetCrest from '$lib/icons/ArmornetCrest.svelte';
	import ArmornetCrestHub from '$lib/icons/ArmornetCrestHub.svelte';
	import ArmornetCrestChrome from '$lib/icons/ArmornetCrestChrome.svelte';
	import Toggle from '$lib/primitives/Toggle.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import { downloadPng, downloadSvg, rasterSize } from '$lib/dev/svg-export.js';

	// One state bag for the chrome crest rig — the panel writes it, the stage
	// renders from it, so there is no preview mode and no apply step.
	type ToggleKey = 'glow' | 'traces' | 'rim' | 'emboss' | 'tethers';
	let chrome = $state({
		size: 240,
		bloom: 1,
		breakout: 0,
		glow: true,
		traces: true,
		rim: true,
		emboss: true,
		tethers: false
	});

	// The stage element, so the export can lift the mark exactly as rendered
	// rather than re-deriving it from the props.
	let chromeStage = $state<HTMLDivElement | null>(null);

	/** Name the file after what is switched ON, so a deck full of exports is
	 *  self-describing rather than crest-1, crest-2. */
	function chromeFilename() {
		const off = (['glow', 'traces', 'rim', 'emboss'] as const).filter((k) => !chrome[k]);
		const on = [
			chrome.tethers && 'tethered',
			chrome.breakout > 0 && `breakout${Math.round(chrome.breakout * 100)}`
		].filter(Boolean);
		return `armornet-crest-chrome-${chrome.size}${on.length ? `-${on.join('-')}` : ''}${
			off.length ? `-no-${off.join('-')}` : ''
		}.svg`;
	}

	/** PNG export multiplier. 4× off a 240 stage clears 1000px, which is more
	 *  than a full-bleed slide needs. */
	let chromeScale = $state(4);

	const chromeSvg = () => chromeStage?.querySelector('svg') as SVGSVGElement | null;

	/** Live readout of what the PNG will actually be, so nobody exports a 96px
	 *  asset into a 1920px deck by accident. */
	const chromePx = $derived.by(() => {
		const svg = chromeSvg();
		if (!svg) return null;
		// touch the reactive inputs so the readout tracks the controls
		void chrome.size;
		void chromeScale;
		const { w, h } = rasterSize(svg, chromeScale);
		return `${w}×${h}`;
	});

	function exportChromeSvg() {
		const svg = chromeSvg();
		if (svg) downloadSvg(svg, chromeFilename());
	}

	function exportChromePng() {
		const svg = chromeSvg();
		if (svg) downloadPng(svg, chromeFilename(), chromeScale);
	}
</script>

<svelte:head>
	<title>Icons — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="Icon">
		<h3 class="component-name">Icon</h3>
		<p class="component-desc">Self-contained SVG icon set sourced from Lucide. Scales with <code class="demo-code">size</code> and supports <code class="demo-code">strokeWidth</code> for line weight. All icons are inlined — no external network request, no font loading. Usage:</p>
		<p
			style="font-family: var(--mono); font-size: 0.6875rem; color: var(--fg-dim); margin-bottom: 20px;"
		>
			<code
				style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
				>&lt;Icon name="shield-check" size={20} /&gt;</code
			>
		</p>
		<div class="icon-grid">
			{#each ['arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'external-link', 'menu', 'more-horizontal', 'more-vertical', 'search', 'link', 'check', 'check-circle', 'check-circle-2', 'circle', 'x', 'x-circle', 'info', 'alert-triangle', 'alert-circle', 'save', 'clipboard-list', 'table', 'cpu', 'monitor', 'network', 'radio', 'power', 'zap', 'activity', 'refresh-cw', 'rotate-ccw', 'armornet', 'crestlink', 'shield', 'shield-check', 'lock', 'lock-open', 'eye', 'eye-off', 'key', 'fingerprint', 'settings', 'settings-2', 'maximize', 'maximize-2', 'zoom-in', 'zoom-out', 'palette', 'plus', 'minus', 'bell', 'trash', 'send', 'wrench', 'git-fork', 'globe', 'clock', 'user', 'users', 'log-out', 'copy'] as const as n}
				<div class="icon-cell">
					<Icon name={n} size={20} />
					<span class="icon-label">{n}</span>
				</div>
			{/each}
		</div>

		<div class="demo-row" style="margin-top: 24px;">
			<span class="demo-label">sizes</span>
			<div class="demo-items" style="align-items: center; gap: 16px;">
				{#each [12, 16, 20, 24, 32] as sz}
					<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
						<Icon name="shield-check" size={sz} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{sz}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">stroke width</span>
			<div class="demo-items" style="align-items: center; gap: 16px;">
				{#each [1, 1.5, 2, 2.5] as sw}
					<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
						<Icon name="network" size={22} strokeWidth={sw} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{sw}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ArmornetCrest">
		<h3 class="component-name">ArmornetCrest</h3>
		<p class="component-desc">
			The brand mark at full fidelity — outlined shield, hollowed <code class="demo-code">A</code>
			core and five struts tying the letter to the shield wall. Two-tone and self-coloured, so it
			does not belong in the
			<code class="demo-code">Icon</code>
			set; reach for <code class="demo-code">&lt;Icon name="armornet" /&gt;</code> when you need the
			single-weight version at 16–24px. Usage:
		</p>
		<p
			style="font-family: var(--mono); font-size: 0.6875rem; color: var(--fg-dim); margin-bottom: 20px;"
		>
			<code
				style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
				>&lt;ArmornetCrest size={96} /&gt;</code
			>
		</p>

		<div class="demo-row" style="align-items: flex-end;">
			<span class="demo-label">sizes</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each [24, 32, 48, 96] as sz}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrest size={sz} mesh={sz >= 48} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{sz}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">variants</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each [{ label: 'default', props: {} }, { label: 'no glow', props: { glow: false } }, { label: 'no struts', props: { mesh: false } }, { label: 'bare', props: { glow: false, mesh: false } }] as v}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrest size={72} {...v.props} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{v.label}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">colour</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each ['var(--accent, #6ee7b7)', '#e2e8f0', '#f0abfc', '#fbbf24'] as c}
					<ArmornetCrest size={64} color={c} mesh={false} />
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ArmornetCrestHub">
		<h3 class="component-name">ArmornetCrestHub</h3>
		<p class="component-desc">
			The crest cut hub-and-spoke, on the <code class="demo-code">crestlink</code> shield: a filled
			hub, spokes, and ringed satellites sitting on the five points of an
			<code class="demo-code">A</code>. The legs and bar carry the weight; the spokes and the five
			tethers into the shield wall stay hairline, so the letter never dissolves into its own
			wiring. Tethers are traced like a circuit — square or 45° off the node, one jog, an arbitrary
			landing. Usage:
		</p>
		<p
			style="font-family: var(--mono); font-size: 0.6875rem; color: var(--fg-dim); margin-bottom: 20px;"
		>
			<code
				style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
				>&lt;ArmornetCrestHub size={96} look="hollow" /&gt;</code
			>
		</p>

		<div class="demo-row" style="align-items: flex-end;">
			<span class="demo-label">look</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each ['hollow', 'weight', 'plated'] as const as l}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrestHub size={96} look={l} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{l}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">spokes</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each ['full', 'stem', 'bar'] as const as s}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrestHub size={96} spokes={s} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{s}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">tethers</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each [true, false] as t}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrestHub size={96} tethers={t} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{t ? 'bound' : 'free'}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">sizes</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each [24, 32, 48, 96] as sz}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrestHub size={sz} glow={sz >= 48} tethers={sz >= 32} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{sz}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ArmornetCrestChrome">
		<h3 class="component-name">ArmornetCrestChrome</h3>
		<p class="component-desc">
			The forged cut of the crest — milled shield frame, dark glass field, and the
			<code class="demo-code">A</code>
			extruded as chrome tubing on ball joints. This is presentation art (hero, splash, favicon
			source), not a UI icon: it carries gradients and a cast shadow, so it will not reproduce in
			one colour and it muddies below ~48px. Usage:
		</p>
		<p
			style="font-family: var(--mono); font-size: 0.6875rem; color: var(--fg-dim); margin-bottom: 20px;"
		>
			<code
				style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
				>&lt;ArmornetCrestChrome size={192} /&gt;</code
			>
		</p>

		<!-- Live rig rather than a variant grid: every prop is a control, and the
		     stage under it IS the result. -->
		<div class="crest-rig">
			<div class="crest-stage" bind:this={chromeStage}>
				<ArmornetCrestChrome
					size={chrome.size}
					glow={chrome.glow}
					bloom={chrome.bloom}
					traces={chrome.traces}
					rim={chrome.rim}
					emboss={chrome.emboss}
					tethers={chrome.tethers}
					breakout={chrome.breakout}
				/>
			</div>

			<div class="crest-ctl">
				<label class="ctl-row">
					<span class="ctl-key">size</span>
					<input type="range" min="24" max="320" step="1" bind:value={chrome.size} />
					<span class="ctl-val">{chrome.size}</span>
				</label>
				<label class="ctl-row">
					<span class="ctl-key">bloom</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.02"
						bind:value={chrome.bloom}
						disabled={!chrome.glow}
					/>
					<span class="ctl-val">{chrome.bloom.toFixed(2)}</span>
				</label>

				<label class="ctl-row">
					<span class="ctl-key">breakout</span>
					<input type="range" min="0" max="1" step="0.02" bind:value={chrome.breakout} />
					<span class="ctl-val">{chrome.breakout.toFixed(2)}</span>
				</label>

				<div class="ctl-switches">
					{#each [{ key: 'tethers', note: 'Struts tying every joint out to the shield wall.' }, { key: 'glow', note: 'Bloom behind the shield and the joints.' }, { key: 'traces', note: 'Etched circuitry in the glass. Drop below ~64px.' }, { key: 'rim', note: 'The second border floating inside the frame.' }, { key: 'emboss', note: 'Cast shadow seating the A into the glass.' }] as s}
						<div class="ctl-switch" title={s.note}>
							<Toggle
								checked={chrome[s.key as ToggleKey]}
								label={s.key}
								onchange={(v) => (chrome[s.key as ToggleKey] = v)}
							/>
							<span class="ctl-key">{s.key}</span>
						</div>
					{/each}
				</div>

				<div class="ctl-export">
					<div class="ctl-btn-row">
						<button type="button" class="ctl-btn ctl-btn--go" onclick={exportChromePng}>
							<Icon name="save" size={13} /> Download PNG
						</button>
						<div class="ctl-scale" role="group" aria-label="PNG resolution">
							{#each [1, 2, 4, 8] as s}
								<button
									type="button"
									class="ctl-chip"
									class:ctl-chip--on={chromeScale === s}
									aria-pressed={chromeScale === s}
									onclick={() => (chromeScale = s)}>{s}×</button
								>
							{/each}
						</div>
						<button type="button" class="ctl-btn" onclick={exportChromeSvg}>
							<Icon name="save" size={13} /> SVG
						</button>
					</div>
					<span class="ctl-note">
						Both export the stage as-is, on transparency — no background is painted. <strong
							>PNG {chromePx ?? ''}</strong
						>
						for Google Slides, which takes no SVG at all; it also bakes the emboss and glow filters,
						so they survive tools that would drop them. SVG for Figma, Illustrator and the web.
					</span>
				</div>

				<div class="ctl-code">
					&lt;ArmornetCrestChrome size=&#123;{chrome.size}&#125;{chrome.tethers
						? ' tethers'
						: ''}{chrome.breakout > 0
						? ` breakout={${chrome.breakout}}`
						: ''}{chrome.glow ? '' : ' glow={false}'}{chrome.glow && chrome.bloom !== 1
						? ` bloom={${chrome.bloom}}`
						: ''}{chrome.traces ? '' : ' traces={false}'}{chrome.rim
						? ''
						: ' rim={false}'}{chrome.emboss ? '' : ' emboss={false}'} /&gt;
				</div>
			</div>
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

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.icon-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 4px;
	}
	.icon-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 2px;
		color: var(--fg-dim);
		cursor: default;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}
	.icon-cell:hover {
		background: rgba(94, 234, 212, 0.05);
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.2);
	}
	.icon-label {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.03em;
		text-align: center;
		color: inherit;
		word-break: break-all;
	}

	/* ── chrome crest rig ── */
	.crest-rig {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 1.5rem;
	}
	.crest-stage {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		/* sized for the slider's 320px ceiling, so the stage never crops the mark */
		min-width: 380px;
		min-height: 380px;
		padding: 1.75rem;
		/* the mark is built for near-black; the stage says so */
		background: radial-gradient(circle at 50% 42%, #0b1218 0%, #06090d 70%);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.crest-ctl {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		flex: 1 1 260px;
		min-width: 240px;
		padding: 1rem;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		border-radius: 3px;
	}
	.ctl-row {
		display: grid;
		grid-template-columns: 4.2rem 1fr 2.6rem;
		align-items: center;
		gap: 0.6rem;
	}
	.ctl-row input[type='range'] {
		width: 100%;
		accent-color: var(--accent, #5fead5);
	}
	.ctl-row input[type='range']:disabled {
		opacity: 0.35;
	}
	.ctl-key {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ctl-val {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.ctl-switches {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: 0.55rem 0.9rem;
		margin-top: 0.35rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}
	.ctl-switch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.ctl-export {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
		margin-top: 0.35rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--border);
	}
	.ctl-btn-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.ctl-scale {
		display: flex;
	}
	.ctl-chip {
		padding: 0.3rem 0.45rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-left-width: 0;
		cursor: pointer;
	}
	.ctl-chip:first-child {
		border-left-width: 1px;
		border-radius: 2px 0 0 2px;
	}
	.ctl-chip:last-child {
		border-radius: 0 2px 2px 0;
	}
	.ctl-chip--on {
		color: var(--accent);
		background: rgba(94, 234, 212, 0.12);
		border-color: rgba(94, 234, 212, 0.4);
	}
	.ctl-chip:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.ctl-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.7rem;
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		color: var(--accent);
		background: rgba(94, 234, 212, 0.08);
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: 2px;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.ctl-btn:hover {
		background: rgba(94, 234, 212, 0.16);
		border-color: rgba(94, 234, 212, 0.55);
	}
	.ctl-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.ctl-note {
		font-size: 0.66rem;
		line-height: 1.6;
		color: var(--fg-dim);
	}
	.ctl-note strong {
		font-family: var(--mono);
		color: var(--fg-muted);
		font-weight: 400;
	}
	.ctl-btn--go {
		color: #06110f;
		background: var(--accent);
		border-color: var(--accent);
	}
	.ctl-btn--go:hover {
		background: #7cf3dd;
		border-color: #7cf3dd;
	}

	.ctl-code {
		margin-top: 0.35rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--accent);
		word-break: break-all;
	}
</style>
