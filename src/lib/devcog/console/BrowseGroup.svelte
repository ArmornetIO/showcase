<script lang="ts">
	// Every app this page's server will serve you, one link each. The list is the
	// framework's answer for this caller on this hostname, so every entry lands
	// where it says.
	import { currentApp, type AppEntry } from './browse.js';

	interface BrowseGroupProps {
		apps: AppEntry[];
	}

	let { apps }: BrowseGroupProps = $props();

	const here = $derived(
		typeof location === 'undefined' ? undefined : currentApp(apps, location.pathname)
	);
</script>

<!-- data-sveltekit-reload: another app is another document. A SvelteKit host's
     router would otherwise try the link as one of its own routes first. -->
<ul class="dc-apps">
	{#each apps as app (app.name)}
		<li>
			<a
				class="dc-app"
				class:dc-here={app.name === here}
				href={app.path}
				aria-current={app.name === here ? 'page' : undefined}
				data-sveltekit-reload
			>
				<span class="dc-app-name">{app.name}</span>
				<span class="dc-app-path">{app.path}</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.dc-apps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.dc-app {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 4px;
		font-family: var(--mono, monospace);
		text-decoration: none;
		color: var(--fg);
	}
	.dc-app:hover,
	.dc-app:focus-visible {
		border-color: var(--accent);
		color: var(--accent);
	}
	.dc-here {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: var(--accent-faint);
	}
	.dc-app-name {
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.dc-app-path {
		font-size: 0.56rem;
		color: var(--fg-dim);
	}
</style>
