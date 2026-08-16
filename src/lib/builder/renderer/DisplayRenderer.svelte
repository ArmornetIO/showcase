<script lang="ts">
	// Read-only display surfaces that aren't a metric, a dataset or a code block:
	// loading states, feeds, rows, cards and the chat transcript.
	import PanelLoading from '$lib/display/feedback/PanelLoading.svelte';
	import Ticker from '$lib/display/metric/Ticker.svelte';
	import LogRow from '$lib/display/code/LogRow.svelte';
	import PeerCard from '$lib/display/entity/PeerCard.svelte';
	import ChatMessage from '$lib/display/chat/ChatMessage.svelte';
	import ChatThread from '$lib/display/chat/ChatThread.svelte';
	import type { ChatEntry } from '$lib/display/chat/ChatThread.svelte';
	import { accessors, lines, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);

	const DEFAULT_TICKER_ITEMS =
		'SOC 2 TYPE II\nISO 27001 · 27017 · 27018\nSPF · DKIM · DMARC\nPHISHING SIMULATIONS\nDNS FILTERING\nPENETRATION TESTING\nRISK REGISTERS\nVENDOR RISK MANAGEMENT';

	const tickerItems = $derived(lines(s('items', DEFAULT_TICKER_ITEMS)));

	const handling = $derived(
		parseJson<string[]>(props.handling, ['Encrypt at rest', 'Access logged'])
	);

	// A two-turn transcript so the thread shows both bubble styles at once.
	const chatMessages: ChatEntry[] = $derived([
		{
			id: 'p1',
			role: 'assistant',
			author: 'CLAUDE',
			content: "Describe the feature and I'll generate a full mockup.",
			timestamp: Date.now()
		},
		{
			id: 'p2',
			role: 'user',
			author: 'YOU',
			content: s('placeholder', 'Describe what you want to build…'),
			timestamp: Date.now()
		}
	]);
</script>

{#if componentId === 'PanelLoading'}
	<PanelLoading />

{:else if componentId === 'Ticker'}
	<Ticker
		items={tickerItems}
		speed={n('speed', 30)}
		separator={s('separator', '●')}
		bordered={b('bordered', true)}
	/>

{:else if componentId === 'LogRow'}
	<LogRow
		ts={s('ts', '12:04:33')}
		level={e('level', 'info')}
		message={s('message', 'Agent mesh initialized')}
	/>

{:else if componentId === 'PeerCard'}
	<PeerCard
		name={s('name', 'threat-scraper-01')}
		id={s('id', '10.0.0.12:4317')}
		latency={s('latency', '4 ms')}
		color={s('color', '#5FEAD5')}
	/>


{:else if componentId === 'ChatMessage'}
	<ChatMessage
		role={e('role', 'assistant')}
		author={s('author', 'CLAUDE')}
		content={s('content', 'How can I help you design this feature?')}
	/>

{:else if componentId === 'ChatThread'}
	<ChatThread
		messages={chatMessages}
		placeholder={s('placeholder', 'Describe what you want to build…')}
		disabled={b('disabled')}
		onSend={() => {}}
	/>
{/if}
