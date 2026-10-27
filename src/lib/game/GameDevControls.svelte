<script lang="ts">
	// The DevCog's GAME group: debug views as toggles, movement as a fader bank.
	// Every explanation is a `detail=` on its control, per the cog's rule.
	import { gameDev, GAME_TUNING_DEFAULTS, type GameTuning } from './game-dev.svelte.js';
	import ControlRow from '../devcog/controls/ControlRow.svelte';
	import Fader from '../devcog/controls/Fader.svelte';
	import FaderBank from '../devcog/controls/FaderBank.svelte';
	import InfoDot from '../devcog/controls/InfoDot.svelte';

	type Toggle = 'fps' | 'bounds' | 'faces' | 'hitbox' | 'chase' | 'noclip';
	const TOGGLES: { key: Toggle; label: string; detail: string }[] = [
		{ key: 'fps', label: 'fps', detail: 'Frame graph, p95/max frame time and allocation rate (PerfHud). Backtick closes it.' },
		{ key: 'bounds', label: 'bounds', detail: "Each collision hull's bounding box — what the broadphase rejects against." },
		{ key: 'faces', label: 'faces', detail: 'Faces by what the walker makes of them: green floor, amber climbable, untinted wall.' },
		{ key: 'hitbox', label: 'hitbox', detail: "The walker's collision box, coloured by mode. Turn on chase to see it." },
		{ key: 'chase', label: 'chase', detail: 'Camera 4m behind and 1.5m above the eye, so you can watch your own box.' },
		{ key: 'noclip', label: 'noclip', detail: 'Fly along the view through everything. Space rises, Shift sinks.' }
	];

	const FADERS: { key: keyof GameTuning; label: string; max: number; step: number; unit: string }[] = [
		{ key: 'walkSpeed', label: 'walk', max: 15, step: 0.5, unit: 'm/s' },
		{ key: 'runSpeed', label: 'run', max: 30, step: 0.5, unit: 'm/s' },
		{ key: 'jumpSpeed', label: 'jump', max: 20, step: 0.5, unit: 'm/s' },
		{ key: 'gravity', label: 'gravity', max: 60, step: 1, unit: 'm/s²' },
		{ key: 'stepHeight', label: 'step', max: 1.5, step: 0.05, unit: 'm' }
	];

	const scene = $derived(gameDev.scenes.at(-1));
</script>

<div class="gd">
	<ControlRow label={scene?.label ?? 'scene'} />
	{#if scene?.maps && scene.maps.length > 1}
		<div class="gd-btns">
			{#each scene.maps as m, i (m.id)}
				{@const on = (gameDev.map ?? scene.maps[0].id) === m.id}
				<button class="gd-btn" class:gd-on={on} aria-pressed={on} onclick={() => (gameDev.map = i === 0 ? null : m.id)}
					>{m.label}</button
				>
			{/each}
			<button
				class="gd-btn"
				title="Refill every slot from a new seed: same map, different clutter."
				onclick={() => (gameDev.seed = (gameDev.seed % 9999) + 1)}>reroll {gameDev.seed}</button
			>
		</div>
	{/if}
	<div class="gd-btns">
		{#each TOGGLES as t (t.key)}
			<button
				class="gd-btn"
				class:gd-on={gameDev[t.key]}
				aria-pressed={gameDev[t.key]}
				title={t.detail}
				onclick={() => (gameDev[t.key] = !gameDev[t.key])}>{t.label}</button
			>
		{/each}
		<InfoDot detail="Debug views for the walker scene. Hover a toggle for what it draws." />
	</div>

	<FaderBank>
		{#each FADERS as f (f.key)}
			<Fader
				label={f.label}
				value={gameDev.tuning[f.key]}
				min={0}
				max={f.max}
				step={f.step}
				reference={GAME_TUNING_DEFAULTS[f.key]}
				format={(v) => `${v.toFixed(f.step < 0.1 ? 2 : 1)}${f.unit}`}
				oninput={(v) => (gameDev.tuning[f.key] = v)}
			/>
		{/each}
		<Fader
			label="time"
			value={gameDev.timeScale}
			min={0.05}
			max={2}
			step={0.05}
			reference={1}
			format={(v) => `${v.toFixed(2)}×`}
			detail="Scales the time fed to the fixed 120Hz step. Slow motion for watching a collision resolve."
			oninput={(v) => (gameDev.timeScale = v)}
		/>
	</FaderBank>

	<div class="gd-btns">
		<button class="gd-btn" onclick={() => scene?.respawn()}>respawn</button>
		<button
			class="gd-btn"
			onclick={() => {
				Object.assign(gameDev.tuning, GAME_TUNING_DEFAULTS);
				gameDev.timeScale = 1;
			}}>reset</button
		>
	</div>
</div>

<style>
	.gd {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		font-family: var(--mono);
	}
	.gd-btns {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	/* Same chip as GlobeDevControls' .gdc-btn, so the groups sit flush. */
	.gd-btn {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		white-space: nowrap;
	}
	.gd-btn:hover {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.gd-on {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}
</style>
