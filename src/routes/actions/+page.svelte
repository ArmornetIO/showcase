<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import ActionsMenu from '$lib/primitives/actions/ActionsMenu.svelte';
	import ExportMenu from '$lib/primitives/actions/ExportMenu.svelte';
	import type { ActionMenuItem } from '$lib/primitives/actions/ActionsMenu.svelte';
	import type { ExportFormat } from '$lib/primitives/actions/ExportMenu.svelte';
	import Icon from '$lib/icons/Icon.svelte';

	let lastAction = $state('');
	let lastExport = $state('');

	const vendorItems: ActionMenuItem[] = [
		{ label: 'View details', icon: 'eye', onclick: () => (lastAction = 'View details') },
		{ label: 'Edit vendor', icon: 'pencil', onclick: () => (lastAction = 'Edit vendor') },
		{ label: 'Assign reviewer', icon: 'users', onclick: () => (lastAction = 'Assign reviewer') },
		{
			label: 'Remove vendor',
			icon: 'trash-2',
			destructive: true,
			onclick: () => (lastAction = 'Remove vendor')
		}
	];

	const assessmentItems: ActionMenuItem[] = [
		{
			label: 'Start assessment',
			icon: 'clipboard-list',
			onclick: () => (lastAction = 'Start assessment')
		},
		{ label: 'Share link', icon: 'share-2', onclick: () => (lastAction = 'Share link') },
		{ label: 'Duplicate', icon: 'copy', onclick: () => (lastAction = 'Duplicate') },
		{
			label: 'Archive',
			icon: 'trash-2',
			destructive: true,
			onclick: () => (lastAction = 'Archive')
		}
	];

	const disabledItems: ActionMenuItem[] = [
		{ label: 'Export', icon: 'download', onclick: () => {} },
		{ label: 'Delete', icon: 'trash-2', destructive: true, disabled: true, onclick: () => {} }
	];

	function handleExport(fmt: ExportFormat) {
		lastExport = fmt.toUpperCase();
	}
</script>

<svelte:head>
	<title>Actions — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<!-- ActionsMenu -->
	<ShowcaseBlock component="ActionsMenu">
		<h3 class="component-name">ActionsMenu</h3>
		<p class="component-desc">
			Contextual dropdown triggered by a ⋮ kebab button. Items support optional icons, destructive
			styling, and disabled state. Use a custom <code class="demo-code">trigger</code> snippet to
			replace the default kebab with any element.
		</p>

		<div class="demo-row">
			<span class="demo-label">default</span>
			<div class="demo-items">
				<ActionsMenu items={vendorItems} />
				{#if lastAction}
					<span class="feedback">→ {lastAction}</span>
				{/if}
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">assessment</span>
			<div class="demo-items">
				<ActionsMenu items={assessmentItems} placement="bottom-start" />
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">disabled item</span>
			<div class="demo-items">
				<ActionsMenu items={disabledItems} />
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">custom trigger</span>
			<div class="demo-items">
				<ActionsMenu items={vendorItems}>
					{#snippet trigger({ open, toggle })}
						<button type="button" class="custom-trigger" class:active={open} onclick={toggle}>
							<Icon name="settings-2" size={13} />
							Options
						</button>
					{/snippet}
				</ActionsMenu>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">in table row</span>
			<div class="demo-items demo-items--wide">
				<div class="fake-table">
					{#each ['Acme Corp', 'DataSync Ltd', 'Infra.io'] as vendor}
						<div class="table-row">
							<span class="row-name">{vendor}</span>
							<span class="row-status">In Progress</span>
							<ActionsMenu items={vendorItems} />
						</div>
					{/each}
				</div>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ExportMenu -->
	<ShowcaseBlock component="ExportMenu">
		<h3 class="component-name">ExportMenu</h3>
		<p class="component-desc">
			Export icon button with a preset format dropdown (CSV, JSON, PDF, Print). Wraps
			<code class="demo-code">ActionsMenu</code> with a download-icon trigger. Pass
			<code class="demo-code">formats</code> to limit which options appear.
		</p>

		<div class="demo-row">
			<span class="demo-label">all formats</span>
			<div class="demo-items">
				<ExportMenu onformat={handleExport} />
				{#if lastExport}
					<span class="feedback">→ {lastExport} selected</span>
				{/if}
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">csv + json only</span>
			<div class="demo-items">
				<ExportMenu formats={['csv', 'json']} onformat={handleExport} />
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">disabled</span>
			<div class="demo-items">
				<ExportMenu disabled onformat={handleExport} />
			</div>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2.5rem;
		margin-bottom: 4px;
	}
	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 100px;
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

	/* ── Feedback label ──────────────────────────────────────────────────── */
	.feedback {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--accent);
		opacity: 0.8;
	}

	/* ── Custom trigger example ──────────────────────────────────────────── */
	.custom-trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: 3px;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.custom-trigger:hover,
	.custom-trigger.active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: var(--accent-faint);
	}

	/* ── Fake table ──────────────────────────────────────────────────────── */
	.fake-table {
		width: 100%;
		max-width: 480px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.table-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-elev);
	}
	.table-row:last-child {
		border-bottom: none;
	}
	.row-name {
		flex: 1;
		font-size: 0.85rem;
		color: var(--fg);
	}
	.row-status {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.06em;
	}
</style>
