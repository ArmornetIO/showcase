<script module lang="ts">
	export interface CmdItem {
		icon?: import('../../icons/Icon.svelte').IconName;
		label: string;
		/** Secondary line under the label — e.g. an entity's type/context in search results. */
		sublabel?: string;
		hint?: string;
		action?: () => void;
	}
	export interface CmdGroup {
		group: string;
		items: CmdItem[];
	}
</script>

<script lang="ts">
	import Icon from '../../icons/Icon.svelte';
	import { fuzzyRank } from '../../fuzzy.js';

	interface CommandPaletteProps {
		open?: boolean;
		commands?: CmdGroup[];
		placeholder?: string;
		onselect?: (item: CmdItem) => void;
		/**
		 * Fires on every query change (and on open, with ''). Lets the host compute
		 * live results (e.g. cross-entity search) and feed them back via `commands`.
		 */
		onquery?: (q: string) => void;
		/**
		 * Host owns filtering: when true, `commands` is rendered verbatim (no internal
		 * ranking pass) so the host can return its own ranked results — a host that
		 * searches a live corpus knows things the label text does not. Pair with
		 * `onquery`. Default false runs the built-in fuzzy ranking.
		 */
		externalFilter?: boolean;
		/** Show a subtle loading row (e.g. while a manifest/fetch is in flight). */
		loading?: boolean;
	}

	const DEFAULT_COMMANDS: CmdGroup[] = [
		{
			group: 'Navigate',
			items: [
				{ icon: 'layout-dashboard', label: 'Go to Dashboard', hint: 'G D' },
				{ icon: 'mesh', label: 'Go to Mesh overview', hint: 'G M' },
				{ icon: 'shield-check', label: 'Go to Posture', hint: 'G P' },
				{ icon: 'clipboard-list', label: 'Go to Findings', hint: 'G F' }
			]
		},
		{
			group: 'Actions',
			items: [
				{ icon: 'refresh-cw', label: 'Force re-scan all agents' },
				{ icon: 'alert-triangle', label: 'Enforce DMARC (p=reject)' },
				{ icon: 'git-fork', label: 'Enroll new agent', hint: '⌘N' },
				{ icon: 'rotate-ccw', label: 'Rotate API keys' }
			]
		},
		{
			group: 'Settings',
			items: [
				{ icon: 'file-text', label: 'Open workspace settings', hint: '⌘,' },
				{ icon: 'layers', label: 'Switch theme' }
			]
		}
	];

	let {
		open = $bindable(false),
		commands = DEFAULT_COMMANDS,
		placeholder = 'Type a command or search…',
		onselect,
		onquery,
		externalFilter = false,
		loading = false
	}: CommandPaletteProps = $props();

	let query = $state('');
	let activeIdx = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const groups: { group: string; items: { item: CmdItem; flatIdx: number }[] }[] = [];
		const flat: CmdItem[] = [];

		for (const grp of commands) {
			// externalFilter: the host has already filtered/ranked, render verbatim.
			// Otherwise rank with the shared scorer — a substring pass answered
			// "Rotate API keys" for "rotate" but not for "rtk", and put whatever
			// happened to be declared first above the closest match.
			const matches =
				externalFilter || !q
					? grp.items
					: fuzzyRank(q, grp.items, (it) => [
							[it.label, 0],
							[it.sublabel, 120],
							[grp.group, 260]
						]);
			if (!matches.length) continue;
			const startIdx = flat.length;
			flat.push(...matches);
			groups.push({ group: grp.group, items: matches.map((item, i) => ({ item, flatIdx: startIdx + i })) });
		}
		return { groups, flat };
	});

	$effect(() => {
		if (open) {
			query = '';
			activeIdx = 0;
			onquery?.('');
			setTimeout(() => inputEl?.focus(), 50);
		}
	});

	$effect(() => {
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				open = !open;
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	function handleKeydown(e: KeyboardEvent) {
		const { flat } = filtered;
		if (!flat.length) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIdx = (activeIdx + 1) % flat.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIdx = (activeIdx - 1 + flat.length) % flat.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			runItem(flat[activeIdx]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	function runItem(item: CmdItem) {
		open = false;
		item.action?.();
		onselect?.(item);
	}

	function handleInput(e: Event) {
		query = (e.currentTarget as HTMLInputElement).value;
		activeIdx = 0;
		onquery?.(query);
	}
</script>

{#if open}
	<button type="button" class="cmdk-backdrop" aria-label="Close command palette" onclick={() => (open = false)}></button>
	<div class="cmdk" role="dialog" aria-label="Command palette" aria-modal="true">
		<div class="cmdk-search">
			<Icon name="search" size={18} style="color: var(--accent); flex-shrink: 0;" />
			<input
				bind:this={inputEl}
				type="text"
				{placeholder}
				value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				autocomplete="off"
				spellcheck={false}
			/>
			<span class="cmdk-esc">ESC</span>
		</div>
		<div class="cmdk-results">
			{#if filtered.flat.length === 0}
				<div class="cmdk-empty">{loading ? 'Searching…' : `No results for "${query}"`}</div>
			{:else}
				{#each filtered.groups as grp (grp.group)}
					<div class="cmdk-group">{grp.group}</div>
					{#each grp.items as { item, flatIdx } (`${grp.group}:${item.label}`)}
						<button
							type="button"
							class="cmdk-item"
							class:active={flatIdx === activeIdx}
							onclick={() => runItem(item)}
							onmousemove={() => (activeIdx = flatIdx)}
						>
							{#if item.icon}
								<Icon name={item.icon} size={16} />
							{/if}
							<span class="ci-body">
								<span class="ci-label">{item.label}</span>
								{#if item.sublabel}
									<span class="ci-sub">{item.sublabel}</span>
								{/if}
							</span>
							{#if item.hint}
								<span class="ci-hint">{item.hint}</span>
							{/if}
						</button>
					{/each}
				{/each}
			{/if}
		</div>
		<div class="cmdk-foot">
			<span class="k"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
			<span class="k"><kbd>↵</kbd> run</span>
			<span class="k"><kbd>esc</kbd> close</span>
		</div>
	</div>
{/if}

<style>
	.cmdk-backdrop {
		appearance: none;
		-webkit-appearance: none;
		display: block;
		border: none;
		padding: 0;
		margin: 0;
		cursor: default;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		z-index: 999;
	}

	.cmdk {
		position: fixed;
		top: 80px;
		left: 50%;
		transform: translateX(-50%);
		width: min(520px, 90vw);
		background: var(--bg-elev);
		backdrop-filter: blur(24px);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.7);
		overflow: hidden;
		z-index: 1000;
	}

	.cmdk::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
	}

	.cmdk-search {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 15px 16px;
		border-bottom: 1px solid var(--border);
	}

	.cmdk-search input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--fg);
		font-family: var(--sans-brand);
		font-size: 17px;
		font-weight: 500;
	}

	.cmdk-search input::placeholder {
		color: var(--fg-dim);
	}

	.cmdk-esc {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 3px 7px;
	}

	.cmdk-results {
		max-height: 268px;
		overflow-y: auto;
		padding: 8px;
	}

	.cmdk-group {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding: 9px 10px 6px;
	}

	.cmdk-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 11px;
		border-radius: var(--radius-control);
		cursor: pointer;
		font-family: var(--sans-brand);
		font-size: 15px;
		color: var(--fg-muted);
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.cmdk-item :global(.icon) {
		color: var(--fg-dim);
		flex-shrink: 0;
		transition: color 0.1s ease;
	}

	.cmdk-item.active,
	.cmdk-item:hover {
		background: var(--accent-faint);
		color: var(--accent);
	}

	.cmdk-item.active :global(.icon),
	.cmdk-item:hover :global(.icon) {
		color: var(--accent);
	}

	.ci-body {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.ci-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ci-sub {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--fg-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ci-hint {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
	}

	.cmdk-empty {
		padding: 30px 16px;
		text-align: center;
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
	}

	.cmdk-foot {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
	}

	.k {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.cmdk-foot kbd {
		font-family: var(--mono);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 2px 5px;
		color: var(--fg-muted);
	}
</style>
