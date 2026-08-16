<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';

	// ── Data shapes ─────────────────────────────────────────────
	// nav_item: { id: string; label: string; icon: IconName }
	// Each variant keeps its own `active` index and a per-item `burst`
	// counter so re-clicking replays the particle animation.

	interface NavItem {
		id: string;
		label: string;
		icon: IconName;
	}

	const ITEMS: NavItem[] = [
		{ id: 'exposure', label: 'Exposure', icon: 'bar-chart-2' },
		{ id: 'mesh', label: 'Agent Mesh', icon: 'mesh' },
		{ id: 'relays', label: 'Relays', icon: 'shield' },
		{ id: 'instrument', label: 'Instrument', icon: 'radar' },
		{ id: 'network', label: 'Network', icon: 'network' },
		{ id: 'docs', label: 'Docs', icon: 'file-text' }
	];

	// Independent active state per demo strip.
	let activeGrow = $state(1);
	let activeCapsule = $state(1);
	let activeStack = $state(1);
	let activeSpark = $state(1);
	let activeFirework = $state(1);
	let activeShimmer = $state(1);
	let activeAurora = $state(1);
	let activeRipple = $state(1);

	// Burst counters keyed by "variant:index" so {#key} remounts the
	// particle layer and the CSS animation restarts on every click.
	let bursts = $state<Record<string, number>>({});
	function burst(key: string) {
		bursts[key] = (bursts[key] ?? 0) + 1;
	}

	// Deterministic sparkle field (no Math.random at module scope —
	// keeps SSR/HMR stable and the layout reproducible).
	const SPARKS = Array.from({ length: 7 }, (_, i) => {
		const a = (i / 7) * Math.PI * 2 + 0.6;
		const r = 20 + (i % 3) * 7;
		return {
			tx: Math.cos(a) * r,
			ty: Math.sin(a) * r,
			d: (i % 4) * 40,
			s: 0.7 + (i % 3) * 0.2
		};
	});

	const FIREWORKS = Array.from({ length: 12 }, (_, i) => {
		const a = (i / 12) * Math.PI * 2;
		const r = 30 + (i % 2) * 10;
		return { tx: Math.cos(a) * r, ty: Math.sin(a) * r, d: (i % 3) * 30 };
	});
</script>

<div class="page">
	<header class="head">
		<div class="kicker">Motion Study</div>
		<h1>Side Nav — Premium Interactions</h1>
		<p class="lede">
			Eight takes on making nav selection <em>feel</em> like something. Left column explores the
			collapsed rail (icon blooms taller, label slides in underneath). Right column explores the
			expanded rail (sparkle, firework &amp; shimmer flourishes). Click any item — re-click to replay.
		</p>
	</header>

	<div class="grid">
		<!-- ══════════════ COLLAPSED / GROW ══════════════ -->
		<section class="col">
			<div class="col-head">
				<span class="dot"></span> Collapsed rail — bloom &amp; label reveal
			</div>

			<!-- V1 · Pillow Bloom -->
			<article class="card">
				<div class="card-meta">
					<span class="name">01 · Pillow Bloom</span>
					<span class="desc">Active icon springs taller, label fades up underneath</span>
				</div>
				<div class="rail rail-collapsed">
					{#each ITEMS as item, i (item.id)}
						<button
							class="cell grow-cell"
							class:on={activeGrow === i}
							onclick={() => (activeGrow = i)}
						>
							<span class="cell-ico"><Icon name={item.icon} size={17} strokeWidth={1.75} /></span>
							<span class="cell-lbl">{item.label}</span>
						</button>
					{/each}
				</div>
			</article>

			<!-- V2 · Capsule Expand -->
			<article class="card">
				<div class="card-meta">
					<span class="name">02 · Capsule Expand</span>
					<span class="desc">Pill morphs into a rounded capsule holding icon + label</span>
				</div>
				<div class="rail rail-collapsed">
					{#each ITEMS as item, i (item.id)}
						<button
							class="cell capsule-cell"
							class:on={activeCapsule === i}
							onclick={() => (activeCapsule = i)}
						>
							<span class="cap-fill"></span>
							<span class="cell-ico"><Icon name={item.icon} size={17} strokeWidth={1.75} /></span>
							<span class="cell-lbl">{item.label}</span>
						</button>
					{/each}
				</div>
			</article>

			<!-- V3 · Lift & Stack -->
			<article class="card">
				<div class="card-meta">
					<span class="name">03 · Lift &amp; Stack</span>
					<span class="desc">Icon lifts on a magnetic ease, label stacks in from below</span>
				</div>
				<div class="rail rail-collapsed">
					{#each ITEMS as item, i (item.id)}
						<button
							class="cell stack-cell"
							class:on={activeStack === i}
							onclick={() => (activeStack = i)}
						>
							<span class="cell-ico"><Icon name={item.icon} size={17} strokeWidth={1.75} /></span>
							<span class="cell-lbl">{item.label}</span>
							<span class="stack-glow"></span>
						</button>
					{/each}
				</div>
			</article>

			<!-- V4 · Ripple Rail -->
			<article class="card">
				<div class="card-meta">
					<span class="name">04 · Ripple Rail</span>
					<span class="desc">Selection ripples outward while the label unfurls</span>
				</div>
				<div class="rail rail-collapsed">
					{#each ITEMS as item, i (item.id)}
						<button
							class="cell ripple-cell"
							class:on={activeRipple === i}
							onclick={() => {
								activeRipple = i;
								burst(`ripple:${i}`);
							}}
						>
							{#key bursts[`ripple:${i}`]}
								{#if activeRipple === i}
									<span class="ripple-ring"></span>
								{/if}
							{/key}
							<span class="cell-ico"><Icon name={item.icon} size={17} strokeWidth={1.75} /></span>
							<span class="cell-lbl">{item.label}</span>
						</button>
					{/each}
				</div>
			</article>
		</section>

		<!-- ══════════════ EXPANDED / FLOURISH ══════════════ -->
		<section class="col">
			<div class="col-head">
				<span class="dot dot-2"></span> Expanded rail — sparkle &amp; firework flourishes
			</div>

			<!-- V5 · Sparkle Burst -->
			<article class="card">
				<div class="card-meta">
					<span class="name">05 · Sparkle Burst</span>
					<span class="desc">Tiny four-point stars scatter from the icon</span>
				</div>
				<div class="rail rail-expanded">
					{#each ITEMS as item, i (item.id)}
						<button
							class="row"
							class:on={activeSpark === i}
							onclick={() => {
								activeSpark = i;
								burst(`spark:${i}`);
							}}
						>
							<span class="row-ico">
								<Icon name={item.icon} size={16} strokeWidth={1.75} />
								{#key bursts[`spark:${i}`]}
									{#if activeSpark === i}
										<span class="spark-field">
											{#each SPARKS as p (p.tx)}
												<span
													class="spark"
													style="--tx:{p.tx}px; --ty:{p.ty}px; --d:{p.d}ms; --s:{p.s}"
												></span>
											{/each}
										</span>
									{/if}
								{/key}
							</span>
							<span class="row-lbl">{item.label}</span>
						</button>
					{/each}
				</div>
			</article>

			<!-- V6 · Firework Pop -->
			<article class="card">
				<div class="card-meta">
					<span class="name">06 · Firework Pop</span>
					<span class="desc">Radial firework detonates behind the row</span>
				</div>
				<div class="rail rail-expanded">
					{#each ITEMS as item, i (item.id)}
						<button
							class="row"
							class:on={activeFirework === i}
							onclick={() => {
								activeFirework = i;
								burst(`fw:${i}`);
							}}
						>
							<span class="row-ico">
								<Icon name={item.icon} size={16} strokeWidth={1.75} />
								{#key bursts[`fw:${i}`]}
									{#if activeFirework === i}
										<span class="fw-field">
											<span class="fw-flash"></span>
											{#each FIREWORKS as p, k (k)}
												<span class="fw-spark" style="--tx:{p.tx}px; --ty:{p.ty}px; --d:{p.d}ms"
												></span>
											{/each}
										</span>
									{/if}
								{/key}
							</span>
							<span class="row-lbl">{item.label}</span>
						</button>
					{/each}
				</div>
			</article>

			<!-- V7 · Shimmer Sweep -->
			<article class="card">
				<div class="card-meta">
					<span class="name">07 · Shimmer Sweep</span>
					<span class="desc">A light glances across the row, leaving a trail of stars</span>
				</div>
				<div class="rail rail-expanded">
					{#each ITEMS as item, i (item.id)}
						<button
							class="row row-shimmer"
							class:on={activeShimmer === i}
							onclick={() => {
								activeShimmer = i;
								burst(`sh:${i}`);
							}}
						>
							{#key bursts[`sh:${i}`]}
								{#if activeShimmer === i}
									<span class="shimmer"></span>
								{/if}
							{/key}
							<span class="row-ico"><Icon name={item.icon} size={16} strokeWidth={1.75} /></span>
							<span class="row-lbl">{item.label}</span>
							{#key bursts[`sh:${i}`]}
								{#if activeShimmer === i}
									<span class="shimmer-stars">
										<i style="--x:34px"></i><i style="--x:58px"></i><i style="--x:82px"></i>
									</span>
								{/if}
							{/key}
						</button>
					{/each}
				</div>
			</article>

			<!-- V8 · Aurora Glow -->
			<article class="card">
				<div class="card-meta">
					<span class="name">08 · Aurora Glow</span>
					<span class="desc">Soft glow breathes up with two orbiting sparks</span>
				</div>
				<div class="rail rail-expanded">
					{#each ITEMS as item, i (item.id)}
						<button
							class="row row-aurora"
							class:on={activeAurora === i}
							onclick={() => {
								activeAurora = i;
								burst(`au:${i}`);
							}}
						>
							<span class="aurora-wash"></span>
							<span class="row-ico"><Icon name={item.icon} size={16} strokeWidth={1.75} /></span>
							<span class="row-lbl">{item.label}</span>
							{#key bursts[`au:${i}`]}
								{#if activeAurora === i}
									<span class="orbit"><i></i><i></i></span>
								{/if}
							{/key}
						</button>
					{/each}
				</div>
			</article>
		</section>
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		padding: 3rem clamp(1rem, 4vw, 3.5rem) 5rem;
		background:
			radial-gradient(1100px 620px at 12% -8%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 60%),
			radial-gradient(900px 560px at 92% 0%, color-mix(in oklab, #a78bfa 12%, transparent), transparent 55%),
			var(--bg, #0a0b0f);
		color: var(--fg);
		font-family: var(--font-sans, ui-sans-serif, system-ui);
	}

	.head {
		max-width: 780px;
		margin-bottom: 2.75rem;
	}
	.kicker {
		font-family: var(--font-mono, ui-monospace);
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 0.75rem;
	}
	.head h1 {
		font-size: clamp(1.7rem, 3.4vw, 2.5rem);
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0 0 0.85rem;
	}
	.lede {
		color: var(--fg-muted);
		line-height: 1.65;
		font-size: 0.95rem;
		margin: 0;
	}
	.lede em {
		color: var(--fg);
		font-style: italic;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.75rem;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.col {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.col-head {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-family: var(--font-mono, ui-monospace);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-muted);
		padding-left: 0.15rem;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 12px var(--accent);
	}
	.dot-2 {
		background: #c4b5fd;
		box-shadow: 0 0 12px #c4b5fd;
	}

	/* ── Card chrome ─────────────────────────────── */
	.card {
		border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
		border-radius: 16px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
			var(--surface, rgba(255, 255, 255, 0.015));
		padding: 1.1rem 1.1rem 1.35rem;
		backdrop-filter: blur(6px);
	}
	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-bottom: 1rem;
	}
	.name {
		font-family: var(--font-mono, ui-monospace);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--fg);
	}
	.desc {
		font-size: 0.75rem;
		color: var(--fg-dim, rgba(255, 255, 255, 0.4));
		line-height: 1.4;
	}

	/* ── Collapsed rail ─────────────────────────────── */
	.rail-collapsed {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.4rem;
		padding: 0.6rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.04);
	}
	.cell {
		position: relative;
		width: 48px;
		height: 48px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		overflow: hidden;
	}
	.cell-ico {
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.cell-lbl {
		z-index: 2;
		font-family: var(--font-mono, ui-monospace);
		font-size: 0.5rem;
		letter-spacing: 0.02em;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0;
		max-height: 0;
		transform: translateY(6px);
		transition:
			opacity 0.3s ease 0.06s,
			transform 0.36s cubic-bezier(0.34, 1.56, 0.64, 1) 0.04s,
			max-height 0.36s ease;
	}
	.cell:hover {
		color: var(--fg);
		background: rgba(255, 255, 255, 0.04);
	}

	/* V1 Pillow Bloom */
	.grow-cell.on {
		width: 56px;
		height: 68px;
		color: var(--accent);
		background: color-mix(in oklab, var(--accent) 14%, transparent);
		box-shadow:
			0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent) inset,
			0 8px 22px -10px color-mix(in oklab, var(--accent) 60%, transparent);
		transition:
			width 0.42s cubic-bezier(0.34, 1.56, 0.64, 1),
			height 0.42s cubic-bezier(0.34, 1.56, 0.64, 1),
			background 0.3s ease;
	}
	.grow-cell.on .cell-ico {
		transform: translateY(-4px) scale(1.08);
	}
	.grow-cell.on .cell-lbl {
		opacity: 1;
		max-height: 1.5em;
		transform: translateY(0);
	}

	/* V2 Capsule Expand */
	.capsule-cell.on {
		width: 56px;
		height: 70px;
		color: var(--accent);
	}
	.cap-fill {
		position: absolute;
		inset: auto 0 0;
		height: 100%;
		border-radius: 14px;
		background: color-mix(in oklab, var(--accent) 16%, transparent);
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 34%, transparent) inset;
		transform: scaleY(0.68);
		transform-origin: center;
		opacity: 0;
		transition: transform 0.44s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.24s ease;
	}
	.capsule-cell.on .cap-fill {
		transform: scaleY(1);
		opacity: 1;
	}
	.capsule-cell.on .cell-ico {
		transform: translateY(-3px);
	}
	.capsule-cell.on .cell-lbl {
		opacity: 1;
		max-height: 1.5em;
		transform: translateY(0);
	}

	/* V3 Lift & Stack */
	.stack-cell.on {
		width: 56px;
		height: 72px;
		color: var(--accent);
	}
	.stack-glow {
		position: absolute;
		top: 8px;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent), transparent 70%);
		opacity: 0;
		transform: scale(0.4);
		transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
		z-index: 1;
	}
	.stack-cell.on .stack-glow {
		opacity: 0.9;
		transform: scale(1);
	}
	.stack-cell.on .cell-ico {
		transform: translateY(-8px) scale(1.12);
	}
	.stack-cell.on .cell-lbl {
		opacity: 1;
		max-height: 1.5em;
		transform: translateY(-4px);
	}

	/* V4 Ripple Rail */
	.ripple-cell.on {
		width: 56px;
		height: 68px;
		color: var(--accent);
		background: color-mix(in oklab, var(--accent) 12%, transparent);
	}
	.ripple-cell.on .cell-ico {
		transform: translateY(-4px) scale(1.06);
	}
	.ripple-cell.on .cell-lbl {
		opacity: 1;
		max-height: 1.5em;
		transform: translateY(0);
	}
	.ripple-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--accent);
		transform: translate(-50%, -50%) scale(0.3);
		opacity: 0.9;
		z-index: 1;
		animation: ripple 0.7s ease-out forwards;
	}
	@keyframes ripple {
		to {
			transform: translate(-50%, -50%) scale(3.4);
			opacity: 0;
		}
	}

	/* ── Expanded rail ─────────────────────────────── */
	.rail-expanded {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.6rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.04);
		width: 210px;
	}
	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		text-align: left;
		overflow: visible;
		transition: color 0.2s ease, background 0.2s ease;
	}
	.row:hover {
		color: var(--fg);
		background: rgba(255, 255, 255, 0.04);
	}
	.row.on {
		color: var(--accent);
		background: color-mix(in oklab, var(--accent) 12%, transparent);
	}
	.row-ico {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
	}
	.row-lbl {
		font-family: var(--font-mono, ui-monospace);
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		position: relative;
		z-index: 2;
	}

	/* V5 Sparkle Burst */
	.spark-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 5;
	}
	.spark {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 6px;
		height: 6px;
		margin: -3px;
		background: radial-gradient(circle, #fff, color-mix(in oklab, var(--accent) 80%, #fff) 60%, transparent 72%);
		/* four-point star */
		clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
		transform: translate(0, 0) scale(0);
		opacity: 0;
		animation: spark 0.72s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
		animation-delay: var(--d);
	}
	@keyframes spark {
		0% {
			transform: translate(0, 0) scale(0) rotate(0deg);
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		60% {
			transform: translate(var(--tx), var(--ty)) scale(var(--s)) rotate(60deg);
			opacity: 1;
		}
		100% {
			transform: translate(calc(var(--tx) * 1.25), calc(var(--ty) * 1.25)) scale(0) rotate(120deg);
			opacity: 0;
		}
	}

	/* V6 Firework Pop */
	.fw-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 5;
	}
	.fw-flash {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 26px;
		height: 26px;
		margin: -13px;
		border-radius: 50%;
		background: radial-gradient(circle, #fff, color-mix(in oklab, var(--accent) 70%, transparent) 45%, transparent 70%);
		transform: scale(0);
		opacity: 0.9;
		animation: fwFlash 0.5s ease-out forwards;
	}
	@keyframes fwFlash {
		0% {
			transform: scale(0);
			opacity: 0.95;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}
	.fw-spark {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 3px;
		height: 3px;
		margin: -1.5px;
		border-radius: 50%;
		background: color-mix(in oklab, var(--accent) 60%, #fff);
		box-shadow: 0 0 6px color-mix(in oklab, var(--accent) 80%, #fff);
		transform: translate(0, 0);
		opacity: 0;
		animation: fwSpark 0.8s cubic-bezier(0.15, 0.75, 0.25, 1) forwards;
		animation-delay: var(--d);
	}
	@keyframes fwSpark {
		0% {
			transform: translate(0, 0) scale(1);
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		100% {
			transform: translate(var(--tx), var(--ty)) scale(0.4);
			opacity: 0;
		}
	}

	/* V7 Shimmer Sweep */
	.row-shimmer {
		overflow: hidden;
	}
	.shimmer {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		background: linear-gradient(
			100deg,
			transparent 20%,
			rgba(255, 255, 255, 0.55) 48%,
			color-mix(in oklab, var(--accent) 60%, #fff) 52%,
			transparent 80%
		);
		mix-blend-mode: screen;
		transform: translateX(-120%);
		animation: shimmer 0.85s cubic-bezier(0.3, 0, 0.2, 1) forwards;
	}
	@keyframes shimmer {
		to {
			transform: translateX(120%);
		}
	}
	.shimmer-stars {
		position: absolute;
		inset: 0;
		z-index: 4;
		pointer-events: none;
	}
	.shimmer-stars i {
		position: absolute;
		top: 50%;
		left: var(--x);
		width: 5px;
		height: 5px;
		margin: -2.5px 0 0 -2.5px;
		background: #fff;
		clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
		opacity: 0;
		transform: scale(0);
		animation: twinkle 0.7s ease-out forwards;
	}
	.shimmer-stars i:nth-child(2) {
		animation-delay: 0.12s;
	}
	.shimmer-stars i:nth-child(3) {
		animation-delay: 0.22s;
	}
	@keyframes twinkle {
		0% {
			opacity: 0;
			transform: scale(0) rotate(0);
		}
		45% {
			opacity: 1;
			transform: scale(1.1) rotate(35deg);
		}
		100% {
			opacity: 0;
			transform: scale(0) rotate(70deg);
		}
	}

	/* V8 Aurora Glow */
	.row-aurora {
		overflow: hidden;
	}
	.aurora-wash {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: 10px;
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--accent) 22%, transparent),
			color-mix(in oklab, #a78bfa 22%, transparent),
			color-mix(in oklab, var(--accent) 22%, transparent)
		);
		background-size: 200% 100%;
		opacity: 0;
		transform: translateY(60%);
		transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
	}
	.row-aurora.on .aurora-wash {
		opacity: 1;
		transform: translateY(0);
		animation: auroraDrift 3.5s ease-in-out infinite;
	}
	@keyframes auroraDrift {
		0%,
		100% {
			background-position: 0% 0;
		}
		50% {
			background-position: 100% 0;
		}
	}
	.orbit {
		position: absolute;
		top: 50%;
		left: 15px;
		width: 0;
		height: 0;
		z-index: 5;
		pointer-events: none;
	}
	.orbit i {
		position: absolute;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 8px 1px color-mix(in oklab, var(--accent) 80%, #fff);
		animation: orbit 1.1s ease-out forwards;
	}
	.orbit i:nth-child(2) {
		animation-delay: 0.15s;
		animation-duration: 1.25s;
	}
	@keyframes orbit {
		0% {
			transform: rotate(0deg) translateX(4px) scale(0.4);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		100% {
			transform: rotate(320deg) translateX(15px) scale(0);
			opacity: 0;
		}
	}
</style>
