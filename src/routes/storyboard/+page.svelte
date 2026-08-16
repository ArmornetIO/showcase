<script lang="ts">
	import { base } from '$app/paths';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import StoryboardCanvas from '$lib/storyboard/StoryboardCanvas.svelte';
	import SwimLane from '$lib/storyboard/SwimLane.svelte';
	import StoryboardFrame from '$lib/storyboard/StoryboardFrame.svelte';
	import StoryboardArrow from '$lib/storyboard/StoryboardArrow.svelte';
	import StoryboardBranch from '$lib/storyboard/StoryboardBranch.svelte';

	// ── Frame size controls ───────────────────────────────────────────────────
	type FrameSize = 'sm' | 'md' | 'lg';
	let frameSize = $state<FrameSize>('md');

	const SIZES: Record<FrameSize, { w: number; h: number; label: string }> = {
		sm:  { w: 160, h: 110, label: 'sm  160×110' },
		md:  { w: 260, h: 180, label: 'md  260×180 (default)' },
		lg:  { w: 360, h: 240, label: 'lg  360×240' },
	};

	// ── Badge variant control ─────────────────────────────────────────────────
	type BadgeVariant = 'default' | 'red';
	let badgeVariant = $state<BadgeVariant>('default');
</script>

<svelte:head><title>Storyboard — Armornet UI</title></svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">

	<!-- ── 1. Full example ────────────────────────────────────────────────────── -->
	<ShowcaseBlock component="StoryboardCanvas SwimLane StoryboardFrame StoryboardArrow StoryboardBranch">
		<h3 class="component-name">Storyboard — full example</h3>
		<p class="component-desc">
			<code class="demo-code">StoryboardCanvas</code> is the outer scroll container.
			<code class="demo-code">SwimLane</code> defines one horizontal user path with a <code class="demo-code">pill</code> label and optional <code class="demo-code">sub</code> subtitle.
			<code class="demo-code">StoryboardFrame</code> wraps each screen thumbnail — content is scaled to 0.38× so inner HTML should use raw <code class="demo-code">px</code> values.
			<code class="demo-code">StoryboardArrow</code> connects frames; optional <code class="demo-code">label</code> describes the transition.
			<code class="demo-code">StoryboardBranch</code> hangs an alternate path (error state, skip path) below a frame.
		</p>

		<div class="demo-canvas-wrap">
			<StoryboardCanvas>
				<!-- Lane 1: happy path -->
				<SwimLane pill="HAPPY PATH" sub="Standard flow from start to completion">
					<StoryboardFrame step={1} route="/ step-one">
						<div class="mock-screen">
							<span class="mock-eyebrow">// step · one</span>
							<h2 class="mock-h2">Start <span class="mock-accent">here.</span></h2>
							<p class="mock-lede">Fill in the form below to continue.</p>
							<div class="mock-input-row"><div class="mock-input">Enter a value…</div></div>
							<div class="mock-btn mock-btn--primary">Continue →</div>
						</div>
					</StoryboardFrame>

					<StoryboardArrow label="validates input" />

					<StoryboardFrame step={2} route="/ step-two" badge="ASYNC">
						<div class="mock-screen mock-screen--center">
							<span class="mock-spinner" aria-hidden="true"></span>
							<p class="mock-processing">Processing…</p>
							<p class="mock-sub">Calling the API. This takes a moment.</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame step={3} route="/ success">
						<div class="mock-screen mock-screen--center">
							<span class="mock-check" aria-hidden="true">✓</span>
							<p class="mock-processing" style="color:#34d399">Done!</p>
							<p class="mock-sub">Your changes have been saved.</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame route="/ dashboard" dashed>
						<div class="mock-dest">
							<span class="mock-dest-logo">▣</span>
							<span class="mock-dest-name">Dashboard</span>
						</div>
					</StoryboardFrame>
				</SwimLane>

				<div class="lane-divider"></div>

				<!-- Lane 2: error branch -->
				<SwimLane pill="ERROR PATH" sub="Validation failure → inline error → retry">
					<div class="branch-col">
						<StoryboardFrame step={1} route="/ step-one" badge="INVALID">
							<div class="mock-screen">
								<span class="mock-eyebrow">// step · one</span>
								<h2 class="mock-h2">Start <span class="mock-accent">here.</span></h2>
								<p class="mock-lede">Fill in the form below to continue.</p>
								<div class="mock-input-row mock-input-row--error">
									<div class="mock-input mock-input--error">bad value!</div>
									<span class="mock-error-msg">This field is required.</span>
								</div>
								<div class="mock-btn mock-btn--primary mock-btn--disabled">Continue →</div>
							</div>
						</StoryboardFrame>

						<StoryboardBranch label="server error (500)">
							<StoryboardFrame
								route="/ step-one"
								badge="500"
								badgeVariant="red"
								width={200}
								height={120}
							>
								<div class="mock-screen mock-screen--center">
									<span class="mock-error-icon">!</span>
									<p class="mock-error-title">Something went wrong</p>
									<p class="mock-sub">Try again or contact support.</p>
								</div>
							</StoryboardFrame>
						</StoryboardBranch>
					</div>

					<StoryboardArrow label="user fixes & resubmits" />

					<StoryboardFrame step={2} route="/ step-two" badge="RETRY">
						<div class="mock-screen mock-screen--center">
							<span class="mock-spinner" aria-hidden="true"></span>
							<p class="mock-processing">Processing…</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame step={3} route="/ success">
						<div class="mock-screen mock-screen--center">
							<span class="mock-check" aria-hidden="true">✓</span>
							<p class="mock-processing" style="color:#34d399">Done!</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame route="/ dashboard" dashed>
						<div class="mock-dest">
							<span class="mock-dest-logo">▣</span>
							<span class="mock-dest-name">Dashboard</span>
						</div>
					</StoryboardFrame>
				</SwimLane>
			</StoryboardCanvas>
		</div>
	</ShowcaseBlock>

	<!-- ── 2. StoryboardFrame variants ──────────────────────────────────────── -->
	<ShowcaseBlock component="StoryboardFrame">
		<h3 class="component-name">StoryboardFrame</h3>
		<p class="component-desc">
			Wraps a screen thumbnail. Key props: <code class="demo-code">step</code> (circled numeral overlay),
			<code class="demo-code">badge</code> + <code class="demo-code">badgeVariant</code> (status chip, default teal or red),
			<code class="demo-code">dashed</code> (destination placeholder style),
			<code class="demo-code">href</code> (makes the frame a clickable link to the live mockup),
			<code class="demo-code">width</code> / <code class="demo-code">height</code> (outer px — inner content scales to fit at 0.38×).
		</p>

		<!-- Size + badge controls -->
		<div class="blade-ctrl">
			<div class="bc-group">
				<span class="bc-label">SIZE</span>
				<div class="bc-btns">
					{#each (['sm', 'md', 'lg'] as FrameSize[]) as s}
						<button
							class="bc-btn"
							class:bc-active={frameSize === s}
							onclick={() => (frameSize = s)}
						>{s}</button>
					{/each}
				</div>
			</div>
			<span class="bc-sep"></span>
			<div class="bc-group">
				<span class="bc-label">BADGE</span>
				<div class="bc-btns">
					{#each (['default', 'red'] as BadgeVariant[]) as v}
						<button
							class="bc-btn"
							class:bc-active={badgeVariant === v}
							onclick={() => (badgeVariant = v)}
						>{v}</button>
					{/each}
				</div>
			</div>
			<span class="bc-sep"></span>
			<span class="bc-hint">{SIZES[frameSize].label}</span>
		</div>

		<div class="frame-row">
			<!-- No step, no badge -->
			<div class="frame-demo-item">
				<StoryboardFrame
					route="/ plain"
					width={SIZES[frameSize].w}
					height={SIZES[frameSize].h}
				>
					<div class="mock-screen mock-screen--center">
						<p class="mock-processing">Plain frame</p>
					</div>
				</StoryboardFrame>
				<span class="frame-demo-label">no step · no badge</span>
			</div>

			<!-- With step -->
			<div class="frame-demo-item">
				<StoryboardFrame
					step={1}
					route="/ with-step"
					width={SIZES[frameSize].w}
					height={SIZES[frameSize].h}
				>
					<div class="mock-screen mock-screen--center">
						<p class="mock-processing">Step ①</p>
					</div>
				</StoryboardFrame>
				<span class="frame-demo-label">step={1}</span>
			</div>

			<!-- With badge -->
			<div class="frame-demo-item">
				<StoryboardFrame
					step={2}
					badge="FIRST RUN"
					{badgeVariant}
					route="/ with-badge"
					width={SIZES[frameSize].w}
					height={SIZES[frameSize].h}
				>
					<div class="mock-screen mock-screen--center">
						<p class="mock-processing">With badge</p>
					</div>
				</StoryboardFrame>
				<span class="frame-demo-label">badge · badgeVariant="{badgeVariant}"</span>
			</div>

			<!-- Dashed (destination) -->
			<div class="frame-demo-item">
				<StoryboardFrame
					route="/ destination"
					dashed
					width={SIZES[frameSize].w}
					height={SIZES[frameSize].h}
				>
					<div class="mock-dest">
						<span class="mock-dest-logo">▣</span>
						<span class="mock-dest-name">Destination</span>
					</div>
				</StoryboardFrame>
				<span class="frame-demo-label">dashed (placeholder)</span>
			</div>

			<!-- Clickable (href) -->
			<div class="frame-demo-item">
				<StoryboardFrame
					step={3}
					route="/ linked"
					href="{base}/mockups/auth-flows"
					width={SIZES[frameSize].w}
					height={SIZES[frameSize].h}
				>
					<div class="mock-screen mock-screen--center">
						<p class="mock-processing" style="font-size:18px">↗ clickable</p>
						<p class="mock-sub">hover to see border</p>
					</div>
				</StoryboardFrame>
				<span class="frame-demo-label">href (links to live mockup)</span>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ── 3. StoryboardArrow variants ──────────────────────────────────────── -->
	<ShowcaseBlock component="StoryboardArrow">
		<h3 class="component-name">StoryboardArrow</h3>
		<p class="component-desc">
			Horizontal connector between frames. No props = bare arrow. <code class="demo-code">label</code>
			adds a two-line caption beneath. <code class="demo-code">tall</code> shifts the arrow down to
			align with the main frame when used next to a <code class="demo-code">StoryboardBranch</code> column.
		</p>

		<div class="arrow-demo-row">
			<div class="arrow-demo-item">
				<div class="arrow-demo-frames">
					<StoryboardFrame route="/ a" width={120} height={80}>
						<div class="mock-screen mock-screen--center"><p class="mock-processing" style="font-size:16px">A</p></div>
					</StoryboardFrame>
					<StoryboardArrow />
					<StoryboardFrame route="/ b" width={120} height={80}>
						<div class="mock-screen mock-screen--center"><p class="mock-processing" style="font-size:16px">B</p></div>
					</StoryboardFrame>
				</div>
				<span class="frame-demo-label">plain (no label)</span>
			</div>

			<div class="arrow-demo-item">
				<div class="arrow-demo-frames">
					<StoryboardFrame route="/ a" width={120} height={80}>
						<div class="mock-screen mock-screen--center"><p class="mock-processing" style="font-size:16px">A</p></div>
					</StoryboardFrame>
					<StoryboardArrow label={"redirects to\nOAuth provider"} />
					<StoryboardFrame route="/ b" width={120} height={80}>
						<div class="mock-screen mock-screen--center"><p class="mock-processing" style="font-size:16px">B</p></div>
					</StoryboardFrame>
				</div>
				<span class="frame-demo-label">label (multiline with \n)</span>
			</div>

			<div class="arrow-demo-item">
				<div class="arrow-demo-frames">
					<div class="branch-col-demo">
						<StoryboardFrame route="/ a" width={120} height={80}>
							<div class="mock-screen mock-screen--center"><p class="mock-processing" style="font-size:16px">A</p></div>
						</StoryboardFrame>
						<StoryboardBranch label="error path">
							<StoryboardFrame route="/ err" badgeVariant="red" badge="ERR" width={120} height={60}>
								<div class="mock-screen mock-screen--center"><p class="mock-error-title" style="font-size:18px">Error</p></div>
							</StoryboardFrame>
						</StoryboardBranch>
					</div>
					<StoryboardArrow tall />
					<StoryboardFrame route="/ b" width={120} height={80}>
						<div class="mock-screen mock-screen--center"><p class="mock-processing" style="font-size:16px">B</p></div>
					</StoryboardFrame>
				</div>
				<span class="frame-demo-label">tall (aligns past a Branch)</span>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ── 4. StoryboardBranch ───────────────────────────────────────────────── -->
	<ShowcaseBlock component="StoryboardBranch">
		<h3 class="component-name">StoryboardBranch</h3>
		<p class="component-desc">
			Hangs an alternate frame below a main frame — expired states, error states, optional paths.
			<code class="demo-code">label</code> captions the branch.
			Wrap the main frame + branch in a flex column so the arrow after it aligns to the main frame row.
			Use <code class="demo-code">StoryboardArrow tall</code> on the arrow that follows.
		</p>

		<div class="branch-demo-wrap">
			<StoryboardCanvas>
				<SwimLane pill="BRANCH DEMO" sub="Main path with one alternate branch">
					<div class="branch-col">
						<StoryboardFrame step={1} route="/ invite" badge="VALID">
							<div class="mock-screen mock-screen--center">
								<p class="mock-processing">Valid invite</p>
								<div class="mock-btn mock-btn--primary" style="margin-top:30px;width:220px">Accept →</div>
							</div>
						</StoryboardFrame>
						<StoryboardBranch label="token expired">
							<StoryboardFrame route="/ invite" badge="EXPIRED" badgeVariant="red" width={220} height={130}>
								<div class="mock-screen mock-screen--center">
									<span class="mock-error-icon">!</span>
									<p class="mock-error-title">Invite expired</p>
									<p class="mock-sub">Ask admin to resend.</p>
								</div>
							</StoryboardFrame>
						</StoryboardBranch>
					</div>

					<StoryboardArrow label="accept → redirect" tall />

					<StoryboardFrame step={2} route="/ callback">
						<div class="mock-screen mock-screen--center">
							<span class="mock-spinner" aria-hidden="true"></span>
							<p class="mock-processing">Signing in…</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame route="/ console" dashed>
						<div class="mock-dest">
							<span class="mock-dest-logo">▣</span>
							<span class="mock-dest-name">Console</span>
						</div>
					</StoryboardFrame>
				</SwimLane>
			</StoryboardCanvas>
		</div>
	</ShowcaseBlock>

	<!-- ── 5. SwimLane footer snippet ───────────────────────────────────────── -->
	<ShowcaseBlock component="SwimLane">
		<h3 class="component-name">SwimLane — footer snippet</h3>
		<p class="component-desc">
			<code class="demo-code">SwimLane</code> accepts an optional <code class="demo-code">footer</code>
			snippet for contextual links or notes rendered below the lane's step row.
		</p>

		<div class="demo-canvas-wrap">
			<StoryboardCanvas>
				<SwimLane pill="WITH FOOTER" sub="Lane with a contextual footer link">
					{#snippet footer()}
						<a href="{base}/mockups/auth-flows" class="footer-link">→ view full auth flows mockup</a>
					{/snippet}

					<StoryboardFrame step={1} route="/ page-a" width={200} height={140}>
						<div class="mock-screen mock-screen--center">
							<p class="mock-processing">Page A</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame step={2} route="/ page-b" width={200} height={140}>
						<div class="mock-screen mock-screen--center">
							<p class="mock-processing">Page B</p>
						</div>
					</StoryboardFrame>

					<StoryboardArrow />

					<StoryboardFrame route="/ end" dashed width={200} height={140}>
						<div class="mock-dest">
							<span class="mock-dest-logo">▣</span>
							<span class="mock-dest-name">End</span>
						</div>
					</StoryboardFrame>
				</SwimLane>
			</StoryboardCanvas>
		</div>
	</ShowcaseBlock>

</div>

<style>
	/* ── Demo canvas wrap (contained scroll) ─────────────────────────────────── */
	.demo-canvas-wrap {
		margin-top: 14px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow-x: auto;
		background: var(--bg);
	}

	/* ── Frame row (for frame variant demo) ──────────────────────────────────── */
	.frame-row {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		margin-top: 1rem;
		align-items: flex-end;
	}

	.frame-demo-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.frame-demo-label {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
		letter-spacing: 0.06em;
	}

	/* ── Arrow demo ──────────────────────────────────────────────────────────── */
	.arrow-demo-row {
		display: flex;
		flex-wrap: wrap;
		gap: 2.5rem;
		margin-top: 1rem;
		align-items: flex-start;
	}

	.arrow-demo-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.arrow-demo-frames {
		display: flex;
		align-items: center;
	}

	.branch-col-demo {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		flex-shrink: 0;
	}

	/* ── Branch demo wrap ────────────────────────────────────────────────────── */
	.branch-demo-wrap {
		margin-top: 14px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow-x: auto;
		background: var(--bg);
	}

	/* ── Branch column (frame + branch stacked) ──────────────────────────────── */
	.branch-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		flex-shrink: 0;
	}

	/* ── Lane divider ────────────────────────────────────────────────────────── */
	.lane-divider {
		height: 1px;
		background: var(--border);
	}

	/* ── Footer link ─────────────────────────────────────────────────────────── */
	.footer-link {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		text-decoration: none;
		padding-left: 1rem;
	}

	.footer-link:hover {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* ── Blade controls ──────────────────────────────────────────────────────── */
	.blade-ctrl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 12px 0 4px;
		padding: 10px 12px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.bc-group  { display: flex; align-items: center; gap: 6px; }
	.bc-btns   { display: flex; gap: 3px; }
	.bc-label  { font-family: var(--mono); font-size: 0.5rem; letter-spacing: 0.15em; color: var(--fg-dim); }
	.bc-sep    { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }
	.bc-hint   { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-dim); }

	.bc-btn {
		height: 26px;
		padding: 0 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.bc-btn:hover    { border-color: var(--accent); color: var(--accent); }
	.bc-btn.bc-active { border-color: var(--accent); color: var(--accent); background: var(--accent-faint); }

	/* ── Mini mock-screen content (renders at 0.38× inside frames) ───────────── */
	.mock-screen {
		padding: 32px 40px;
		background: var(--bg);
		min-height: 474px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.mock-screen--center {
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.mock-eyebrow {
		font-family: monospace;
		font-size: 13px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.mock-h2 {
		font-size: 38px;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.1;
		margin: 0;
	}

	.mock-accent { color: var(--accent); }

	.mock-lede {
		font-size: 16px;
		color: var(--fg-dim);
		margin: 0;
	}

	.mock-input-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mock-input-row--error .mock-input { border-color: rgba(248,113,113,0.6); }

	.mock-input {
		height: 46px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		font-size: 18px;
		color: var(--fg-muted);
	}

	.mock-input--error { color: #f87171; }

	.mock-error-msg {
		font-size: 13px;
		color: #f87171;
	}

	.mock-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		border-radius: 4px;
		font-size: 15px;
		font-weight: 700;
		font-family: monospace;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.mock-btn--primary { background: var(--accent); color: var(--bg); }
	.mock-btn--disabled { opacity: 0.4; }

	.mock-processing {
		font-size: 22px;
		font-weight: 600;
		color: var(--fg-muted);
		margin: 0;
	}

	.mock-sub {
		font-size: 14px;
		color: var(--fg-dim);
		margin: 0;
	}

	.mock-spinner {
		width: 32px;
		height: 32px;
		border: 2px solid rgba(94,234,212,0.25);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.mock-check {
		font-size: 40px;
		color: #34d399;
		line-height: 1;
	}

	.mock-error-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(248,113,113,0.08);
		border: 1px solid rgba(248,113,113,0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		font-weight: 700;
		color: #f87171;
	}

	.mock-error-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--fg);
		margin: 0;
	}

	.mock-dest {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}

	.mock-dest-logo {
		font-size: 40px;
		color: var(--accent);
		opacity: 0.45;
	}

	.mock-dest-name {
		font-size: 13px;
		font-weight: 700;
		font-family: monospace;
		color: var(--fg-dim);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	@keyframes spin { to { transform: rotate(360deg); } }
</style>
