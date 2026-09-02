<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';

	// Up to 4 panes from query params ?a=slug1&b=slug2&c=slug3&d=slug4
	const PANE_KEYS = ['a', 'b', 'c', 'd'] as const;

	let panes = $state(
		PANE_KEYS.map((k) => page.url.searchParams.get(k) ?? '').filter(Boolean)
	);

	// Preference votes — slug → preference note
	let votes = $state<Record<string, string>>({});
	let votingFor = $state<string | null>(null);
	let voteNote = $state('');
	let iframeKeys = $state<Record<string, number>>({});

	function reload(slug: string) {
		iframeKeys = { ...iframeKeys, [slug]: (iframeKeys[slug] ?? 0) + 1 };
	}

	function reloadAll() {
		const next: Record<string, number> = {};
		for (const s of panes) next[s] = (iframeKeys[s] ?? 0) + 1;
		iframeKeys = next;
	}

	function removePaneBySlug(slug: string) {
		panes = panes.filter((s) => s !== slug);
	}

	function submitVote(slug: string) {
		votes = { ...votes, [slug]: voteNote.trim() || 'preferred' };
		votingFor = null;
		voteNote = '';
	}

	function clearVote(slug: string) {
		const next = { ...votes };
		delete next[slug];
		votes = next;
	}

	function addPaneSlug(slug: string) {
		if (!slug || panes.includes(slug) || panes.length >= 4) return;
		panes = [...panes, slug];
	}

	let addSlugInput = $state('');
	let handoffCopyState = $state<'idle' | 'copied'>('idle');

	async function copyHandoffPrompt(slug: string) {
		const note = votes[slug] && votes[slug] !== 'preferred' ? votes[slug] : '';
		const prompt = [
			`/canvas-mode`,
			``,
			`Iterate on mockup slug: ${slug}`,
			`Route: showcase/src/routes/mockups/${slug}/+page.svelte`,
			``,
			`## Design decision`,
			`This variant was preferred over the alternatives${note ? `: ${note}` : '.'}`,
			``,
			`## Next iteration`,
			`(describe your changes here before pasting into Claude Code)`
		].join('\n');
		try {
			await navigator.clipboard.writeText(prompt);
			handoffCopyState = 'copied';
			setTimeout(() => (handoffCopyState = 'idle'), 2000);
		} catch { /* clipboard unavailable */ }
	}

	const gridClass = $derived(
		panes.length <= 1 ? 'compare-grid--1'
		: panes.length === 2 ? 'compare-grid--2'
		: panes.length === 3 ? 'compare-grid--3'
		: 'compare-grid--4'
	);

	const winner = $derived(
		Object.keys(votes).length === 1 ? Object.keys(votes)[0] : null
	);
</script>

<svelte:head>
	<title>Compare Mockups — Showcase</title>
</svelte:head>

<div class="compare-root">
	<!-- Header -->
	<header class="compare-header">
		<a href="{base}/builder" class="back-link">← BUILDER</a>
		<span class="compare-title">COMPARE MOCKUPS</span>

		<div class="header-actions">
			<!-- Add pane -->
			{#if panes.length < 4}
				<div class="add-pane-wrap">
					<input
						class="add-pane-input"
						type="text"
						placeholder="slug…"
						bind:value={addSlugInput}
						onkeydown={(e) => { if (e.key === 'Enter') { addPaneSlug(addSlugInput.trim()); addSlugInput = ''; } }}
					/>
					<button
						class="header-btn"
						onclick={() => { addPaneSlug(addSlugInput.trim()); addSlugInput = ''; }}
					>+ ADD</button>
				</div>
			{/if}
			<button class="header-btn" onclick={reloadAll} title="Reload all panes">↺ RELOAD ALL</button>
		</div>
	</header>

	<!-- Winner banner -->
	{#if winner}
		<div class="winner-banner">
			✓ PREFERRED: <strong>{winner}</strong>
			{#if votes[winner] && votes[winner] !== 'preferred'} — {votes[winner]}{/if}
			<div class="winner-actions">
				<button class="winner-link" onclick={() => copyHandoffPrompt(winner)}>
					{handoffCopyState === 'copied' ? '✓ COPIED' : '⊟ Copy brief'}
				</button>
				<a href="{base}/builder?slug={winner}" class="winner-link">→ Back to builder</a>
			</div>
		</div>
	{/if}

	<!-- Pane grid -->
	{#if panes.length === 0}
		<div class="compare-empty">
			<p>No mockups to compare.</p>
			<p>Open from the Builder AI tab or add slugs above.</p>
			<a href="{base}/builder" class="empty-link">← Go to Builder</a>
		</div>
	{:else}
		<div class="compare-grid {gridClass}">
			{#each panes as slug (slug)}
				{@const isVoted = !!votes[slug]}
				{@const isWinner = slug === winner}
				<div class="pane" class:pane--voted={isVoted} class:pane--winner={isWinner}>
					<!-- Pane header -->
					<div class="pane-header">
						<span class="pane-slug">{slug}</span>
						<div class="pane-actions">
							<button class="pane-btn" onclick={() => reload(slug)} title="Reload">↺</button>
							<a href="{base}/mockups/{slug}" target="_blank" class="pane-btn" title="Open in tab">↗</a>
							<button class="pane-btn pane-btn--close" onclick={() => removePaneBySlug(slug)} title="Remove pane">✕</button>
						</div>
					</div>

					<!-- iframe -->
					{#key iframeKeys[slug] ?? 0}
						<iframe
							src="{base}/mockups/{slug}"
							title="Mockup — {slug}"
							class="pane-iframe"
						></iframe>
					{/key}

					<!-- Vote footer -->
					<div class="pane-footer">
						{#if votingFor === slug}
							<div class="vote-form">
								<input
									class="vote-input"
									type="text"
									placeholder="Why do you prefer this? (optional)"
									bind:value={voteNote}
									onkeydown={(e) => { if (e.key === 'Enter') submitVote(slug); if (e.key === 'Escape') { votingFor = null; voteNote = ''; } }}
								/>
								<button class="vote-confirm-btn" onclick={() => submitVote(slug)}>✓</button>
								<button class="vote-cancel-btn" onclick={() => { votingFor = null; voteNote = ''; }}>✕</button>
							</div>
						{:else if isVoted}
							<div class="vote-result">
								<span class="vote-check">✓ PREFERRED</span>
								{#if votes[slug] !== 'preferred'}
									<span class="vote-note"> — {votes[slug]}</span>
								{/if}
								<button class="vote-clear-btn" onclick={() => clearVote(slug)}>clear</button>
							</div>
						{:else}
							<button class="prefer-btn" onclick={() => { votingFor = slug; voteNote = ''; }}>
								Prefer this
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* ── Root ────────────────────────────────────────────────────────────────── */
	.compare-root {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
		background: var(--bg, #060b14);
		color: var(--fg, #e2e8f0);
	}

	/* ── Header ──────────────────────────────────────────────────────────────── */
	.compare-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 16px;
		height: 48px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.12));
		background: var(--bg-elev, #0a1120);
	}

	.back-link {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
		text-decoration: none;
		transition: color 0.15s;
		flex-shrink: 0;
	}
	.back-link:hover { color: var(--accent); }

	.compare-title {
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--accent);
		flex: 1;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.add-pane-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.add-pane-input {
		font-family: var(--mono);
		font-size: 11px;
		padding: 4px 8px;
		background: var(--bg, #060b14);
		border: 1px solid var(--border, rgba(94, 234, 212, 0.15));
		border-radius: 2px;
		color: var(--fg);
		outline: none;
		width: 140px;
	}
	.add-pane-input:focus { border-color: var(--accent); }
	.add-pane-input::placeholder { color: var(--fg-dim); }

	.header-btn {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.15em;
		padding: 5px 10px;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.2));
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		border-radius: 2px;
		transition: all 0.14s;
		white-space: nowrap;
	}
	.header-btn:hover { border-color: var(--accent); color: var(--accent); }

	/* ── Winner banner ───────────────────────────────────────────────────────── */
	.winner-banner {
		flex-shrink: 0;
		padding: 8px 16px;
		background: rgba(94, 234, 212, 0.08);
		border-bottom: 1px solid rgba(94, 234, 212, 0.2);
		font-family: var(--mono);
		font-size: 11px;
		color: var(--accent);
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.winner-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.winner-link {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--accent);
		text-decoration: none;
		border: 1px solid rgba(94, 234, 212, 0.3);
		padding: 3px 8px;
		border-radius: 2px;
		transition: background 0.12s;
		background: none;
		cursor: pointer;
		letter-spacing: 0.05em;
	}
	.winner-link:hover { background: rgba(94, 234, 212, 0.1); }

	/* ── Grid ────────────────────────────────────────────────────────────────── */
	.compare-grid {
		flex: 1;
		display: grid;
		gap: 1px;
		background: var(--border, rgba(94, 234, 212, 0.12));
		min-height: 0;
	}
	.compare-grid--1 { grid-template-columns: 1fr; }
	.compare-grid--2 { grid-template-columns: 1fr 1fr; }
	.compare-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
	.compare-grid--4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }

	/* ── Pane ────────────────────────────────────────────────────────────────── */
	.pane {
		display: flex;
		flex-direction: column;
		background: var(--bg, #060b14);
		overflow: hidden;
		transition: box-shadow 0.2s;
	}
	.pane--voted { box-shadow: inset 0 0 0 1px rgba(94, 234, 212, 0.3); }
	.pane--winner { box-shadow: inset 0 0 0 2px var(--accent); }

	.pane-header {
		display: flex;
		align-items: center;
		padding: 0 10px;
		height: 32px;
		flex-shrink: 0;
		background: var(--bg-elev, #0a1120);
		border-bottom: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		gap: 8px;
	}

	.pane-slug {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		color: var(--fg-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pane-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.pane-btn {
		font-family: var(--mono);
		font-size: 11px;
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 3px 5px;
		border-radius: 2px;
		line-height: 1;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: color 0.12s;
	}
	.pane-btn:hover { color: var(--accent); }
	.pane-btn--close:hover { color: #fca5a5; }

	.pane-iframe {
		flex: 1;
		width: 100%;
		border: none;
		background: var(--bg, #060b14);
		min-height: 0;
	}

	/* ── Vote footer ─────────────────────────────────────────────────────────── */
	.pane-footer {
		flex-shrink: 0;
		border-top: 1px solid var(--border, rgba(94, 234, 212, 0.1));
		background: var(--bg-elev, #0a1120);
		padding: 6px 10px;
		min-height: 38px;
		display: flex;
		align-items: center;
	}

	.prefer-btn {
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.15em;
		padding: 5px 12px;
		border: 1px solid var(--border, rgba(94, 234, 212, 0.2));
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		border-radius: 2px;
		transition: all 0.14s;
		width: 100%;
		text-align: center;
	}
	.prefer-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(94, 234, 212, 0.05); }

	.vote-form {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
	}

	.vote-input {
		flex: 1;
		font-family: var(--mono);
		font-size: 10px;
		padding: 4px 8px;
		background: var(--bg, #060b14);
		border: 1px solid var(--accent);
		border-radius: 2px;
		color: var(--fg);
		outline: none;
		min-width: 0;
	}

	.vote-confirm-btn {
		font-size: 12px;
		background: rgba(94, 234, 212, 0.1);
		border: 1px solid var(--accent);
		color: var(--accent);
		cursor: pointer;
		padding: 3px 7px;
		border-radius: 2px;
		transition: background 0.12s;
		flex-shrink: 0;
	}
	.vote-confirm-btn:hover { background: rgba(94, 234, 212, 0.2); }

	.vote-cancel-btn {
		font-size: 12px;
		background: none;
		border: 1px solid var(--border);
		color: var(--fg-dim);
		cursor: pointer;
		padding: 3px 7px;
		border-radius: 2px;
		transition: color 0.12s;
		flex-shrink: 0;
	}
	.vote-cancel-btn:hover { color: #fca5a5; }

	.vote-result {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		font-family: var(--mono);
		font-size: 9px;
	}

	.vote-check {
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--accent);
	}

	.vote-note {
		color: var(--fg-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vote-clear-btn {
		font-family: var(--mono);
		font-size: 8px;
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 2px 4px;
		text-decoration: underline;
		transition: color 0.12s;
		flex-shrink: 0;
	}
	.vote-clear-btn:hover { color: var(--fg); }

	/* ── Empty state ─────────────────────────────────────────────────────────── */
	.compare-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--fg-dim);
		text-align: center;
	}

	.compare-empty p { margin: 0; }

	.empty-link {
		margin-top: 12px;
		font-size: 10px;
		letter-spacing: 0.15em;
		color: var(--accent);
		text-decoration: none;
		border: 1px solid rgba(94, 234, 212, 0.3);
		padding: 5px 12px;
		border-radius: 2px;
	}
	.empty-link:hover { background: rgba(94, 234, 212, 0.08); }
</style>
