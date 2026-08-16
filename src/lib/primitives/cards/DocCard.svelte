<script lang="ts">
	import type { Snippet } from 'svelte';

	export type DocCardColor = 'accent' | 'cyan' | 'emerald' | 'blue' | 'amber';
	export type DocCardStatus = 'draft' | 'active' | 'approved';

	/** A git-derived author credit rendered as an avatar in rich mode. */
	export interface DocCardAuthor {
		handle: string;
		name: string;
		commits: number;
	}

	interface DocCardProps {
		/** Eyebrow label — e.g. "ENG · 01". In rich mode, `docId` overrides this. */
		tag: string;
		/** Main card title */
		title: string;
		/** Footer metadata line — e.g. "DRAFT · 2026-05-13" (simple mode only) */
		meta?: string;
		/** Accent color for the left edge bar, TR corner, and tag text */
		variant?: DocCardColor;
		/** Status controls the dot color in the meta row. Rich mode accepts any string. */
		status?: DocCardStatus | (string & {});
		onclick?: (e: MouseEvent) => void;
		class?: string;
		/** Optional override of the meta area (simple mode) */
		metaSlot?: Snippet;

		// ── Rich mode (opt-in) ──────────────────────────────────────────────────
		/** When set, the card renders as an anchor to this href. */
		href?: string;
		/** SVG path `d` for the header glyph — presence enables rich layout. */
		icon?: string;
		/** Document identifier shown in the header (defaults to `tag`). */
		docId?: string;
		/** Version badge, rendered as `v{version}`. */
		version?: string;
		/** Classification label, shown at the top-right. */
		classification?: string;
		/** Tag chips; overflow past `maxTags` collapses into a `+N` chip. */
		tags?: string[];
		/** Maximum tag chips before the `+N` overflow chip. Default 4. */
		maxTags?: number;
		/** Author avatars (initials). First 3 are shown. */
		authors?: DocCardAuthor[];
		/** Fallback author byline when `authors` is empty. */
		authorText?: string;
		/** Date suffix appended to the status text (rich mode). */
		updated?: string;
	}

	let {
		tag,
		title,
		meta,
		variant = 'accent',
		status = 'draft',
		onclick,
		class: cls = '',
		metaSlot,
		href,
		icon,
		docId,
		version,
		classification,
		tags,
		maxTags = 4,
		authors,
		authorText,
		updated
	}: DocCardProps = $props();

	const COLOR_MAP: Record<
		DocCardColor,
		{ bar: string; corner: string; tag: string; borderHover: string; shadow: string }
	> = {
		accent: {
			bar: 'var(--accent)',
			corner: 'rgba(94, 234, 212, 0.55)',
			tag: 'var(--accent)',
			borderHover: 'rgba(94, 234, 212, 0.4)',
			shadow: '0 0 0 1px rgba(94, 234, 212, 0.2), 0 8px 28px -10px rgba(94, 234, 212, 0.35)'
		},
		cyan: {
			bar: 'var(--palette-cyan)',
			corner: 'rgba(34, 211, 238, 0.55)',
			tag: 'var(--palette-cyan-l)',
			borderHover: 'rgba(34, 211, 238, 0.4)',
			shadow: '0 0 0 1px rgba(34, 211, 238, 0.2), 0 8px 28px -10px rgba(34, 211, 238, 0.35)'
		},
		emerald: {
			bar: 'var(--palette-emerald)',
			corner: 'rgba(52, 211, 153, 0.55)',
			tag: 'var(--palette-emerald-l)',
			borderHover: 'rgba(52, 211, 153, 0.4)',
			shadow: '0 0 0 1px rgba(52, 211, 153, 0.2), 0 8px 28px -10px rgba(52, 211, 153, 0.35)'
		},
		blue: {
			bar: 'var(--palette-blue)',
			corner: 'rgba(56, 189, 248, 0.55)',
			tag: 'var(--palette-blue-l)',
			borderHover: 'rgba(56, 189, 248, 0.4)',
			shadow: '0 0 0 1px rgba(56, 189, 248, 0.2), 0 8px 28px -10px rgba(56, 189, 248, 0.35)'
		},
		amber: {
			bar: 'var(--palette-amber)',
			corner: 'rgba(252, 211, 77, 0.55)',
			tag: 'var(--palette-amber-l)',
			borderHover: 'rgba(252, 211, 77, 0.4)',
			shadow: '0 0 0 1px rgba(252, 211, 77, 0.2), 0 8px 28px -10px rgba(252, 211, 77, 0.35)'
		}
	};

	/** Simple-mode status dot (draft/active/approved). */
	const STATUS_DOT: Record<DocCardStatus, string> = {
		draft: 'var(--palette-cyan)',
		active: 'var(--palette-emerald)',
		approved: 'var(--palette-emerald)'
	};

	/** Rich-mode status dot — wider lifecycle vocabulary, falls back to draft. */
	const STATUS_DOT_RICH: Record<string, string> = {
		active: 'var(--palette-emerald)',
		implemented: 'var(--palette-emerald)',
		published: 'var(--palette-emerald)',
		approved: 'var(--palette-emerald)',
		draft: 'var(--palette-cyan)',
		'in-progress': 'var(--palette-cyan)',
		backlog: 'var(--fg-dim)',
		wip: 'var(--palette-amber)'
	};

	const c = $derived(COLOR_MAP[variant]);

	/** Rich layout activates when any rich metadata prop is supplied. */
	const isRich = $derived(
		!!(
			href ||
			icon ||
			docId ||
			version ||
			classification ||
			(tags && tags.length) ||
			(authors && authors.length) ||
			authorText ||
			updated
		)
	);

	const dotColor = $derived(
		isRich ? (STATUS_DOT_RICH[status] ?? STATUS_DOT_RICH.draft) : STATUS_DOT[status as DocCardStatus]
	);

	const visibleTags = $derived((tags ?? []).slice(0, maxTags));
	const extraTags = $derived((tags ?? []).length - maxTags);
	const shownAuthors = $derived((authors ?? []).slice(0, 3));
	const statusText = $derived(
		`${String(status).toUpperCase()}${updated ? ` · ${updated}` : ''}`
	);

	// Interaction wiring — anchors are natively interactive, so role/tabindex
	// only apply to the simple div-with-onclick case.
	const asLink = $derived(!!href);
</script>

{#if isRich}
	<svelte:element
		this={asLink ? 'a' : 'div'}
		href={asLink ? href : undefined}
		class="rich-card {cls}"
		style:--edge={c.bar}
		role={!asLink && onclick ? 'button' : undefined}
		tabindex={!asLink && onclick ? 0 : undefined}
		{onclick}
		onkeydown={!asLink && onclick
			? (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onclick(e as unknown as MouseEvent)
			: undefined}
	>
		<div class="rc-header">
			<div class="rc-id-row">
				{#if icon}
					<svg
						class="rc-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						style:color={c.tag}
					>
						<path d={icon} />
					</svg>
				{/if}
				<span class="rc-id" style:color={c.tag}>{docId ?? tag}</span>
				{#if version}<span class="rc-version">v{version}</span>{/if}
			</div>
			{#if classification}<span class="rc-class">{classification}</span>{/if}
		</div>
		<h3 class="rc-title">{title}</h3>
		{#if visibleTags.length > 0}
			<div class="rc-tags">
				{#each visibleTags as t}<span class="rc-tag">{t}</span>{/each}
				{#if extraTags > 0}<span class="rc-tag rc-tag-more">+{extraTags}</span>{/if}
			</div>
		{/if}
		<div class="rc-footer">
			<div class="rc-authors">
				{#each shownAuthors as a}
					<span class="rc-avatar" title="{a.name} ({a.commits} commits)"
						>{a.handle.slice(0, 2).toUpperCase()}</span
					>
				{/each}
				{#if shownAuthors.length === 0 && authorText}
					<span class="rc-author-text">{authorText}</span>
				{/if}
			</div>
			<div class="rc-status-row">
				<span class="rc-dot" style:background={dotColor}></span>
				<span class="rc-status-text">{statusText}</span>
			</div>
		</div>
	</svelte:element>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="group relative flex min-h-[140px] cursor-pointer flex-col justify-between overflow-hidden rounded-[6px] border border-[rgba(94,234,212,0.12)] p-[22px] transition-[border-color,transform,box-shadow] duration-300 ease-in-out hover:-translate-y-0.5 hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-hover)] sm:min-h-[170px] {cls}"
		style:background="linear-gradient(180deg, rgba(15, 23, 42, 0.5), rgba(3, 7, 18, 0.6))"
		style:--bar={c.bar}
		style:--corner={c.corner}
		style:--border-hover={c.borderHover}
		style:--shadow-hover={c.shadow}
		style:--dot={dotColor}
		role={onclick ? 'button' : undefined}
		tabindex={onclick ? 0 : undefined}
		{onclick}
		onkeydown={onclick
			? (e) => (e.key === 'Enter' || e.key === ' ') && onclick(e as any)
			: undefined}
	>
		<!-- Left edge animated bar — slides from 30% → 100% height on hover -->
		<span
			class="pointer-events-none absolute bottom-0 left-0 top-0 w-[2px] origin-top scale-y-[0.3] bg-[var(--bar)] transition-transform duration-[400ms] ease-in-out group-hover:scale-y-100"
			aria-hidden="true"
		></span>

		<!-- TR corner bracket -->
		<span
			class="pointer-events-none absolute right-2 top-2 h-[10px] w-[10px] border-r border-t border-[var(--corner)]"
			aria-hidden="true"
		></span>

		<!-- Top content: tag + title -->
		<div>
			<div
				class="mb-[14px] font-[var(--mono)] text-[0.625rem] uppercase tracking-[0.25em]"
				style:color={c.tag}
			>
				{tag}
			</div>
			<div
				class="font-[var(--sans-brand)] text-[1.125rem] font-semibold leading-[1.25] text-[var(--fg)]"
			>
				{title}
			</div>
		</div>

		<!-- Bottom meta row -->
		<div
			class="mt-[14px] flex items-center gap-2 font-[var(--mono)] text-[0.625rem] uppercase tracking-[0.1em] text-[var(--fg-dim)]"
		>
			{#if metaSlot}
				{@render metaSlot()}
			{:else if meta}
				<span
					class="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-[var(--dot)]"
					aria-hidden="true"
				></span>
				{meta}
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ── Rich card ─────────────────────────────────────────── */
	.rich-card {
		display: flex;
		flex-direction: column;
		padding: 1.25rem 1.375rem 1.125rem;
		border: 1px solid rgba(94, 234, 212, 0.1);
		border-radius: 8px;
		background: linear-gradient(160deg, rgba(15, 23, 42, 0.55), rgba(3, 7, 18, 0.65));
		text-decoration: none;
		color: inherit;
		position: relative;
		overflow: hidden;
		cursor: pointer;
		transition:
			border-color 0.22s,
			transform 0.22s,
			box-shadow 0.22s;
	}
	.rich-card::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 2px;
		background: var(--edge, var(--accent));
		transform: scaleY(0.25);
		transform-origin: top;
		transition: transform 0.38s ease;
	}
	.rich-card::after {
		content: '';
		position: absolute;
		top: 8px;
		right: 8px;
		width: 10px;
		height: 10px;
		border-top: 1px solid rgba(94, 234, 212, 0.25);
		border-right: 1px solid rgba(94, 234, 212, 0.25);
		transition: border-color 0.22s;
	}
	.rich-card:hover {
		border-color: rgba(94, 234, 212, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 28px -10px rgba(94, 234, 212, 0.2);
	}
	.rich-card:hover::before {
		transform: scaleY(1);
	}
	.rich-card:hover::after {
		border-color: rgba(94, 234, 212, 0.55);
	}

	.rc-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.rc-id-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.rc-icon {
		width: 13px;
		height: 13px;
		flex-shrink: 0;
		opacity: 0.85;
	}
	.rc-id {
		font-family: var(--mono);
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.rc-version {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 3px;
		padding: 0.05rem 0.3rem;
	}
	.rc-class {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.55;
		flex-shrink: 0;
	}
	.rc-title {
		font-family: var(--sans-brand);
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--fg);
		margin: 0 0 0.875rem;
	}
	.rc-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 1rem;
	}
	.rc-tag {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.05em;
		color: var(--fg-dim);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 3px;
		padding: 0.1rem 0.38rem;
		white-space: nowrap;
	}
	.rc-tag-more {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.2);
		background: rgba(94, 234, 212, 0.05);
	}
	.rc-footer {
		margin-top: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.rc-authors {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.rc-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(94, 234, 212, 0.1);
		border: 1px solid rgba(94, 234, 212, 0.2);
		font-family: var(--mono);
		font-size: 0.52rem;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0;
		flex-shrink: 0;
	}
	.rc-author-text {
		font-family: var(--mono);
		font-size: 0.63rem;
		color: var(--fg-dim);
	}
	.rc-status-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.rc-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.rc-status-text {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.07em;
		color: var(--fg-dim);
		white-space: nowrap;
		text-transform: uppercase;
	}
</style>
