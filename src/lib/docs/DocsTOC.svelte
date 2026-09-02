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
	}

	let {
		containerEl = undefined,
		containerSelector,
		key = undefined,
		headingSelector = 'h2, h3',
		rootMargin = '-15% 0px -65% 0px',
		label = 'On this page'
	}: DocsTOCProps = $props();

	let headings = $state<TocHeading[]>([]);
	let activeId = $state('');

	// ── Effect 1 — Scan + MutationObserver ───────────────────────────────────
	// Reactive on: key, containerEl, containerSelector, headingSelector.
	// Sets up a MutationObserver so dynamically-loaded content (async imports,
	// route transitions) is captured without the caller having to signal again.
	$effect(() => {
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
			headings = extracted;
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

		// Seed active to the first heading if nothing is set yet.
		if (!activeId && headings.length) activeId = headings[0].id;

		return () => io.disconnect();
	});
</script>

{#if headings.length}
	<nav class="doc-toc" aria-label="On this page">
		<p class="doc-toc-label">{label}</p>
		<ul class="doc-toc-list" role="list">
			{#each headings as h (h.id)}
				<li class="doc-toc-item" class:active={activeId === h.id} data-level={h.level}>
					<a href="#{h.id}">{h.text}</a>
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
</style>
