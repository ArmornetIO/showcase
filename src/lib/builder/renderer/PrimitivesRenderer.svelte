<script lang="ts">
	// Buttons, badges, cards and the other atoms. Everything here is a leaf —
	// no nested layout, no data fixtures beyond a menu's sample items.
	import Button from '$lib/primitives/Button.svelte';
	import IconButton from '$lib/primitives/IconButton.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';
	import StatusDot from '$lib/primitives/StatusDot.svelte';
	import StatusBadge from '$lib/primitives/StatusBadge.svelte';
	import Avatar from '$lib/display/Avatar.svelte';
	import Card from '$lib/primitives/cards/Card.svelte';
	import HudCorners from '$lib/primitives/HudCorners.svelte';
	import SectionBar from '$lib/primitives/SectionBar.svelte';
	import StatStrip from '$lib/primitives/StatStrip.svelte';
	import type { StatStripItem } from '$lib/primitives/StatStrip.svelte';
	import DangerBanner from '$lib/primitives/DangerBanner.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import UserBlock from '$lib/primitives/UserBlock.svelte';
	import ActionsMenu from '$lib/primitives/ActionsMenu.svelte';
	import ExportMenu from '$lib/primitives/ExportMenu.svelte';
	import TriggerOverlays from './TriggerOverlays.svelte';
	import { Trigger } from './trigger.svelte.js';
	import { accessors, parseJson } from './accessors.js';
	import type { RendererProps } from './types.js';

	let { componentId, props, w, h }: RendererProps = $props();
	const { s, b, n, e } = accessors(() => props);

	const trigger = new Trigger(() => props);

	const statStripItems = $derived(
		parseJson<StatStripItem[]>(props.items, [
			{ value: '12', label: 'Agents' },
			{ value: '3', label: 'Blocked', color: 'red' }
		])
	);
</script>

{#if componentId === 'Button'}
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
