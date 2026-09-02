<script lang="ts">
	// Buttons, badges, cards and the other atoms. Everything here is a leaf —
	// no nested layout, no data fixtures beyond a menu's sample items.
	import Button from '$lib/primitives/actions/Button.svelte';
	import IconButton from '$lib/primitives/actions/IconButton.svelte';
	import Chip from '$lib/primitives/status/Chip.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';
	import StatusDot from '$lib/primitives/status/StatusDot.svelte';
	import StatusBadge from '$lib/primitives/status/StatusBadge.svelte';
	import Avatar from '$lib/display/entity/Avatar.svelte';
	import Card from '$lib/primitives/cards/Card.svelte';
	import HudCorners from '$lib/primitives/chrome/HudCorners.svelte';
	import SectionBar from '$lib/primitives/chrome/SectionBar.svelte';
	import StatStrip from '$lib/primitives/chrome/StatStrip.svelte';
	import type { StatStripItem } from '$lib/primitives/chrome/StatStrip.svelte';
	import DangerBanner from '$lib/primitives/status/DangerBanner.svelte';
	import EmptyState from '$lib/primitives/status/EmptyState.svelte';
	import UserBlock from '$lib/primitives/cards/UserBlock.svelte';
	import ActionsMenu from '$lib/primitives/actions/ActionsMenu.svelte';
	import ExportMenu from '$lib/primitives/actions/ExportMenu.svelte';
	import TriggerOverlays from './TriggerOverlays.svelte';
	import { Trigger } from './trigger.svelte.js';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props, w, h }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);

	const trigger = new Trigger(() => props);

	/** Steps rather than a number prop: a size scale keeps a canvas of a dozen
	 *  labels coherent, and freeform px is how that stops being true. */
	const TEXT_SIZES: Record<string, string> = {
		xs: '10px',
		sm: '12px',
		md: '14px',
		lg: '18px',
		xl: '24px',
		'2xl': '32px'
	};
	const TEXT_WEIGHTS: Record<string, string> = { normal: '400', medium: '500', bold: '700' };

	const statStripItems = $derived(
		parseJson<StatStripItem[]>(props.items, [
			{ value: '12', label: 'Agents' },
			{ value: '3', label: 'Blocked', color: 'danger' }
		])
	);
</script>

{#if componentId === 'Text'}
	<!-- No component behind this one — a Text item IS its styling, and giving it
	     a library component would make a heading out of what is meant to be a
	     note on the canvas. Tokens rather than raw values so it re-themes with
	     everything else. -->
	<div
		class="bt-text"
		class:bt-mono={b('mono')}
		class:bt-upper={b('uppercase')}
		style:font-size={TEXT_SIZES[e('size', 'sm')] ?? TEXT_SIZES.sm}
		style:font-weight={TEXT_WEIGHTS[e('weight', 'normal')] ?? '400'}
		style:color="var(--{e('color', 'fg-muted')})"
		style:text-align={e('align', 'left')}
	>{s('content', 'Label')}</div>

{:else if componentId === 'Button'}
	<Button
		variant={e('variant', 'ghost')}
		size={e('size', 'md')}
		disabled={b('disabled')}
		loading={b('loading')}
		onclick={trigger.enabled ? trigger.fire : undefined}
	>
		{s('__children', 'Button')}
	</Button>
	<TriggerOverlays {trigger} {props} />

{:else if componentId === 'IconButton'}
	<IconButton
		variant={e('variant', 'default')}
		disabled={b('disabled')}
		label={s('label', 'Action')}
		onclick={trigger.enabled ? trigger.fire : undefined}
	>
		{#snippet children()}
			<span style="font-size:14px;line-height:1">{s('icon', '⚙')}</span>
		{/snippet}
	</IconButton>
	<TriggerOverlays {trigger} {props} />

{:else if componentId === 'Chip'}
	<Chip look={e('look', 'ghost')} color={e('color', 'accent')} pulse={b('pulse', false)}>
		{s('__children', 'ACTIVE')}
	</Chip>

{:else if componentId === 'Icon'}
	<Icon name={e<IconName>('name', 'shield-check')} size={n('size', 20)} />

{:else if componentId === 'StatusDot'}
	<StatusDot status={e('status', 'healthy')} glow={b('glow', true)} />

{:else if componentId === 'StatusBadge'}
	<StatusBadge status={e('status', 'healthy')} bordered={b('bordered', true)} />

{:else if componentId === 'Avatar'}
	<Avatar initials={s('initials', 'AB')} size={n('size', 40)} />

{:else if componentId === 'Card'}
	<Card
		type={e('type', 'stat')}
		variant={e('variant', 'accent')}
		title={s('title', 'Card Title')}
		eyebrow={s('eyebrow', 'THREAT INTEL')}
		description={s('description', '')}
		excerpt={s('excerpt', '')}
		category={s('category', 'SECURITY')}
		readTime={s('readTime', '5 min')}
		label={s('label', 'SCORE')}
		value={s('value', '94')}
		statVariant={e('statVariant', 'default')}
		size={e('size', 'md')}
		initials={s('initials', 'AS')}
		name={s('name', 'Alice Smith')}
		role={s('role', 'Security Engineer')}
		tag={s('tag', 'POLICY')}
		meta={s('meta', '')}
		docStatus={e('docStatus', 'draft')}
	/>

{:else if componentId === 'HudCorners'}
	<!-- Corners are absolutely positioned, so give them a box to sit in. -->
	<div class="relative" style:width="{w || 80}px" style:height="{h || 80}px">
		<HudCorners color={s('color', 'var(--accent)')} size={n('size', 9)} offset={n('offset', 6)} />
	</div>

{:else if componentId === 'SectionBar'}
	<SectionBar label={s('label', 'SECTION')} />

{:else if componentId === 'StatStrip'}
	<StatStrip items={statStripItems} />

{:else if componentId === 'DangerBanner'}
	<DangerBanner title={s('title', 'Delete this organisation')} message={s('message', '')} />

{:else if componentId === 'EmptyState'}
	<EmptyState
		message={s('message', 'Nothing here yet')}
		sub={s('sub', '')}
		variant={e('variant', 'inline')}
	/>

{:else if componentId === 'UserBlock'}
	<UserBlock
		initials={s('initials', 'AR')}
		name={s('name', 'A. Rivera')}
		email={s('email', '')}
		role={s('role', '')}
	/>

{:else if componentId === 'ActionsMenu'}
	<ActionsMenu
		items={[
			{ label: 'View details', icon: 'eye', onclick: () => {} },
			{ label: 'Edit', icon: 'pencil', onclick: () => {} },
			{ label: 'Delete', icon: 'trash-2', destructive: true, onclick: () => {} }
		]}
		placement={e('placement', 'bottom-end')}
		disabled={b('disabled')}
	/>

{:else if componentId === 'ExportMenu'}
	<ExportMenu onformat={() => {}} disabled={b('disabled')} />
{/if}

<style>
	.bt-text {
		width: 100%;
		margin: 0;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.bt-mono {
		font-family: var(--mono);
	}
	.bt-upper {
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
</style>
