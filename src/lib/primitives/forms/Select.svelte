<script lang="ts" module>
	import type { IconName } from '../../icons/Icon.svelte';
	import type { MotionExit } from '../../motion/exits.js';
	import { advancedSettings } from '../../settings/store.svelte.js';

	export interface SelectOption {
		value: string;
		label: string;
		disabled?: boolean;
		icon?: IconName;
		/** Any CSS colour, applied to the option's icon and, when selected, its label. */
		color?: string;
	}

	export interface SelectOptGroup {
		group: string;
		options: SelectOption[];
	}

	/** A row. With `value` it is a choice; with `onclick` it is an action — a
	 *  menu of actions is a select whose choices do something instead of being
	 *  remembered. */
	export interface SelectEntry {
		kind?: 'item';
		label: string;
		value?: string;
		icon?: IconName;
		color?: string;
		destructive?: boolean;
		disabled?: boolean;
		/** Overrides the `value` match — for menus that track selection themselves. */
		selected?: boolean;
		onclick?: () => void;
	}

	/** A non-interactive group label. */
	export interface SelectHeader {
		kind: 'header';
		label: string;
	}

	/** A hairline rule between groups. */
	export interface SelectSeparator {
		kind: 'separator';
	}

	export type SelectItem = SelectEntry | SelectHeader | SelectSeparator;

	/**
	 * Where the panel goes, as `<side>-<align>`.
	 *
	 * A PREFERENCE, not an instruction: the side flips when the preferred one has
	 * no room and the other has more. A panel that only ever opened downward
	 * rendered below the viewport the first time one appeared in a footer, so
	 * the control looked inert. Alignment never flips — a control that jumps
	 * horizontally under the cursor is harder to use than one slightly off-edge.
	 */
	export type SelectPlacement = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

	export interface SelectDismissConfig {
		enabled: boolean;
		/** Idle time before the panel closes itself, in ms. */
		idleMs: number;
		/** Keyboard users never generate hover, so without this the panel closes under them. */
		pauseOnFocusWithin: boolean;
		pauseOnHover: boolean;
		/** Exit transition, run as the panel node is destroyed. */
		exit: MotionExit;
		exitMs: number;
	}

	/** `false` to opt out, or a partial override. */
	export type SelectDismiss = boolean | Partial<SelectDismissConfig>;

	/**
	 * The behavioural half of the auto-dismiss policy. `enabled` is false: a
	 * panel that closes itself on a timer is hostile to anyone still reading it.
	 * The motion half (exit, idle window) comes from the global settings store at
	 * resolve time, so changing the app's motion changes every panel at once.
	 */
	export const SELECT_DISMISS: Readonly<
		Omit<SelectDismissConfig, 'exit' | 'exitMs' | 'idleMs'>
	> = Object.freeze({
		enabled: false,
		pauseOnFocusWithin: true,
		pauseOnHover: true
	});

	/**
	 * Layer defaults → global motion settings → the call site's override. A
	 * partial override implies opt-in: tuning a timer you never enabled is never
	 * the intent. Reads reactive state, so call it from a `$derived`.
	 */
	export function resolveDismiss(v: SelectDismiss | undefined): SelectDismissConfig {
		const spec = advancedSettings.exit;
		const base: SelectDismissConfig = {
			...SELECT_DISMISS,
			idleMs: advancedSettings.overlayIdleMs,
			exit: spec.transition,
			exitMs: spec.duration
		};
		if (v === undefined) return base;
		if (typeof v === 'boolean') return { ...base, enabled: v };
		return { ...base, enabled: true, ...v };
	}
</script>

<script lang="ts">
	// ── Select — the house dropdown ───────────────────────────────────────────
	// Not a native <select>: the browser draws that list itself, so it ignores
	// every token and looks different on each OS. This one owns the panel, and
	// ActionsMenu is built on it — one dropdown in the library, not two.
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';
	import { portal } from '../portal.js';

	interface SelectProps {
		/** On the trigger, so a `<label for>` focuses it. */
		id?: string;
		/** Submits `value` with a surrounding form, as a native select would. */
		name?: string;
		value?: string;
		options?: SelectOption[];
		groups?: SelectOptGroup[];
		/** Full control over the rows — headers, separators, actions. Wins over
		 *  `options` and `groups`. */
		items?: SelectItem[];
		placeholder?: string;
		disabled?: boolean;
		class?: string;
		icon?: IconName;
		/** `md` is a form field; `sm` sits inline in a table row or toolbar. */
		size?: 'md' | 'sm';
		/** Trigger width. A prop, not a class: scoped styles outrank utilities.
		 *  Defaults to 260px at `md` and to its content at `sm`. */
		width?: string;
		/** Fired with the picked value, only when it changed. */
		onchange?: (value: string) => void;
		/** Pick several: chips in the field, checkbox rows, and the panel stays
		 *  open between picks. Reads and writes `values`, not `value`. */
		multiple?: boolean;
		values?: string[];
		onvalues?: (values: string[]) => void;
		/** Type in the field to filter the rows. With `multiple` this is the
		 *  chips-plus-typeahead autocomplete. */
		searchable?: boolean;
		/** Offer the typed text as a row of its own when nothing matches it —
		 *  for open sets like domains and tags. Implies `searchable`. */
		creatable?: boolean;
		/** Replace the default field-style trigger. */
		trigger?: Snippet<[{ open: boolean; toggle: () => void }]>;
		/** Accessible name for the trigger. */
		label?: string;
		placement?: SelectPlacement;
		/** Defaults to `!multiple`: closing after each tick makes choosing three
		 *  things cost three openings. */
		closeOnSelect?: boolean;
		/** Content pinned under the rows — for the one input a list cannot
		 *  express. Clicks inside it do not dismiss the panel. */
		footer?: Snippet;
		/** The same, above the rows — a page's own search box, say. */
		header?: Snippet;
		autoDismiss?: SelectDismiss;
		/** Fired when the idle timer — not a click or Escape — closed the panel. */
		ondismiss?: () => void;
		onopenchange?: (open: boolean) => void;
	}

	let {
		id,
		name,
		value = $bindable(''),
		options = [],
		groups = [],
		items,
		placeholder,
		disabled = false,
		class: cls = '',
		icon,
		size = 'md',
		width,
		onchange,
		multiple = false,
		values = $bindable([]),
		onvalues,
		searchable: searchableProp = false,
		creatable = false,
		trigger,
		label,
		placement = 'bottom-start',
		closeOnSelect,
		footer,
		header,
		autoDismiss,
		ondismiss,
		onopenchange
	}: SelectProps = $props();

	const rows = $derived<SelectItem[]>(
		items ??
			(groups.length
				? groups.flatMap((g) => [{ kind: 'header', label: g.group } as SelectItem, ...g.options])
				: options)
	);

	const uid = $props.id();
	const menuId = `${uid}-menu`;
	const searchable = $derived(searchableProp || creatable);
	const keepOpen = $derived(!(closeOnSelect ?? !multiple));

	const isEntry = (r: SelectItem): r is SelectEntry => r.kind !== 'header' && r.kind !== 'separator';
	const isSelected = (e: SelectEntry) =>
		e.selected ??
		(e.value !== undefined && (multiple ? values.includes(e.value) : e.value === value));
	const current = $derived(rows.find((r): r is SelectEntry => isEntry(r) && isSelected(r)));
	/** A chip's label; a created value has no row, so it is its own label. */
	const labelFor = (v: string) =>
		rows.find((r): r is SelectEntry => isEntry(r) && r.value === v)?.label ?? v;

	// ── Search ────────────────────────────────────────────────────────────────
	let query = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);
	const q = $derived(query.trim());
	// Headers and separators drop out while filtering: a header over a filtered
	// group is noise when most groups are empty.
	const shown = $derived.by<SelectItem[]>(() => {
		if (!q) return rows;
		const lq = q.toLowerCase();
		const hits = rows.filter((r): r is SelectEntry => isEntry(r) && r.label.toLowerCase().includes(lq));
		const known =
			hits.some((h) => h.label.toLowerCase() === lq || h.value?.toLowerCase() === lq) ||
			values.some((v) => v.toLowerCase() === lq);
		return creatable && !known ? [...hits, { label: `Add "${q}"`, value: q, icon: 'plus' }] : hits;
	});
	// While searching, focus stays in the input; the arrow keys move this
	// highlight instead of focus.
	let activeIdx = $state(-1);
	const pickable = $derived(shown.filter((r): r is SelectEntry => isEntry(r) && !r.disabled));
	const activeEntry = $derived(pickable[activeIdx]);
	$effect(() => {
		// Typing highlights the best match, so Enter takes it.
		activeIdx = q ? 0 : -1;
	});
	$effect(() => {
		if (activeEntry && menuEl) menuEl.querySelector('.menu-item.active')?.scrollIntoView({ block: 'nearest' });
	});

	const dismiss = $derived(resolveDismiss(autoDismiss));
	const exit = $derived(dismiss.exit);

	let open = $state(false);
	let triggerEl = $state<HTMLElement | null>(null);
	let menuEl = $state<HTMLElement | null>(null);
	/** Which way it opened, so the entrance moves toward the trigger. */
	let up = $state(false);
	let menuStyle = $state('');

	// ── Auto-dismiss ──────────────────────────────────────────────────────────
	let hovered = $state(false);
	let focusWithin = $state(false);
	const held = $derived(
		(dismiss.pauseOnHover && hovered) || (dismiss.pauseOnFocusWithin && focusWithin)
	);

	$effect(() => {
		if (!open || !dismiss.enabled || held) return;
		const t = setTimeout(() => {
			close();
			ondismiss?.();
		}, dismiss.idleMs);
		return () => clearTimeout(t);
	});

	/** The trigger and the panel are siblings, not nested. */
	function within(t: Node | null): boolean {
		return !!t && ((triggerEl?.contains(t) ?? false) || (menuEl?.contains(t) ?? false));
	}

	// Only VISIBLE focus holds the panel open: clicking the trigger focuses it,
	// so counting plain focus would let every click-opened panel pin itself open.
	function setFocusWithin(t: Node | null) {
		if (!within(t)) {
			focusWithin = false;
			return;
		}
		const el = t as Element;
		focusWithin = typeof el.matches === 'function' ? el.matches(':focus-visible') : true;
	}

	// Tracked at the window: `.trigger-wrap` is `display: contents`, so it has no
	// box to enter.
	function trackHover(e: PointerEvent) {
		if (!open) return;
		hovered = within(e.target as Node | null);
	}

	const GAP = 4;

	function calcPosition() {
		if (!triggerEl) return;
		const r = (triggerEl.firstElementChild ?? triggerEl).getBoundingClientRect();
		const align = placement.endsWith('-start') ? 'start' : 'end';
		const want = placement.startsWith('top') ? 'top' : 'bottom';

		// Height is only knowable after render: the open pass assumes it fits and
		// the effect below re-runs this with a real measurement, before paint.
		const room = { bottom: window.innerHeight - r.bottom - GAP, top: r.top - GAP };
		const need = menuEl?.getBoundingClientRect().height ?? 0;
		const other = want === 'bottom' ? 'top' : 'bottom';
		// Flip only when the other side is roomier too, or a panel taller than
		// the window would flip on every measurement.
		const side = need > room[want] && room[other] > room[want] ? other : want;
		up = side === 'top';

		const y =
			side === 'bottom'
				? `top:${r.bottom + GAP}px`
				: `bottom:${window.innerHeight - r.top + GAP}px`;
		const x = align === 'end' ? `right:${window.innerWidth - r.right}px` : `left:${r.left}px`;
		// At least as wide as a field trigger, so the list lines up under it.
		menuStyle = `${y};${x};min-width:max(176px, ${r.width}px);max-height:${Math.max(room.bottom, room.top)}px;--exit-origin:${side === 'bottom' ? 'top' : 'bottom'} ${align === 'end' ? 'right' : 'left'}`;
	}

	$effect(() => {
		if (open && menuEl) calcPosition();
	});

	const entryEls = () =>
		Array.from(menuEl?.querySelectorAll<HTMLButtonElement>('.menu-item:not(:disabled)') ?? []);

	// Focus lands on the current choice, so the arrow keys start from it. Not
	// while searching: focus belongs to the input the user is typing in.
	$effect(() => {
		if (!open || !menuEl || searchable) return;
		const els = entryEls();
		(els.find((el) => el.getAttribute('aria-checked') === 'true') ?? els[0])?.focus();
	});

	function toggle() {
		if (disabled) return;
		if (!open) {
			calcPosition();
			// Assume hover until the first pointerover says otherwise, or the timer
			// runs from a standing start under a pointer that has not moved yet.
			hovered = true;
		}
		open = !open;
		onopenchange?.(open);
	}

	function close() {
		if (!open) return;
		open = false;
		hovered = false;
		focusWithin = false;
		query = '';
		onopenchange?.(false);
	}

	// `.sel-focus` marks the field's own control; a chip's × comes first in the
	// DOM and must not be where focus returns to.
	const focusTrigger = () =>
		(
			(triggerEl?.querySelector('.sel-focus') ?? triggerEl?.firstElementChild) as HTMLElement | null
		)?.focus();

	function setValues(next: string[]) {
		values = next;
		onvalues?.(next);
	}

	function pick(e: SelectEntry) {
		e.onclick?.();
		if (e.value !== undefined) {
			if (multiple) {
				const v = e.value;
				setValues(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
			} else if (e.value !== value) {
				value = e.value;
				onchange?.(e.value);
			}
		}
		query = '';
		if (!keepOpen) {
			close();
			if (!searchable) focusTrigger();
		}
	}

	function onInputKeydown(e: KeyboardEvent) {
		const n = pickable.length;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) return toggle();
			if (n) activeIdx = e.key === 'ArrowDown' ? (activeIdx + 1) % n : (activeIdx - 1 + n) % n;
		} else if (e.key === 'Enter' && open && activeEntry) {
			e.preventDefault();
			pick(activeEntry);
		} else if (e.key === 'Backspace' && !query && multiple && values.length) {
			setValues(values.slice(0, -1));
		} else if (e.key === 'Tab') {
			close();
		}
	}

	// A click on the field's padding, not on one of its controls.
	function onFieldClick(e: MouseEvent) {
		if (disabled || e.target !== e.currentTarget) return;
		if (searchable) inputEl?.focus();
		else toggle();
	}

	// A click inside the panel is not an outside click; rows that dismiss call
	// close() themselves, so multi-pick ticks and footer fields stay open.
	function handleWindowClick(e: MouseEvent) {
		if (!open || within(e.target as Node | null)) return;
		close();
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			close();
			focusTrigger();
		}
	}

	function onMenuKeydown(e: KeyboardEvent) {
		// Home/End belong to a header or footer text field, not the row list.
		if ((e.key === 'Home' || e.key === 'End') && e.target instanceof HTMLInputElement) return;
		const els = entryEls();
		const i = els.indexOf(document.activeElement as HTMLButtonElement);
		const to =
			e.key === 'ArrowDown'
				? (i + 1) % els.length
				: e.key === 'ArrowUp'
					? (i - 1 + els.length) % els.length
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? els.length - 1
							: -1;
		if (e.key === 'Tab') close();
		if (to < 0 || !els.length) return;
		e.preventDefault();
		els[to].focus();
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
			e.preventDefault();
			toggle();
		}
	}
</script>

<svelte:window
	onclick={handleWindowClick}
	onkeydown={handleWindowKeydown}
	onfocusin={(e) => setFocusWithin(e.target as Node | null)}
	onfocusout={(e) => setFocusWithin(e.relatedTarget as Node | null)}
	onpointerover={trackHover}
/>

<span class="trigger-wrap" bind:this={triggerEl}>
	{#if trigger}
		{@render trigger({ open, toggle })}
	{:else if multiple || searchable}
		<!-- A field rather than a button: it holds chips and an input, which a
		     button may not contain. -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="select-wrap field size-{size} {cls}"
			class:has-key={!!icon}
			class:open
			class:is-disabled={disabled}
			class:searchable
			style:--sel-w={width}
			onclick={onFieldClick}
		>
			{#if icon}
				<span class="sel-key"><Icon name={icon} size={size === 'sm' ? 12 : 15} /></span>
			{/if}
			{#if multiple}
				{#each values as v (v)}
					<span class="sel-chip">
						{labelFor(v)}
						<button
							type="button"
							class="sel-chip-x"
							aria-label="Remove {labelFor(v)}"
							{disabled}
							onclick={() => setValues(values.filter((x) => x !== v))}
						>
							<Icon name="x" size={11} />
						</button>
					</span>
				{/each}
			{/if}
			{#if searchable}
				<input
					bind:this={inputEl}
					bind:value={query}
					{id}
					class="sel-input sel-focus"
					class:has-value={!multiple && !!current}
					placeholder={multiple
						? values.length
							? ''
							: (placeholder ?? '')
						: (current?.label ?? placeholder ?? '')}
					{disabled}
					role="combobox"
					aria-controls={menuId}
					aria-expanded={open}
					aria-haspopup="menu"
					aria-label={label}
					autocomplete="off"
					spellcheck="false"
					onfocus={() => !open && toggle()}
					onclick={() => !open && toggle()}
					oninput={() => !open && toggle()}
					onkeydown={onInputKeydown}
				/>
			{:else}
				<button
					type="button"
					{id}
					class="sel-field-btn sel-focus"
					{disabled}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={label}
					onclick={toggle}
					onkeydown={onTriggerKeydown}
				>
					{#if !values.length}<span class="is-placeholder">{placeholder ?? ''}</span>{/if}
				</button>
			{/if}
			<Icon name="chevron-down" size={size === 'sm' ? 12 : 15} class="caret" />
		</div>
	{:else}
		<button
			type="button"
			{id}
			class="select-wrap size-{size} {cls}"
			class:has-key={!!icon}
			class:open
			style:--sel-w={width}
			{disabled}
			aria-haspopup="menu"
			aria-expanded={open}
			aria-label={label}
			onclick={toggle}
			onkeydown={onTriggerKeydown}
		>
			{#if icon}
				<span class="sel-key"><Icon name={icon} size={15} /></span>
			{/if}
			<span class="sel-value" class:is-placeholder={!current}>
				{current?.label ?? placeholder ?? ''}
			</span>
			<Icon name="chevron-down" size={size === 'sm' ? 12 : 15} class="caret" />
		</button>
	{/if}
	{#if name && multiple}
		{#each values as v (v)}<input type="hidden" {name} value={v} />{/each}
	{:else if name}
		<input type="hidden" {name} {value} />
	{/if}
</span>

{#if open}
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="menu"
		class:up
		style={menuStyle}
		id={menuId}
		role="menu"
		tabindex="-1"
		bind:this={menuEl}
		use:portal
		onkeydown={onMenuKeydown}
		out:exit={{ duration: dismiss.enabled ? dismiss.exitMs : 0 }}
	>
		{#if header}
			<div class="menu-footer">{@render header()}</div>
			<div class="menu-sep" role="separator"></div>
		{/if}
		<!-- Keyed by position as well as label: separators carry no label, and two
		     groups can legitimately hold same-named entries. -->
		{#each shown as item, i (`${i}:${item.kind ?? 'item'}:${'label' in item ? item.label : ''}`)}
			{#if item.kind === 'separator'}
				<div class="menu-sep" role="separator"></div>
			{:else if item.kind === 'header'}
				<span class="menu-header" role="presentation">{item.label}</span>
			{:else}
				{@const selected = isSelected(item)}
				<button
					type="button"
					class="menu-item"
					class:destructive={item.destructive}
					class:selected
					class:active={item === activeEntry}
					style={item.color ? `--item-color:${item.color}` : undefined}
					disabled={item.disabled}
					role={keepOpen ? 'menuitemcheckbox' : 'menuitemradio'}
					aria-checked={selected}
					onmousedown={(e) => searchable && e.preventDefault()}
					onclick={() => pick(item)}
				>
					{#if item.icon}
						<span class="item-icon"><Icon name={item.icon} size={13} /></span>
					{/if}
					<span class="item-label">{item.label}</span>
					{#if selected}
						<span class="item-check"><Icon name="check" size={13} /></span>
					{/if}
				</button>
			{/if}
		{:else}
			{#if !header}<span class="menu-empty">{q ? 'No matches' : 'Nothing to pick'}</span>{/if}
		{/each}
		{#if footer}
			<div class="menu-sep" role="separator"></div>
			<div class="menu-footer">{@render footer()}</div>
		{/if}
	</div>
{/if}

<style>
	.trigger-wrap {
		display: contents;
	}

	/* ── Default trigger — a form field ──────────────────────────────────── */
	.select-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		width: var(--sel-w, 260px);
		max-width: 100%;
		padding: 10px 38px 10px 13px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}
	.select-wrap:hover:not(:disabled) {
		border-color: var(--border-strong);
	}
	.select-wrap:focus-visible,
	.select-wrap.open {
		outline: none;
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent-faint-strong),
			0 0 16px var(--accent-faint);
	}
	.select-wrap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.has-key {
		padding-left: 36px;
	}
	.size-sm {
		width: var(--sel-w, auto);
		padding: 0.25rem 1.5rem 0.25rem 0.5rem;
		font-size: 0.72rem;
	}
	.size-sm.has-key {
		padding-left: 1.6rem;
	}
	.size-sm :global(.caret) {
		right: 0.4rem;
	}
	.size-sm .sel-key {
		left: 0.45rem;
	}

	/* ── Field trigger — chips and/or a search input ─────────────────────── */
	.field {
		flex-wrap: wrap;
		gap: 6px;
		min-height: 40px;
		padding: 6px 38px 6px 10px;
		cursor: pointer;
	}
	.field.searchable {
		cursor: text;
	}
	.field.has-key {
		padding-left: 36px;
	}
	.field.size-sm {
		gap: 4px;
		min-height: 0;
		padding: 0.15rem 1.5rem 0.15rem 0.3rem;
	}
	.field.size-sm.has-key {
		padding-left: 1.6rem;
	}
	.field:focus-within {
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent-faint-strong),
			0 0 16px var(--accent-faint);
	}
	.field.is-disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.sel-input,
	.sel-field-btn {
		flex: 1;
		min-width: 6ch;
		align-self: stretch;
		padding: 2px 3px;
		border: 0;
		background: transparent;
		color: var(--fg);
		font: inherit;
		text-align: left;
		outline: none;
	}
	.sel-field-btn {
		cursor: pointer;
	}
	.sel-input::placeholder,
	.is-placeholder {
		color: var(--fg-dim);
	}
	/* Single searchable: the current choice sits in the placeholder, so typing
	   replaces it — and it has to read as a value, not a hint. */
	.sel-input.has-value::placeholder {
		color: var(--fg);
	}
	.sel-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		padding: 2px 3px 2px 8px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-control);
		background: var(--accent-faint);
		color: var(--accent);
		font-size: 11px;
		white-space: nowrap;
	}
	.size-sm .sel-chip {
		padding: 0 2px 0 6px;
		font-size: 0.66rem;
	}
	.sel-chip-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-inset);
		background: none;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.sel-chip-x:hover,
	.sel-chip-x:focus-visible {
		outline: none;
		color: var(--accent);
		background: var(--accent-faint-strong);
	}
	.sel-value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		/* Keeps an empty trigger the same height as a filled one. */
		min-height: 1lh;
	}
	.sel-value.is-placeholder {
		color: var(--fg-dim);
	}
	.select-wrap :global(.caret) {
		position: absolute;
		right: 12px;
		color: var(--fg-dim);
		pointer-events: none;
		transition: transform 0.15s ease;
	}
	.select-wrap.open :global(.caret) {
		transform: rotate(180deg);
	}
	.sel-key {
		position: absolute;
		left: 11px;
		display: flex;
		align-items: center;
		color: var(--accent);
		pointer-events: none;
	}

	/* ── Panel ───────────────────────────────────────────────────────────── */
	/* The house popover recipe, shared with PageContextMenu's panels, AppShell's
	   org switcher and BulkActionBar's overflow. */
	.menu {
		position: fixed;
		z-index: 8000;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.5rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
		overflow-y: auto;
		outline: none;
		animation: menu-in 0.12s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	/* Opening upward, the panel settles DOWN onto its trigger. */
	.menu.up {
		animation-name: menu-in-up;
	}
	@keyframes menu-in-up {
		from {
			opacity: 0;
			transform: translateY(4px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Callers pass sentence case — the uppercasing belongs here. */
	.menu-header {
		padding: 0.375rem 0.5rem 0.125rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
		line-height: 1.4;
		user-select: none;
	}
	.menu-header:first-child {
		padding-top: 0;
	}
	.menu-empty {
		padding: 0.375rem 0.5rem;
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg-dim);
	}
	.menu-footer {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.125rem 0.5rem 0.25rem;
	}
	.menu-sep {
		flex-shrink: 0;
		height: 1px;
		margin: 0.25rem 0;
		background: var(--border);
	}

	.menu-item {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-control);
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.7rem;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.1s,
			color 0.1s;
	}
	.menu-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.menu-item:not(:disabled):hover,
	.menu-item:focus-visible,
	.menu-item.active {
		outline: none;
		background: var(--surface-raised);
		color: var(--fg);
	}
	.menu-item.destructive {
		color: var(--palette-red);
	}
	.menu-item.destructive:not(:disabled):hover {
		background: color-mix(in srgb, var(--palette-red) 10%, transparent);
		color: var(--palette-red-l);
	}
	.menu-item[style*='--item-color'] .item-icon,
	.menu-item[style*='--item-color'] .item-check {
		color: var(--item-color);
		opacity: 1;
	}
	.menu-item.selected {
		background: color-mix(in srgb, var(--item-color, var(--accent)) 12%, transparent);
	}
	.menu-item.selected .item-label {
		color: var(--item-color, var(--accent));
	}
	.item-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		opacity: 0.7;
	}
	.menu-item:hover .item-icon {
		opacity: 1;
	}
	.item-label {
		line-height: 1.2;
	}
	.item-check {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin-left: auto;
		color: var(--item-color, var(--accent));
	}
</style>
