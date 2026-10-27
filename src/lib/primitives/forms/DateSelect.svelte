<script lang="ts">
	// One component, four faces, because all four draw the same month grid and
	// only differ in what wraps it:
	//
	//   calendar — the grid IS the surface: large cells carrying per-day events
	//   picker   — a button; the grid opens in a popover under it
	//   input    — the picker, but the field is a real `Input` you can type into
	//   range    — two adjacent months + presets, selecting a from/to pair
	//
	// Values are ISO `YYYY-MM-DD` strings, not Date objects: they round-trip
	// through JSON and the Go API unchanged, and a calendar day has no timezone.
	// `output` shapes only what `onchange` emits and what the hidden `<input name>`
	// submits, so a form posts exactly what its API expects (see ./date.ts).
	import { untrack } from 'svelte';
	import Icon from '../../icons/Icon.svelte';
	import Button from '../actions/Button.svelte';
	import IconButton from '../actions/IconButton.svelte';
	import Input from './Input.svelte';
	import { portal } from '../portal.js';
	import {
		addDays,
		formatDate,
		orderForLocale,
		parseDate,
		patternForOrder,
		todayISO,
		type DateOrder,
		type DateOutput,
		type ISODate
	} from './date.js';

	export type DateSelectVariant = 'calendar' | 'picker' | 'input' | 'range';
	export interface DateEvent {
		id: string;
		date: ISODate;
		title: string;
		/** Any CSS colour; the accent when absent. */
		color?: string;
	}
	/** The last `days` days, ending today. */
	export interface DatePreset {
		label: string;
		days: number;
	}

	interface DateSelectProps {
		variant?: DateSelectVariant;
		value?: ISODate | null;
		/** `range` only. */
		from?: ISODate | null;
		to?: ISODate | null;
		min?: ISODate;
		max?: ISODate;
		/** Pin "today" — screenshots and tests; the local day otherwise. */
		today?: ISODate;
		/** `calendar` only. */
		events?: DateEvent[];
		/** `range` only. */
		presets?: DatePreset[];
		/** How typed all-numeric dates read (`03/04`); from `locale` when absent. */
		order?: DateOrder;
		locale?: string;
		output?: DateOutput;
		/** Submits the `output`-shaped value through a hidden input. Not for `range`. */
		name?: string;
		id?: string;
		/** Accessible name when there is no `FormField` label pointing at `id`. */
		label?: string;
		placeholder?: string;
		size?: 'sm' | 'md';
		disabled?: boolean;
		/** Hides Clear: the field cannot be emptied from the calendar. */
		required?: boolean;
		/** Out: why the typed text was not accepted. Bind it into `FormField`'s `error`. */
		error?: string;
		onchange?: (out: string | number | null, day: ISODate | null) => void;
		/** Fires once a range is complete, or cleared — not on the first click. */
		onrangechange?: (from: ISODate | null, to: ISODate | null) => void;
	}

	let {
		variant = 'input',
		value = $bindable(null),
		from = $bindable(null),
		to = $bindable(null),
		min,
		max,
		today = todayISO(),
		events = [],
		presets = [
			{ label: '7D', days: 7 },
			{ label: '30D', days: 30 },
			{ label: '90D', days: 90 }
		],
		order,
		locale,
		output = { kind: 'date' },
		name,
		id,
		label,
		placeholder,
		size = 'md',
		disabled = false,
		required = false,
		error = $bindable(),
		onchange,
		onrangechange
	}: DateSelectProps = $props();

	// ── Month math ──────────────────────────────────────────────────────────────
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	type Cell = { date: ISODate; day: number; inMonth: boolean };
	// 6×7, Monday first, so the grid never changes height between months.
	function grid(y: number, m: number): Cell[] {
		const offset = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(Date.UTC(y, m, 1 - offset + i));
			return { date: iso(d), day: d.getUTCDate(), inMonth: d.getUTCMonth() === m };
		});
	}
	const shift = (y: number, m: number, n: number) => {
		const d = new Date(Date.UTC(y, m + n, 1));
		return [d.getUTCFullYear(), d.getUTCMonth()] as const;
	};
	const utc = (d: ISODate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
	const fmt = (o: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' });
	const monthLabel = (y: number, m: number) =>
		fmt({ month: 'long', year: 'numeric' }).format(Date.UTC(y, m, 1));
	const longLabel = (d: ISODate) =>
		fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(utc(d));
	// 2024-01-01 was a Monday.
	const weekdays = $derived(
		Array.from({ length: 7 }, (_, i) => fmt({ weekday: 'short' }).format(Date.UTC(2024, 0, 1 + i)))
	);
	const outOfBounds = (d: ISODate) => (!!min && d < min) || (!!max && d > max);

	const start = untrack(() => value ?? from ?? today);
	let viewY = $state(+start.slice(0, 4));
	let viewM = $state(+start.slice(5, 7) - 1);
	const step = (n: number) => ([viewY, viewM] = shift(viewY, viewM, n));
	const showMonthOf = (d: ISODate) => ([viewY, viewM] = [+d.slice(0, 4), +d.slice(5, 7) - 1]);

	// ── Single value — calendar, picker, input ─────────────────────────────────
	const fieldOrder = $derived(order ?? orderForLocale(locale));
	const display = (d: ISODate) =>
		formatDate(d, { kind: 'pattern', pattern: patternForOrder(fieldOrder) }) as string;

	let text = $state(untrack(() => (value ? display(value) : '')));
	// What `text` was last rendered from. Plain lets: they are bookkeeping, and
	// making them reactive would re-run the effect that writes them.
	let shownValue = untrack(() => value);
	let shownOrder = untrack(() => fieldOrder);
	// A value written from outside, or an order change, re-renders the text — so
	// 03/04 is redrawn in the new order rather than silently re-read as another day.
	$effect(() => {
		const v = value;
		const o = fieldOrder;
		if (v === shownValue && o === shownOrder) return;
		shownValue = v;
		shownOrder = o;
		text = v ? display(v) : '';
	});

	function set(d: ISODate | null) {
		shownValue = d;
		text = d ? display(d) : '';
		value = d;
		onchange?.(d === null ? null : formatDate(d, output), d);
	}

	const parsed = $derived(parseDate(text, { order: fieldOrder, locale, today }));
	const textError = $derived(
		text.trim() && !parsed
			? `Can't read “${text.trim()}”`
			: parsed && min && parsed < min
				? `On or after ${longLabel(min)}`
				: parsed && max && parsed > max
					? `On or before ${longLabel(max)}`
					: undefined
	);
	$effect(() => {
		if (variant === 'input') error = textError;
	});

	// Commit normalises the text, so what was typed and what was stored never disagree.
	function commit() {
		if (!text.trim()) {
			if (value !== null) set(null);
		} else if (parsed && !textError) {
			if (parsed !== value) set(parsed);
			else text = display(parsed);
		}
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			commit();
			open = false;
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			openPop();
		}
	}
	// Typing moves the popover to the month being typed, so the grid confirms the read.
	function follow() {
		if (parsed) showMonthOf(parsed);
	}

	// ── Popover — picker, input ────────────────────────────────────────────────
	let open = $state(false);
	let rootEl = $state<HTMLElement>();
	let popEl = $state<HTMLElement>();
	let popStyle = $state('');
	function place() {
		if (!rootEl) return;
		const r = rootEl.getBoundingClientRect();
		const h = popEl?.offsetHeight ?? 0;
		const below = window.innerHeight - r.bottom;
		const top = h + 8 > below && r.top > below ? r.top - h - 4 : r.bottom + 4;
		popStyle = `top:${top}px;left:${r.left}px`;
	}
	function openPop() {
		if (disabled) return;
		showMonthOf((variant === 'input' ? parsed : null) ?? value ?? today);
		open = true;
	}
	function pick(d: ISODate | null) {
		set(d);
		open = false;
	}
	$effect(() => {
		if (open && popEl) place();
	});
	$effect(() => {
		if (!open) return;
		// Portalled out of rootEl, so the popover counts as inside too.
		const down = (e: PointerEvent) => {
			const t = e.target as Node;
			if (!rootEl?.contains(t) && !popEl?.contains(t)) open = false;
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		window.addEventListener('pointerdown', down);
		window.addEventListener('keydown', key);
		window.addEventListener('scroll', place, true);
		window.addEventListener('resize', place);
		return () => {
			window.removeEventListener('pointerdown', down);
			window.removeEventListener('keydown', key);
			window.removeEventListener('scroll', place, true);
			window.removeEventListener('resize', place);
		};
	});

	// ── Calendar ───────────────────────────────────────────────────────────────
	const byDate = $derived(
		events.reduce<Record<ISODate, DateEvent[]>>((acc, e) => ((acc[e.date] ??= []).push(e), acc), {})
	);

	// ── Range ──────────────────────────────────────────────────────────────────
	let hover = $state<ISODate | null>(null);
	let activePreset = $state<string | null>(null);
	// While only `from` is set, the hovered day previews the end of the range.
	const rangeEnd = $derived(to ?? (from && hover && hover >= from ? hover : null));
	const inRange = (d: ISODate) => !!from && !!rangeEnd && d > from && d < rangeEnd;
	const rangeDays = $derived(from && to ? (utc(to) - utc(from)) / 864e5 + 1 : 0);
	const second = $derived(shift(viewY, viewM, 1));

	function setRange(f: ISODate | null, t: ISODate | null) {
		from = f;
		to = t;
		if (t || !f) onrangechange?.(f, t);
	}
	function pickRange(d: ISODate) {
		activePreset = null;
		if (!from || to || d < from) setRange(d, null);
		else setRange(from, d);
	}
	function applyPreset(p: DatePreset) {
		activePreset = p.label;
		setRange(addDays(today, -(p.days - 1)), today);
		// Today in the right-hand month, so the end of the range is on screen.
		showMonthOf(today);
		step(-1);
	}
</script>

{#snippet weekdayRow(short: boolean)}
	{#each weekdays as w (w)}<div class="wd" aria-hidden="true">{short ? w.slice(0, 2) : w}</div>{/each}
{/snippet}

{#snippet monthNav(y: number, m: number, small: boolean)}
	<IconButton icon="chevron-left" label="Previous month" size="sm" onclick={() => step(-1)} />
	<span class="month" class:small>{monthLabel(y, m)}</span>
	<IconButton icon="chevron-right" label="Next month" size="sm" onclick={() => step(1)} />
{/snippet}

{#snippet singleMonth(selected: ISODate | null)}
	<div class="mini-grid" role="group" aria-label={monthLabel(viewY, viewM)}>
		{@render weekdayRow(true)}
		{#each grid(viewY, viewM) as c (c.date)}
			<button
				type="button"
				class="mini"
				class:out={!c.inMonth}
				class:today={c.date === today}
				class:sel={c.date === selected}
				disabled={outOfBounds(c.date)}
				aria-label={longLabel(c.date)}
				aria-pressed={c.date === selected}
				aria-current={c.date === today ? 'date' : undefined}
				onclick={() => pick(c.date)}>{c.day}</button
			>
		{/each}
	</div>
{/snippet}

{#if variant === 'calendar'}
	<div class="calendar" class:disabled>
		<div class="bar">
			{@render monthNav(viewY, viewM, false)}
			<Button
				size="xs"
				disabled={outOfBounds(today)}
				onclick={() => (showMonthOf(today), set(today))}>Today</Button
			>
		</div>
		<div class="big-grid" role="group" aria-label={label ?? monthLabel(viewY, viewM)}>
			{@render weekdayRow(false)}
			{#each grid(viewY, viewM) as c (c.date)}
				{@const dayEvents = byDate[c.date] ?? []}
				<button
					type="button"
					class="big-cell"
					class:out={!c.inMonth}
					class:today={c.date === today}
					class:sel={c.date === value}
					disabled={disabled || outOfBounds(c.date)}
					aria-label="{longLabel(c.date)}{dayEvents.length ? `, ${dayEvents.length} due` : ''}"
					aria-pressed={c.date === value}
					aria-current={c.date === today ? 'date' : undefined}
					onclick={() => set(c.date)}
				>
					<span class="num">{c.day}</span>
					{#each dayEvents.slice(0, 2) as e (e.id)}
						<span class="ev" style:--ev={e.color ?? 'var(--accent)'}>{e.title}</span>
					{/each}
					{#if dayEvents.length > 2}
						<span class="more">+{dayEvents.length - 2} more</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{:else if variant === 'range'}
	<div class="range" class:disabled>
		<div class="bar">
			<span class="range-val">
				<span class:ph={!from}>{from ? longLabel(from) : 'Start'}</span>
				<Icon name="arrow-right" size={12} />
				<span class:ph={!to}>{to ? longLabel(to) : 'End'}</span>
			</span>
			{#if rangeDays}<span class="days">{rangeDays} days</span>{/if}
			<span class="grow"></span>
			{#each presets as p (p.label)}
				<Button
					shape="pill"
					size="xs"
					tone="accent"
					pressed={activePreset === p.label}
					{disabled}
					onclick={() => applyPreset(p)}>{p.label}</Button
				>
			{/each}
		</div>
		<div class="range-body">
			<IconButton icon="chevron-left" label="Previous month" size="sm" onclick={() => step(-1)} />
			{#each [[viewY, viewM], second] as [y, m] (`${y}-${m}`)}
				<div class="range-month">
					<span class="month small center">{monthLabel(y, m)}</span>
					<div
						class="mini-grid"
						role="group"
						aria-label={monthLabel(y, m)}
						onmouseleave={() => (hover = null)}
					>
						{@render weekdayRow(true)}
						{#each grid(y, m) as c (c.date)}
							{#if c.inMonth}
								<button
									type="button"
									class="mini"
									class:today={c.date === today}
									class:sel={c.date === from || c.date === rangeEnd}
									class:edge-l={c.date === from && !!rangeEnd}
									class:edge-r={c.date === rangeEnd}
									class:span={inRange(c.date)}
									disabled={disabled || outOfBounds(c.date)}
									aria-label={longLabel(c.date)}
									aria-pressed={c.date === from || c.date === to}
									onmouseenter={() => (hover = c.date)}
									onclick={() => pickRange(c.date)}>{c.day}</button
								>
							{:else}
								<span></span>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
			<IconButton icon="chevron-right" label="Next month" size="sm" onclick={() => step(1)} />
		</div>
		{#if !required && (from || to)}
			<div class="foot">
				<Button size="xs" {disabled} onclick={() => ((activePreset = null), setRange(null, null))}
					>Clear</Button
				>
			</div>
		{/if}
	</div>
{:else}
	<!-- focusout bubbles, so blur commits without Input having to forward onblur. -->
	<div
		class="field field-{size}"
		bind:this={rootEl}
		role={variant === 'input' && label ? 'group' : undefined}
		aria-label={variant === 'input' ? label : undefined}
		onfocusout={variant === 'input' ? commit : undefined}
	>
		{#if variant === 'input'}
			<Input
				{id}
				bind:value={text}
				{size}
				{disabled}
				{required}
				placeholder={placeholder ?? patternForOrder(fieldOrder)}
				status={textError ? 'error' : 'default'}
				class="ds-text"
				oninput={follow}
				onkeydown={onKey}
			/>
			<span class="adorn">
				<IconButton
					icon="chevron-down"
					label="Open calendar"
					size="sm"
					{disabled}
					onclick={() => (open ? (open = false) : openPop())}
				/>
			</span>
		{:else}
			<button
				type="button"
				{id}
				class="trigger trigger-{size}"
				class:open
				class:ph={!value}
				{disabled}
				aria-label={label}
				aria-haspopup="dialog"
				aria-expanded={open}
				onclick={() => (open ? (open = false) : openPop())}
			>
				<span>{value ? longLabel(value) : (placeholder ?? 'Choose a date')}</span>
				<Icon name="chevron-down" size={12} />
			</button>
		{/if}
		{#if name}
			<input type="hidden" {name} value={value === null ? '' : String(formatDate(value, output))} />
		{/if}
	</div>

	{#if open}
		<div
			class="popover"
			role="dialog"
			aria-label={label ?? 'Choose date'}
			use:portal
			bind:this={popEl}
			style={popStyle}
		>
			<div class="bar between">{@render monthNav(viewY, viewM, true)}</div>
			{@render singleMonth((variant === 'input' ? parsed : null) ?? value)}
			<div class="foot">
				<Button size="xs" disabled={outOfBounds(today)} onclick={() => pick(today)}>Today</Button>
				{#if !required && value}
					<Button size="xs" onclick={() => pick(null)}>Clear</Button>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	.grow {
		flex: 1;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 100%;
	}
	.bar.between {
		justify-content: space-between;
	}
	.month {
		font-family: var(--mono);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		font-size: var(--t-small);
		color: var(--fg);
		min-width: 11ch;
		text-align: center;
	}
	.month.small {
		font-size: var(--t-micro);
	}
	.center {
		display: block;
		margin-bottom: var(--sp-2);
	}
	.wd {
		font-family: var(--mono);
		font-size: var(--t-micro);
		text-transform: uppercase;
		color: var(--fg-muted);
		text-align: center;
		padding: var(--sp-1) 0;
	}
	.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	/* calendar */
	.calendar {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.big-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
		background: var(--border);
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: hidden;
	}
	.big-grid .wd {
		background: var(--bg-elev);
	}
	.big-cell {
		all: unset;
		box-sizing: border-box;
		background: var(--bg-elev);
		min-height: 92px;
		padding: var(--sp-1) var(--sp-2);
		display: flex;
		flex-direction: column;
		gap: 3px;
		cursor: pointer;
		overflow: hidden;
	}
	.big-cell:hover:not(:disabled) {
		background: var(--surface-raised);
	}
	.big-cell:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}
	.big-cell.out,
	.big-cell:disabled {
		opacity: 0.4;
	}
	.big-cell:disabled {
		cursor: not-allowed;
	}
	.big-cell.sel {
		background: var(--accent-faint);
		box-shadow: inset 0 0 0 1px var(--accent-line);
	}
	.num {
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg-dim);
		align-self: flex-start;
		padding: 0 4px;
		border-radius: var(--radius-xs);
	}
	.today .num {
		background: var(--accent);
		color: var(--text-onaccent);
	}
	.ev {
		font-size: var(--t-micro);
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding-left: 6px;
		border-left: 2px solid var(--ev);
	}
	.more {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-muted);
	}

	/* picker + input */
	.field {
		position: relative;
		width: 100%;
	}
	.field :global(.ds-text) {
		padding-right: 36px;
	}
	.adorn {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
	}
	.trigger {
		all: unset;
		box-sizing: border-box;
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--sp-2);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		color: var(--fg);
		font-family: var(--sans-brand);
		cursor: pointer;
	}
	/* Mirrors Input's size ramp, so a picker and an input line up in one form. */
	.trigger-sm {
		font-size: 13px;
		padding: 8px 11px;
	}
	.trigger-md {
		font-size: 15px;
		padding: 11px 13px;
	}
	.trigger.ph {
		color: var(--fg-dim);
	}
	.trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.trigger.open,
	.trigger:focus-visible {
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent-faint-strong),
			0 0 16px var(--accent-faint);
	}
	.popover {
		position: fixed;
		z-index: 60;
		width: 280px;
		padding: var(--sp-3);
		background: var(--bg-elev);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.mini-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		row-gap: 2px;
	}
	.mini {
		all: unset;
		box-sizing: border-box;
		height: 32px;
		display: grid;
		place-items: center;
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.mini:hover:not(:disabled) {
		background: var(--surface-raised);
	}
	.mini:focus-visible {
		outline: 1px solid var(--accent);
	}
	.mini.out {
		color: var(--fg-muted);
	}
	.mini:disabled {
		color: var(--fg-muted);
		opacity: 0.35;
		cursor: not-allowed;
		text-decoration: line-through;
	}
	.mini.today {
		box-shadow: inset 0 0 0 1px var(--accent-line);
	}
	.mini.sel {
		background: var(--accent);
		color: var(--text-onaccent);
	}
	.foot {
		display: flex;
		gap: var(--sp-2);
		width: 100%;
	}

	/* range */
	.range {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.range-val {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--fg);
	}
	.ph {
		color: var(--fg-muted);
	}
	.days {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-dim);
	}
	.range-body {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-5);
	}
	.range-month {
		flex: 1;
	}
	.mini.span {
		background: var(--accent-faint);
		border-radius: 0;
	}
	.mini.edge-l {
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
	}
	.mini.edge-r {
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
	}
	.mini.edge-l.edge-r {
		border-radius: var(--radius-sm);
	}
</style>
