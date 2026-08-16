<script lang="ts">
	import Input from './Input.svelte';
	import Icon from '../../icons/Icon.svelte';
	import type { InputStatus, InputSize } from './Input.svelte';

	interface PasswordInputProps {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		id?: string;
		name?: string;
		status?: InputStatus;
		size?: InputSize;
		class?: string;
		oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
		onchange?: (e: Event & { currentTarget: HTMLInputElement }) => void;
	}

	let {
		value = $bindable(''),
		placeholder,
		disabled = false,
		required = false,
		id,
		name,
		status = 'default',
		size = 'md',
		class: cls = '',
		oninput,
		onchange
	}: PasswordInputProps = $props();

	let revealed = $state(false);
</script>

<div class="pw-wrap">
	<Input
		type={revealed ? 'text' : 'password'}
		bind:value
		{placeholder}
		{disabled}
		{required}
		{id}
		{name}
		{status}
		{size}
		class="pw-input {cls}"
		{oninput}
		{onchange}
	/>
	<button
		type="button"
		class="pw-reveal"
		onclick={() => (revealed = !revealed)}
		aria-label={revealed ? 'Hide' : 'Show'}
		aria-pressed={revealed}
		tabindex={-1}
	>
		<Icon name={revealed ? 'eye-off' : 'eye'} size={14} strokeWidth={1.75} />
	</button>
</div>

<style>
	.pw-wrap {
		position: relative;
	}
	/* Push the native input's text away from the reveal button */
	.pw-wrap :global(.pw-input) {
		padding-right: 2.2rem;
	}
	.pw-reveal {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: none;
		background: none;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition: color 0.15s;
	}
	.pw-reveal:hover {
		color: var(--fg);
	}
</style>
