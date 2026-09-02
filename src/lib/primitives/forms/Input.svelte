<script lang="ts">
	export type InputType = 'text' | 'search' | 'url' | 'email' | 'password' | 'number';
	export type InputStatus = 'default' | 'error' | 'success' | 'warn';
	export type InputSize = 'sm' | 'md' | 'lg';

	interface InputProps {
		type?: InputType;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		readonly?: boolean;
		id?: string;
		name?: string;
		/** Visual state — drives border + focus color. */
		status?: InputStatus;
		size?: InputSize;
		/** Numeric constraints — forwarded to `<input>`; `type="number"` only. */
		min?: number | string;
		max?: number | string;
		step?: number | string;
		class?: string;
		oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
		onchange?: (e: Event & { currentTarget: HTMLInputElement }) => void;
		onkeydown?: (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
	}

	let {
		type = 'text',
		value = $bindable(''),
		placeholder,
		disabled = false,
		required = false,
		readonly = false,
		id,
		name,
		status = 'default',
		size = 'md',
		min,
		max,
		step,
		class: cls = '',
		oninput,
		onchange,
		onkeydown
	}: InputProps = $props();
</script>

<input
	{type}
	bind:value
	{placeholder}
	{disabled}
	{required}
	{id}
	{name}
	readonly={readonly}
	{min}
	{max}
	{step}
	{oninput}
	{onchange}
	{onkeydown}
	class="input input-{status} input-{size} {cls}"
/>

<style>
	.input {
		width: 100%;
		font-family: var(--sans-brand);
		color: var(--fg);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		outline: none;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.input::placeholder { color: var(--fg-dim); }
	.input:disabled { opacity: 0.5; cursor: not-allowed; }

	/* ── Sizes ────────────────────────────────────────────────────────────── */
	/* Size changes the box, not the corner: a 6/7/8 ramp across sizes was a 1px
	   delta nobody could read, and it fought the tier the field already sits in. */
	.input-sm { font-size: 13px; padding: 8px 11px; }
	.input-md { font-size: 15px; padding: 11px 13px; }
	.input-lg { font-size: 17px; padding: 14px 15px; }

	/* ── Status — focus = 1px ring + outer halo (matches mockup) ──────────── */
	.input-default:focus {
		border-color: var(--accent);
		box-shadow:
			0 0 0 1px var(--accent-faint-strong),
			0 0 16px var(--accent-faint);
	}

	.input-error { border-color: rgba(252, 165, 165, 0.5); }
	.input-error:focus {
		border-color: var(--palette-red);
		box-shadow:
			0 0 0 1px rgba(252, 165, 165, 0.45),
			0 0 16px rgba(252, 165, 165, 0.18);
	}

	.input-success { border-color: rgba(52, 211, 153, 0.45); }
	.input-success:focus {
		border-color: var(--palette-emerald);
		box-shadow:
			0 0 0 1px rgba(52, 211, 153, 0.45),
			0 0 16px rgba(52, 211, 153, 0.18);
	}

	.input-warn { border-color: rgba(252, 211, 77, 0.5); }
	.input-warn:focus {
		border-color: var(--palette-amber);
		box-shadow:
			0 0 0 1px rgba(252, 211, 77, 0.5),
			0 0 16px rgba(252, 211, 77, 0.18);
	}
</style>