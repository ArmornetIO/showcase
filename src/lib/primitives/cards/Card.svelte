<script module lang="ts">
	export type {
		CardType,
		CardVariant,
		CompositeCardItem,
		ArticleCardAuthor,
		DataInputMode,
		DataInputFieldType,
		DataInputInfoRow,
		DataInputField,
		StatCardVariant,
		StatCardSize,
		DocCardStatus,
		SummaryVariant,
		SummaryItem
	} from './card.types.js';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		CardType,
		CardVariant,
		CompositeCardItem,
		ArticleCardAuthor,
		DataInputMode,
		DataInputInfoRow,
		DataInputField,
		StatCardVariant,
		StatCardSize,
		DocCardStatus,
		SummaryVariant,
		SummaryItem
	} from './card.types.js';
	import CompositeCard from './CompositeCard.svelte';
	import ArticleCard from './ArticleCard.svelte';
	import DataInputCard from './DataInputCard.svelte';
	import ProfileCard from './ProfileCard.svelte';
	import StatCard from './StatCard.svelte';
	import DocCard from './DocCard.svelte';
	import SummaryCards from '../../display/metric/SummaryCards.svelte';
	import HudCard from './HudCard.svelte';
	import PricingCard from './PricingCard.svelte';

	interface CardProps {
		type: CardType;
		variant?: CardVariant;
		class?: string;

		// ── composite ───────────────────────────────────────────────────────────
		eyebrow?: string;
		description?: string;
		body?: string;
		items?: CompositeCardItem[];
		split?: [number, number];

		// ── article ─────────────────────────────────────────────────────────────
		index?: number;
		category?: string;
		readTime?: string;
		excerpt?: string;
		author?: ArticleCardAuthor;
		href?: string;
		thumbHeight?: string;

		// ── composite + article + data-input ────────────────────────────────────
		title?: string;

		// ── data-input ──────────────────────────────────────────────────────────
		mode?: DataInputMode;
		status?: string;
		rows?: DataInputInfoRow[];
		fields?: DataInputField[];
		submitLabel?: string;
		onsubmit?: (values: Record<string, string>) => void;

		// ── profile ─────────────────────────────────────────────────────────────
		initials?: string;
		name?: string;
		role?: string;
		bio?: string;
		tags?: string[];
		profileLayout?: 'horizontal' | 'vertical';

		// ── stat ────────────────────────────────────────────────────────────────
		statVariant?: StatCardVariant;
		size?: StatCardSize;
		label?: string;
		value?: string | number;
		bracketColor?: string;
		valueColor?: string;
		labelColor?: string;

		// ── doc ─────────────────────────────────────────────────────────────────
		tag?: string;
		meta?: string;
		docStatus?: DocCardStatus;
		onclick?: (e: MouseEvent) => void;
		metaSlot?: Snippet;

		// ── summary ──────────────────────────────────────────────────────────────
		summaryItems?: SummaryItem[];
		summaryColumns?: number;

		// ── hud ───────────────────────────────────────────────────────────────────
		windowLabel?: string;
		ctaLabel?: string;
		ctaHref?: string;
		featured?: boolean;

		// ── pricing ───────────────────────────────────────────────────────────────
		tier?: string;
		price?: string;
		priceUnit?: string;
		priceSub?: string;
		priceItems?: string[];
		pending?: boolean;
		badge?: string;
	}

	let {
		type,
		variant = 'accent',
		class: cls = '',
		eyebrow = '',
		description = '',
		body,
		items = [],
		split,
		index = 1,
		category = '',
		readTime = '',
		excerpt = '',
		author,
		href,
		thumbHeight,
		title = '',
		mode = 'form',
		status,
		rows = [],
		fields = [],
		submitLabel,
		onsubmit,
		initials = '',
		name = '',
		role = '',
		bio,
		tags,
		profileLayout = 'horizontal',
		statVariant = 'default',
		size = 'md',
		label = '',
		value = 0,
		bracketColor,
		valueColor,
		labelColor,
		tag = '',
		meta,
		docStatus = 'draft',
		onclick,
		metaSlot,
		summaryItems = [],
		summaryColumns,
		windowLabel,
		ctaLabel,
		ctaHref,
		featured = false,
		tier = '',
		price,
		priceUnit,
		priceSub,
		priceItems = [],
		pending = false,
		badge
	}: CardProps = $props();
</script>

{#if type === 'composite'}
	<CompositeCard
		{eyebrow}
		{title}
		{description}
		{body}
		{items}
		{variant}
		{split}
		class={cls}
	/>
{:else if type === 'article'}
	<ArticleCard
		{index}
		{category}
		{readTime}
		{title}
		{excerpt}
		author={author ?? { initials: '', name: '' }}
		{href}
		{thumbHeight}
		{variant}
		class={cls}
	/>
{:else if type === 'data-input'}
	<DataInputCard
		{mode}
		{eyebrow}
		{title}
		{status}
		{rows}
		{fields}
		{submitLabel}
		{onsubmit}
		{variant}
		class={cls}
	/>
{:else if type === 'profile'}
	<ProfileCard
		{initials}
		{name}
		{role}
		{bio}
		{tags}
		{variant}
		layout={profileLayout}
		class={cls}
	/>
{:else if type === 'stat'}
	<StatCard
		variant={statVariant}
		{size}
		{label}
		{value}
		{bracketColor}
		{valueColor}
		{labelColor}
		class={cls}
	/>
{:else if type === 'doc'}
	<DocCard
		{tag}
		{title}
		{meta}
		status={docStatus}
		{variant}
		{onclick}
		{metaSlot}
		class={cls}
	/>
{:else if type === 'summary'}
	<SummaryCards items={summaryItems} columns={summaryColumns} />
{:else if type === 'hud'}
	<HudCard
		{eyebrow}
		{title}
		body={body}
		{windowLabel}
		{ctaLabel}
		{ctaHref}
		{featured}
		{variant}
		class={cls}
	/>
{:else if type === 'pricing'}
	<PricingCard
		{tier}
		tagline={description}
		{price}
		{priceUnit}
		{priceSub}
		items={priceItems}
		{ctaLabel}
		{ctaHref}
		{pending}
		{badge}
		{featured}
		{variant}
		class={cls}
	/>
{/if}
