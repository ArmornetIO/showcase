<script lang="ts">
	import Toggle from './Toggle.svelte';

	interface Props {
		title: string;
		description?: string;
		checked: boolean;
		disabled?: boolean;
		onchange: (v: boolean) => void;
	}

	let { title, description, checked, disabled = false, onchange }: Props = $props();
</script>

<div class="setting-row">
	<div class="txt">
		<div class="t">{title}</div>
		{#if description}
			<div class="d">{description}</div>
		{/if}
	</div>
	<Toggle variant="squared" {checked} {disabled} label={title} onchange={onchange} />
</div>

<style>
	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 7px;
		padding: 16px 18px;
	}
	.setting-row + .setting-row {
		margin-top: 12px;
	}
	.txt {
		min-width: 0;
	}
	.t {
		font-family: var(--mono);
		font-size: 13.5px;
		color: var(--fg);
		margin-bottom: 5px;
	}
	.d {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--fg-dim);
		line-height: 1.5;
	}
</style>
