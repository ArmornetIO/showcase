<script lang="ts">
	import type { ChoiceOption } from './choice.types.js';

	interface Props {
		options: ChoiceOption[];
		value: string;
		onchange: (v: string) => void;
		name?: string;
		disabled?: boolean;
		variant?: 'list' | 'inline' | 'card';
	}

	let { options, value, onchange, name = '', disabled = false, variant = 'list' }: Props = $props();
</script>

{#if variant === 'card'}
	<div class="card-grp">
		{#each options as opt (opt.value)}
			<label class="radio-card {disabled ? 'is-disabled' : ''}">
				<input
					type="radio"
					{name}
					value={opt.value}
					checked={value === opt.value}
					{disabled}
					onchange={() => { if (!disabled) onchange(opt.value); }}
				/>
				<span class="rc-key"></span>
				<span class="rc-body">
					<span class="rc-title">{opt.label}</span>
					{#if opt.description}
						<span class="rc-desc">{opt.description}</span>
					{/if}
				</span>
			</label>
		{/each}
	</div>
{:else}
	<div class="radio-grp {variant === 'inline' ? 'inline' : ''}" role="radiogroup">
		{#each options as opt (opt.value)}
			<label class="radio {disabled ? 'is-disabled' : ''}">
				<input
					type="radio"
					{name}
					value={opt.value}
					checked={value === opt.value}
					{disabled}
					onchange={() => { if (!disabled) onchange(opt.value); }}
				/>
				<span class="rk"></span>
				{opt.label}
			</label>
		{/each}
	</div>
{/if}

<style>
	/* ── List & Inline ── */
	.radio-grp {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.radio-grp.inline {
		flex-direction: row;
		gap: 20px;
		flex-wrap: wrap;
	}
	.radio {
		display: inline-flex;
		align-items: center;
		gap: 11px;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 13px;
		letter-spacing: .05em;
		color: var(--fg-muted);
		user-select: none;
	}
	.radio input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.radio .rk {
		position: relative;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		background: var(--surface-raised);
		transition: all .18s ease;
	}
	.radio .rk::after {
		content: '';
		position: absolute;
		inset: 0;
		margin: auto;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		transform: scale(0);
		transition: transform .18s cubic-bezier(.5,1.6,.5,1);
	}
	.radio input:checked + .rk {
		border-color: var(--accent);
		box-shadow: 0 0 10px -2px var(--accent);
	}
	.radio input:checked + .rk::after {
		transform: scale(1);
		box-shadow: 0 0 6px var(--accent);
	}
	.radio input:focus-visible + .rk {
		box-shadow: 0 0 0 2px var(--accent-faint-strong);
	}
	.radio input:disabled + .rk {
		opacity: .4;
	}
	.radio.is-disabled {
		cursor: not-allowed;
		color: var(--fg-dim);
	}
	.radio:hover input:not(:disabled) + .rk {
		border-color: var(--accent);
	}

	/* ── Card ── */
	.card-grp {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.radio-card {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--surface-raised);
		cursor: pointer;
		transition: all .2s ease;
		clip-path: polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
	}
	.radio-card:hover {
		border-color: var(--border-strong);
	}
	.radio-card input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.radio-card .rc-key {
		margin-top: 2px;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		position: relative;
		transition: all .18s ease;
	}
	.radio-card .rc-key::after {
		content: '';
		position: absolute;
		inset: 0;
		margin: auto;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		transform: scale(0);
		transition: transform .18s cubic-bezier(.5,1.6,.5,1);
	}
	.radio-card .rc-body {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.radio-card .rc-title {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: .08em;
		text-transform: uppercase;
		color: var(--fg);
	}
	.radio-card .rc-desc {
		font-family: var(--sans-brand);
		font-size: 13px;
		color: var(--fg-dim);
		line-height: 1.4;
	}
	.radio-card input:checked ~ .rc-key {
		border-color: var(--accent);
		box-shadow: 0 0 8px -2px var(--accent);
	}
	.radio-card input:checked ~ .rc-key::after {
		transform: scale(1);
	}
	.radio-card:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-faint);
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}
	.radio-card.is-disabled {
		cursor: not-allowed;
		opacity: .5;
	}
</style>
