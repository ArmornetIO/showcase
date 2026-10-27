<script module lang="ts">
	export interface TocHeading {
		id: string;
		text: string;
		level: number;
	}
</script>

<script lang="ts">
	interface DocsTOCProps {
		/**
		 * Element to scan for headings. Preferred over `containerSelector`.
		 * Pass a `bind:this` reference from the parent.
		 */
		containerEl?: HTMLElement | null;
		/**
		 * CSS selector fallback when `containerEl` is not provided.
		 * Resolved with `document.querySelector`. Default: `'body'`.
		 */
		containerSelector?: string;
		/**
		 * Changing this value triggers a full re-scan (e.g. pass the current
		 * route path so navigation swaps in new headings immediately).
		 */
		key?: unknown;
		/**
		 * Which heading elements to include. Default: `'h2, h3'`.
		 * Include h1 if the page has a single top-level title in the content.
		 */
		headingSelector?: string;
		/**
		 * IntersectionObserver rootMargin for active-heading tracking.
		 * Default cuts off the top 15% and bottom 65% of the viewport so the
		 * active heading is the one nearest the reader's eye-line.
		 */
		rootMargin?: string;
		/** Label above the TOC list. Default: `'On this page'`. */
		label?: string;
		/**
		 * Supply the outline instead of scanning the DOM for it.
		 *
		 * The scan exists for pages that render prose they did not author. When the
		 * outline is already a known value — docgen computes one per document,
		 * anchors included — scanning re-derives it from markup that has to be
		 * mounted first, which makes the rail arrive a frame late and disagree with
		 * the build about what a heading is.
		 *
		 * Active-heading tracking still observes the real elements, so this changes
		 * where the LIST comes from and nothing else.
		 */
		headings?: TocHeading[];
		/**
		 * `numbered` draws a zero-padded ordinal per entry instead of indenting by
		 * level — for a sequence, where the order IS the navigation and a reader
		 * asks "which step am I on", not "where does this nest".
		 */
		variant?: 'outline' | 'numbered';
	}

	let {
		containerEl = undefined,
		containerSelector,
		key = undefined,
		headingSelector = 'h2, h3',
		rootMargin = '-15% 0px -65% 0px',
		label = 'On this page',
		headings: given,
		variant = 'outline'
	}: DocsTOCProps = $props();

	let scanned = $state<TocHeading[]>([]);
	// A supplied outline wins outright; the scan is not even a fallback for it,
	// because a caller that states its headings and then gets different ones has
	// no way to tell.
	const headings = $derived(given ?? scanned);
	let activeId = $state('');
	// A jump to an anchor parks the heading at the top of the viewport, above the
	// observer's band, so the observer never reports it. The chosen heading holds
	// until the reader scrolls on their own.
	let pinned = false;

	function pin(id: string) {
		activeId = id;
		pinned = true;
	}

	function unpin() {
		pinned = false;
	}

	// ── Effect 1 — Scan + MutationObserver ───────────────────────────────────
	// Reactive on: key, containerEl, containerSelector, headingSelector.
	// Sets up a MutationObserver so dynamically-loaded content (async imports,
	// route transitions) is captured without the caller having to signal again.
	$effect(() => {
		// Nothing to scan for when the outline was supplied — and observing the DOM
		// anyway would spend a MutationObserver per page to compute a value the
		// caller already handed us.
		if (given) return;

		// Force dependency tracking on all props that should trigger a re-scan.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		void key;

		const root: HTMLElement =
			containerEl ??
			(containerSelector ? document.querySelector<HTMLElement>(containerSelector) : null) ??
			document.body;

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		function scan() {
			const extracted: TocHeading[] = Array.from(
				root.querySelectorAll<HTMLElement>(headingSelector)
			)
				.filter((el) => Boolean(el.id))
				.map((el) => ({
					id: el.id,
					text: el.textContent?.trim() ?? '',
					level: Number(el.tagName[1])
				}));
			scanned = extracted;
		}

		function scheduleRescan() {
			if (debounceTimer) clearTimeout(debounceTimer);
			// 80 ms debounce absorbs burst mutations from hydration / dynamic imports.
			debounceTimer = setTimeout(scan, 80);
		}

		scan();

		const mo = new MutationObserver(scheduleRescan);
		mo.observe(root, { childList: true, subtree: true });

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			mo.disconnect();
		};
	});

	// ── Effect 2 — IntersectionObserver for active heading ───────────────────
	// Reactive on: headings, rootMargin.
	// Disconnects and reconnects whenever headings list changes (new page scan).
	$effect(() => {
		if (!headings.length) return;

		// Track the most recently intersecting heading above the fold.
		// On rapid scrolling, multiple entries fire simultaneously — pick the
		// one with the largest intersection ratio so we stay accurate.
		let latestRatio = 0;

		const io = new IntersectionObserver(
			(entries) => {
				if (pinned) return;
				let best: IntersectionObserverEntry | null = null;
				for (const entry of entries) {
					if (entry.isIntersecting && entry.intersectionRatio >= latestRatio) {
						latestRatio = entry.intersectionRatio;
						best = entry;
					}
				}
				if (best) activeId = best.target.id;
				// Reset ratio each callback so next tick competes fairly.
				latestRatio = 0;
			},
			{ rootMargin }
		);

		for (const h of headings) {
			const el = document.getElementById(h.id);
			if (el) io.observe(el);
		}

		// Seed active from the URL's anchor, else the first heading.
		const hash = decodeURIComponent(location.hash.slice(1));
		if (headings.some((h) => h.id === hash)) pin(hash);
		else if (!activeId) activeId = headings[0].id;

		return () => io.disconnect();
	});
</script>

<svelte:window onwheel={unpin} ontouchmove={unpin} onkeydown={unpin} />

{#if headings.length}
	<nav class="doc-toc" aria-label={label} data-variant={variant}>
		<p class="doc-toc-label">{label}</p>
		<ul class="doc-toc-list" role="list">
			{#each headings as h, i (h.id)}
				<li class="doc-toc-item" class:active={activeId === h.id} data-level={h.level}>
					<a href="#{h.id}" onclick={() => pin(h.id)}>
						{#if variant === 'numbered'}
							<span class="doc-toc-num">{String(i + 1).padStart(2, '0')}</span>
						{/if}
						<span class="doc-toc-text">{h.text}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	.doc-toc {
		padding: 1.25rem;
	}
	.doc-toc-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin: 0 0 0.75rem;
	}
	.doc-toc-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.doc-toc-item a {
		display: block;
		font-size: 0.83rem;
		color: var(--fg-muted);
		text-decoration: none;
		padding: 0.25rem 0 0.25rem 0.6rem;
		border-left: 2px solid transparent;
		line-height: 1.35;
		transition:
			color 0.12s,
			border-color 0.12s;
	}
	/* h3 indented relative to h2 */
	.doc-toc-item[data-level='3'] a {
		padding-left: 1.1rem;
		font-size: 0.8rem;
	}
	/* h4 further indented */
	.doc-toc-item[data-level='4'] a {
		padding-left: 1.6rem;
		font-size: 0.78rem;
	}
	.doc-toc-item a:hover {
		color: var(--fg);
	}
	.doc-toc-item.active a {
		color: var(--accent);
		border-left-color: var(--accent);
	}

	/* ── numbered ────────────────────────────────────────────────────────────
	   A sequence reads by ordinal, so the indent-by-level rules are overridden
	   rather than combined: a step that also happened to be an h3 would otherwise
	   sit half-indented and break the column the numbers form. */
	.doc-toc[data-variant='numbered'] .doc-toc-item a {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		padding-left: 0.75rem;
		font-size: 0.82rem;
	}
	.doc-toc-num {
		flex-shrink: 0;
		font-family: var(--mono);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		color: var(--fg-dim);
	}
	.doc-toc-item.active .doc-toc-num {
		color: var(--accent);
	}
</style>
