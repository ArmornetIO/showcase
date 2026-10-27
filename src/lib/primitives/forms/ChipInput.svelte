<script lang="ts">
	import { tick } from 'svelte';

	interface ChipInputProps {
		value?: string[];
		placeholder?: string;
		id?: string;
		class?: string;
		disabled?: boolean;
		/** Order is meaning (a priority list): chips are numbered, draggable,
		 *  and move with Alt+←/→ when focused. */
		sortable?: boolean;
	}

	let {
		value = $bindable([]),
		placeholder = 'Add tag…',
		id,
		class: cls = '',
		disabled = false,
		sortable = false
	}: ChipInputProps = $props();

	let inputVal = $state('');
	let chipEls = $state<HTMLElement[]>([]);
	let dragFrom = $state<number | null>(null);
	let dropAt = $state<number | null>(null);
	const canSort = $derived(sortable && !disabled);

	function move(from: number, to: number) {
		if (to < 0 || to >= value.length || from === to) return;
		const next = [...value];
		next.splice(to, 0, ...next.splice(from, 1));
		value = next;
	}

	// Moving a focused node in the DOM blurs it; refocus so repeated Alt+arrow keeps going.
	async function moveAndFocus(from: number, to: number) {
		move(from, to);
		await tick();
		chipEls[Math.max(0, Math.min(to, value.length - 1))]?.focus();
	}

	function chipKeydown(e: KeyboardEvent, i: number) {
		if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
			e.preventDefault();
			moveAndFocus(i, i - 1);
		} else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
			e.preventDefault();
			moveAndFocus(i, i + 1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			chipEls[i - 1]?.focus();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			chipEls[i + 1]?.focus();
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			removeChip(value[i]);
			tick().then(() => chipEls[Math.min(i, value.length - 1)]?.focus());
		}
	}

	function drop(e: DragEvent, i: number) {
		e.preventDefault();
		if (dragFrom !== null) move(dragFrom, i);
		dragFrom = dropAt = null;
	}

	function addChip(raw: string) {
		const v = raw
			.trim()
			.replace(/,+$/, '')
			.trim();
		if (v && !value.includes(v)) {
			value = [...value, v];
		}
		inputVal = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addChip(inputVal);
		} else if (e.key === 'Backspace' && inputVal === '' && value.length > 0) {
			value = value.slice(0, -1);
		}
	}

	function handleInput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value;
		if (v.endsWith(',')) {
			addChip(v);
		}
	}

	function removeChip(chip: string) {
		value = value.filter((c) => c !== chip);
	}
</script>

<!-- A <label> natively focuses its nested input on click — no JS handler needed. -->
<label class="chip-input {cls}" aria-label="Tag input">
	{#each value as chip, i (chip)}
		{#if canSort}
			<!-- preventDefault on click: the wrapping <label> would otherwise steal focus to the text input. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
			<span
				bind:this={chipEls[i]}
				class="chip-item sortable"
				class:dragging={dragFrom === i}
				class:drop-before={dropAt === i && dragFrom !== null && dragFrom > i}
				class:drop-after={dropAt === i && dragFrom !== null && dragFrom < i}
				tabindex="0"
				draggable="true"
				aria-label="{chip}, {i + 1} of {value.length}. Alt+arrow to move."
				onclick={(e) => {
					e.preventDefault();
					chipEls[i]?.focus();
				}}
				onkeydown={(e) => chipKeydown(e, i)}
				ondragstart={(e) => {
					dragFrom = i;
					e.dataTransfer?.setData('text/plain', chip);
				}}
				ondragover={(e) => {
					e.preventDefault();
					dropAt = i;
				}}
				ondragleave={() => dropAt === i && (dropAt = null)}
				ondrop={(e) => drop(e, i)}
				ondragend={() => (dragFrom = dropAt = null)}
			>
				<span class="chip-ord">{i + 1}</span>
				{chip}
				<button
					type="button"
					class="chip-remove"
					tabindex="-1"
					onclick={(e) => { e.stopPropagation(); removeChip(chip); }}
					aria-label="Remove {chip}"
				>×</button>
			</span>
		{:else}
		<span class="chip-item">
			{chip}
			{#if !disabled}
				<button
					type="button"
					class="chip-remove"
					onclick={(e) => { e.stopPropagation(); removeChip(chip); }}
					aria-label="Remove {chip}"
				>×</button>
			{/if}
		</span>
		{/if}
	{/each}
	{#if !disabled}
		<input
			{id}
			type="text"
			bind:value={inputVal}
			{placeholder}
			class="chip-text-input"
			onkeydown={handleKeydown}
			oninput={handleInput}
		/>
	{/if}
</label>

<style>
	.chip-input {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-height: 42px;
		padding: 6px 10px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		cursor: text;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.chip-input:focus-within {
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent-faint-strong),
			0 0 16px var(--accent-faint);
	}
	.chip-item {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px 2px 9px;
		background: var(--accent-faint);
		border: 1px solid rgba(94, 234, 212, 0.35);
		border-radius: 999px;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
		white-space: nowrap;
		line-height: 1.6;
	}
	.chip-item.sortable {
		cursor: grab;
		position: relative;
		outline: none;
	}
	.chip-item.sortable:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.chip-item.dragging {
		opacity: 0.4;
	}
	.chip-item.drop-before {
		box-shadow: -3px 0 0 var(--accent);
	}
	.chip-item.drop-after {
		box-shadow: 3px 0 0 var(--accent);
	}
	.chip-ord {
		font-size: 0.6rem;
		opacity: 0.6;
		margin-right: 2px;
	}
	.chip-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		padding: 0;
		font-size: 0.85rem;
		line-height: 1;
		border-radius: 50%;
		opacity: 0.7;
		transition: opacity 0.15s;
	}
	.chip-remove:hover {
		opacity: 1;
	}
	.chip-text-input {
		flex: 1;
		min-width: 120px;
		background: none;
		border: none;
		outline: none;
		font-family: var(--sans-brand);
		font-size: 13px;
		color: var(--fg);
		padding: 2px 0;
	}
	.chip-text-input::placeholder {
		color: var(--fg-dim);
	}
</style>
