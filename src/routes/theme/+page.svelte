<script lang="ts">
	import ThemePicker from '$lib/theme/ThemePicker.svelte';
	import AppearanceCard from '$lib/theme/AppearanceCard.svelte';
	import AdvancedSettingsPanel from '$lib/settings/AdvancedSettingsPanel.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
</script>

<svelte:head>
	<title>Theme — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="ThemePicker">
		<h3 class="component-name">ThemePicker</h3>
		<p class="component-desc">Theme selection control backed by the <code class="demo-code">theme</code> store. Place once in the app shell (typically the sidebar footer). Persists the choice to <code class="demo-code">localStorage</code>; the app shell applies <code class="demo-code">theme.resolved</code> to <code class="demo-code">&lt;html&gt;</code>. Use <code class="demo-code">Token swatches</code> below to verify every theme renders correctly.</p>
		<div class="demo-row">
			<span class="demo-label">trigger</span>
			<div class="demo-items">
				<ThemePicker />
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="AdvancedSettingsPanel">
		<h3 class="component-name">AdvancedSettingsPanel</h3>
		<p class="component-desc">Every appearance preference in one panel — palette, surface, corners, backdrop, side-nav style, motion — one group at a time behind an icon rail. This is what the cog in <code class="demo-code">ThemePicker</code> opens and what the onboarding <em>Make it yours</em> step renders, so first-run and everyday use are the same surface rather than two that drift. Selection is <code class="demo-code">StepSwitcher</code>: the chevrons nudge to the neighbouring value and the value opens the whole list. The stage above it previews the <em>real</em> thing — a live <code class="demo-code">Backdrop</code>, the actual <code class="demo-code">Flourish</code>, the exit transition the preference resolves to — so nothing here is a drawing of a setting. Pass <code class="demo-code">framed=&#123;false&#125;</code> when a popover or card already supplies the frame.</p>
		<div class="demo-row">
			<span class="demo-label">panel</span>
			<div class="demo-items">
				<AdvancedSettingsPanel />
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="AppearanceCard">
		<h3 class="component-name">AppearanceCard</h3>
		<p class="component-desc">Glass / flat switch, backed by the <code class="demo-code">appearance</code> store. The card wears <code class="demo-code">.glass</code> itself, so it is a live preview rather than a description of one — pick <code class="demo-code">Flat</code> and the card goes flat along with every other surface. Persists to <code class="demo-code">localStorage</code>; the host applies <code class="demo-code">data-appearance</code> to <code class="demo-code">&lt;html&gt;</code>, exactly as it does for the theme.</p>
		<div class="demo-row">
			<span class="demo-label">card</span>
			<div class="demo-items">
				<AppearanceCard class="w-[min(26rem,100%)]" />
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock>
		<h3 class="component-name">Corner geometry</h3>
		<p class="component-desc">Four radius tiers, set app-wide from <code class="demo-code">Advanced &rarr; Corners</code> in the picker above. Named for where a surface <em>sits</em>, not what it is called — a card and a HUD card are different tiers because they were always different radii, and unifying them by name would be a redesign, not a refactor. Reach for them as <code class="demo-code">var(--radius-surface)</code> in a <code class="demo-code">&lt;style&gt;</code> block or as the <code class="demo-code">.r-surface</code> class in markup; there is deliberately no <code class="demo-code">radius</code> prop, because a prop is how call sites drift apart. Tailwind's own <code class="demo-code">--radius-*</code> ramp is overridden alongside, so every <code class="demo-code">rounded-md</code> in both apps tracks the knob with no edit. <code class="demo-code">rounded-full</code> opts out for free — a status dot is a shape, not a corner.</p>
		<div class="token-grid">
			{#each [['--radius-hairline', 'hairline · bars, tracks'], ['--radius-inset', 'inset · rows, chips, HUD cards'], ['--radius-control', 'control · inputs, code, tabs'], ['--radius-surface', 'surface · panels, drawers, modals']] as [token, label]}
				<div class="token-swatch">
					<div
						class="h-14 w-full border border-[var(--border)] bg-[var(--surface-raised)]"
						style="border-radius: var({token})"
					></div>
					<code class="demo-code">{label}</code>
				</div>
			{/each}
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock>
		<h3 class="component-name">Token swatches</h3>
		<p class="component-desc">Design token reference — verify every theme renders correctly by switching with the <code class="demo-code">ThemePicker</code> above. Use these token names (e.g. <code class="demo-code">var(--accent)</code>, <code class="demo-code">var(--fg-dim)</code>) directly in component styles; never hardcode hex values.</p>
		<div class="token-grid">
			{#each [['--bg', 'bg'], ['--bg-elev', 'bg-elev'], ['--fg', 'fg'], ['--fg-muted', 'fg-muted'], ['--fg-dim', 'fg-dim'], ['--accent', 'accent'], ['--accent-faint', 'accent-faint'], ['--accent-faint-strong', 'accent-faint-strong'], ['--border', 'border'], ['--border-strong', 'border-strong'], ['--surface-raised', 'surface-raised'], ['--method-get-fg', 'method-get'], ['--method-post-fg', 'method-post'], ['--method-delete-fg', 'method-delete'], ['--method-patch-fg', 'method-patch']] as [token, label]}
				<div class="token-swatch">
					<div
						class="swatch-color"
						style="background: var({token}); border: 1px solid var(--border-strong)"
					></div>
					<code class="swatch-label">{label}</code>
				</div>
			{/each}
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

	.token-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.token-swatch {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.swatch-color {
		height: 36px;
		border-radius: 4px;
	}

	.swatch-label {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-dim);
		letter-spacing: 0.04em;
	}
</style>
