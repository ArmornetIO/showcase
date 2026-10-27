<script lang="ts">
	import Panel from '$lib/primitives/chrome/Panel.svelte';
	import SectionBar from '$lib/primitives/chrome/SectionBar.svelte';
	import SegmentGroup from '$lib/primitives/actions/SegmentGroup.svelte';
	import FormField from '$lib/primitives/forms/FormField.svelte';
	import Select from '$lib/primitives/forms/Select.svelte';
	import DateSelect, { type DateEvent } from '$lib/primitives/forms/DateSelect.svelte';
	import { formatDate, type DateOrder, type DateOutput } from '$lib/primitives/forms/date.js';
	import Chip from '$lib/primitives/status/Chip.svelte';

	// Pinned so the page screenshots the same every day.
	const TODAY = '2026-09-29';

	type Kind = 'risk' | 'evidence' | 'assessment';
	const KIND_VAR: Record<Kind, string> = {
		risk: 'var(--palette-red)',
		evidence: 'var(--accent)',
		assessment: 'var(--palette-cyan)'
	};
	const KIND_CHIP = { risk: 'error', evidence: 'accent', assessment: 'cyan' } as const;
	const raw: { id: string; date: string; title: string; kind: Kind }[] = [
		{ id: 'e1', date: '2026-09-03', title: 'SOC 2 evidence due', kind: 'evidence' },
		{ id: 'e2', date: '2026-09-08', title: 'Vendor: Stripe review', kind: 'assessment' },
		{ id: 'e3', date: '2026-09-14', title: 'R-112 acceptance expires', kind: 'risk' },
		{ id: 'e4', date: '2026-09-14', title: 'Access review evidence', kind: 'evidence' },
		{ id: 'e5', date: '2026-09-22', title: 'Vendor: Okta review', kind: 'assessment' },
		{ id: 'e6', date: '2026-09-29', title: 'R-087 acceptance expires', kind: 'risk' },
		{ id: 'e7', date: '2026-09-29', title: 'Pen-test report', kind: 'evidence' },
		{ id: 'e8', date: '2026-09-29', title: 'Vendor: GitHub review', kind: 'assessment' },
		{ id: 'e9', date: '2026-10-02', title: 'Q3 policy attestation', kind: 'evidence' }
	];
	const events: DateEvent[] = raw.map((e) => ({ ...e, color: KIND_VAR[e.kind] }));

	let calDay = $state<string | null>(TODAY);
	const agenda = $derived(raw.filter((e) => e.date === calDay));

	let reviewBy = $state<string | null>('2026-10-15');

	const ORDERS = [
		{ value: 'mdy', label: 'MDY' },
		{ value: 'dmy', label: 'DMY' },
		{ value: 'ymd', label: 'YMD' }
	];
	const OUTPUTS: Record<string, DateOutput> = {
		date: { kind: 'date' },
		'utc-start': { kind: 'datetime' },
		'ny-end': { kind: 'datetime', zone: 'America/New_York', boundary: 'end' },
		'tokyo-start': { kind: 'datetime', zone: 'Asia/Tokyo' },
		epoch: { kind: 'epoch', unit: 's' },
		long: { kind: 'pattern', pattern: 'dddd, MMMM D, YYYY' },
		dotted: { kind: 'pattern', pattern: 'DD.MM.YYYY' }
	};
	const OUTPUT_OPTIONS = [
		{ value: 'date', label: 'ISO date' },
		{ value: 'utc-start', label: 'UTC datetime · start of day' },
		{ value: 'ny-end', label: 'New York datetime · end of day' },
		{ value: 'tokyo-start', label: 'Tokyo datetime · start of day' },
		{ value: 'epoch', label: 'Unix seconds' },
		{ value: 'long', label: 'Pattern · dddd, MMMM D, YYYY' },
		{ value: 'dotted', label: 'Pattern · DD.MM.YYYY' }
	];
	let order = $state<DateOrder>('mdy');
	let outKey = $state('ny-end');
	let due = $state<string | null>('2026-10-15');
	let dueError = $state<string>();
	const emitted = $derived(due ? formatDate(due, OUTPUTS[outKey]) : null);

	let from = $state<string | null>('2026-09-08');
	let to = $state<string | null>('2026-09-29');
</script>

<div class="page">
	<header class="head">
		<span class="eyebrow">Primitive · forms</span>
		<h1>DateSelect</h1>
		<p>
			One month grid, four wrappers. Values are ISO <code>YYYY-MM-DD</code> strings; <code>output</code>
			shapes what leaves the field.
		</p>
	</header>

	<SectionBar label='variant="calendar"' />
	<div class="cal-layout">
		<DateSelect variant="calendar" bind:value={calDay} {events} today={TODAY} />
		<Panel title={calDay ?? 'No day'}>
			{#if agenda.length}
				<ul class="agenda">
					{#each agenda as e (e.id)}
						<li>
							<Chip color={KIND_CHIP[e.kind]} lead="dot" size="sm">{e.kind}</Chip>
							<span>{e.title}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="dim">Nothing due.</p>
			{/if}
		</Panel>
	</div>

	<SectionBar label='variant="picker"' />
	<div class="pick-row">
		<FormField label="Review by" hint="Past dates are disabled (min = today)" id="review-by">
			<DateSelect variant="picker" id="review-by" bind:value={reviewBy} min={TODAY} today={TODAY} />
		</FormField>
		<p class="dim">A button styled like <code>Input</code>: choose, don't type.</p>
	</div>

	<SectionBar label='variant="input"' />
	<div class="pick-row">
		<FormField label="Due" id="due" error={dueError} hint="Try 10/15, oct 15, tomorrow, +2w">
			<DateSelect
				id="due"
				name="due_at"
				bind:value={due}
				bind:error={dueError}
				min={TODAY}
				today={TODAY}
				{order}
				output={OUTPUTS[outKey]}
			/>
		</FormField>
		<div class="examples">
			<span class="eyebrow">Input order</span>
			<SegmentGroup options={ORDERS} value={order} onchange={(o) => (order = o as DateOrder)} />
			<span class="eyebrow">Output</span>
			<Select size="sm" options={OUTPUT_OPTIONS} value={outKey} onchange={(v) => (outKey = v)} />
			<dl class="io">
				<dt>value</dt>
				<dd><code>{due ?? 'null'}</code></dd>
				<dt>emits</dt>
				<dd><code class="emit">{emitted === null ? 'null' : JSON.stringify(emitted)}</code></dd>
			</dl>
			<p class="dim">
				Enter or blur commits and rewrites the text in the input order; ↓ opens the calendar, Esc
				closes it.
			</p>
		</div>
	</div>

	<SectionBar label='variant="range"' />
	<Panel>
		<DateSelect variant="range" bind:from bind:to today={TODAY} />
	</Panel>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: var(--sp-6);
		max-width: 1100px;
	}
	.eyebrow {
		font-family: var(--mono);
		font-size: var(--t-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		color: var(--accent);
	}
	h1 {
		font-family: var(--sans-brand);
		font-size: var(--t-display);
		color: var(--fg);
		margin: var(--sp-1) 0;
	}
	.head p,
	.dim {
		color: var(--fg-dim);
		font-size: var(--t-small);
	}
	code {
		font-family: var(--mono);
		color: var(--fg);
	}
	.cal-layout {
		display: grid;
		grid-template-columns: 1fr 260px;
		gap: var(--sp-4);
		align-items: start;
	}
	.agenda {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: var(--t-small);
		color: var(--fg);
	}
	.agenda li {
		display: flex;
		gap: var(--sp-2);
		align-items: center;
	}
	.pick-row {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: var(--sp-6);
		align-items: start;
	}
	.examples {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		max-width: 52ch;
	}
	.io {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--sp-1) var(--sp-3);
		margin: 0;
		font-size: var(--t-small);
	}
	.io dt {
		font-family: var(--mono);
		font-size: var(--t-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		color: var(--fg-muted);
	}
	.io dd {
		margin: 0;
	}
	.emit {
		color: var(--accent);
	}
</style>
