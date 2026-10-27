<script lang="ts">
	import { onMount } from 'svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import Button from '$lib/primitives/actions/Button.svelte';
	import AlertBladeHost from '$lib/display/drawer/AlertBladeHost.svelte';
	import { alertBlade } from '$lib/display/drawer/alertBlade.svelte.js';
	import { buildWatch } from '$lib/routing/build-watch.svelte.js';

	let checking = $state(false);
	let lastChecked = $state<string>();

	onMount(() => buildWatch.start());

	async function checkNow() {
		checking = true;
		await buildWatch.check();
		lastChecked = new Date().toLocaleTimeString();
		checking = false;
	}

	function previewPrompt() {
		alertBlade.show({
			variant: 'info',
			title: 'A newer version is available',
			message: 'Reload to pick it up.',
			duration: 0,
			action: { label: 'Reload', onclick: () => location.reload() }
		});
	}
</script>

<svelte:head>
	<title>buildWatch — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock>
		<h3 class="component-name">buildWatch</h3>
		<p class="component-desc">
			Tells a tab that a deploy replaced the bundle it runs. compose stamps every page with
			<code class="demo-code">&lt;meta name="compose-build"&gt;</code> and every HTML response with
			<code class="demo-code">X-Compose-Build</code>; <code class="demo-code">check()</code> asks for
			this page again and compares the two. Call <code class="demo-code">start()</code> once in the app
			shell and react to <code class="demo-code">stale</code>, or await
			<code class="demo-code">check()</code> before something that needs current code, like joining a
			match.
		</p>

		<dl class="bw-state">
			<dt>This tab's build</dt>
			<dd>{buildWatch.current || 'none: not served by compose (dev server)'}</dd>
			<dt>Stale</dt>
			<dd>{buildWatch.stale ? 'yes, a newer build is deployed' : 'no'}</dd>
			<dt>Last checked</dt>
			<dd>{lastChecked ?? 'not yet'}</dd>
		</dl>

		<div class="bw-actions">
			<Button onclick={checkNow} loading={checking}>Check now</Button>
			<Button onclick={previewPrompt}>Preview the prompt</Button>
		</div>
	</ShowcaseBlock>
</div>

<AlertBladeHost />

<style>
	.bw-state {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
		margin: 1rem 0;
		font-size: 0.8125rem;
	}
	.bw-state dt {
		color: var(--fg-muted);
	}
	.bw-state dd {
		margin: 0;
		font-family: var(--mono);
	}
	.bw-actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
