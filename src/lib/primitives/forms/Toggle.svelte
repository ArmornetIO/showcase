<script module lang="ts">
	export type { ToggleVariant } from './toggle.types.js';
</script>

<script lang="ts">
	import type { ToggleVariant } from './toggle.types.js';

	interface Props {
		variant?: ToggleVariant;
		checked: boolean;
		disabled?: boolean;
		label?: string;
		onchange?: (checked: boolean) => void;
	}

	let { variant = 'default', checked, disabled = false, label, onchange }: Props = $props();

	function toggle() {
		if (!disabled) onchange?.(!checked);
	}
</script>

<!-- ─── Default ───────────────────────────────────────────────────────────────── -->
{#if variant === 'default'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="w-10 h-5 border flex items-center transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1
			{checked ? 'border-teal-300/50 bg-teal-300/10 justify-end' : 'border-[var(--border-strong)] bg-[var(--surface-raised)] justify-start'}"
	>
		<span class="w-3 h-3 mx-1 transition-colors duration-150 {checked ? 'bg-teal-300' : 'bg-[var(--fg-dim)]'}"></span>
	</button>

<!-- ─── Focus Scope ───────────────────────────────────────────────────────────── -->
{:else if variant === 'focus-scope'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative flex h-8 w-8 items-center justify-center border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1
			{checked ? 'border-cyan-400 bg-cyan-950/10' : 'border-[var(--control-border)] bg-transparent'}"
	>
		<div class="absolute h-5 w-5 border-x border-y transition-all duration-300
			{checked ? 'border-cyan-400 scale-75 rotate-45' : 'border-gray-700 scale-100 rotate-0'}"></div>
		<div class="h-1.5 w-1.5 transition-colors duration-300 {checked ? 'bg-cyan-400' : 'bg-gray-600'}"></div>
	</button>

<!-- ─── Pulse Phase ───────────────────────────────────────────────────────────── -->
{:else if variant === 'pulse-phase'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative flex w-16 flex-col items-stretch justify-center gap-1 border p-1.5 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1
			{checked ? 'border-indigo-500 bg-indigo-950/10' : 'border-[var(--control-border)] bg-[var(--control-bg)]'}"
	>
		<div class="h-3 w-full opacity-70">
			{#if checked}
				<svg class="h-full w-full text-indigo-400" viewBox="0 0 40 10" fill="none">
					<path d="M0 5h10l2-4 3 8 2-6 2 2h11" stroke="currentColor" stroke-width="1" stroke-linecap="square" />
				</svg>
			{:else}
				<svg class="h-full w-full text-gray-600" viewBox="0 0 40 10" fill="none">
					<path d="M0 5h40" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-dasharray="2 2" />
				</svg>
			{/if}
		</div>
		<span class="text-center font-mono text-[7px] tracking-widest {checked ? 'text-indigo-400' : 'text-gray-600'}">PULSE</span>
	</button>

<!-- ─── Node Target ───────────────────────────────────────────────────────────── -->
{:else if variant === 'node-target'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative flex h-8 w-8 items-center justify-center transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1
			{checked ? 'bg-teal-500/5' : 'bg-[var(--control-chassis)]'}"
	>
		<span class="absolute top-0 left-0 h-1.5 w-1.5 border-t border-l transition-colors duration-200 {checked ? 'border-teal-400' : 'border-[var(--control-inactive)]'}"></span>
		<span class="absolute top-0 right-0 h-1.5 w-1.5 border-t border-r transition-colors duration-200 {checked ? 'border-teal-400' : 'border-[var(--control-inactive)]'}"></span>
		<span class="absolute bottom-0 left-0 h-1.5 w-1.5 border-b border-l transition-colors duration-200 {checked ? 'border-teal-400' : 'border-[var(--control-inactive)]'}"></span>
		<span class="absolute bottom-0 right-0 h-1.5 w-1.5 border-b border-r transition-colors duration-200 {checked ? 'border-teal-400' : 'border-[var(--control-inactive)]'}"></span>
		<div class="h-2.5 w-2.5 transition-all duration-300
			{checked ? 'bg-teal-400 scale-100 shadow-[0_0_10px_rgba(45,212,191,0.8)]' : 'bg-[var(--control-surface)] scale-50'}"></div>
	</button>

<!-- ─── Power Breaker ─────────────────────────────────────────────────────────── -->
{:else if variant === 'power-breaker'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative h-8 w-14 overflow-hidden border border-[var(--control-border)] bg-black disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
	>
		<div class="absolute inset-x-0 bottom-0 h-1.5" style="background:repeating-linear-gradient(45deg,#27272a,#27272a 3px,#18181b 3px,#18181b 6px)"></div>
		<div class="absolute inset-x-0 top-0 flex h-[22px] items-center justify-center border-b font-mono text-[7px] font-bold transition-all duration-200
			{checked ? 'border-red-500/50 bg-red-950/20 text-red-400 translate-y-0' : 'border-[var(--control-border)] bg-[var(--control-chassis)] text-gray-500 -translate-y-0.5'}">
			{checked ? 'ENGAGED' : 'SAFE'}
		</div>
	</button>

<!-- ─── Horizontal Gate ───────────────────────────────────────────────────────── -->
{:else if variant === 'horizontal-gate'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative flex h-7 w-16 items-center justify-between border border-[var(--control-border)] bg-[#141416] p-0.5 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1"
	>
		<div class="h-full w-6 transition-transform duration-300 {checked ? 'translate-x-0 bg-teal-500' : 'translate-x-1 bg-[var(--control-inactive)]'}"></div>
		<div class="absolute left-1/2 -translate-x-1/2 select-none font-mono text-[8px] tracking-tighter text-gray-600">GATE</div>
		<div class="h-full w-6 transition-transform duration-300 {checked ? 'translate-x-0 bg-teal-500' : '-translate-x-1 bg-[var(--control-inactive)]'}"></div>
	</button>

<!-- ─── Hardware Dip ──────────────────────────────────────────────────────────── -->
{:else if variant === 'hardware-dip'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative flex h-9 w-6 flex-col justify-between border-y border-y-[var(--control-border)] border-x border-x-[var(--control-bg)] bg-[var(--control-bg)] p-[2px] shadow-inner disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
	>
		<div class="absolute left-1/2 top-[2px] -translate-x-1/2 select-none font-mono text-[6px] font-bold tracking-tighter text-gray-600">1</div>
		<div class="relative z-10 h-[14px] w-full border-t border-white/10 transition-all duration-150 ease-out
			{checked ? 'translate-y-0 bg-red-500 shadow-[0_1px_4px_rgba(239,68,68,0.5)]' : 'translate-y-[15px] bg-[var(--control-inactive)]'}">
			<div class="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[1px]">
				<div class="h-1.5 w-[1px] {checked ? 'bg-red-800' : 'bg-[var(--control-border)]'}"></div>
				<div class="h-1.5 w-[1px] {checked ? 'bg-red-800' : 'bg-[var(--control-border)]'}"></div>
			</div>
		</div>
		<div class="absolute bottom-[2px] left-1/2 -translate-x-1/2 select-none font-mono text-[6px] font-bold tracking-tighter text-gray-600">0</div>
	</button>

<!-- ─── Bracket ───────────────────────────────────────────────────────────────── -->
{:else if variant === 'bracket'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="relative flex h-8 w-10 items-center justify-center border-l border-r bg-[var(--neutral-950)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1
			{checked ? 'border-cyan-400' : 'border-[var(--control-inactive)]'}"
	>
		{#if checked}
			<div class="absolute inset-0 bg-cyan-500/5 mix-blend-screen"></div>
		{/if}
		<div class="h-3 w-4 transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
			{checked ? 'scale-100 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'scale-50 bg-[var(--control-surface)]'}"></div>
	</button>

<!-- ─── Data Grid ─────────────────────────────────────────────────────────────── -->
{:else if variant === 'data-grid'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="grid h-8 w-8 grid-cols-2 gap-[2px] border border-[var(--control-border)] bg-[var(--neutral-950)] p-[3px] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1"
	>
		{#each [0, 1, 2, 3] as i}
			<div
				class="h-full w-full transition-all {checked ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]' : 'bg-[var(--control-surface)]'}"
				style="transition-duration:200ms; transition-delay:{checked ? i * 40 : 0}ms"
			></div>
		{/each}
	</button>

<!-- ─── Multi-LED ─────────────────────────────────────────────────────────────── -->
{:else if variant === 'multi-led'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="flex items-center gap-1 border border-[var(--control-border)] bg-[var(--control-chassis)] px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1"
	>
		<div class="h-2 w-2 transition-colors duration-200 {checked ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-[var(--neutral-800)]'}"></div>
		<div class="h-2 w-2 transition-colors duration-200 {checked ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-[var(--neutral-800)]'}"></div>
		<div class="h-2 w-2 transition-colors duration-200 {checked ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-[var(--neutral-800)]'}"></div>
	</button>

<!-- ─── Squared (dns-policy config rows — 46×24 sliding thumb) ───────────────── -->
{:else if variant === 'squared'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="sq-toggle {checked ? 'sq-on' : ''} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
	></button>

<!-- ─── Agentic (purple — for use inside agentic node drawers) ────────────────── -->
{:else if variant === 'agentic'}
	<button
		type="button" role="switch" aria-checked={checked}
		aria-label={label ?? (checked ? 'Disable' : 'Enable')}
		{disabled} onclick={toggle}
		class="w-10 h-5 border flex items-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a8ff] focus-visible:ring-offset-1
			{checked
				? 'border-[rgba(196,168,255,0.5)] bg-[rgba(196,168,255,0.12)] justify-end'
				: 'border-[var(--border-strong)] bg-[var(--surface-raised)] justify-start'}"
	>
		<span class="w-3 h-3 mx-1 transition-all duration-200 {checked
			? 'bg-[#c4a8ff] shadow-[0_0_6px_rgba(196,168,255,0.5)]'
			: 'bg-[var(--fg-dim)]'}"></span>
	</button>
{/if}

<style>
	button {
		position: relative;
	}
	button::before {
		content: '';
		position: absolute;
		inset: -8px;
	}

	/* ── Squared variant ─────────────────────────────────────────────────────── */
	.sq-toggle {
		position: relative;
		width: 46px;
		height: 24px;
		flex-shrink: 0;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		cursor: pointer;
		padding: 0;
		transition: all 0.2s ease;
	}
	.sq-toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: var(--radius-inset);
		background: var(--fg-dim);
		transition: all 0.2s ease;
	}
	.sq-toggle.sq-on {
		background: var(--accent-faint);
		border-color: var(--accent);
		box-shadow: 0 0 12px -2px rgba(95, 234, 213, 0.55);
	}
	.sq-toggle.sq-on::after {
		left: 24px;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
	}
</style>
