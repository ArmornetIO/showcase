<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import Breadcrumbs from '$lib/navigation/Breadcrumbs.svelte';
</script>

<svelte:head>
	<title>Navigation — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="Breadcrumbs">
		<h3 class="component-name">Breadcrumbs</h3>
		<p class="component-desc">Path context trail. The last item receives no <code class="demo-code">href</code> and renders as the current page. <code class="demo-code">separator</code> accepts any string — default is <code class="demo-code">/</code>.</p>
		<div class="demo-row">
			<span class="demo-label">3 levels</span>
			<Breadcrumbs
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Console', href: '/console' },
					{ label: 'Agent detail' }
				]}
			/>
		</div>
		<div class="demo-row">
			<span class="demo-label">2 levels</span>
			<Breadcrumbs items={[{ label: 'Vendors', href: '/vendors' }, { label: 'Acme Corp' }]} />
		</div>
		<div class="demo-row">
			<span class="demo-label">custom sep</span>
			<Breadcrumbs
				separator="›"
				items={[
					{ label: 'Admin', href: '/admin' },
					{ label: 'Flags', href: '/admin/flags' },
					{ label: 'console-flag' }
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
</style>
