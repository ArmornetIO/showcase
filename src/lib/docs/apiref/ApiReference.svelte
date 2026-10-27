<script lang="ts">
	// The API reference — the whole generated spec, read one operation at a time.
	//
	// Contents, then one operation, and nothing beside it. Anything true of the
	// WHOLE API — how permissions work, how agents connect — is its own entry in
	// the contents rather than a panel reprinted against every operation. The
	// spec's x-armornet-authz is the enrichment worth carrying, and it is worth
	// ONE LINE: most operations answer "member on your organization", and a rule
	// restated on every page is a rule readers stop seeing.
	//
	// No cards, no boxes: hairline rows, and the four method hues already in
	// tokens.css as the whole palette.
	import CodeBlock from '../../display/code/CodeBlock.svelte';
	import TerminalBlock from '../../display/code/TerminalBlock.svelte';
	import Tabs from '../../navigation/Tabs.svelte';
	import Collapsible from '../../primitives/chrome/Collapsible.svelte';
	import SearchInput from '../../primitives/forms/SearchInput.svelte';
	import CommandPalette from '../../primitives/actions/CommandPalette.svelte';
	import type { CmdGroup, CmdItem } from '../../primitives/actions/CommandPalette.svelte';
	import type { ApiIsland, Endpoint } from './types.js';
	import {
		KIND_META,
		LANGS,
		allEndpoints,
		bodyFieldsOf,
		detailFor,
		exampleFor,
		isNotable,
		kindCounts,
		lineSections,
		sampleFor,
		siblingsOf,
		tupleFor
	} from './apiref.js';

	let {
		data,
		specHref = '/openapi.yaml',
		homeHref,
		height = '100vh',
		chrome = true,
		stickyTop = '0px'
	}: {
		data: ApiIsland;
		/** Where the machine-readable spec is served. */
		specHref?: string;
		/** Makes the wordmark a link. Omitted, it is plain text — this component
		 *  knows no route table of its own. */
		homeHref?: string;
		/** Only read when `chrome` is on: how tall the self-chromed reader is. */
		height?: string;
		/** The reference's own top bar. OFF inside an app that already has one —
		 *  a page carrying a second wordmark and a second search reads as a
		 *  different product. Chromeless, the contents column sticks under the
		 *  host's header and the window does the scrolling. */
		chrome?: boolean;
		/** Chromeless only: how far down the host's own header sits. */
		stickyTop?: string;
	} = $props();

	const endpoints = $derived(allEndpoints(data));
	const counts = $derived(kindCounts(endpoints));
	const line = $derived(data.line ? lineSections(data.line) : null);

	// Finding an operation is the palette's job, the same ⌘K palette the rest of
	// the docs use. It used to be a filter box that hid the contents as you typed,
	// which meant this page had its own answer to "search" — a reader who learned
	// ⌘K everywhere else found a box here that did something different.
	let cmdOpen = $state(false);
	let cmdQuery = $state('');
	// Two pages describe the whole API rather than one operation. They are
	// entries in the contents, not a sidebar — pinning them beside every
	// operation was reprinting a reference chapter on every page of the book.
	let view = $state<'operation' | 'permissions' | 'mesh'>('operation');
	let selectedId = $state('');
	let lang = $state<string>(LANGS[0]);
	// Every resource needs a real boolean up front — `bind:` to an undefined
	// entry throws against a prop with a fallback, which is a blank page rather
	// than a warning. The first resource stands open so the contents show what
	// they contain.
	// Deliberately the initial island: the reference reads ONE generated spec for
	// its lifetime, and rebuilding the map on every change would throw away which
	// resources the reader has opened.
	// svelte-ignore state_referenced_locally
	let open = $state<Record<string, boolean>>(
		Object.fromEntries(data.resources.map((r, i) => [r.id, i === 0]))
	);

	// Ranked here rather than by the palette: 411 operations are matched on the
	// PATH, and a path is not a label — `/api/vendors/{id}` has to answer
	// "vendors" and "vendor id" both, which a scorer aimed at command names does
	// not. Capped, because a result list nobody scrolls past 30 items of costs
	// only render time.
	const MAX_HITS = 30;

	const commands: CmdGroup[] = $derived.by(() => {
		const q = cmdQuery.trim().toLowerCase();
		const byResource = new Map<string, CmdItem[]>();
		let taken = 0;

		for (const r of data.resources) {
			for (const e of r.endpoints) {
				if (taken >= MAX_HITS) break;
				const hit =
					q === '' ||
					e.path.toLowerCase().includes(q) ||
					e.summary.toLowerCase().includes(q) ||
					(e.opId ?? '').toLowerCase().includes(q);
				if (!hit) continue;
				const items = byResource.get(r.title) ?? [];
				items.push({
					label: e.summary,
					sublabel: `${e.method.toUpperCase()} ${e.path}`,
					action: () => pick(e)
				});
				byResource.set(r.title, items);
				taken++;
			}
		}
		return [...byResource].map(([group, items]) => ({ group, items }));
	});

	const groups = $derived(data.resources);

	const endpoint = $derived(endpoints.find((e) => e.id === selectedId) ?? endpoints[0]);
	const resourceOf = $derived(
		data.resources.find((r) => r.endpoints.some((e) => e.id === endpoint?.id))
	);
	const tuple = $derived(endpoint ? tupleFor(endpoint) : null);
	const example = $derived(endpoint ? exampleFor(data, endpoint) : null);
	const bodyFields = $derived(endpoint ? bodyFieldsOf(data, endpoint) : []);
	const notable = $derived(endpoint ? isNotable(endpoint) : false);
	const siblings = $derived(endpoint ? siblingsOf(endpoints, endpoint) : []);
	const langTabs = $derived(LANGS.map((l) => ({ id: l, label: l })));

	let readEl: HTMLElement | null = $state(null);

	function pick(e: Endpoint) {
		selectedId = e.id;
		view = 'operation';
		// Chromeless, the reading column has no scrollbar of its own — the window
		// is what moved, so the window is what has to come back.
		if (chrome) readEl?.scrollTo({ top: 0 });
		else window.scrollTo({ top: 0, behavior: 'instant' });
	}

	// The contents follow the reading column, not the other way round: landing on
	// a deep link with every resource shut hides where you are.
	$effect(() => {
		if (resourceOf) open[resourceOf.id] = true;
	});
</script>

<CommandPalette
	bind:open={cmdOpen}
	{commands}
	externalFilter
	placeholder="Search {data.total} operations…"
	onquery={(q) => (cmdQuery = q)}
/>

<div
	class="page"
	class:chromeless={!chrome}
	style:height={chrome ? height : undefined}
	style:--sticky-top={chrome ? undefined : stickyTop}
>
	{#if chrome}
		<header class="topbar">
			{#if homeHref}
				<a class="wordmark" href={homeHref}>armornet<span>api</span></a>
			{:else}
				<span class="wordmark">armornet<span>api</span></span>
			{/if}
			<div class="find">
				<SearchInput
					variant="command-trigger"
					placeholder="Search {data.total} operations"
					onclick={() => (cmdOpen = true)}
				/>
			</div>
			<a class="spec" href={specHref}>openapi.yaml</a>
		</header>
	{/if}
	{#if !endpoint}
		<p class="empty">{data.description}</p>
	{:else}
		<div class="body">
			<!-- ── contents ───────────────────────────────────────────────────── -->
			<nav class="toc" aria-label="Contents">
				{#if !chrome}
					<!-- With the host's header above, the search belongs to the contents:
					     one trigger on the page, and it is the same ⌘K everywhere else. -->
					<div class="find">
						<SearchInput
							variant="command-trigger"
							placeholder="Search {data.total} operations"
							onclick={() => (cmdOpen = true)}
						/>
					</div>
				{/if}
				<div class="toc-body">
					<ul class="guides">
						<li>
							<button class:on={view === 'permissions'} onclick={() => (view = 'permissions')}>
								Permissions
							</button>
						</li>
						{#if line}
							<li>
								<button class:on={view === 'mesh'} onclick={() => (view = 'mesh')}>
									Agent connection
								</button>
							</li>
						{/if}
					</ul>

					{#each groups as g (g.id)}
						<Collapsible bind:open={open[g.id]}>
							{#snippet trigger({ open: isOpen, toggle })}
								<button class="res" onclick={toggle} aria-expanded={isOpen}>
									<span class="res-name">{g.title}</span>
									<span class="res-n">{g.endpoints.length}</span>
								</button>
							{/snippet}
							<ul>
								{#each g.endpoints as e (e.id)}
									<li>
										<button
											class="op op-{e.method}"
											class:on={e.id === endpoint.id}
											onclick={() => pick(e)}
										>
											<span class="verb">{e.method}</span>
											<span class="route">{e.path}</span>
										</button>
									</li>
								{/each}
							</ul>
						</Collapsible>
					{/each}
					<!-- Said once, at the foot of the contents, instead of under every operation. -->
					<p class="source">
						Generated from <a href={specHref}><code>openapi.yaml</code></a>.
					</p>
				</div>
			</nav>

			<!-- ── the operation ──────────────────────────────────────────────── -->
			<main class="read" bind:this={readEl}>
				{#if view === 'operation'}
					<article class="doc">
						{#if resourceOf}<p class="where">{resourceOf.title}</p>{/if}
						<h1>{endpoint.summary}</h1>

						<p class="route-line route-{endpoint.method}">
							<span class="verb">{endpoint.method}</span>
							<span class="path">{endpoint.path}</span>
						</p>

						{#if endpoint.desc}
							<div class="prose">
								{#each endpoint.desc.split('\n\n') as para}<p>{para}</p>{/each}
							</div>
						{/if}

						<!-- The spec's own wording, and only that. A rule restated in our
						     words is a second source of truth that drifts from policy.go. -->
						<p class="access-line" class:plain={!notable}>
							{endpoint.auth.detail}
							{#if endpoint.auth.schemes?.length}
								<span class="creds">{endpoint.auth.schemes.join(' · ')}</span>
							{/if}
						</p>

						{#if endpoint.params?.length}
							<section class="rows">
								<h2>Parameters</h2>
								{#each endpoint.params as p}
									<div class="row">
										<code class="name">{p.name}</code>
										<span class="type">
											{p.type}<span class="where-in">in {p.in}</span>
											{#if p.required}<span class="must">required</span>{/if}
											{#if p.default}<span class="dim">defaults to {p.default}</span>{/if}
										</span>
										<span class="say">
											{#if p.desc}{p.desc}{/if}
											{#if p.enum}<span class="opts"
													>{#each p.enum as v}<code>{v}</code>{/each}</span
												>{/if}
										</span>
									</div>
								{/each}
							</section>
						{/if}

						{#if bodyFields.length}
							<section class="rows">
								<h2>
									Body{#if endpoint.body}<code class="schema">{endpoint.body}</code>{/if}
								</h2>
								{#each bodyFields as f}
									<div class="row">
										<code class="name">{f.name}</code>
										<span class="type">
											{f.ref ?? f.type}
											{#if f.required}<span class="must">required</span>{/if}
											{#if f.readOnly}<span class="dim">returned, not sent</span>{/if}
										</span>
										<span class="say">
											{#if f.desc}{f.desc}{/if}
											{#if f.enum}<span class="opts"
													>{#each f.enum as v}<code>{v}</code>{/each}</span
												>{/if}
										</span>
									</div>
								{/each}
							</section>
						{/if}

						<section class="call">
							<h2>Call it</h2>
							<Tabs tabs={langTabs} bind:active={lang} />
							<!-- cURL is a thing you type at a prompt, the rest is source. That is
							     the line TerminalBlock and CodeBlock are drawn along. -->
							{#if lang === 'cURL'}
								<TerminalBlock content={sampleFor(lang, endpoint, data.host)} copy />
							{:else}
								<CodeBlock code={sampleFor(lang, endpoint, data.host)} copy wrap dedent={false} />
							{/if}
						</section>

						<section class="rows returns">
							<h2>Returns</h2>
							{#each endpoint.responses ?? [] as r}
								<div class="row">
									<code class="name status s-{r.code[0]}">{r.code}</code>
									<span class="type"
										>{#if r.schema}{r.schema}{r.array ? '[]' : ''}{:else}no body{/if}</span
									>
									<span class="say">{r.desc}</span>
								</div>
							{/each}
							{#if tuple && !(endpoint.responses ?? []).some((r) => r.code === '403')}
								<div class="row faint">
									<code class="name status s-4">403</code>
									<span class="type">Error</span>
									<span class="say">You do not hold {tuple.relation.replace(/_/g, ' ')}.</span>
								</div>
							{/if}
						</section>

						{#if example}
							<section class="call">
								<h2>A response</h2>
								<!-- A value being shown, not a session — no traffic lights. -->
								<TerminalBlock content={example} chrome={false} copy maxHeight="320px" />
							</section>
						{/if}

						<!-- What someone integrating reaches for next: the rest of this
						     record's life cycle, which the path already tells us. -->
						{#if siblings.length}
							<section class="rows next">
								<h2>Nearby</h2>
								{#each siblings as s}
									<button class="row row-link" onclick={() => pick(s)}>
										<code class="name verb-{s.method}">{s.method}</code>
										<span class="type">{s.path}</span>
										<span class="say">{s.summary}</span>
									</button>
								{/each}
							</section>
						{/if}
					</article>
				{:else if view === 'permissions'}
					<article class="doc">
						<h1>Permissions</h1>

						<section class="rows">
							<h2>How a call is judged</h2>
							{#each counts as k}
								<div class="row">
									<code class="name">{KIND_META[k.kind].label}</code>
									<span class="type">{k.count} operations</span>
									<span class="say">{detailFor(endpoints, k.kind)}</span>
								</div>
							{/each}
						</section>

						{#if data.fgaModel?.length}
							<section class="rows">
								<h2>Object types</h2>
								{#each data.fgaModel as m}
									<div class="row">
										<code class="name">{m.object_type.replace(/_/g, ' ')}</code>
										<span class="type">{m.relations.join(', ')}</span>
										<span class="say">{m.operations} operations</span>
									</div>
								{/each}
							</section>
						{/if}

						<section class="rows">
							<h2>Credentials</h2>
							{#each data.schemes as s}
								<div class="row">
									<code class="name">{s.label.split(' (')[0]}</code>
									<span class="type"
										>{s.label.includes('(') ? s.label.split('(')[1].replace(')', '') : ''}</span
									>
									<span class="say">{s.desc}</span>
								</div>
							{/each}
						</section>
					</article>
				{:else if line && data.line}
					<article class="doc">
						<h1>The Line protocol</h1>
						<p class="route-line route-get">
							<span class="verb">{data.line.protocol}</span>
							<span class="path">{data.line.url}</span>
						</p>
						<p class="lede">{data.line.description}</p>

						{#if line.steps.length}
							<section class="flow">
								<h2>Opening a Line</h2>
								<div class="lanes" aria-hidden="true">
									<span>agent A</span><span>server</span><span>agent B</span>
								</div>
								<ol>
									{#each line.steps as s}
										<li>
											<span class="step-n">{s.n}</span>
											<span class="hop hop-{s.from}-{s.to}">
												<span class="hop-msg">{s.msg}</span>
												{#if s.to === 'both'}<span class="hop-tip"></span>{/if}
											</span>
											<div class="step-body">
												<p>{s.text}</p>
												{#if s.fields.length}
													<span class="opts"
														>{#each s.fields as f}<code>{f}</code>{/each}</span
													>
												{/if}
											</div>
										</li>
									{/each}
								</ol>
							</section>
						{/if}

						{#if line.discovery.length}
							<section class="rows">
								<h2>Finding a peer</h2>
								{#each line.discovery as m}
									<div class="row">
										<code class="name">{m.msg}</code>
										<span class="type">{m.dir}</span>
										<span class="say">
											{m.text}
											<span class="opts"
												>{#each m.fields as f}<code>{f}</code>{/each}</span
											>
										</span>
									</div>
								{/each}
							</section>
						{/if}

						{#if line.other.length}
							<section class="rows">
								<h2>The rest of the protocol</h2>
								{#each line.other as m}
									<div class="row">
										<code class="name">{m.msg}</code>
										<span class="type">{m.dir}</span>
										<span class="say">
											{m.text}
											<span class="opts"
												>{#each m.fields as f}<code>{f}</code>{/each}</span
											>
										</span>
									</div>
								{/each}
							</section>
						{/if}
					</article>
				{/if}
			</main>
		</div>
	{/if}
</div>

<style>
	/* One family for reading (Inter), one for machine strings (JetBrains Mono).
	   Mono is used where a string is literally typed into a terminal or a URL —
	   never as decoration for a label. */
	.page {
		--ink: var(--fg);
		--soft: var(--fg-muted);
		--faint: var(--fg-dim);
		--hair: var(--border);
		--verb-get: var(--method-get-fg);
		--verb-post: var(--method-post-fg);
		--verb-put: var(--method-patch-fg);
		--verb-patch: var(--method-patch-fg);
		--verb-delete: var(--method-delete-fg);
		font-family: var(--sans);
		color: var(--ink);
		background: var(--bg);
		display: flex;
		flex-direction: column;
	}

	/* ── top bar ─────────────────────────────────────────────────────────── */
	.empty {
		padding: 2rem;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		padding: 0 var(--sp-5);
		height: 54px;
		border-bottom: 1px solid var(--hair);
		flex: 0 0 auto;
	}
	.wordmark {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: inherit;
		text-decoration: none;
	}
	.wordmark span {
		font-weight: 400;
		color: var(--faint);
		margin-left: 0.4em;
	}
	.find {
		flex: 0 1 380px;
	}
	.spec {
		margin-left: auto;
		font-family: var(--mono);
		font-size: var(--t-small);
		color: var(--soft);
		text-decoration: none;
		border-bottom: 1px solid var(--border-accent);
		padding-bottom: 2px;
	}
	.spec:hover {
		color: var(--accent);
	}

	.body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 250px minmax(0, 1fr);
	}

	/* ── contents ────────────────────────────────────────────────────────── */
	.toc {
		overflow-y: auto;
		padding: var(--sp-4) var(--sp-2) var(--sp-7) var(--sp-5);
		border-right: 1px solid var(--hair);
	}
	.guides {
		list-style: none;
		margin: 0 0 var(--sp-4);
		padding: 0 0 var(--sp-3);
		border-bottom: 1px solid var(--hair);
	}
	.guides button {
		display: block;
		width: 100%;
		padding: 5px 0;
		background: none;
		border: 0;
		text-align: left;
		font-family: var(--sans);
		font-size: var(--t-body);
		color: var(--soft);
		cursor: pointer;
	}
	.guides button:hover {
		color: var(--ink);
	}
	.guides button.on {
		color: var(--accent);
	}
	.res {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		width: 100%;
		padding: 6px 0;
		background: none;
		border: 0;
		cursor: pointer;
		text-align: left;
	}
	.res-name {
		font-size: var(--t-body);
		color: var(--soft);
	}
	.res:hover .res-name {
		color: var(--ink);
	}
	.res-n {
		margin-left: auto;
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--faint);
		opacity: 0.7;
	}
	.toc ul {
		list-style: none;
		margin: 0 0 var(--sp-2);
		padding: 0;
	}
	.op {
		display: flex;
		align-items: baseline;
		gap: 8px;
		width: 100%;
		padding: 3px 0 3px 10px;
		background: none;
		border: 0;
		border-left: 1px solid var(--hair);
		cursor: pointer;
		text-align: left;
	}
	.op:hover {
		border-left-color: var(--soft);
	}
	.op.on {
		border-left-color: currentColor;
	}
	.op-get {
		color: var(--verb-get);
	}
	.op-post {
		color: var(--verb-post);
	}
	.op-put,
	.op-patch {
		color: var(--verb-patch);
	}
	.op-delete {
		color: var(--verb-delete);
	}
	.op .verb {
		font-family: var(--mono);
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: 34px;
		flex: 0 0 34px;
		text-align: right;
		opacity: 0.85;
	}
	.op .route {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.op.on .route {
		color: var(--ink);
	}
	.source {
		margin: var(--sp-5) 0 0;
		padding-top: var(--sp-3);
		border-top: 1px solid var(--hair);
		font-size: var(--t-micro);
		color: var(--faint);
	}
	.source code {
		font-family: var(--mono);
	}
	.source a {
		color: inherit;
	}
	.source a:hover {
		color: var(--accent);
	}

	/* ── inside a host that already has a header ─────────────────────────────
	   No viewport of our own: the window scrolls the reading column, and the
	   contents stick under whatever the host's own bar is. A second scroll
	   container under a page header traps the host's footer below a pane the
	   reader can never scroll past. */
	.page.chromeless {
		height: auto;
		background: none;
	}
	.page.chromeless .toc {
		position: sticky;
		top: var(--sticky-top, 0px);
		align-self: start;
		max-height: calc(100vh - var(--sticky-top, 0px));
		/* The trigger holds still and the resource list moves under it: it is the
		   page's only visible way into search, and scrolling the contents is
		   exactly when a reader is looking for one. */
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.page.chromeless .toc-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.page.chromeless .read {
		overflow: visible;
		/* A sticky column can only stay put while its container is taller than it
		   is. Most operations read shorter than the contents, so without this the
		   grid ended level with the nav, sticky had a few pixels of travel, and
		   the whole contents column slid off the top on the first scroll. */
		min-height: calc(100vh - var(--sticky-top, 0px));
	}
	.page.chromeless .find {
		margin-bottom: var(--sp-4);
		padding-right: var(--sp-3);
	}

	.next .row-link {
		display: grid;
		/* A path is the identifier here, so it gets the room and never wraps —
		   the summary is what gives way. */
		grid-template-columns: 48px minmax(0, 22rem) minmax(0, 1fr);
		width: 100%;
		background: none;
		border-top: 1px solid var(--hair);
		text-align: left;
		cursor: pointer;
		align-items: baseline;
	}
	.next .row-link .type {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
	.next .row-link .say {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.next .row-link:hover .type {
		color: var(--ink);
	}
	.next .name {
		font-size: var(--t-micro);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.verb-get {
		color: var(--verb-get);
	}
	.verb-post {
		color: var(--verb-post);
	}
	.verb-put,
	.verb-patch {
		color: var(--verb-patch);
	}
	.verb-delete {
		color: var(--verb-delete);
	}

	/* ── reading column ──────────────────────────────────────────────────── */
	.read {
		overflow-y: auto;
		padding: var(--sp-7) var(--sp-7) var(--sp-8);
	}
	.doc {
		min-width: 0;
		max-width: 74ch;
	}
	.lede {
		margin: 0 0 var(--sp-4);
		font-size: var(--t-lead);
		line-height: 1.65;
		color: var(--soft);
		max-width: 68ch;
	}
	.where {
		margin: 0 0 var(--sp-2);
		font-size: var(--t-small);
		color: var(--faint);
	}
	.doc h1 {
		margin: 0 0 var(--sp-3);
		font-size: 2rem;
		font-weight: 500;
		letter-spacing: -0.025em;
		line-height: 1.15;
	}
	.route-line {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 0 0 var(--sp-5);
		padding-bottom: var(--sp-3);
		border-bottom: 1px solid var(--hair);
	}
	.route-line .verb {
		font-family: var(--mono);
		font-size: var(--t-small);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.route-get .verb {
		color: var(--verb-get);
	}
	.route-post .verb {
		color: var(--verb-post);
	}
	.route-put .verb,
	.route-patch .verb {
		color: var(--verb-patch);
	}
	.route-delete .verb {
		color: var(--verb-delete);
	}
	.route-line .path {
		font-family: var(--mono);
		font-size: var(--t-lead);
		color: var(--ink);
		word-break: break-all;
	}
	.prose p {
		margin: 0 0 var(--sp-3);
		font-size: var(--t-lead);
		line-height: 1.65;
		color: var(--soft);
	}

	/* ── access ──────────────────────────────────────────────────────────── */
	.access-line {
		margin: 0;
		font-size: var(--t-small);
		line-height: var(--lh-ui);
		color: var(--soft);
	}
	.access-line .creds {
		color: var(--faint);
		font-family: var(--mono);
		font-size: var(--t-micro);
		margin-left: 8px;
		white-space: nowrap;
	}
	.access-line.plain {
		margin: calc(-1 * var(--sp-3)) 0 var(--sp-5);
		color: var(--faint);
	}

	/* ── the Line handshake ──────────────────────────────────────────────────
	   Three lanes, one hop per step, drawn between the two ends it actually
	   travels between. Lane centres sit at 1/6, 1/2 and 5/6 of the width, which
	   is where the --l and --r offsets below come from. */
	.flow {
		margin: var(--sp-6) 0;
	}
	.lanes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		padding-bottom: var(--sp-2);
		border-bottom: 1px solid var(--hair);
		font-size: var(--t-micro);
		color: var(--faint);
		text-align: center;
	}
	.flow ol {
		list-style: none;
		margin: 0;
		padding: 0;
		counter-reset: none;
	}
	.flow li {
		position: relative;
		padding: var(--sp-3) 0;
		border-bottom: 1px solid var(--hair);
	}
	.step-n {
		position: absolute;
		left: -26px;
		top: calc(var(--sp-3) + 2px);
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--faint);
	}
	.hop {
		position: relative;
		display: block;
		height: 22px;
		margin-bottom: 6px;
	}
	.hop::before {
		content: '';
		position: absolute;
		top: 11px;
		left: var(--l);
		right: calc(100% - var(--r));
		height: 1px;
		background: var(--accent);
		opacity: 0.6;
	}
	.hop::after {
		content: '';
		position: absolute;
		top: 8px;
		width: 0;
		height: 0;
		border-top: 3.5px solid transparent;
		border-bottom: 3.5px solid transparent;
	}
	.hop-msg {
		position: absolute;
		left: calc((var(--l) + var(--r)) / 2);
		top: 0;
		transform: translateX(-50%);
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--accent);
		background: var(--bg);
		padding: 0 8px;
		white-space: nowrap;
	}
	/* rightward hops */
	.hop-A-server {
		--l: 16.6%;
		--r: 50%;
	}
	.hop-server-B {
		--l: 50%;
		--r: 83.3%;
	}
	.hop-A-server::after,
	.hop-server-B::after {
		left: calc(var(--r) - 6px);
		border-left: 6px solid var(--accent);
	}
	/* leftward hops */
	.hop-server-A {
		--l: 16.6%;
		--r: 50%;
	}
	.hop-B-A {
		--l: 16.6%;
		--r: 83.3%;
	}
	.hop-server-A::after,
	.hop-B-A::after {
		left: var(--l);
		border-right: 6px solid var(--accent);
	}
	/* both ends at once */
	.hop-server-both {
		--l: 16.6%;
		--r: 83.3%;
	}
	.hop-server-both::after {
		left: var(--l);
		border-right: 6px solid var(--accent);
	}
	/* A control message reaches both ends, so it needs the second head that
	   ::before/::after cannot give it. */
	.hop-tip {
		position: absolute;
		top: 8px;
		left: calc(var(--r) - 6px);
		width: 0;
		height: 0;
		border-top: 3.5px solid transparent;
		border-bottom: 3.5px solid transparent;
		border-left: 6px solid var(--accent);
	}
	/* A dials nothing — the agents talk with the server out of it, so the hop is
	   drawn without the server's hue. */
	.hop-B-A::before {
		background: var(--fg-muted);
		opacity: 0.5;
	}
	.hop-B-A::after {
		border-right-color: var(--fg-muted);
	}
	.hop-B-A .hop-msg {
		color: var(--soft);
	}
	.step-body p {
		margin: 0;
		font-size: var(--t-small);
		line-height: 1.6;
		color: var(--soft);
		max-width: 68ch;
	}
	.step-body .opts {
		margin: 5px 0 0;
		display: flex;
	}

	/* ── hairline rows ───────────────────────────────────────────────────── */
	.rows,
	.call {
		margin: var(--sp-6) 0;
	}
	h2 {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		margin: 0 0 var(--sp-2);
		font-size: var(--t-body);
		font-weight: 500;
		color: var(--ink);
	}
	.schema {
		font-family: var(--mono);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--faint);
	}
	.row {
		display: grid;
		grid-template-columns: 150px 170px minmax(0, 1fr);
		gap: var(--sp-3);
		padding: 10px 0;
		border-top: 1px solid var(--hair);
		font-size: var(--t-small);
		line-height: var(--lh-ui);
	}
	.row.faint {
		opacity: 0.55;
	}
	.name {
		font-family: var(--mono);
		color: var(--ink);
		word-break: break-all;
	}
	.type {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--soft);
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-content: start;
	}
	.where-in,
	.dim {
		color: var(--faint);
	}
	.must {
		color: var(--verb-post);
	}
	.say {
		color: var(--soft);
	}
	.opts {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-left: 5px;
	}
	.opts code {
		font-family: var(--mono);
		font-size: var(--t-micro);
		color: var(--faint);
	}
	.status.s-2 {
		color: var(--verb-get);
	}
	.status.s-4 {
		color: var(--verb-post);
	}
	.status.s-5 {
		color: var(--verb-delete);
	}

	@media (max-width: 900px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}
		.toc {
			display: none;
		}
		.read {
			padding: var(--sp-5) var(--sp-4) var(--sp-7);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page :global(*) {
			transition: none !important;
		}
	}
</style>
