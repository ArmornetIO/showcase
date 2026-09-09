<script lang="ts">
	// Dev-console controls for the ItemFrames plugin. Contributed as part of a
	// host's PAGE group.
	import { frameControl } from './control.svelte.js';
	import ControlRow from '../devcog/controls/ControlRow.svelte';
	import InfoDot from '../devcog/controls/InfoDot.svelte';
	import Seg from '../devcog/controls/Seg.svelte';

	const PRESETS = [
		{ value: '0', label: 'off' },
		{ value: '1000', label: '1s' },
		{ value: '3000', label: '3s' },
		{ value: '8000', label: '8s' }
	];

	const LATENCY_DETAIL =
		'Holds every GET by this much so the real pre-load scaffolds stay on screen long enough to look at.';
	const FORCE_DETAIL = 'Pins every scaffold on regardless of what the data is doing.';
</script>

<div class="fdc">
	<ControlRow label="slow loading" detail={LATENCY_DETAIL} />
	<Seg
		options={PRESETS}
		value={String(frameControl.devLatencyMs)}
		onchange={(v) => (frameControl.devLatencyMs = Number(v))}
	/>
	<label class="fdc-toggle">
		<input type="checkbox" bind:checked={frameControl.forceFrames} />
		<span class="fdc-lab">force frames</span>
		<InfoDot detail={FORCE_DETAIL} />
	</label>
</div>

<style>
	.fdc {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-family: var(--mono);
	}
	.fdc-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.fdc-lab {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
</style>
