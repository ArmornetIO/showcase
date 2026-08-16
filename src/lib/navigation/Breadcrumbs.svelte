<script lang="ts">
	// Standalone trail, for surfaces that have no LayoutHeader to hang one on —
	// the docs shell is the case it exists for. An app page under a LayoutHeader
	// passes `crumbs` to the header instead; see design pattern 03, "The trail,
	// not a bar". A breadcrumb bar rendered beside a header is the anti-pattern.
	export interface BreadcrumbItem {
		label: string;
		/** If provided and not the last item, renders as an anchor link. */
		href?: string;
	}

	interface BreadcrumbsProps {
		items: BreadcrumbItem[];
		separator?: string;
	}

	let { items, separator = '/' }: BreadcrumbsProps = $props();
</script>

<nav aria-label="Breadcrumb">
	<ol class="flex items-center gap-1.5 font-[var(--mono)] text-[0.75rem] list-none p-0 m-0 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
		{#each items as item, i (i)}
			<li class="flex items-center gap-1.5">
				{#if i > 0}
					<span class="text-[var(--fg-dim)] select-none" aria-hidden="true">{separator}</span>
				{/if}
				{#if item.href && i < items.length - 1}
					<a
						href={item.href}
						class="text-[var(--fg-dim)] hover:text-[var(--accent)] transition-colors duration-150 no-underline"
					>
						{item.label}
					</a>
				{:else}
					<span class="text-[var(--fg-muted)]">{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
