<script module lang="ts">
	export interface WorkspaceChoice {
		id: string;
		name: string;
		/** Uploaded mark; initials stand in when absent. */
		logo?: string;
		/** What the org does. */
		description?: string;
		website?: string;
		role?: string;
		/** A short state beside the name, e.g. "No alpha access". `accent` is an
		 *  invitation (pressing helps); `warn` is a heads-up (pressing won't). */
		status?: { label: string; tone: 'accent' | 'warn' };
	}
</script>

<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// WORKSPACE PICKER — the list on the step after sign-in, rendered inside
	// AuthSplit's flow pane (`wide`), which supplies the page, the step and the
	// `auth-*` heading, lede and back link around it.
	//
	// Most visits return to the same workspace, so that one is lifted out as the
	// answer the page expects; the rest are a stack of the same row. A row is the
	// org's own profile — mark, name, what it does, where it lives — because two
	// workspaces with similar names are otherwise a coin toss.
	import SearchInput from '../primitives/forms/SearchInput.svelte';

	interface Props {
		workspaces: WorkspaceChoice[];
		/** The expected answer, lifted out above the rest. */
		lastId?: string;
		/** The row being entered; every row is disabled while it is set. */
		busyId?: string;
		onpick?: (id: string) => void;
	}

	let { workspaces, lastId = '', busyId = '', onpick }: Props = $props();

	const last = $derived(workspaces.find((w) => w.id === lastId) ?? null);
	const rest = $derived(workspaces.filter((w) => w !== last));

	// Search only earns its place past a screenful; a handful is read at a glance.
	const SEARCH_AT = 6;
	let query = $state('');
	const shown = $derived(
		rest.filter((w) =>
			`${w.name} ${w.website ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
		)
	);

	const initials = (name: string) =>
		name
			.split(/[\s-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('') || '—';
</script>

<div class="picker">
	{#if last}
		<p class="label">Last used</p>
		<!-- No separate Continue: as on the login, the choice is the control. -->
		{@render row(last, true)}
	{/if}

	{#if rest.length}
		<p class="label">{last ? 'Other workspaces' : 'Your workspaces'}</p>
		{#if rest.length > SEARCH_AT}
			<div class="search"><SearchInput bind:value={query} placeholder="Find a workspace" /></div>
		{/if}
		<ul class="stack">
			{#each shown as w (w.id)}
				<li>{@render row(w, false)}</li>
			{/each}
		</ul>
	{/if}
</div>

{#snippet row(w: WorkspaceChoice, featured: boolean)}
	<button
		class="row"
		class:featured
		type="button"
		disabled={!!busyId}
		aria-busy={busyId === w.id}
		onclick={() => onpick?.(w.id)}
	>
		{#if w.logo}
			<img class="mark" src={w.logo} alt="" />
		{:else}
			<span class="mark initials" aria-hidden="true">{initials(w.name)}</span>
		{/if}
		<span class="text">
			<span class="head">
				<span class="name">{w.name}</span>
				{#if w.role}<span class="role" class:admin={w.role !== 'member'}>{w.role}</span>{/if}
				{#if w.status}<span class="status {w.status.tone}">{w.status.label}</span>{/if}
			</span>
			{#if w.description}
				<span class="desc">{w.description}</span>
			{:else}
				<span class="desc empty">No profile yet</span>
			{/if}
			{#if w.website}<span class="site">{w.website}</span>{/if}
		</span>
		<span class="go" aria-hidden="true">{busyId === w.id ? '…' : '→'}</span>
	</button>
{/snippet}

<style>
	.label {
		margin: var(--sp-5) 0 var(--sp-3);
		font-family: var(--mono);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.picker > .label:first-child {
		margin-top: 0;
	}
	.search {
		margin-bottom: var(--sp-3);
	}
	.stack {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	/* A row is the login's ghost provider button grown to hold an identity: the
	   same raised ground, strong hairline, cut corners and accent hover, in
	   sentence case because it carries a name, not a command. Each tint sits on
	   the pane's own ground so AuthSplit's ribbon, which crosses the pane, never
	   runs through the text of a row. */
	.row {
		--tint: var(--surface-raised);
		display: flex;
		align-items: flex-start;
		gap: var(--sp-4);
		width: 100%;
		padding: var(--sp-4);
		background: linear-gradient(var(--tint), var(--tint)), var(--bg-elev);
		border: 1px solid var(--border-strong);
		clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			opacity 0.2s ease;
	}
	.row:hover:not(:disabled) {
		--tint: var(--accent-faint);
		border-color: var(--accent);
	}
	.row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.row:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.row[aria-busy='true'] {
		opacity: 1;
	}
	/* Lit at rest, which is all that marks it as the answer the page expects; it
	   is otherwise the same row, so it reads as one of them. */
	.row.featured {
		--tint: var(--accent-faint-strong);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.row.featured:hover:not(:disabled) {
		--tint: var(--accent-faint-strong);
		border-color: var(--accent);
	}

	.mark {
		flex: none;
		width: 40px;
		height: 40px;
		object-fit: contain;
	}
	.featured .mark {
		width: 48px;
		height: 48px;
	}
	.initials {
		display: grid;
		place-items: center;
		border: 1px solid var(--border-strong);
		background: var(--accent-faint);
		font-family: var(--mono);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--accent);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	/* Wraps rather than shrinks: the status chip drops below a name it would
	   otherwise cut to a few letters. */
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px var(--sp-3);
	}
	.name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.98rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.featured .name {
		font-size: 1.1rem;
	}
	.role {
		flex: none;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.role.admin {
		color: var(--accent);
	}
	/* Pushed to the row's end so it reads as the row's state, not a second
	   role. A hairline chip, the same weight as the role beside it. */
	.status {
		flex: none;
		margin-left: auto;
		padding: 1px 6px;
		border: 1px solid currentColor;
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.status.warn {
		color: var(--palette-amber-l);
	}
	.status.accent {
		color: var(--accent);
	}
	/* Two lines at most: enough to say what the org does, short enough that the
	   stack still scans as a list. */
	.desc {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--fg-muted);
	}
	.desc.empty {
		font-style: italic;
	}
	.site {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--fg-muted);
	}
	/* Only the expected answer points onward at rest; on hover the arrow confirms
	   which row the press will take. */
	.go {
		flex: none;
		align-self: center;
		font-family: var(--mono);
		color: var(--accent);
		opacity: 0;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
	}
	.featured .go,
	.row[aria-busy='true'] .go,
	.row:hover:not(:disabled) .go,
	.row:focus-visible .go {
		opacity: 1;
	}
	.row:hover:not(:disabled) .go {
		transform: translateX(2px);
	}
</style>
