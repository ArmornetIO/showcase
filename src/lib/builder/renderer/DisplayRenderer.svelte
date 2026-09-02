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
	import Backdrop from '$lib/backdrop/Backdrop.svelte';
	import { DEFAULT_BLEND, type BlendMode } from '$lib/backdrop/backdrops.js';
	import type { StripSpec } from '$lib/backdrop/strips.js';
	import { accessors, lines, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);

	const DEFAULT_TICKER_ITEMS =
		'SOC 2 TYPE II\nISO 27001 · 27017 · 27018\nSPF · DKIM · DMARC\nPHISHING SIMULATIONS\nDNS FILTERING\nPENETRATION TESTING\nRISK REGISTERS\nVENDOR RISK MANAGEMENT';

	const tickerItems = $derived(lines(s('items', DEFAULT_TICKER_ITEMS)));

	/**
	 * One id or a comma-joined stack — `Backdrop` reads both, so nothing here
	 * has to know which it was given.
	 */
	const backdropId = $derived(e('preset', 'ash-drift'));

	/** An authored composition, or `undefined` so the named preset takes over. */
	const backdropStrips = $derived.by(() => {
		const raw = s('strips', '').trim();
		if (!raw) return undefined;
		const parsed = parseJson<StripSpec[]>(raw, []);
		return parsed.length ? parsed : undefined;
	});

	/**
	 * Per-family knobs authored in the studio: `{ styles, params }`.
	 *
	 * `parseJson` falls back on bad input, so a half-typed edit in the inspector
	 * degrades to the families' own defaults rather than throwing.
	 */
	const backdropLayers = $derived(
		parseJson<{ styles?: Record<string, string>; params?: Record<string, Record<string, number>> }>(
			s('layers', ''),
			{}
		)
	);

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
{:else if componentId === 'HorizonBackdrop'}
	<!--
		The backdrop is `position: absolute; inset: 0` and has no intrinsic size —
		it fills whatever positioned box it is given. On a builder canvas that box
		is the placed item's frame, so it needs a positioned wrapper of its own or
		it would escape to the nearest positioned ancestor and cover the canvas.

		`--backdrop-strength` and `--backdrop-cell` are set here rather than passed
		as props because they are CSS custom properties the component reads with
		`var()` — the same two knobs the studio drives.
	-->
	<div
		class="backdrop-slot"
		style:--backdrop-strength={n('strength', 1)}
		style:--backdrop-cell="{n('cell', 34)}px"
	>
		<!--
			Everything goes through the dispatcher, including an authored
			composition. This used to branch to `HorizonBackdrop` directly whenever
			`strips` was set, which quietly meant a stack holding a composition
			rendered ONLY that composition — the branch had no way to draw the other
			layers. `Backdrop` applies the strips to its Möbius layer and paints the
			rest around it.
		-->
		<Backdrop
			id={backdropId}
			strength={n('strength', 1)}
			blend={e('blend', DEFAULT_BLEND) as BlendMode}
			strips={backdropStrips}
			rainbow={b('rainbow')}
			rainbowSpeed={n('rainbowSpeed', 18)}
			styles={backdropLayers.styles}
			params={backdropLayers.params}
		/>
	</div>
{/if}

<style>
	.backdrop-slot {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
</style>
