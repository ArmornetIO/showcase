<script lang="ts">
	import Icon, { type IconName } from '../../icons/Icon.svelte';

	export interface SelectOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	export interface SelectOptGroup {
		group: string;
		options: SelectOption[];
	}

	interface SelectProps {
		id?: string;
		name?: string;
		value?: string;
		options?: SelectOption[];
		groups?: SelectOptGroup[];
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		class?: string;
		icon?: IconName;
		onchange?: (e: Event & { currentTarget: HTMLSelectElement }) => void;
	}

	let {
		id,
		name,
		value = $bindable(''),
		options = [],
		groups = [],
		placeholder,
		disabled = false,
		required = false,
		class: cls = '',
		icon,
		onchange
	}: SelectProps = $props();
</script>

<div class="select-wrap {cls}" class:has-key={!!icon}>
	{#if icon}
		<span class="sel-key">
			<Icon name={icon} size={15} />
		</span>
	{/if}
	<select
		{id}
		{name}
		bind:value
		{disabled}
		{required}
		{onchange}
	>
		{#if placeholder}
			<option value="" disabled>{placeholder}</option>
		{/if}

		{#if groups.length > 0}
			{#each groups as grp}
				<optgroup label={grp.group}>
					{#each grp.options as opt}
						<option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
					{/each}
				</optgroup>
			{/each}
		{:else}
			{#each options as opt}
				<option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
			{/each}
		{/if}
	</select>
	<svg
		class="caret"
		width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
	>
		<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
</div>

<style>
	.select-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		width: 260px;
	}
	select {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		padding: 10px 38px 10px 13px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 7px;
		color: var(--fg);
		font-family: var(--mono);
		font-size: 13px;
		outline: none;
		cursor: pointer;
		transition: border-color .2s ease, box-shadow .2s ease;
	}
	select:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent-faint-strong), 0 0 16px var(--accent-faint);
	}
	select:disabled {
		opacity: .5;
		cursor: not-allowed;
	}
	.select-wrap:hover select:not(:disabled) {
		border-color: var(--border-strong);
	}
	select option {
		background: var(--bg-elev);
		color: var(--fg);
	}
	select optgroup {
		background: var(--bg-elev);
		color: var(--fg-dim);
		font-style: normal;
	}
	.caret {
		position: absolute;
		right: 12px;
		color: var(--fg-dim);
		pointer-events: none;
		flex-shrink: 0;
	}
	.sel-key {
		position: absolute;
		left: 11px;
		color: var(--accent);
		pointer-events: none;
		display: flex;
		align-items: center;
	}
	.has-key select {
		padding-left: 36px;
	}
</style>
