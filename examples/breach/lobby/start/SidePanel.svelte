<script lang="ts">
	// One of the start screen's two side panels: a side's name in its colour,
	// what the side is called, whatever the game shows of it, and how it wins.
	import type { Snippet } from 'svelte';
	import { Icon } from 'showcase';

	interface Props {
		tone: string;
		label: string;
		role: string;
		/** How this side wins, in a line. */
		goal: string;
		children: Snippet;
	}
	let { tone, label, role, goal, children }: Props = $props();
</script>

<section class="team" style:--tone={tone}>
	<header>
		<span class="dot"></span>
		<b>{label}</b>
		<span class="role">{role}</span>
	</header>
	{@render children()}
	<p class="goal"><Icon name="flag" size={12} /> <span>{goal}</span></p>
</section>

<style>
	.team {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 0;
		padding: 14px 14px 12px;
		border-radius: 22px;
		background:
			radial-gradient(120% 70% at 50% 100%, color-mix(in srgb, var(--tone) 14%, transparent), transparent 70%),
			var(--panel);
		border: 1px solid color-mix(in srgb, var(--tone) 22%, transparent);
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.95rem;
	}
	header b {
		color: var(--tone);
		font-weight: 800;
		letter-spacing: 0.02em;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--tone);
		box-shadow: 0 0 10px var(--tone);
	}
	.role {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--fg-dim, #97a3aa);
	}
	.goal {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin: 0;
		padding: 8px 10px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--tone) 9%, transparent);
		font-size: 0.72rem;
		line-height: 1.35;
		color: var(--fg, #e2e8f0);
	}
	.goal :global(svg) {
		flex: none;
		margin-top: 2px;
		color: var(--tone);
	}
</style>
