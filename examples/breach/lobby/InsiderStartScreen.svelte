<script lang="ts">
	// ── Insider Threat's start screen ───────────────────────────────────────────
	// The same screen as Breach's (StartScreen.svelte), on the same frame
	// (`start/StartShell`), for the office game: the real office filmed full
	// width as the worm spreads, and how a shift plays. No side panels: the
	// scene is the picture of the game, and the sides are in Learn more.
	//
	// A scaffold. Every fact on it is the game's own — office.yaml through
	// office.gen.ts, and the lobby's lines — but the words a visitor reads first
	// are stand-ins until marketing writes them. Each is marked PLACEHOLDER below.
	//
	// The lobby's default start screen wherever the deployment offers Insider
	// Threat; the bar switches to the CTF's.
	import { SIDE_TONE } from '../internal/badge.js';
	import { OFFICE_DATA } from '../internal/office.gen.js';
	import { OFFICE_SIZES } from '../internal/rules.js';
	import OfficeTour from '../insider/OfficeTour.svelte';
	import StartShell, { type StartLearn, type StartStep, type StartTitle } from './start/StartShell.svelte';

	interface Props {
		/** As Breach's: `false` when the visitor is known to be signed out, `null`
		 *  on a host with no accounts. */
		account: boolean | null;
		/** Play was pressed and the page is on its way to sign in. */
		leaving?: boolean;
		/** Mount the office. Held back while the title is over this screen, so
		 *  the walk starts when it can be seen. */
		scene?: boolean;
		/** The Halloween look: the office after hours (insider/halloween.ts) in
		 *  the scene, and the frame in its orange and purple. */
		halloween?: boolean;
		onplay: () => void;
		titles?: readonly StartTitle[];
	}
	let { account, leaving = false, scene = true, halloween = false, onplay, titles }: Props = $props();

	/** How far the tour has walked the worm. */
	let done = $state(0);
	const WORM = OFFICE_DATA.milestones.map((m) => ({ id: m.key, name: m.name }));
	const lit = $derived(new Set(WORM.slice(0, done).map((m) => m.id)));

	const fewest = OFFICE_SIZES[0].id[0];
	const most = OFFICE_SIZES[OFFICE_SIZES.length - 1].id[0];

	// PLACEHOLDER: the headline. The lobby's own line ("Coworkers locked in for
	// the shift. One of you is the insider."), until there is a pitch.
	const LINES = ['Locked in for the shift.', 'One of you is the insider.'] as const;

	const LOYAL = { label: 'Loyal', tone: SIDE_TONE.blue };
	const INSIDER = { label: 'Insider', tone: SIDE_TONE.red };

	const STEPS: StartStep[] = [
		{ icon: 'user', title: 'Get a job', text: 'Everybody starts in the lobby with one. One of you is secretly the insider.' },
		{ icon: 'hand', title: 'Work a station', text: 'Walk up and do a task. Loyal work opens the door.' },
		{ icon: 'users', title: 'Call a meeting', text: 'Saw something? Talk it over, then vote someone out.' }
	];

	const LEARN: StartLearn = {
		title: 'How Insider Threat plays',
		lede: `Insider Threat is a first-person game for ${fewest} to ${most} players. You are coworkers locked in an office for the shift, and one of you is secretly the insider, spreading a worm through the building one step at a time.`,
		wins: [
			{ label: 'Loyal wins', tone: LOYAL.tone, text: 'by finishing enough work to open the door, or by voting the insider out.' },
			{ label: 'The insider wins', tone: INSIDER.tone, text: 'when the worm calls home, or when nobody is left to stop it.' }
		],
		sections: [
			{
				title: 'A shift',
				steps: [
					'Everybody starts in the lobby with a job. Your job is your alibi: it says where you have a reason to be.',
					'Walk to a station and work a task there. Every task a loyal coworker finishes brings the door closer to opening.',
					`The insider does the worm's ${WORM.length} steps by hand, at the same stations, so it looks like ordinary work.`,
					'Rounds last a minute. How close the door is only shows when a round ends.'
				]
			},
			{
				title: 'The office reacts',
				text: 'Every step of the worm shows: lights flicker, screens glitch, the racks turn amber. Whoever saw it can call a meeting in the break room, talk it over and vote. The Manager can call one any time.'
			},
			{ title: 'The jobs', body: jobs }
		]
	};
</script>

<StartShell
	name="Insider Threat"
	{titles}
	lines={LINES}
	accent={1}
	live={scene}
	{account}
	{leaving}
	{onplay}
	howTitle="How a shift plays"
	steps={STEPS}
	versus={[
		{ label: LOYAL.label, tone: 'var(--blue)' },
		{ label: INSIDER.label, tone: 'var(--red)' }
	]}
	facts={[`${fewest}–${most} players`, 'First person', 'Play with friends or bots']}
	path={{ title: 'The worm’s path', steps: WORM, lit, tone: 'var(--red)' }}
	learn={LEARN}
	bleed
	headline="top"
	season={halloween ? 'halloween' : undefined}
>
	<!-- PLACEHOLDER: Breach's line, until Insider Threat has its own. -->
	{#snippet tagline()}An immersive <b>security awareness training</b> experience.{/snippet}

	{#snippet hero()}
		{#if scene}
			<OfficeTour {halloween} onstep={(n) => (done = n)} />
		{/if}
	{/snippet}
</StartShell>

{#snippet jobs()}
	<ul class="job-list">
		{#each OFFICE_DATA.archetypes as j (j.key)}
			<li>
				<b>{j.name}</b>
				<span>{j.blurb}</span>
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	/* ── Learn more: the jobs ───────────────────────────────────────────── */
	.job-list {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.job-list li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--blue) 25%, transparent);
		font-size: 0.78rem;
	}
	.job-list span {
		color: var(--fg-dim, #97a3aa);
	}
	@media (max-width: 640px) {
		.job-list {
			grid-template-columns: 1fr;
		}
	}
</style>
