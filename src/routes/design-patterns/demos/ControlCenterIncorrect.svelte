<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';

	// Today's shell. Inbox and Docs are person-scope items sitting in the
	// scrolling destination list, so the unseen badge is only visible if the
	// list happens to be scrolled to it — and the bottom-left region that exists
	// to hold them carries only the account row.
	const destinations = [
		{ label: 'Vendors', icon: 'users' as const, active: true },
		{ label: 'Inbox', icon: 'bell' as const, badge: '3', misplaced: true },
		{ label: 'Docs', icon: 'file-text' as const, misplaced: true },
		{ label: 'Mesh', icon: 'mesh' as const },
		{ label: 'Agents', icon: 'cpu' as const },
		{ label: 'Threats', icon: 'shield-alert' as const }
	];
</script>

<div class="frame">
	<aside class="side">
		<div class="side-box side-top">
			<span class="zone-tag ok">org</span>
			<div class="brand"><span class="mark">▣</span> ARMORNET</div>
			<button class="row" type="button">
				<Icon name="search" size={13} /> Search <kbd>⌘K</kbd>
			</button>
			<button class="row" type="button">
				<Icon name="layout-grid" size={13} /> Overview
			</button>
		</div>

		<div class="side-mid">
			{#each destinations as d}
				<span class="row" class:active={d.active} class:misplaced={d.misplaced}>
					<Icon name={d.icon} size={13} />
					{d.label}
					{#if d.badge}<span class="badge">{d.badge}</span>{/if}
				</span>
			{/each}
			<span class="fade" aria-hidden="true"></span>
		</div>

		<div class="side-box side-bot empty">
			<span class="zone-tag bad">you</span>
			<span class="row"><span class="avatar">TR</span> Account</span>
		</div>
	</aside>

	<main class="main">
		<div class="topbar">
			<span class="crumb">Vendors</span>
			<div class="ctx">
				<button class="ghost" type="button"><Icon name="filter" size={12} /> Filter</button>
				<button class="ghost" type="button">Builder</button>
				<button class="slab" type="button"><Icon name="plus" size={12} /> New</button>
			</div>
		</div>
		<div class="canvas"></div>
	</main>
</div>

<p class="note">Person-scope items in the scrolling list. The unseen count scrolls away.</p>

<style>
	.frame {
		display: flex;
		width: 100%;

		height: 178px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg);
	}

	.side {
		display: flex;
		flex-direction: column;
		width: 116px;
		flex-shrink: 0;
		border-right: 1px solid var(--border);
		background: var(--bg-elev);
	}

	.side-box {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
		padding: 0.5rem 0.4rem;
		border: 1px solid rgba(52, 211, 153, 0.28);
		background: rgba(52, 211, 153, 0.05);
		margin: 0.35rem;
		border-radius: 6px;
	}
	.side-box.empty {
		border-color: rgba(252, 165, 165, 0.3);
		background: rgba(252, 165, 165, 0.04);
	}

	.zone-tag {
		position: absolute;
		top: -0.44rem;
		right: 0.4rem;
		font-family: var(--mono);
		font-size: 0.46rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		background: var(--bg-elev);
		padding: 0 0.22rem;
	}
	.zone-tag.ok {
		color: var(--palette-emerald);
	}
	.zone-tag.bad {
		color: var(--palette-red);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.32rem;
		font-family: var(--sans);
		font-size: 0.54rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--fg-muted);
		padding: 0.1rem 0.3rem 0.3rem;
	}
	.mark {
		color: var(--accent);
		font-size: 0.7rem;
	}

	.side-mid {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
		padding: 0.25rem 0.35rem;
		overflow: hidden;
	}

	.fade {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 22px;
		background: linear-gradient(to top, var(--bg-elev), transparent);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.38rem;
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-muted);
		padding: 0.26rem 0.35rem;
		border-radius: 4px;
		border: none;
		background: transparent;
		text-align: left;
		width: 100%;
		cursor: pointer;
		white-space: nowrap;
	}
	.row.active {
		color: var(--accent);
		background: var(--accent-faint);
	}
	.row.misplaced {
		border: 1px dashed rgba(252, 165, 165, 0.45);
		color: var(--palette-red);
	}

	kbd {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.48rem;
		color: var(--fg-dim);
	}

	.badge {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.46rem;
		font-weight: 700;
		line-height: 1;
		color: var(--bg);
		background: var(--accent);
		border-radius: 999px;
		padding: 0.12rem 0.22rem;
	}

	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 999px;
		font-size: 0.4rem;
		font-weight: 600;
		color: var(--accent);
		background: var(--accent-faint-strong);
		border: 1px solid var(--border-accent);
	}

	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.6rem;
		border-bottom: 1px solid var(--border);
	}

	.crumb {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
	}

	.ctx {
		display: flex;
		align-items: center;
		gap: 0.22rem;
	}

	.ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.24rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		height: 22px;
		padding: 0 0.36rem;
		border-radius: 4px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		white-space: nowrap;
	}

	.slab {
		display: inline-flex;
		align-items: center;
		gap: 0.24rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		font-weight: 600;
		height: 22px;
		padding: 0 0.5rem;
		border-radius: 5px;
		border: 1px solid transparent;
		background: var(--accent);
		color: var(--bg);
		cursor: pointer;
		white-space: nowrap;
	}

	.canvas {
		flex: 1;
		background: repeating-linear-gradient(
			-45deg,
			transparent,
			transparent 7px,
			rgba(255, 255, 255, 0.014) 7px,
			rgba(255, 255, 255, 0.014) 14px
		);
	}

	.note {
		margin: 0.7rem 0 0;
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.6;
		color: var(--palette-red);
	}
</style>
