export type PropKind = 'text' | 'textarea' | 'boolean' | 'number' | 'enum';

export interface PropDef {
	kind: PropKind;
	label: string;
	default: unknown;
	options?: readonly string[];
	min?: number;
	max?: number;
	step?: number;
	/**
	 * How an `enum` should be DRAWN. Purely presentational — `kind` stays `enum`,
	 * the value is still one of `options`, and everything downstream (the scene
	 * channel vocabulary, the registry invariants) is untouched.
	 *
	 * It exists because a dropdown is the wrong control for most of the enums in
	 * here: `variant`, `size` and `tone` are 3–5 mutually exclusive choices that
	 * fit on one line, and a colour enum rendered as a list of token NAMES makes
	 * you read the palette instead of seeing it. A hint rather than a new `kind`
	 * so opting in is one word per prop and opting out is deleting it.
	 *
	 *   select   — native dropdown (the default; right past ~8 options)
	 *   chips    — pressed-state buttons in a row
	 *   swatches — colour squares; `options` must be colours the CSS can paint
	 *   icons    — glyph grid; `options` must be `ICONS` keys
	 */
	presentation?: 'select' | 'chips' | 'swatches' | 'icons';
	/** Only show this prop when another prop matches one of the given values. */
	showWhen?: { key: string; values: readonly string[] };
	/** Renders a named section divider immediately before this prop row. */
	section?: string;
	/**
	 * Whether the scene builder may drive this prop over time, and how.
	 *
	 *   lerp — interpolate between two values across a cue's span (numbers)
	 *   step — change at the cue's onset and hold (enums, booleans, short text)
	 *   none — not animatable
	 *
	 * OPTIONAL, and defaulted by `kind` in `scene/component-channels.ts`, so the
	 * animatable vocabulary for the whole library is derived rather than
	 * authored. Set it only where the default is wrong — a `number` that is
	 * really an id, or a `textarea` short enough to be worth swapping.
	 */
	animate?: 'none' | 'step' | 'lerp';
}

export interface ComponentMeta {
	id: string;
	label: string;
	category: 'Primitives' | 'Layout' | 'Navigation' | 'Display' | 'Storyboard';
	defaultW: number;
	defaultH: number;
	resizable: boolean;
	/** If false, component is an overlay/trigger target — not shown in the drag palette. */
	placeable: boolean;
	props: Record<string, PropDef>;
}

// ── Trigger interaction props — shared by Button and IconButton ──────────────
const TRIGGER_PROPS: Record<string, PropDef> = {
	__trigger: {
		kind: 'enum',
		label: 'On Click',
		default: 'none',
		options: ['none', 'alert-info', 'alert-success', 'alert-warn', 'alert-danger', 'open-drawer', 'open-modal'],
		section: 'INTERACTION'
	},
	__triggerTitle: {
		kind: 'text',
		label: 'Alert title',
		default: '',
		showWhen: { key: '__trigger', values: ['alert-info', 'alert-success', 'alert-warn', 'alert-danger'] }
	},
	__triggerMessage: {
		kind: 'text',
		label: 'Alert message',
		default: 'Action triggered',
		showWhen: { key: '__trigger', values: ['alert-info', 'alert-success', 'alert-warn', 'alert-danger'] }
	},
	__drawerType: {
		kind: 'enum',
		label: 'Node type',
		default: 'control-plane',
		options: ['control-plane', 'agentic', 'proxy', 'daemon'],
		showWhen: { key: '__trigger', values: ['open-drawer'] }
	},
	__drawerPosition: {
		kind: 'enum',
		label: 'Position',
		default: 'bottom',
		options: ['bottom', 'top', 'left', 'right'],
		showWhen: { key: '__trigger', values: ['open-drawer'] }
	},
	__drawerTitle: {
		kind: 'text',
		label: 'Drawer title',
		default: 'Node Details',
		showWhen: { key: '__trigger', values: ['open-drawer'] }
	},
	__drawerIcon: {
		kind: 'text',
		label: 'Icon glyph',
		default: 'CP',
		showWhen: { key: '__trigger', values: ['open-drawer'] }
	},
	__drawerNodeId: {
		kind: 'text',
		label: 'Node ID',
		default: 'ctrl.plane.01',
		showWhen: { key: '__trigger', values: ['open-drawer'] }
	},
	__drawerState: {
		kind: 'enum',
		label: 'Node state',
		default: 'healthy',
		options: ['healthy', 'degraded', 'offline'],
		showWhen: { key: '__trigger', values: ['open-drawer'] }
	},
	__modalTitle: {
		kind: 'text',
		label: 'Modal title',
		default: 'Confirm Action',
		showWhen: { key: '__trigger', values: ['open-modal'] }
	},
	__modalBody: {
		kind: 'textarea',
		label: 'Modal content',
		default: 'Are you sure you want to proceed?',
		showWhen: { key: '__trigger', values: ['open-modal'] }
	},
	__modalVariant: {
		kind: 'enum',
		label: 'Variant',
		default: 'default',
		options: ['default', 'danger', 'warn', 'success'],
		showWhen: { key: '__trigger', values: ['open-modal'] }
	},
	__modalSize: {
		kind: 'enum',
		label: 'Size',
		default: 'md',
		options: ['sm', 'md', 'lg'],
		showWhen: { key: '__trigger', values: ['open-modal'] }
	}
};

export const REGISTRY: ComponentMeta[] = [
	// ── Primitives ──────────────────────────────────────────────────────────────
	{
		id: 'Checkbox',
		label: 'Checkbox',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			__children: { kind: 'text', label: 'Label', default: 'Enabled' },
			checked: { kind: 'boolean', label: 'Checked', default: false },
			indeterminate: { kind: 'boolean', label: 'Indeterminate', default: false },
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'MeshLayoutPicker',
		label: 'Mesh Layout Picker',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			value: {
				kind: 'enum',
				label: 'Layout',
				default: 'grouped',
				options: ['grouped', 'packed', 'radial', 'fan', 'globe']
			},
			label: { kind: 'text', label: 'Heading', default: 'Arrangement' },
			columns: { kind: 'number', label: 'Columns', default: 2, min: 1, max: 5, step: 1 }
		}
	},
	{
		id: 'Button',
		label: 'Button',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			__children: { kind: 'text', label: 'Label', default: 'Button' },
			variant: {
				kind: 'enum',
				label: 'Variant',
				default: 'ghost',
				options: ['primary', 'ghost', 'danger', 'solid', 'solid-ghost']
			},
			size: { kind: 'enum', label: 'Size', default: 'md', options: ['sm', 'md', 'lg'] },
			disabled: { kind: 'boolean', label: 'Disabled', default: false },
			loading: { kind: 'boolean', label: 'Loading', default: false },
			...TRIGGER_PROPS
		}
	},
	{
		id: 'IconButton',
		label: 'Icon Button',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			variant: { kind: 'enum', label: 'Variant', default: 'default', presentation: 'chips', options: ['default', 'danger'] },
			disabled: { kind: 'boolean', label: 'Disabled', default: false },
			label: { kind: 'text', label: 'Aria label', default: 'Action' },
			icon: { kind: 'text', label: 'Icon glyph', default: '⚙' },
			...TRIGGER_PROPS
		}
	},
	{
		id: 'Chip',
		label: 'Chip',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			__children: { kind: 'text', label: 'Label', default: 'ACTIVE' },
			look: {
				kind: 'enum',
				label: 'Look',
				default: 'ghost',
				presentation: 'chips',
				options: ['ghost', 'filled']
			},
			color: {
				kind: 'enum',
				label: 'Color',
				default: 'accent',
				// Chips, not swatches: these are token NAMES, and a swatch can only
				// paint a value the CSS can resolve.
				presentation: 'chips',
				options: ['default', 'accent', 'success', 'warn', 'error', 'cyan', 'blue', 'critical', 'get', 'post', 'delete', 'patch']
			},
			pulse: { kind: 'boolean', label: 'Pulse dot', default: false }
		}
	},
	{
		id: 'Icon',
		label: 'Icon',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			// A curated subset, not all ~105 keys: a picker you have to scroll is a
			// search problem, and the registry invariant needs `default` to be one of
			// `options` anyway. Free choice of the full set stays available in code.
			name: {
				kind: 'enum',
				label: 'Glyph',
				default: 'shield-check',
				presentation: 'icons',
				options: [
					'shield-check', 'shield-alert', 'alert-triangle', 'alert-circle',
					'check-circle-2', 'x-circle', 'clipboard-list', 'clipboard-check',
					'file-text', 'message-square', 'bar-chart-2', 'table-2',
					'layout-grid', 'layout-dashboard', 'layout-template', 'panel-right',
					'git-branch', 'git-merge', 'git-fork', 'share-2',
					'settings-2', 'refresh-cw', 'flask-conical', 'credit-card'
				]
			},
			size: { kind: 'number', label: 'Size (px)', default: 20, min: 10, max: 64, step: 1 }
		}
	},
	{
		id: 'StatusDot',
		label: 'Status Dot',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			status: {
				kind: 'enum',
				label: 'Status',
				default: 'healthy',
				options: ['healthy', 'degraded', 'offline']
			},
			glow: { kind: 'boolean', label: 'Glow', default: true }
		}
	},
	{
		id: 'StatusBadge',
		label: 'Status Badge',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			status: {
				kind: 'enum',
				label: 'Status',
				default: 'healthy',
				options: ['healthy', 'degraded', 'offline']
			},
			bordered: { kind: 'boolean', label: 'Bordered', default: true }
		}
	},
	{
		id: 'Toggle',
		label: 'Toggle',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			checked: { kind: 'boolean', label: 'Checked', default: false },
			disabled: { kind: 'boolean', label: 'Disabled', default: false },
			label: { kind: 'text', label: 'Label', default: 'Enable feature' }
		}
	},
	{
		id: 'Input',
		label: 'Input',
		category: 'Primitives',
		defaultW: 240,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Enter value…' }
		}
	},
	{
		id: 'Textarea',
		label: 'Textarea',
		category: 'Primitives',
		defaultW: 240,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Enter text…' },
			rows: { kind: 'number', label: 'Rows', default: 4, min: 1, max: 20, step: 1 }
		}
	},
	{
		id: 'SearchInput',
		label: 'Search Input',
		category: 'Primitives',
		defaultW: 240,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Search…' },
			variant: {
				kind: 'enum',
				label: 'Variant',
				default: 'default',
				options: ['default', 'command-trigger']
			}
		}
	},
	{
		id: 'PasswordInput',
		label: 'Password Input',
		category: 'Primitives',
		defaultW: 240,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Enter password…' },
			size: { kind: 'enum', label: 'Size', default: 'md', options: ['sm', 'md', 'lg'] },
			status: {
				kind: 'enum',
				label: 'Status',
				default: 'default',
				options: ['default', 'error', 'success', 'warn']
			},
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'ChipInput',
		label: 'Chip Input',
		category: 'Primitives',
		defaultW: 280,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			value: { kind: 'textarea', label: 'Chips (JSON)', default: '["prod", "api"]' },
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Add tag…' },
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'FileUpload',
		label: 'File Upload',
		category: 'Primitives',
		defaultW: 320,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			placeholder: {
				kind: 'text',
				label: 'Placeholder',
				default: 'Drag & drop, paste, or click to browse'
			},
			accept: { kind: 'text', label: 'Accept', default: '*' },
			filename: { kind: 'text', label: 'Filename', default: '' },
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'SettingRow',
		label: 'Setting Row',
		category: 'Primitives',
		defaultW: 380,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			title: { kind: 'text', label: 'Title', default: 'Require MFA' },
			description: {
				kind: 'text',
				label: 'Description',
				default: 'Every member must enrol a second factor.'
			},
			checked: { kind: 'boolean', label: 'Checked', default: true },
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'UserBlock',
		label: 'User Block',
		category: 'Primitives',
		defaultW: 260,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			initials: { kind: 'text', label: 'Initials', default: 'AR' },
			name: { kind: 'text', label: 'Name', default: 'A. Rivera' },
			email: { kind: 'text', label: 'Email', default: 'arivera@example.com' },
			role: { kind: 'text', label: 'Role', default: 'Admin' }
		}
	},
	{
		id: 'DangerBanner',
		label: 'Danger Banner',
		category: 'Primitives',
		defaultW: 440,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			title: { kind: 'text', label: 'Title', default: 'Delete this organisation' },
			message: {
				kind: 'text',
				label: 'Message',
				default: 'This removes every agent, rule, and report. It cannot be undone.'
			}
		}
	},
	{
		id: 'EmptyState',
		label: 'Empty State',
		category: 'Primitives',
		defaultW: 320,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			message: { kind: 'text', label: 'Message', default: 'Nothing here yet' },
			sub: { kind: 'text', label: 'Sub-text', default: 'Once an agent reports, it shows up here.' },
			variant: { kind: 'enum', label: 'Variant', default: 'inline', options: ['inline', 'card'] }
		}
	},
	{
		id: 'CommandPalette',
		label: 'Command Palette',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Type a command or search…' }
		}
	},
	{
		id: 'Select',
		label: 'Select',
		category: 'Primitives',
		defaultW: 240,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			placeholder: { kind: 'text', label: 'Placeholder', default: 'Choose an option…' },
			options: {
				kind: 'textarea',
				label: 'Options (JSON array)',
				default: '[{"value":"global","label":"Global (all registries)"},{"value":"npm","label":"NPM"},{"value":"go","label":"Go Modules"},{"value":"pip","label":"PIP"}]'
			},
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'SectionBar',
		label: 'Section Bar',
		category: 'Primitives',
		defaultW: 300,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			label: { kind: 'text', label: 'Label', default: 'SECTION' }
		}
	},
	{
		id: 'Avatar',
		label: 'Avatar',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			initials: { kind: 'text', label: 'Initials', default: 'AB' },
			size: { kind: 'number', label: 'Size (px)', default: 40, min: 24, max: 120, step: 4 }
		}
	},
	{
		id: 'ViewToggle',
		label: 'View Toggle',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			options: {
				kind: 'text',
				label: 'Options (val:Label,…)',
				default: 'grid:Grid,list:List,table:Table'
			},
			value: { kind: 'text', label: 'Active value', default: 'grid' }
		}
	},
	{
		id: 'Card',
		label: 'Card',
		category: 'Primitives',
		defaultW: 320,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			type: {
				kind: 'enum',
				label: 'Type',
				default: 'stat',
				options: ['composite', 'article', 'data-input', 'profile', 'stat', 'doc', 'summary', 'hud', 'pricing']
			},
			variant: {
				kind: 'enum',
				label: 'Variant',
				default: 'accent',
				options: ['accent', 'cyan', 'emerald', 'blue'],
				showWhen: { key: 'type', values: ['composite', 'article', 'data-input', 'profile', 'doc', 'hud', 'pricing'] }
			},
			title: {
				kind: 'text',
				label: 'Title',
				default: 'Card Title',
				showWhen: { key: 'type', values: ['composite', 'article', 'data-input', 'doc', 'hud'] }
			},
			eyebrow: {
				kind: 'text',
				label: 'Eyebrow',
				default: 'THREAT INTEL',
				showWhen: { key: 'type', values: ['composite', 'data-input', 'hud'] }
			},
			description: {
				kind: 'textarea',
				label: 'Description',
				default: 'Card description text.',
				showWhen: { key: 'type', values: ['composite'] }
			},
			excerpt: {
				kind: 'textarea',
				label: 'Excerpt',
				default: 'A short summary of the article.',
				showWhen: { key: 'type', values: ['article'] }
			},
			category: {
				kind: 'text',
				label: 'Category',
				default: 'SECURITY',
				showWhen: { key: 'type', values: ['article'] }
			},
			readTime: {
				kind: 'text',
				label: 'Read Time',
				default: '5 min',
				showWhen: { key: 'type', values: ['article'] }
			},
			label: {
				kind: 'text',
				label: 'Label',
				default: 'SCORE',
				showWhen: { key: 'type', values: ['stat'] }
			},
			value: {
				kind: 'text',
				label: 'Value',
				default: '94',
				showWhen: { key: 'type', values: ['stat'] }
			},
			statVariant: {
				kind: 'enum',
				label: 'Stat Variant',
				default: 'default',
				options: ['default', 'accent', 'warn', 'error', 'dim'],
				showWhen: { key: 'type', values: ['stat'] }
			},
			size: {
				kind: 'enum',
				label: 'Size',
				default: 'md',
				options: ['sm', 'md', 'md-long', 'lg', 'xl'],
				showWhen: { key: 'type', values: ['stat'] }
			},
			initials: {
				kind: 'text',
				label: 'Initials',
				default: 'AS',
				showWhen: { key: 'type', values: ['profile'] }
			},
			name: {
				kind: 'text',
				label: 'Name',
				default: 'Alice Smith',
				showWhen: { key: 'type', values: ['profile'] }
			},
			role: {
				kind: 'text',
				label: 'Role',
				default: 'Security Engineer',
				showWhen: { key: 'type', values: ['profile'] }
			},
			tag: {
				kind: 'text',
				label: 'Tag',
				default: 'POLICY',
				showWhen: { key: 'type', values: ['doc'] }
			},
			meta: {
				kind: 'text',
				label: 'Meta',
				default: 'Updated 2 days ago',
				showWhen: { key: 'type', values: ['doc'] }
			},
			docStatus: {
				kind: 'enum',
				label: 'Doc Status',
				default: 'draft',
				options: ['draft', 'active', 'approved'],
				showWhen: { key: 'type', values: ['doc'] }
			},
			// ── hud ──────────────────────────────────────────────────────────
			body: {
				kind: 'textarea',
				label: 'Body text',
				default: 'Supporting description for this card.',
				showWhen: { key: 'type', values: ['hud'] }
			},
			num: {
				kind: 'text',
				label: 'Outline numeral',
				default: '',
				showWhen: { key: 'type', values: ['hud'] }
			},
			windowLabel: {
				kind: 'text',
				label: 'Window label',
				default: '',
				showWhen: { key: 'type', values: ['hud'] }
			},
			ctaLabel: {
				kind: 'text',
				label: 'CTA label',
				default: '',
				showWhen: { key: 'type', values: ['hud', 'pricing'] }
			},
			ctaHref: {
				kind: 'text',
				label: 'CTA href',
				default: '',
				showWhen: { key: 'type', values: ['hud', 'pricing'] }
			},
			featured: {
				kind: 'boolean',
				label: 'Featured',
				default: false,
				showWhen: { key: 'type', values: ['hud', 'pricing'] }
			},
			// ── pricing ───────────────────────────────────────────────────────
			tier: {
				kind: 'text',
				label: 'Tier name',
				default: 'Professional',
				showWhen: { key: 'type', values: ['pricing'] }
			},
			price: {
				kind: 'text',
				label: 'Price',
				default: '$299',
				showWhen: { key: 'type', values: ['pricing'] }
			},
			priceUnit: {
				kind: 'text',
				label: 'Price unit',
				default: '/mo',
				showWhen: { key: 'type', values: ['pricing'] }
			},
			priceSub: {
				kind: 'text',
				label: 'Price sub-note',
				default: '',
				showWhen: { key: 'type', values: ['pricing'] }
			},
			badge: {
				kind: 'text',
				label: 'Badge label',
				default: '',
				showWhen: { key: 'type', values: ['pricing'] }
			},
			pending: {
				kind: 'boolean',
				label: 'Coming soon',
				default: false,
				showWhen: { key: 'type', values: ['pricing'] }
			},
			// ── profile ───────────────────────────────────────────────────────
			profileLayout: {
				kind: 'enum',
				label: 'Layout',
				default: 'horizontal',
				options: ['horizontal', 'vertical'],
				showWhen: { key: 'type', values: ['profile'] }
			}
		}
	},

	{
		id: 'HudCorners',
		label: 'Hud Corners',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			color: { kind: 'text', label: 'Color', default: 'var(--accent)' },
			size: { kind: 'number', label: 'Size (px)', default: 9, min: 4, max: 24, step: 1 },
			offset: { kind: 'number', label: 'Offset (px)', default: 6, min: 2, max: 20, step: 1 }
		}
	},

	// ── Layout ──────────────────────────────────────────────────────────────────
	{
		id: 'Panel',
		label: 'Panel',
		category: 'Layout',
		defaultW: 320,
		defaultH: 160,
		resizable: true,
		placeable: true,
		props: {
			__header: { kind: 'text', label: 'Header text', default: 'Panel Title' },
			__children: { kind: 'textarea', label: 'Body text', default: 'Panel body content goes here.' }
		}
	},
	{
		id: 'Tabs',
		label: 'Tabs',
		category: 'Layout',
		defaultW: 440,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			tabs: {
				kind: 'textarea',
				label: 'Tabs (JSON array)',
				default:
					'[{"id":"overview","label":"Overview"},{"id":"logs","label":"Logs"},{"id":"config","label":"Config"}]'
			},
			active: { kind: 'text', label: 'Active tab ID', default: 'overview' }
		}
	},
	{
		id: 'LayoutHeader',
		label: 'Layout Header',
		category: 'Layout',
		defaultW: 560,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			eyebrow: { kind: 'text', label: 'Eyebrow', default: '// vendor management' }
		}
	},
	{
		id: 'ActionBar',
		label: 'Action Bar',
		category: 'Layout',
		defaultW: 400,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			actions: {
				kind: 'textarea',
				label: 'Actions (JSON array)',
				default:
					'[{"label":"Save","variant":"primary"},{"label":"Cancel","variant":"ghost"},{"label":"Delete","variant":"danger"}]'
			}
		}
	},
	{
		id: 'Modal',
		label: 'Modal',
		category: 'Layout',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'PageHero',
		label: 'Page Hero',
		category: 'Layout',
		defaultW: 800,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			headline: { kind: 'text', label: 'Headline', default: 'Defend Your Stack' },
			kicker: { kind: 'text', label: 'Kicker', default: 'PLATFORM' },
			lede: { kind: 'textarea', label: 'Lede', default: 'Automate your compliance program end-to-end.' },
			overlay: { kind: 'boolean', label: 'Grid overlay', default: true }
		}
	},
	{
		id: 'ClosingCTA',
		label: 'Closing CTA',
		category: 'Layout',
		defaultW: 600,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			headline: { kind: 'text', label: 'Headline', default: 'Ready to ship compliance?' },
			kicker: { kind: 'text', label: 'Kicker', default: 'GET STARTED' },
			lede: { kind: 'textarea', label: 'Lede', default: 'Book a 30-minute intro call with our team.' },
			primaryLabel: { kind: 'text', label: 'Primary CTA', default: 'Book a demo' },
			primaryHref: { kind: 'text', label: 'Primary href', default: '/demo' },
			secondaryLabel: { kind: 'text', label: 'Secondary CTA', default: 'View pricing' },
			secondaryHref: { kind: 'text', label: 'Secondary href', default: '/pricing' },
			overlay: { kind: 'boolean', label: 'Grid overlay', default: true }
		}
	},

	// ── Navigation ──────────────────────────────────────────────────────────────
	{
		id: 'SidebarNav',
		label: 'Sidebar Nav',
		category: 'Navigation',
		defaultW: 220,
		defaultH: 400,
		resizable: true,
		placeable: true,
		props: {
			sections: {
				kind: 'textarea',
				label: 'Sections (JSON)',
				default:
					'[{"title":"Main","items":[{"label":"Dashboard","href":"/","icon":"home"},{"label":"Docs","href":"/docs","icon":"file-text"}]}]'
			}
		}
	},
	{
		id: 'EcoTabBar',
		label: 'Eco Tab Bar',
		category: 'Navigation',
		defaultW: 460,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			tabs: {
				kind: 'textarea',
				label: 'Tabs (JSON)',
				default:
					'[{"id":"all"},{"id":"npm","name":"npm","mode":"3/5 active"},{"id":"pypi","name":"PyPI","mode":"inactive · BLOCK"}]'
			},
			active: { kind: 'text', label: 'Active tab id', default: 'all' }
		}
	},
	{
		id: 'Breadcrumbs',
		label: 'Breadcrumbs',
		category: 'Navigation',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			items: {
				kind: 'textarea',
				label: 'Items (JSON array)',
				default:
					'[{"label":"Dashboard","href":"/"},{"label":"Vendors","href":"/vendors"},{"label":"Armornet"}]'
			},
			separator: { kind: 'text', label: 'Separator', default: '/' }
		}
	},

	// ── Display ─────────────────────────────────────────────────────────────────
	{
		id: 'StatStrip',
		label: 'Stat Strip',
		category: 'Display',
		defaultW: 420,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			items: {
				kind: 'textarea',
				label: 'Items (JSON)',
				default:
					'[{"value":"12","label":"Agents"},{"value":"3","label":"Blocked","color":"red"},{"value":"1","label":"Observing","color":"warn"}]'
			}
		}
	},
	{
		id: 'StatTile',
		label: 'Stat Tile',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			label: { kind: 'text', label: 'Label', default: 'EVENTS' },
			value: { kind: 'text', label: 'Value', default: '1,284' },
			sub: { kind: 'text', label: 'Sub-label', default: '↑ 12% vs last week' },
			subVariant: {
				kind: 'enum',
				label: 'Sub variant',
				default: 'up',
				options: ['up', 'down', 'neutral']
			},
			mono: { kind: 'boolean', label: 'Monospace value', default: false }
		}
	},
	{
		id: 'CountUp',
		label: 'Count Up',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			value: { kind: 'number', label: 'Value', default: 1284, min: 0, max: 1000000, step: 1 },
			duration: { kind: 'number', label: 'Duration (ms)', default: 900, min: 0, max: 5000, step: 50 },
			decimals: { kind: 'number', label: 'Decimals', default: 0, min: 0, max: 4, step: 1 },
			separator: { kind: 'boolean', label: 'Thousands separator', default: true },
			prefix: { kind: 'text', label: 'Prefix', default: '' },
			suffix: { kind: 'text', label: 'Suffix', default: '' },
			mono: { kind: 'boolean', label: 'Monospace', default: true }
		}
	},
	{
		id: 'PostureVerdict',
		label: 'Posture Verdict',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			value: { kind: 'number', label: 'Coverage', default: 82, min: 0, max: 100, step: 1 },
			unit: { kind: 'text', label: 'Unit', default: '%' },
			prefix: { kind: 'text', label: 'Prefix', default: 'You have assurance on' },
			suffix: { kind: 'text', label: 'Suffix', default: 'of your critical third-party risk' }
		}
	},
	{
		id: 'ProgressBar',
		label: 'Progress Bar',
		category: 'Display',
		defaultW: 300,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			type: {
				kind: 'enum',
				label: 'Type',
				default: 'linear',
				options: ['linear', 'radial', 'stepped', 'stacked']
			},
			variant: {
				kind: 'enum',
				label: 'Variant',
				default: 'accent',
				options: ['default', 'accent', 'success', 'warn', 'error']
			},
			value: { kind: 'number', label: 'Value', default: 65, min: 0, max: 100, step: 1 },
			max: { kind: 'number', label: 'Max', default: 100, min: 1, max: 1000, step: 1 },
			label: { kind: 'text', label: 'Label', default: 'Progress' },
			size: { kind: 'enum', label: 'Size', default: 'md', options: ['sm', 'md', 'lg'] },
			showPercent: { kind: 'boolean', label: 'Show percent', default: true },
			indeterminate: { kind: 'boolean', label: 'Indeterminate', default: false }
		}
	},
	{
		id: 'RadialProgress',
		label: 'Radial Progress',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			value: { kind: 'number', label: 'Value', default: 72, min: 0, max: 100, step: 1 },
			size: { kind: 'number', label: 'Diameter (px)', default: 80, min: 40, max: 200, step: 4 },
			variant: {
				kind: 'enum',
				label: 'Variant',
				default: 'accent',
				options: ['default', 'accent', 'success', 'warn', 'error']
			},
			label: { kind: 'text', label: 'Center label', default: 'SCORE' },
			showPercent: { kind: 'boolean', label: 'Show percent', default: true },
			indeterminate: { kind: 'boolean', label: 'Indeterminate', default: false }
		}
	},
	{
		id: 'SteppedProgress',
		label: 'Stepped Progress',
		category: 'Display',
		defaultW: 320,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			steps: {
				kind: 'text',
				label: 'Steps (comma-sep labels or count)',
				default: 'ASSESS,SCAN,ANALYZE,REPORT'
			},
			current: { kind: 'number', label: 'Current step', default: 2, min: 0, max: 20, step: 1 },
			stepStyle: {
				kind: 'enum',
				label: 'Style',
				default: 'blocks',
				options: ['blocks', 'ticks', 'dots']
			},
			variant: {
				kind: 'enum',
				label: 'Variant',
				default: 'accent',
				options: ['default', 'accent', 'success', 'warn', 'error']
			},
			label: { kind: 'text', label: 'Label', default: 'Assessment progress' },
			showCount: { kind: 'boolean', label: 'Show count', default: false }
		}
	},
	{
		id: 'StackedBar',
		label: 'Stacked Bar',
		category: 'Display',
		defaultW: 320,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			label: { kind: 'text', label: 'Label', default: 'Risk breakdown' },
			size: { kind: 'enum', label: 'Size', default: 'md', options: ['sm', 'md', 'lg'] },
			showLegend: { kind: 'boolean', label: 'Show legend', default: true },
			segments: {
				kind: 'textarea',
				label: 'Segments (JSON array)',
				default:
					'[{"label":"Critical","value":12,"variant":"error"},{"label":"High","value":28,"variant":"warn"},{"label":"Medium","value":45,"variant":"accent"},{"label":"Low","value":15,"variant":"success"}]'
			}
		}
	},
	{
		id: 'PanelLoading',
		label: 'Panel Loading',
		category: 'Display',
		defaultW: 300,
		defaultH: 120,
		resizable: true,
		placeable: true,
		props: {}
	},
	{
		id: 'Ticker',
		label: 'Ticker',
		category: 'Display',
		defaultW: 480,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			items: {
				kind: 'textarea',
				label: 'Items (one per line)',
				default:
					'SOC 2 TYPE II\nISO 27001 · 27017 · 27018\nSPF · DKIM · DMARC\nPHISHING SIMULATIONS\nDNS FILTERING\nPENETRATION TESTING\nRISK REGISTERS\nVENDOR RISK MANAGEMENT'
			},
			speed: { kind: 'number', label: 'Speed (s)', default: 30, min: 5, max: 120, step: 5 },
			separator: { kind: 'text', label: 'Separator', default: '●' },
			bordered: { kind: 'boolean', label: 'Bordered', default: true }
		}
	},
	{
		id: 'ConsensusBar',
		label: 'Consensus Bar',
		category: 'Display',
		defaultW: 280,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			pct: { kind: 'number', label: 'Percentage', default: 72, min: 0, max: 100, step: 1 },
			label: { kind: 'text', label: 'Label', default: 'Threat consensus' }
		}
	},
	{
		id: 'FileTree',
		label: 'File Tree',
		category: 'Display',
		defaultW: 320,
		defaultH: 400,
		resizable: true,
		placeable: false,
		props: {}
	},
	{
		id: 'FilterToolbar',
		label: 'Filter Toolbar',
		category: 'Display',
		defaultW: 720,
		defaultH: 0,
		resizable: true,
		placeable: false,
		props: {}
	},
	{
		id: 'TablePager',
		label: 'Table Pager',
		category: 'Display',
		defaultW: 480,
		defaultH: 0,
		resizable: true,
		placeable: false,
		props: {}
	},
	{
		id: 'BulkActionBar',
		label: 'Bulk Action Bar',
		category: 'Display',
		defaultW: 640,
		defaultH: 0,
		resizable: true,
		placeable: false,
		props: {}
	},
	{
		id: 'LogRow',
		label: 'Log Row',
		category: 'Display',
		defaultW: 500,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			ts: { kind: 'text', label: 'Timestamp', default: '12:04:33' },
			level: { kind: 'enum', label: 'Level', default: 'info', options: ['info', 'warn', 'err', 'ok'] },
			message: { kind: 'text', label: 'Message', default: 'Agent mesh initialized successfully' }
		}
	},
	{
		id: 'CodeBlock',
		label: 'Code Block',
		category: 'Display',
		defaultW: 480,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			title: { kind: 'text', label: 'Title', default: 'example' },
			code: {
				kind: 'textarea',
				label: 'Code',
				default: '<!-- a component -->\n<Button variant="primary" onclick={save}>\n\tSave\n</Button>'
			}
		}
	},
	{
		id: 'ConfigBlock',
		label: 'Config Block',
		category: 'Display',
		defaultW: 340,
		defaultH: 160,
		resizable: true,
		placeable: true,
		props: {
			yaml: {
				kind: 'textarea',
				label: 'YAML',
				default:
					'agent:\n  name: threat-scraper\n  mode: passive\n  enabled: true\n  interval: 30s'
			}
		}
	},
	{
		id: 'Sparkline',
		label: 'Sparkline',
		category: 'Display',
		defaultW: 180,
		defaultH: 60,
		resizable: true,
		placeable: true,
		props: {
			data: {
				kind: 'text',
				label: 'Data (comma-separated)',
				default: '10,24,18,42,30,55,47,62,58,71'
			},
			color: { kind: 'text', label: 'Color', default: 'var(--accent)' },
			width: { kind: 'number', label: 'Width (px)', default: 160, min: 40, max: 600, step: 10 },
			height: { kind: 'number', label: 'Height (px)', default: 60, min: 20, max: 200, step: 5 }
		}
	},
	{
		id: 'PeerCard',
		label: 'Peer Card',
		category: 'Display',
		defaultW: 280,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			name: { kind: 'text', label: 'Name', default: 'threat-scraper-01' },
			id: { kind: 'text', label: 'ID', default: '10.0.0.12:4317' },
			latency: { kind: 'text', label: 'Latency', default: '4 ms' },
			// Real colour VALUES rather than token names, so the swatches paint what
			// they set. Costs free-text entry on this one prop; buys a palette you
			// read by looking instead of by parsing hex.
			color: {
				kind: 'enum',
				label: 'Color',
				default: '#5FEAD5',
				presentation: 'swatches',
				options: ['#5FEAD5', '#4ADE80', '#38BDF8', '#C4A8FF', '#FB7185', '#FDBA74', '#FCD34D', '#94A3B8']
			}
		}
	},
	{
		id: 'Timeline',
		label: 'Timeline',
		category: 'Display',
		defaultW: 300,
		defaultH: 200,
		resizable: true,
		placeable: true,
		props: {
			variant: { kind: 'enum', label: 'Variant', default: 'rail', options: ['rail', 'feed'] },
			events: {
				kind: 'textarea',
				label: 'Events (JSON array)',
				default:
					'[{"when":"2025-01-14","title":"Agent deployed","desc":"Threat scraper initialized","major":true},{"when":"2025-01-15","title":"First scan completed"},{"when":"2025-01-16","title":"Alert triggered","desc":"Anomalous traffic detected","major":true}]'
			}
		}
	},
	{
		id: 'DataTable',
		label: 'Data Table',
		category: 'Display',
		defaultW: 380,
		defaultH: 240,
		resizable: true,
		placeable: true,
		props: {
			variant: { kind: 'enum', label: 'Variant', default: 'kv', options: ['kv', 'table'] },
			rows: {
				kind: 'textarea',
				label: 'KV Rows (key: value, one per line)',
				default:
					'Vendor: Armornet\nStatus: Active\nLast scan: 2 hours ago\nRisk score: Low\nFramework: SOC 2 Type II',
				showWhen: { key: 'variant', values: ['kv'] }
			},
			columns: {
				kind: 'textarea',
				label: 'Columns (JSON array)',
				default:
					'[{"key":"name","header":"Name"},{"key":"status","header":"Status"},{"key":"score","header":"Score"}]',
				showWhen: { key: 'variant', values: ['table'] }
			},
			tableRows: {
				kind: 'textarea',
				label: 'Rows (JSON array)',
				default:
					'[{"name":"threat-scraper","status":"active","score":"94"},{"name":"dep-analyzer","status":"active","score":"87"},{"name":"core-agent","status":"degraded","score":"62"}]',
				showWhen: { key: 'variant', values: ['table'] }
			}
		}
	},
	{
		id: 'Chart',
		label: 'Chart',
		category: 'Display',
		defaultW: 480,
		defaultH: 220,
		resizable: true,
		placeable: true,
		props: {
			type: {
				kind: 'enum',
				label: 'Chart type',
				default: 'line',
				options: ['line', 'grouped-bar', 'stacked-bar', 'scatter', 'pie', 'radar', 'heatmap', 'candlestick']
			}
		}
	},
	{
		id: 'DonutChart',
		label: 'Donut Chart',
		category: 'Display',
		defaultW: 320,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			title:       { kind: 'text',   label: 'Title',        default: 'Data Exposure' },
			centerLabel: { kind: 'text',   label: 'Center label', default: 'Total' },
			countLabel:  { kind: 'text',   label: 'Count label',  default: 'Count' },
			caption:     { kind: 'text',   label: 'Caption',      default: '' },
		}
	},
	{
		id: 'TerminalBlock',
		label: 'Terminal Block',
		category: 'Display',
		defaultW: 480,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			title: { kind: 'text', label: 'Window title', default: 'agent.yaml' },
			content: {
				kind: 'textarea',
				label: 'Content',
				default: 'agent:\n  name: threat-scraper\n  mode: passive\n  enabled: true'
			}
		}
	},
	{
		id: 'FaqAccordion',
		label: 'FAQ Accordion',
		category: 'Display',
		defaultW: 560,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			items: {
				kind: 'textarea',
				label: 'Items (JSON array)',
				default:
					'[{"q":"What is SOC 2?","a":"SOC 2 is a security framework developed by the AICPA."},{"q":"How long does certification take?","a":"Typically 3-6 months depending on your readiness posture."}]'
			}
		}
	},

	// ── Assessment components ─────────────────────────────────────────────────
	{
		id: 'SegmentGroup',
		label: 'Segment Group',
		category: 'Display',
		defaultW: 320,
		defaultH: 44,
		resizable: false,
		placeable: true,
		props: {
			options: {
				kind: 'textarea',
				label: 'Options (JSON)',
				default: '[{"value":"yes","label":"Yes"},{"value":"partial","label":"Partial"},{"value":"no","label":"No"}]'
			},
			value: { kind: 'text', label: 'Selected value', default: '' }
		}
	},
	{
		id: 'RadioList',
		label: 'Radio List',
		category: 'Display',
		defaultW: 280,
		defaultH: 100,
		resizable: true,
		placeable: true,
		props: {
			options: {
				kind: 'textarea',
				label: 'Options (JSON)',
				default: '[{"value":"soc2","label":"SOC 2 Type II"},{"value":"iso27001","label":"ISO 27001"},{"value":"hipaa","label":"HIPAA"},{"value":"none","label":"None of the above"}]'
			},
			value: { kind: 'text', label: 'Selected value', default: '' }
		}
	},
	{
		id: 'CheckboxList',
		label: 'Checkbox List',
		category: 'Display',
		defaultW: 280,
		defaultH: 100,
		resizable: true,
		placeable: true,
		props: {
			options: {
				kind: 'textarea',
				label: 'Options (JSON)',
				default: '[{"value":"soc2","label":"SOC 2 Type II"},{"value":"iso27001","label":"ISO 27001"},{"value":"hipaa","label":"HIPAA"}]'
			},
			selected: {
				kind: 'textarea',
				label: 'Selected values (JSON)',
				default: '[]'
			}
		}
	},
	{
		id: 'HexShield',
		label: 'Hex Shield',
		category: 'Display',
		defaultW: 320,
		defaultH: 320,
		resizable: true,
		placeable: true,
		props: {
			layers: { kind: 'number', label: 'Layers', default: 4, min: 1, max: 20, step: 1 },
			plates: { kind: 'number', label: 'Plates', default: 19, min: 1, max: 100, step: 1 },
			active: { kind: 'boolean', label: 'Active', default: true }
		}
	},

	// ── Brand marks ─────────────────────────────────────────────────────────────
	// All three are sized by their own `size` prop rather than by the box, so they
	// are not resizable — dragging the frame would leave the art behind.
	{
		id: 'ArmornetCrest',
		label: 'Armornet Crest',
		category: 'Display',
		defaultW: 120,
		defaultH: 120,
		resizable: false,
		placeable: true,
		props: {
			size: { kind: 'number', label: 'Size', default: 96, min: 16, max: 320, step: 4 },
			color: { kind: 'text', label: 'Colour', default: 'var(--accent)' },
			glow: { kind: 'boolean', label: 'Halo', default: true },
			mesh: { kind: 'boolean', label: 'Struts', default: true }
		}
	},
	{
		id: 'ArmornetCrestHub',
		label: 'Armornet Crest — Hub',
		category: 'Display',
		defaultW: 120,
		defaultH: 120,
		resizable: false,
		placeable: true,
		props: {
			size: { kind: 'number', label: 'Size', default: 96, min: 16, max: 320, step: 4 },
			look: {
				kind: 'enum',
				label: 'Look',
				default: 'hollow',
				options: ['hollow', 'weight', 'plated']
			},
			spokes: { kind: 'enum', label: 'Spokes', default: 'full', options: ['full', 'stem', 'bar'] },
			tethers: { kind: 'boolean', label: 'Tethers', default: true },
			glow: { kind: 'boolean', label: 'Halo', default: true }
		}
	},
	{
		id: 'ArmornetCrestChrome',
		label: 'Armornet Crest — Chrome',
		category: 'Display',
		defaultW: 240,
		defaultH: 260,
		resizable: false,
		placeable: true,
		props: {
			size: { kind: 'number', label: 'Size', default: 192, min: 48, max: 320, step: 4 },
			glow: { kind: 'boolean', label: 'Bloom', default: true },
			bloom: { kind: 'number', label: 'Bloom amount', default: 1, min: 0, max: 1, step: 0.05 },
			traces: { kind: 'boolean', label: 'Etched traces', default: true },
			rim: { kind: 'boolean', label: 'Inner rim', default: true },
			emboss: { kind: 'boolean', label: 'Cast shadow', default: true },
			tethers: { kind: 'boolean', label: 'Wall struts', default: false },
			breakout: { kind: 'number', label: 'Breakout', default: 0, min: 0, max: 1, step: 0.02 }
		}
	},
	{
		id: 'CanvasEdge',
		label: 'Canvas Edge',
		category: 'Display',
		defaultW: 300,
		defaultH: 160,
		resizable: true,
		placeable: true,
		props: {
			style: {
				kind: 'enum',
				label: 'Style',
				default: 'energy',
				options: ['energy', 'pulse', 'dashed', 'degraded', 'blocked', 'latent', 'scanning', 'encrypted']
			},
			dataType: {
				kind: 'enum',
				label: 'Data type',
				default: 'query',
				options: ['query', 'config', 'feed', 'verdict', 'lifecycle', 'intercept'],
				showWhen: { key: 'style', values: ['energy'] }
			},
			showGrid: { kind: 'boolean', label: 'Show grid', default: false }
		}
	},

	// ── Chat components ──────────────────────────────────────────────────────────
	{
		id: 'ChatMessage',
		label: 'Chat Message',
		category: 'Display',
		defaultW: 280,
		defaultH: 0,
		resizable: true,
		placeable: true,
		props: {
			role: {
				kind: 'enum',
				label: 'Role',
				default: 'assistant',
				options: ['user', 'assistant', 'system']
			},
			content: {
				kind: 'textarea',
				label: 'Content',
				default: 'How can I help you design this feature?'
			}
		}
	},
	{
		id: 'ChatThread',
		label: 'Chat Thread',
		category: 'Display',
		defaultW: 320,
		defaultH: 480,
		resizable: true,
		placeable: true,
		props: {
			placeholder: {
				kind: 'text',
				label: 'Placeholder',
				default: 'Describe what you want to build…'
			},
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},

	// ── Actions & toolbar ───────────────────────────────────────────────────────
	{
		id: 'ActionsMenu',
		label: 'Actions Menu',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			placement: {
				kind: 'enum',
				label: 'Placement',
				default: 'bottom-end',
				options: ['bottom-end', 'bottom-start']
			},
			disabled: { kind: 'boolean', label: 'Disabled', default: false },
			autoDismiss: { kind: 'boolean', label: 'Auto-dismiss when idle', default: false }
		}
	},
	{
		id: 'ExportMenu',
		label: 'Export Menu',
		category: 'Primitives',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			disabled: { kind: 'boolean', label: 'Disabled', default: false }
		}
	},
	{
		id: 'IconToolbar',
		label: 'Icon Toolbar',
		category: 'Layout',
		defaultW: 44,
		defaultH: 280,
		resizable: true,
		placeable: true,
		props: {
			orientation: {
				kind: 'enum',
				label: 'Orientation',
				default: 'vertical',
				options: ['vertical', 'horizontal']
			}
		}
	},

	// ── Overlay components (placeable: false — triggered via Button/IconButton) ──
	{
		id: 'SelectionModal',
		label: 'Selection Modal',
		category: 'Layout',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'NavDrawer',
		label: 'Nav Drawer',
		category: 'Layout',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'NodeDrawer',
		label: 'Node Drawer',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'AlertBlade',
		label: 'Alert Blade',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'EntityOverviewTab',
		label: 'Entity Overview Tab',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'OverviewDrawer',
		label: 'Overview Drawer',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'IncidentDrawer',
		label: 'Incident Drawer',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'SheetDrawer',
		label: 'Sheet Drawer',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'VerdictLogTab',
		label: 'Verdict Log Tab',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},
	{
		id: 'EventLogTab',
		label: 'Event Log Tab',
		category: 'Display',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: false,
		props: {}
	},

	// ── Storyboard ──────────────────────────────────────────────────────────────
	{
		id: 'StoryboardCanvas',
		label: 'Storyboard Canvas',
		category: 'Storyboard',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			title: { kind: 'text', label: 'Title', default: '' },
			__children: { kind: 'text', label: 'Body', default: 'Drop swim lanes here.' }
		}
	},
	{
		id: 'SwimLane',
		label: 'Swim Lane',
		category: 'Storyboard',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			pill: { kind: 'text', label: 'Pill', default: 'LANE' },
			label: { kind: 'text', label: 'Label', default: '' },
			sub: { kind: 'text', label: 'Subtitle', default: '' },
			__children: { kind: 'text', label: 'Body', default: 'Drop storyboard frames here.' }
		}
	},
	{
		id: 'StoryboardFrame',
		label: 'Storyboard Frame',
		category: 'Storyboard',
		defaultW: 260,
		defaultH: 180,
		resizable: false,
		placeable: true,
		props: {
			step: { kind: 'number', label: 'Step', default: 1, min: 1, max: 9, step: 1 },
			route: { kind: 'text', label: 'Route', default: '/ path' },
			badge: { kind: 'text', label: 'Badge', default: '' },
			badgeVariant: { kind: 'enum', label: 'Badge variant', default: 'default', options: ['default', 'red'] },
			dashed: { kind: 'boolean', label: 'Dashed', default: false },
			__children: { kind: 'text', label: 'Body', default: 'Frame content.' }
		}
	},
	{
		id: 'StoryboardArrow',
		label: 'Storyboard Arrow',
		category: 'Storyboard',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			label: { kind: 'text', label: 'Label', default: '' },
			tall: { kind: 'boolean', label: 'Tall offset', default: false }
		}
	},
	{
		id: 'StoryboardBranch',
		label: 'Storyboard Branch',
		category: 'Storyboard',
		defaultW: 0,
		defaultH: 0,
		resizable: false,
		placeable: true,
		props: {
			connector: { kind: 'text', label: 'Connector', default: '↓' },
			label: { kind: 'text', label: 'Label', default: '' },
			__children: { kind: 'text', label: 'Body', default: 'Branch content.' }
		}
	}
];

export const REGISTRY_MAP = new Map(REGISTRY.map((c) => [c.id, c]));
export const CATEGORIES = ['Primitives', 'Layout', 'Navigation', 'Display', 'Storyboard'] as const;
export type Category = (typeof CATEGORIES)[number];
