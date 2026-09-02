<script lang="ts">
	interface ChipInputProps {
		value?: string[];
		placeholder?: string;
		id?: string;
		class?: string;
		disabled?: boolean;
	}

	let {
		value = $bindable([]),
		placeholder = 'Add tag…',
		id,
		class: cls = '',
		disabled = false
	}: ChipInputProps = $props();

	let inputVal = $state('');

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
	{#each value as chip}
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
