<script lang="ts">
	import Icon, { type IconName } from '$lib/icons/Icon.svelte';
	import ArmornetLogo from '$lib/icons/ArmornetLogo.svelte';
	import ArmornetCrest from '$lib/icons/ArmornetCrest.svelte';
	import ArmornetCrestHub from '$lib/icons/ArmornetCrestHub.svelte';
	import ArmornetCrestChrome from '$lib/icons/ArmornetCrestChrome.svelte';
	import ArmornetCrestMesh, {
		CREST_MESH_SHAPES,
		type CrestMeshShape
	} from '$lib/icons/ArmornetCrestMesh.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import IconStudio from '$lib/icons/IconStudio.svelte';
	import type { MarkId } from '$lib/icons/icon-knobs.js';

	// The grids below are fixed cuts — the two or three variants worth SHOWING.
	// Everything a mark exposes, in any combination, plus the exports, lives in
	// the studio: one generated panel per mark rather than a rig per block that
	// only the chrome crest ever got.
	let studio = $state<MarkId | null>(null);
	let glyph = $state<IconName>('shield-check');
	// The shield the studio should open on, when the way in was a shield cell.
	let shield = $state<CrestMeshShape | undefined>(undefined);
</script>

<svelte:head>
	<title>Icons — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="Icon">
		<div class="block-head">
			<h3 class="component-name">Icon</h3>
			<button class="tune" onclick={() => (studio = 'icon')}>
				<Icon name="settings-2" size={12} /> Tune
			</button>
		</div>
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
				<!-- The cell IS the way in: clicking a glyph opens it on the studio's
				     stage, which is the only place it can be seen big. -->
				<button
					class="icon-cell"
					title="Open {n} in the studio"
					onclick={() => {
						glyph = n;
						studio = 'icon';
					}}
				>
					<Icon name={n} size={20} />
					<span class="icon-label">{n}</span>
				</button>
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

	<ShowcaseBlock component="ArmornetLogo">
		<div class="block-head">
			<h3 class="component-name">ArmornetLogo</h3>
		</div>
		<p class="component-desc">
			THE logo. Header, footer, hero, favicon — everything that means "this product" renders this
			and nothing else. It is deliberately thin: <code class="demo-code">ArmornetCrestMesh</code>
			owns the geometry and can draw twenty-six shields, and this file's whole job is to say WHICH
			ONE is the brand. Never write
			<code class="demo-code">&lt;ArmornetCrestMesh shape="crestkey" /&gt;</code> in an app — that is
			a second vote on the logo, and the next tweak only wins one of them. Usage:
		</p>
		<p
			style="font-family: var(--mono); font-size: 0.6875rem; color: var(--fg-dim); margin-bottom: 20px;"
		>
			<code
				style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
				>&lt;ArmornetLogo size={64} /&gt;</code
			>
		</p>

		<div class="demo-row" style="align-items: flex-end;">
			<span class="demo-label">sizes</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each [20, 32, 48, 96] as sz}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<!-- The hairline silts up below ~32px, which is what `innerWall`
						     is for; showing it drop out at 20 is the demo. -->
						<ArmornetLogo size={sz} innerWall={sz >= 32} glow={sz >= 32} />
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
				{#each [{ label: 'outline', props: { variant: 'outline' as const } }, { label: 'no wall', props: { innerWall: false } }, { label: 'flat', props: { glow: false } }] as v}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetLogo size={72} {...v.props} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{v.label}</span
						>
					</div>
				{/each}
				<!-- `filled` punches the figure through to whatever is behind, so it
				     only reads on a contrasting ground — demoed on one, because on the
				     page background it is a solid shield and proves nothing. -->
				<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
					<div style="background:#e2e8f0;border-radius:6px;padding:8px;display:flex;">
						<ArmornetLogo size={72} variant="filled" color="#0f172a" glow={false} />
					</div>
					<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)">filled</span
					>
				</div>
			</div>
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">colour</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px;">
				{#each ['var(--accent, #6ee7b7)', '#e2e8f0', '#f0abfc', '#fbbf24'] as c}
					<ArmornetLogo size={64} color={c} glow={false} />
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ArmornetCrest">
		<div class="block-head">
			<h3 class="component-name">ArmornetCrest</h3>
			<button class="tune" onclick={() => (studio = 'crest')}>
				<Icon name="settings-2" size={12} /> Tune
			</button>
		</div>
		<p class="component-desc">
			The brand mark at full fidelity — double shield wall, solid <code class="demo-code">A</code>
			with ring nodes punched through it, and an inner mesh from the crossbar down to the feet. It
			carries its own halo and weights, so it does not belong in the
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
				{#each [{ label: 'default', props: {} }, { label: 'no glow', props: { glow: false } }, { label: 'no mesh', props: { mesh: false } }, { label: 'bare', props: { glow: false, mesh: false } }] as v}
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
		<div class="block-head">
			<h3 class="component-name">ArmornetCrestHub</h3>
			<button class="tune" onclick={() => (studio = 'hub')}>
				<Icon name="settings-2" size={12} /> Tune
			</button>
		</div>
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

	<ShowcaseBlock component="ArmornetCrestMesh">
		<div class="block-head">
			<h3 class="component-name">ArmornetCrestMesh</h3>
			<button class="tune" onclick={() => (studio = 'mesh')}>
				<Icon name="settings-2" size={12} /> Tune
			</button>
		</div>
		<p class="component-desc">
			The crest with the console's own mesh centre inside it — the same filled hub, spokes and
			ringed satellites the Mesh screen draws for the control-plane node
			(<code class="demo-code">crestlink</code>), behind a shield wall. The wall carries the weight;
			the wall and the figure share one weight, exactly as crestlink does. crestlink's top pair is
			dropped so three dots sit centred in the field and the shield gets to be the shape; the
			three that remain keep their crestlink coordinates, and a shield too tight for the figure
			scales the whole of it rather than moving any part. Usage:
		</p>
		<p
			style="font-family: var(--mono); font-size: 0.6875rem; color: var(--fg-dim); margin-bottom: 20px;"
		>
			<code
				style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
				>&lt;ArmornetCrestMesh size={96} shape="crest" /&gt;</code
			>
		</p>

		<!-- The cell IS the way in, exactly as the glyph grid works: click a shield
		     and the studio opens on it, which is the only place it can be seen big
		     and taken apart. Twenty-nine silhouettes are not a demo row. -->
		<div class="icon-grid icon-grid--shield">
			{#each CREST_MESH_SHAPES as sh (sh)}
				<button
					class="icon-cell"
					title="Open {sh} in the studio"
					onclick={() => {
						shield = sh;
						studio = 'mesh';
					}}
				>
					<ArmornetCrestMesh size={54} shape={sh} />
					<span class="icon-label">{sh}</span>
				</button>
			{/each}
		</div>

		<div class="demo-row" style="margin-top: 24px; align-items: flex-end;">
			<span class="demo-label">filled</span>
			<div class="demo-items" style="align-items: flex-end; gap: 20px; flex-wrap: wrap;">
				{#each CREST_MESH_SHAPES.slice(0, 6) as sh (sh)}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrestMesh size={72} shape={sh} variant="filled" />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{sh}</span
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
						<ArmornetCrestMesh
							size={sz}
							glow={sz >= 48}
							innerWall={sz >= 32}
						/>
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{sz}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ArmornetCrestChrome">
		<div class="block-head">
			<h3 class="component-name">ArmornetCrestChrome</h3>
			<button class="tune" onclick={() => (studio = 'chrome')}>
				<Icon name="settings-2" size={12} /> Tune
			</button>
		</div>
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

		<div class="demo-row" style="align-items: flex-end;">
			<span class="demo-label">variants</span>
			<div class="demo-items" style="align-items: flex-end; gap: 24px;">
				{#each [{ label: 'default', props: {} }, { label: 'keyed', props: { shape: 'keyed' as const } }, { label: 'keyed · tethered', props: { shape: 'keyed' as const, tethers: true } }, { label: 'tethered', props: { tethers: true } }, { label: 'breakout', props: { breakout: 1 } }, { label: 'flat', props: { glow: false, traces: false, emboss: false } }] as v}
					<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
						<ArmornetCrestChrome size={128} {...v.props} />
						<span style="font-family:var(--mono);font-size:0.5625rem;color:var(--fg-dim)"
							>{v.label}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<p class="block-note">
			Every prop, in any combination, plus the PNG and SVG exports, is under <strong>Tune</strong>.
			The exports lift the stage as rendered, on transparency — PNG for Google Slides, which takes
			no SVG at all and would otherwise drop the emboss and glow filters; SVG for Figma,
			Illustrator and the web.
		</p>
	</ShowcaseBlock>
</div>

<IconStudio
	open={studio !== null}
	mark={studio ?? 'icon'}
	icon={glyph}
	shape={shield}
	onclose={() => (studio = null)}
/>

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
	/* Shields need more room than a 20px glyph, and a wider cell keeps the
	   silhouette — the thing being compared — from touching its own label. */
	.icon-grid--shield {
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
	}
	.icon-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 14px 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 2px;
		background: transparent;
		font: inherit;
		color: var(--fg-dim);
		cursor: pointer;
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
	.icon-cell:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.icon-label {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.03em;
		text-align: center;
		color: inherit;
		word-break: break-all;
	}

	/* ── studio hand-off ── */
	.block-head {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.tune {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.tune:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.08);
	}
	.tune:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.block-note {
		margin-top: 1.25rem;
		font-size: 0.66rem;
		line-height: 1.6;
		color: var(--fg-dim);
	}
	.block-note strong {
		font-family: var(--mono);
		font-weight: 400;
		color: var(--fg-muted);
	}
</style>
