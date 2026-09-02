<script lang="ts">
	// Serve-mode segmented control. The modes themselves are the host app's
	// vocabulary ('marketing' | 'app' | 'showcase' in armornet, anything in a
	// bootstrapped app), so this only knows how to render and report them.

	interface ModeSwitcherProps {
		mode: string;
		modes: readonly string[];
		onChange: (mode: string) => void;
	}

	let { mode, modes, onChange }: ModeSwitcherProps = $props();
</script>

<div class="mode-switcher" role="group" aria-label="Serve mode">
	{#each modes as m (m)}
		<button
			class="mode-opt"
			class:active={mode === m}
			aria-pressed={mode === m}
			onclick={() => onChange(m)}>{m}</button
		>
	{/each}
</div>

<style>
	.mode-switcher {
		display: flex;
		gap: 2px;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 2px;
	}

	.mode-opt {
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		padding: 0.15rem 0.45rem;
		border-radius: 3px;
		border: none;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		letter-spacing: 0.04em;
		transition: color 0.15s, background 0.15s;
	}
	.mode-opt:hover {
		color: var(--fg-muted);
	}
	.mode-opt.active {
		background: var(--accent-faint-strong);
		color: var(--accent);
	}
</style>
