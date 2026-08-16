<script lang="ts">
	// The only mockup in the repository.
	//
	// Every other folder in `routes/mockups/` is gitignored: they are sketches
	// that belong to the machine that made them. This one is committed because it
	// is not a sketch — it is the instructions, and it doubles as the thing it
	// describes. Ask Claude Code to change this page and you are doing the loop
	// it is telling you about.
	import Panel from '$lib/primitives/chrome/Panel.svelte';
	import SectionBar from '$lib/primitives/chrome/SectionBar.svelte';
	import CodeBlock from '$lib/display/code/CodeBlock.svelte';
	import Chip from '$lib/primitives/status/Chip.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import StatTile from '$lib/display/metric/StatTile.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';

	interface Step {
		icon: IconName;
		title: string;
		body: string;
	}

	const LOOP: Step[] = [
		{
			icon: 'play',
			title: 'Leave the dev server running',
			body: 'Vite keeps this page mounted and swaps only what changed. You never reload, so scroll position, open menus and half-filled forms survive every edit.'
		},
		{
			icon: 'message-square',
			title: 'Describe the change out loud',
			body: 'Say what you want in the terminal — "make the header sticky and drop the border" — rather than naming files. Claude Code finds the file; you watch the browser.'
		},
		{
			icon: 'eye',
			title: 'Judge it on screen, not in the diff',
			body: 'The point of refining against a live page is that you react to what it looks like. Keep going until it reads right; the diff is a record of that, not the medium.'
		}
	];

	const EXAMPLE_PROMPT = `Open showcase at /mockups/realtime-refinement.
Build me a vendor detail page beside it at /mockups/vendor-detail:
a PageHero, a StatStrip of four posture numbers, and a DataTable
of open findings. Use the showcase components, not raw markup.`;

	const NEW_MOCKUP = `# from the repo root
cd showcase && npm run dev

# then, in Claude Code:
# "make a new mockup at /mockups/<name> that ..."`;
</script>

<svelte:head>
	<title>Realtime Refinement — UI Component Library</title>
</svelte:head>

<div class="page">
	<header class="head">
		<div class="kicker">
			<Chip look="ghost" color="accent">MOCKUPS</Chip>
			<span class="kicker-text">the local sketchpad</span>
		</div>
		<h1>Realtime Refinement</h1>
		<p class="lede">
			Design by describing a change and watching it land. The dev server stays up, Claude Code edits
			the file, and Vite swaps the component in place — so the gap between "what if" and "look at
			it" is about a second.
		</p>
	</header>

	<div class="tiles">
		<StatTile label="COMMITTED MOCKUPS" value="1" sub="this page" subVariant="neutral" mono />
		<StatTile label="YOURS" value="local" sub="gitignored" subVariant="neutral" mono />
		<StatTile label="RELOADS NEEDED" value="0" sub="HMR keeps state" subVariant="up" mono />
	</div>

	<section>
		<SectionBar label="THE LOOP" />
		<div class="loop">
			{#each LOOP as step (step.title)}
				<Panel>
					<div class="step">
						<span class="step-icon"><Icon name={step.icon} size={16} /></span>
						<h3>{step.title}</h3>
						<p>{step.body}</p>
					</div>
				</Panel>
			{/each}
		</div>
	</section>

	<section>
		<SectionBar label="START ONE" />
		<div class="two-up">
			<Panel title="Run it">
				<CodeBlock code={NEW_MOCKUP} copy dedent={false} />
				<p class="note">
					Anything you create under <code>routes/mockups/</code> is ignored by git. It runs, it
					hot-reloads, it never lands in a commit — so sketch freely and delete without ceremony.
				</p>
			</Panel>

			<Panel title="Ask for something real">
				<CodeBlock code={EXAMPLE_PROMPT} copy dedent={false} />
				<p class="note">
					Point at components rather than markup. The library is the vocabulary you are designing
					in, and a mockup built from it is a mockup you can ship pieces of.
				</p>
			</Panel>
		</div>
	</section>

	<section>
		<SectionBar label="WHY ONLY THIS ONE IS COMMITTED" />
		<Panel>
			<div class="prose">
				<p>
					A mockup is a thought, not a deliverable. Committing them means every branch carries
					everyone else's abandoned explorations, review diffs fill with pages nobody ships, and an
					open-source clone opens onto a museum of half-finished ideas.
				</p>
				<p>
					So <code>routes/mockups/*</code> is gitignored and the sidebar is built from the folders
					actually present on your machine — your sketches appear for you and for nobody else. The
					labels live in <code>routes/mockups/nav.ts</code>, which is ignored too; without it a
					folder still shows up under a title-cased version of its slug.
				</p>
				<p>
					This page is the exception because it is the README for the directory, and the most useful
					README is one you can edit while it renders. Try it: ask for a different accent colour and
					watch the sentence you are reading move.
				</p>
			</div>
		</Panel>
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		padding: 2rem 2.5rem 4rem;
		max-width: 1100px;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 68ch;
	}

	.kicker {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.kicker-text {
		font-family: var(--mono);
		font-size: 0.65rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	h1 {
		font-family: var(--mono);
		font-size: 2rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 0;
		color: var(--fg);
	}

	.lede {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--fg-muted);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.loop {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.step-icon {
		display: flex;
		width: 28px;
		height: 28px;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--accent-faint);
		color: var(--accent);
	}

	.step h3 {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--fg);
	}

	.step p,
	.note,
	.prose p {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.65;
		color: var(--fg-muted);
	}

	.two-up {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 0.75rem;
	}

	.note {
		margin-top: 0.75rem;
	}

	.prose {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 72ch;
	}

	code {
		font-family: var(--mono);
		font-size: 0.85em;
		color: var(--fg);
		background: var(--accent-faint);
		padding: 0.05em 0.35em;
		border-radius: 3px;
	}
</style>
