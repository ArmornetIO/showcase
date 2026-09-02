<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';

	interface Props {
		/** Current set of selected chip values. */
		value?: string[];
		/** Suggestions shown in the dropdown (filtered by query). */
		suggestions?: string[];
		placeholder?: string;
		disabled?: boolean;
		onchange?: (values: string[]) => void;
	}

	let {
		value = $bindable([]),
		suggestions = [],
		placeholder = 'Add…',
		disabled = false,
		onchange
	}: Props = $props();

	let query = $state('');
	let open = $state(false);
	let activeIdx = $state(-1);
	let inputEl = $state<HTMLInputElement | null>(null);

	const filtered = $derived(() => {
		const q = query.trim().toLowerCase();
		return suggestions.filter(s => s.toLowerCase().includes(q) && !value.includes(s));
	});

	const showAdd = $derived(() => {
		const q = query.trim().toLowerCase();
		return q.length > 0 && !suggestions.includes(q) && !value.includes(q);
	});

	const opts = $derived(() => {
		const items = filtered().map(v => ({ val: v, isAdd: false }));
		if (showAdd()) items.push({ val: query.trim().toLowerCase(), isAdd: true });
		return items;
	});

	function addChip(val: string) {
		val = val.trim().toLowerCase();
		if (!val || value.includes(val)) { query = ''; return; }
		const next = [...value, val];
		value = next;
		onchange?.(next);
		query = '';
		activeIdx = -1;
	}

	function removeChip(val: string) {
		const next = value.filter(v => v !== val);
		value = next;
		onchange?.(next);
	}

	function removeLastChip() {
		if (value.length === 0) return;
		removeChip(value[value.length - 1]);
	}

	function handleKeydown(e: KeyboardEvent) {
		const total = opts().length;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIdx = total === 0 ? -1 : (activeIdx + 1) % total;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIdx = total === 0 ? -1 : (activeIdx - 1 + total) % total;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (activeIdx >= 0 && opts()[activeIdx]) {
				addChip(opts()[activeIdx].val);
			} else if (query.trim()) {
				addChip(query);
			}
		} else if (e.key === 'Backspace' && query === '') {
			removeLastChip();
		} else if (e.key === 'Escape') {
			open = false;
			activeIdx = -1;
		}
	}

	function handleBlur() {
		// small delay so mousedown on options fires first
		setTimeout(() => { open = false; activeIdx = -1; }, 120);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="combobox" class:disabled>
	<div class="cb-control" onclick={() => !disabled && inputEl?.focus()}>
		{#each value as chip (chip)}
			<span class="cb-chip">
				{chip}
				<button
					type="button"
					class="cb-x"
					aria-label="Remove {chip}"
					onclick={(e) => { e.stopPropagation(); removeChip(chip); }}
				>
					<Icon name="x" size={11} />
				</button>
			</span>
		{/each}
		<input
			bind:this={inputEl}
			bind:value={query}
			class="cb-input"
			{placeholder}
			{disabled}
			autocomplete="off"
			spellcheck="false"
			onfocus={() => { open = true; activeIdx = -1; }}
			onblur={handleBlur}
			oninput={() => { open = true; activeIdx = -1; }}
			onkeydown={handleKeydown}
		/>
	</div>

	<div class="cb-menu" class:open>
		{#if opts().length > 0}
			{#each opts() as opt, i (opt.val + opt.isAdd)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="cb-opt"
					class:active={i === activeIdx}
					onmousedown={(e) => { e.preventDefault(); addChip(opt.val); }}
				>
					<Icon name={opt.isAdd ? 'plus' : 'globe'} size={14} />
					{opt.val}
					{#if opt.isAdd}
						<span class="cb-add">add</span>
					{/if}
				</div>
			{/each}
		{:else if query.trim()}
			<div class="cb-empty">No matches</div>
		{/if}
	</div>
</div>

<style>
	.combobox {
		position: relative;
		width: 100%;
		max-width: 440px;
	}
	.combobox.disabled {
		opacity: .5;
		pointer-events: none;
	}
	.cb-control {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 7px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--surface-raised);
		cursor: text;
		transition: border-color .2s ease, box-shadow .2s ease;
	}
	.cb-control:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent-faint-strong), 0 0 16px var(--accent-faint);
	}
	.cb-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px 4px 10px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--accent);
		background: var(--accent-faint);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-control);
	}
	.cb-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		border-radius: var(--radius-inset);
		color: var(--fg-dim);
		cursor: pointer;
		transition: all .15s ease;
		background: none;
		border: none;
		padding: 0;
	}
	.cb-x:hover {
		color: var(--accent);
		background: var(--accent-faint-strong);
	}
	.cb-input {
		flex: 1;
		min-width: 90px;
		background: none;
		border: none;
		outline: none;
		color: var(--fg);
		font-family: var(--mono);
		font-size: 13px;
		padding: 4px 2px;
	}
	.cb-input::placeholder {
		color: var(--fg-dim);
	}
	.cb-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 50;
		background: var(--bg-elev);
		backdrop-filter: blur(20px);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		box-shadow: 0 12px 36px rgba(0,0,0,0.5);
		padding: 6px;
		opacity: 0;
		transform: translateY(-6px);
		pointer-events: none;
		transition: opacity .16s ease, transform .16s ease;
		max-height: 210px;
		overflow-y: auto;
	}
	.cb-menu.open {
		opacity: 1;
		transform: translateY(0);
		pointer-events: auto;
	}
	.cb-opt {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 10px;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--fg-muted);
		border-radius: var(--radius-control);
		cursor: pointer;
		transition: all .12s ease;
	}
	.cb-opt:hover,
	.cb-opt.active {
		background: var(--accent-faint);
		color: var(--accent);
	}
	.cb-add {
		margin-left: auto;
		font-size: 10px;
		color: var(--fg-dim);
		letter-spacing: .08em;
		text-transform: uppercase;
	}
	.cb-opt:hover .cb-add,
	.cb-opt.active .cb-add {
		color: var(--accent);
	}
	.cb-empty {
		padding: 10px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
		text-align: center;
	}
</style>
