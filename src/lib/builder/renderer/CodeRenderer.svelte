<script lang="ts">
	// The three monospace blocks. They differ only in chrome — snippet, YAML and
	// terminal — so they share one file.
	import CodeBlock from '../../display/code/CodeBlock.svelte';
	import ConfigBlock from '../../display/code/ConfigBlock.svelte';
	import TerminalBlock from '../../display/code/TerminalBlock.svelte';
	import { accessors } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s } = accessors(() => props);
</script>

{#if componentId === 'CodeBlock'}
	<CodeBlock title={s('title', 'example')} code={s('code', '<Button />')} />

{:else if componentId === 'ConfigBlock'}
	<ConfigBlock yaml={s('yaml', 'agent:\n  name: example')} />

{:else if componentId === 'TerminalBlock'}
	<TerminalBlock
		title={s('title', 'agent.yaml')}
		content={s('content', 'agent:\n  name: threat-scraper\n  mode: passive\n  enabled: true')}
	/>
{/if}
