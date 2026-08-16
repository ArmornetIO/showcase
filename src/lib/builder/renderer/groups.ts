import type { Component } from 'svelte';
import type { RendererProps } from './types.js';

import PrimitivesRenderer from './PrimitivesRenderer.svelte';
import FormsRenderer from './FormsRenderer.svelte';
import LayoutRenderer from './LayoutRenderer.svelte';
import NavigationRenderer from './NavigationRenderer.svelte';
import MetricsRenderer from './MetricsRenderer.svelte';
import DataRenderer from './DataRenderer.svelte';
import DisplayRenderer from './DisplayRenderer.svelte';
import CodeRenderer from './CodeRenderer.svelte';
import MarketingRenderer from './MarketingRenderer.svelte';
import BrandRenderer from './BrandRenderer.svelte';
import MeshRenderer from './MeshRenderer.svelte';
import ChoiceRenderer from './ChoiceRenderer.svelte';
import StoryboardRenderer from './StoryboardRenderer.svelte';

/**
 * One family of components and the renderer that draws them.
 *
 * `ids` is the dispatch table: `ComponentRenderer` looks a registry id up here
 * and mounts exactly one group, so adding a component means adding it to a
 * group's `ids` and writing the branch in that group's file. `renderer-coverage`
 * fails the build if those two ever disagree, or if an id is claimed twice.
 */
export interface RenderGroup {
	/** Stable slug — used in test output and nowhere in the UI. */
	id: string;
	/** Human label for the family. */
	label: string;
	/** Basename of the renderer, so tests can read the file that owns the branch. */
	file: string;
	component: Component<RendererProps>;
	ids: readonly string[];
}

export const RENDER_GROUPS: readonly RenderGroup[] = [
	{
		id: 'primitives',
		label: 'Primitives',
		file: 'PrimitivesRenderer.svelte',
		component: PrimitivesRenderer,
		ids: [
			'Button',
			'IconButton',
			'Chip',
			'Icon',
			'StatusDot',
			'StatusBadge',
			'Avatar',
			'Card',
			'HudCorners',
			'SectionBar',
			'StatStrip',
			'DangerBanner',
			'EmptyState',
			'UserBlock',
			'ActionsMenu',
			'ExportMenu'
		]
	},
	{
		id: 'forms',
		label: 'Forms & controls',
		file: 'FormsRenderer.svelte',
		component: FormsRenderer,
		ids: [
			'Input',
			'Textarea',
			'SearchInput',
			'PasswordInput',
			'ChipInput',
			'FileUpload',
			'Checkbox',
			'Toggle',
			'SettingRow',
			'Select',
			'ViewToggle',
			'MeshLayoutPicker'
		]
	},
	{
		id: 'layout',
		label: 'Layout',
		file: 'LayoutRenderer.svelte',
		component: LayoutRenderer,
		ids: ['Panel', 'Tabs', 'LayoutHeader', 'ActionBar', 'RulePanel', 'IconToolbar']
	},
	{
		id: 'navigation',
		label: 'Navigation',
		file: 'NavigationRenderer.svelte',
		component: NavigationRenderer,
		ids: ['SidebarNav', 'Breadcrumbs', 'EcoTabBar']
	},
	{
		id: 'metrics',
		label: 'Metrics',
		file: 'MetricsRenderer.svelte',
		component: MetricsRenderer,
		ids: [
			'StatTile',
			'CountUp',
			'PostureVerdict',
			'ProgressBar',
			'RadialProgress',
			'SteppedProgress',
			'StackedBar',
			'ConsensusBar'
		]
	},
	{
		id: 'data',
		label: 'Charts & tables',
		file: 'DataRenderer.svelte',
		component: DataRenderer,
		ids: ['DataTable', 'Timeline', 'Sparkline', 'Chart', 'DonutChart']
	},
	{
		id: 'display',
		label: 'Display',
		file: 'DisplayRenderer.svelte',
		component: DisplayRenderer,
		ids: [
			'PanelLoading',
			'Ticker',
			'LogRow',
			'PeerCard',
			'ChatMessage',
			'ChatThread'
		]
	},
	{
		id: 'code',
		label: 'Code blocks',
		file: 'CodeRenderer.svelte',
		component: CodeRenderer,
		ids: ['CodeBlock', 'ConfigBlock', 'TerminalBlock']
	},
	{
		id: 'marketing',
		label: 'Marketing sections',
		file: 'MarketingRenderer.svelte',
		component: MarketingRenderer,
		ids: ['PageHero', 'ClosingCTA', 'FaqAccordion']
	},
	{
		id: 'brand',
		label: 'Brand marks',
		file: 'BrandRenderer.svelte',
		component: BrandRenderer,
		ids: ['HexShield', 'ArmornetCrest', 'ArmornetCrestHub', 'ArmornetCrestChrome']
	},
	{
		id: 'mesh',
		label: 'Mesh',
		file: 'MeshRenderer.svelte',
		component: MeshRenderer,
		ids: ['CanvasEdge']
	},
	{
		id: 'choice',
		label: 'Choice',
		file: 'ChoiceRenderer.svelte',
		component: ChoiceRenderer,
		ids: ['SegmentGroup', 'RadioList', 'CheckboxList']
	},
	{
		id: 'storyboard',
		label: 'Storyboard',
		file: 'StoryboardRenderer.svelte',
		component: StoryboardRenderer,
		ids: [
			'StoryboardCanvas',
			'SwimLane',
			'StoryboardFrame',
			'StoryboardArrow',
			'StoryboardBranch'
		]
	}
];

const BY_ID = new Map<string, RenderGroup>(
	RENDER_GROUPS.flatMap((group) => group.ids.map((id) => [id, group] as const))
);

/** The group that owns a registry id, or `undefined` if nothing renders it. */
export function groupFor(componentId: string): RenderGroup | undefined {
	return BY_ID.get(componentId);
}
