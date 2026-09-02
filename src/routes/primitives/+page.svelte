<script lang="ts">
	import Button from '$lib/primitives/actions/Button.svelte';
	import Chip, { CHIP_CUTS, type ChipCut } from '$lib/primitives/status/Chip.svelte';
	import ChipStudio from '$lib/primitives/status/ChipStudio.svelte';
	import { CUT_NOTES } from '$lib/primitives/status/chip-knobs.js';
	import StatusDot from '$lib/primitives/status/StatusDot.svelte';
	import StatusBadge from '$lib/primitives/status/StatusBadge.svelte';
	import Toggle from '$lib/primitives/forms/Toggle.svelte';
	import type { ToggleVariant } from '$lib/primitives/forms/Toggle.svelte';
	import Input from '$lib/primitives/forms/Input.svelte';
	import Textarea from '$lib/primitives/forms/Textarea.svelte';
	import FormField from '$lib/primitives/forms/FormField.svelte';
	import Select from '$lib/primitives/forms/Select.svelte';
	import type { SelectOption } from '$lib/primitives/forms/Select.svelte';
	import Combobox from '$lib/primitives/forms/Combobox.svelte';
	import Tile from '$lib/primitives/chrome/Tile.svelte';
	import Tooltip from '$lib/primitives/status/Tooltip.svelte';
	import ViewToggle from '$lib/primitives/actions/ViewToggle.svelte';
	import type { ViewToggleOption } from '$lib/primitives/actions/ViewToggle.svelte';
	import SearchInput from '$lib/primitives/forms/SearchInput.svelte';
	import StepSwitcher from '$lib/primitives/forms/StepSwitcher.svelte';
	import type { ChoiceOption } from '$lib/primitives/forms/choice.types.js';
	import CommandPalette from '$lib/primitives/actions/CommandPalette.svelte';
	import SectionBar from '$lib/primitives/chrome/SectionBar.svelte';
	import type { StatusLevel } from '$lib/primitives/status/StatusDot.svelte';

	let toggleA = $state(true);
	let toggleB = $state(false);

	const toggleVariants: ToggleVariant[] = [
		'focus-scope', 'pulse-phase', 'node-target', 'power-breaker',
		'horizontal-gate', 'hardware-dip', 'bracket', 'data-grid', 'multi-led'
	];
	let toggleStates = $state<Record<string, boolean>>({
		'focus-scope': true,
		'pulse-phase': false,
		'node-target': true,
		'power-breaker': false,
		'horizontal-gate': true,
		'hardware-dip': false,
		'bracket': true,
		'data-grid': false,
		'multi-led': true
	});
	let inputVal = $state('');
	let textareaVal = $state('');
	let loading = $state(false);

	// The silhouette the studio opens on — every cell of the cut grid has its
	// own way in, and landing on the wrong one is a hunt.
	let chipStudio = $state(false);
	let chipCut = $state<ChipCut | undefined>(undefined);

	const levelOpts: ChoiceOption[] = [
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
		{ value: 'critical', label: 'Critical' }
	];
	let levelVal = $state('medium');
	let wrapVal = $state('dark');

	let viewToggleVal = $state('table');
	const viewToggleOpts: ViewToggleOption[] = [
		{ value: 'table', label: 'Table' },
		{ value: 'grid', label: 'Grid' },
		{ value: 'chart', label: 'Chart' }
	];

	let searchVal = $state('');
	let cmdOpen = $state(false);
	let lastCmd = $state('');
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import ActionsMenu from '$lib/primitives/actions/ActionsMenu.svelte';
	import ExportMenu from '$lib/primitives/actions/ExportMenu.svelte';
	import type { ActionMenuItem } from '$lib/primitives/actions/ActionsMenu.svelte';
	import type { ExportFormat } from '$lib/primitives/actions/ExportMenu.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import PageContextMenu from '$lib/primitives/actions/PageContextMenu.svelte';
	import EdgeToolbarCard from '$lib/primitives/cards/EdgeToolbarCard.svelte';
	import BreakoutStack from '$lib/primitives/chrome/BreakoutStack.svelte';
	import SubFooter from '$lib/primitives/chrome/SubFooter.svelte';
	import IconToolbar from '$lib/layout/IconToolbar.svelte';

	// ── PageContextMenu demo state ────────────────────────────────────────────
	// The toolbar holds no filter state of its own, so the chips have to be
	// derived from the live filters — otherwise "remove" would clear a chip that
	// nothing was filtering by.
	let ctxSearch = $state('okta');
	let ctxCriticality = $state('critical');
	let ctxStatus = $state('all');
	let ctxSortKey = $state('name');
	let ctxSortDir = $state<'asc' | 'desc'>('asc');

	const ctxChips = $derived(
		[
			ctxSearch && { label: `search: ${ctxSearch}`, remove: () => (ctxSearch = '') },
			ctxCriticality !== 'all' && {
				label: `criticality: ${ctxCriticality}`,
				remove: () => (ctxCriticality = 'all')
			},
			ctxStatus !== 'all' && { label: `status: ${ctxStatus}`, remove: () => (ctxStatus = 'all') }
		].filter(Boolean) as { label: string; remove: () => void }[]
	);

	function clearCtx() {
		ctxSearch = '';
		ctxCriticality = 'all';
		ctxStatus = 'all';
	}

	let lastAction = $state('');
	let lastExport = $state('');
	let comboValue = $state(['github.com', 'npmjs.org', 'docker.io']);

	const demoVendorItems: ActionMenuItem[] = [
		{ label: 'View details', icon: 'eye', onclick: () => (lastAction = 'View details') },
		{ label: 'Edit', icon: 'pencil', onclick: () => (lastAction = 'Edit') },
		{ label: 'Assign reviewer', icon: 'users', onclick: () => (lastAction = 'Assign reviewer') },
		{ label: 'Delete', icon: 'trash-2', destructive: true, onclick: () => (lastAction = 'Delete') }
	];
</script>

<svelte:head>
	<title>Primitives — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<!-- Button -->
	<ShowcaseBlock component="Button">
		<h3 class="component-name">Button</h3>
		<p class="component-desc">Primary interaction trigger. <code class="demo-code">primary</code> / <code class="demo-code">ghost</code> / <code class="demo-code">danger</code> are the console-style chip buttons (mono caps, beveled corners). <code class="demo-code">solid</code> / <code class="demo-code">solid-ghost</code> are the marketing-style pill buttons (rounded, sentence case). Pass <code class="demo-code">href</code> to render an <code class="demo-code">&lt;a&gt;</code> instead of a <code class="demo-code">&lt;button&gt;</code>.</p>

		<div class="demo-row">
			<span class="demo-label">console variants</span>
			<div class="demo-items">
				<Button variant="primary">Primary</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="danger">Danger</Button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">marketing variants</span>
			<div class="demo-items">
				<Button variant="solid">Solid pill</Button>
				<Button variant="solid-ghost">Outline pill</Button>
				<Button variant="solid" href="#" target="_self">As anchor</Button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">size</span>
			<div class="demo-items">
				<Button variant="primary" size="sm">Small</Button>
				<Button variant="primary" size="md">Medium</Button>
				<Button variant="primary" size="lg">Large</Button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">full width</span>
			<div class="demo-items" style="flex-direction:column; align-items:stretch; min-width:280px;">
				<Button variant="solid" full>Full-width solid</Button>
				<Button variant="solid-ghost" full>Full-width ghost</Button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">states</span>
			<div class="demo-items">
				<Button variant="primary" loading>Loading</Button>
				<Button variant="primary" disabled>Disabled</Button>
				<Button
					variant="primary"
					{loading}
					onclick={() => {
						loading = true;
						setTimeout(() => (loading = false), 2000);
					}}
				>
					{loading ? 'Working…' : 'Click me'}
				</Button>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Chip -->
	<ShowcaseBlock component="Chip">
		<div class="block-head">
			<h3 class="component-name">Chip</h3>
			<button class="tune" onclick={() => (chipStudio = true)}>
				<Icon name="settings-2" size={12} /> Tune
			</button>
		</div>
		<p class="component-desc">Inline label primitive with two looks that mirror <code class="demo-code">Button</code>'s ghost/solid split. <code class="demo-code">ghost</code> — border-only for semantic status annotations. <code class="demo-code">filled</code> — tinted for categorical tags and HTTP methods. Pass <code class="demo-code">pulse</code> for a live-signal dot.</p>

		<p class="component-desc"><strong>The silhouette carries the meaning.</strong> Every <code class="demo-code">cut</code> is a 45° chamfer of the same box — the only variable is which corners, so the set stays a system rather than a mood board. Click one to open it in the studio.</p>
		<div class="cut-grid">
			{#each CHIP_CUTS as c (c)}
				<!-- The cell IS the way in: the difference between `line` and `shield`
				     is entirely visual, so the thumbnail has to be the control. -->
				<button class="cut-cell" title={CUT_NOTES[c]} onclick={() => { chipCut = c; chipStudio = true; }}>
					<Chip color="accent" cut={c}>{c}</Chip>
					<span class="cut-note">{CUT_NOTES[c]}</span>
				</button>
			{/each}
		</div>

		<div class="demo-row">
			<span class="demo-label">ghost</span>
			<div class="demo-items">
				<Chip color="default">default</Chip>
				<Chip color="accent">accent</Chip>
				<Chip color="success">success</Chip>
				<Chip color="warn">warn</Chip>
				<Chip color="error">error</Chip>
				<Chip color="cyan">cyan</Chip>
				<Chip color="blue">blue</Chip>
				<Chip color="critical">critical</Chip>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">filled</span>
			<div class="demo-items">
				<Chip look="filled" color="default">default</Chip>
				<Chip look="filled" color="accent">accent</Chip>
				<Chip look="filled" color="success">success</Chip>
				<Chip look="filled" color="warn">warn</Chip>
				<Chip look="filled" color="error">error</Chip>
				<Chip look="filled" color="cyan">cyan</Chip>
				<Chip look="filled" color="blue">blue</Chip>
				<Chip look="filled" color="critical">critical</Chip>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">http methods</span>
			<div class="demo-items">
				<Chip look="filled" color="get">GET</Chip>
				<Chip look="filled" color="post">POST</Chip>
				<Chip look="filled" color="delete">DELETE</Chip>
				<Chip look="filled" color="patch">PATCH</Chip>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">pulse</span>
			<div class="demo-items">
				<Chip color="accent" pulse>live</Chip>
				<Chip color="success" pulse>online</Chip>
				<Chip color="error" pulse>degraded</Chip>
				<Chip look="filled" color="accent" pulse>broadcasting</Chip>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">marker</span>
			<div class="demo-items">
				<Chip color="accent" lead="none">none</Chip>
				<Chip color="accent" lead="dot">dot</Chip>
				<Chip color="accent" lead="bar">bar</Chip>
				<Chip color="accent" lead="wedge">wedge</Chip>
				<Chip color="critical" cut="shield" lead="bar">bar · shield</Chip>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">outline</span>
			<div class="demo-items">
				<Chip color="cyan" edge="hairline">hairline</Chip>
				<Chip color="cyan" edge="bracket">bracket</Chip>
				<Chip look="filled" color="cyan" edge="none">none</Chip>
			</div>
		</div>
		<p class="block-note">
			<strong>bracket</strong> is for dense tables — one closed box per row is what stops the rows
			reading as rows. It is scoped to <strong>square</strong> on purpose: a corner tick on a
			chamfer is a stray dash.
		</p>
	</ShowcaseBlock>

	<ChipStudio open={chipStudio} cut={chipCut} onclose={() => (chipStudio = false)} />

	<!-- StatusDot + StatusBadge -->
	<ShowcaseBlock component="StatusDot StatusBadge">
		<h3 class="component-name">StatusDot · StatusBadge</h3>
		<p class="component-desc"><strong>StatusDot</strong> — inline health glyph; use <code class="demo-code">glow</code> for live dashboards, omit for static lists. <strong>StatusBadge</strong> — standalone labelled state for table cells and detail headers where the status needs readable text. Pass <code class="demo-code">label</code> to override the keyword (e.g. <code class="demo-code">"operational"</code>) and <code class="demo-code">filled</code> for a solid pill on status pages.</p>
		{#each ['healthy', 'degraded', 'offline'] as status}
			<div class="demo-row">
				<span class="demo-label">{status}</span>
				<div class="demo-items">
					<StatusDot status={status as StatusLevel} glow />
					<StatusDot status={status as StatusLevel} glow={false} />
					<StatusBadge status={status as StatusLevel} bordered />
					<StatusBadge status={status as StatusLevel} bordered={false} />
				</div>
			</div>
		{/each}
		<div class="demo-row">
			<span class="demo-label">filled / labelled</span>
			<div class="demo-items">
				<StatusBadge status="healthy" label="operational" filled />
				<StatusBadge status="degraded" label="investigating" filled />
				<StatusBadge status="offline" label="down" filled />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Tile -->
	<ShowcaseBlock component="Tile">
		<h3 class="component-name">Tile</h3>
		<p class="component-desc">Lightweight content card with an eyebrow <code class="demo-code">tag</code>, <code class="demo-code">title</code>, and body. Pass <code class="demo-code">href</code> to make the whole tile a hover-lift link, or <code class="demo-code">ctaLabel</code> + <code class="demo-code">ctaHref</code> for a footer call-to-action. Variants tint the tag color and hover-border using the secondary palette.</p>
		<div class="demo-row">
			<span class="demo-label">basic</span>
			<div class="demo-items" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; width:100%;">
				<Tile tag="ENCRYPTION" title="Encrypted everywhere" body="TLS 1.3 in transit. AES-256 at rest. Per-tenant key wrapping." />
				<Tile tag="ACCESS" title="Least privilege by default" body="SSO + SCIM provisioning, hardware-backed admin MFA, session-bound elevation." />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">link variant</span>
			<div class="demo-items" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; width:100%;">
				<Tile tag="QUICKSTART" title="Connect a mailbox" body="15-minute walkthrough from signup to first quarantined phish." href="#" variant="cyan" />
				<Tile tag="API" title="API reference" body="REST and webhook surface for everything Armornet exposes." href="#" variant="emerald" />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">with CTA link</span>
			<div class="demo-items" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; width:100%;">
				<Tile
					tag="SALES"
					title="Talk to sales"
					body="Pricing, procurement, multi-tenant deployments, and custom DPAs."
					ctaLabel="sales@armornet.io"
					ctaHref="mailto:sales@armornet.io"
				/>
				<Tile
					tag="SECURITY"
					title="Report a vulnerability"
					body="Coordinated disclosure welcome. PGP key on the security page."
					ctaLabel="security@armornet.io"
					ctaHref="mailto:security@armornet.io"
				/>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">variants</span>
			<div class="demo-items" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:0.75rem; width:100%;">
				<Tile tag="ACCENT" title="Accent" body="Default teal tint." variant="accent" href="#" />
				<Tile tag="CYAN" title="Cyan" body="For data / signal contexts." variant="cyan" href="#" />
				<Tile tag="EMERALD" title="Emerald" body="For ok / healthy contexts." variant="emerald" href="#" />
				<Tile tag="BLUE" title="Blue" body="For info / docs contexts." variant="blue" href="#" />
				<Tile tag="AMBER" title="Amber" body="For warnings / change logs." variant="amber" href="#" />
				<Tile tag="RED" title="Red" body="For risk / incident contexts." variant="red" href="#" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Toggle -->
	<ShowcaseBlock component="Toggle">
		<h3 class="component-name">Toggle</h3>
		<p class="component-desc">Binary on/off control for settings with immediate effect. If the change requires a save/submit step, use a <code class="demo-code">Button</code> instead.</p>
		<div class="demo-row">
			<span class="demo-label">states</span>
			<div class="demo-items">
				<Toggle checked={toggleA} onchange={(v) => (toggleA = v)} label="Toggle A" />
				<Toggle checked={toggleB} onchange={(v) => (toggleB = v)} label="Toggle B" />
				<Toggle checked={true} disabled label="Disabled on" />
				<Toggle checked={false} disabled label="Disabled off" />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">values</span>
			<div class="demo-items">
				<code class="demo-code">A: {toggleA} · B: {toggleB}</code>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Toggle variants -->
	<ShowcaseBlock component="Toggle">
		<h3 class="component-name">Toggle · variants</h3>
		<p class="component-desc">Nine technical toggle styles via the <code class="demo-code">variant</code> prop — each is a single stateful control that animates between on/off. Click any one to toggle it.</p>
		{#each toggleVariants as v}
			<div class="demo-row">
				<span class="demo-label">{v}</span>
				<div class="demo-items">
					<Toggle
						variant={v}
						checked={toggleStates[v]}
						onchange={(val) => (toggleStates[v] = val)}
					/>
				</div>
			</div>
		{/each}
	</ShowcaseBlock>

	<!-- Input + Textarea + FormField -->
	<ShowcaseBlock component="Input Textarea FormField">
		<h3 class="component-name">Input · Textarea · FormField</h3>
		<p class="component-desc">Always wrap <code class="demo-code">Input</code> and <code class="demo-code">Textarea</code> with <code class="demo-code">FormField</code> for consistent label, hint, and required-state handling. For filterable list/table search, use <code class="demo-code">SearchInput</code>.</p>
		<div class="demo-form">
			<FormField label="Text input" id="demo-text" hint="Some helpful hint text.">
				<Input id="demo-text" bind:value={inputVal} placeholder="Type something…" />
			</FormField>
			<FormField label="Required field" id="demo-req" required>
				<Input id="demo-req" placeholder="Required…" required />
			</FormField>
			<FormField label="URL input" id="demo-url">
				<Input id="demo-url" type="url" placeholder="https://example.com" />
			</FormField>
			<FormField label="Disabled" id="demo-dis">
				<Input id="demo-dis" value="Can't touch this" disabled />
			</FormField>
			<FormField label="Notes" id="demo-ta" hint="Resizable.">
				<Textarea
					id="demo-ta"
					bind:value={textareaVal}
					placeholder="Write something…"
					rows={3}
				/>
			</FormField>
		</div>
	</ShowcaseBlock>

	<!-- Select -->
	<ShowcaseBlock component="Select">
		<h3 class="component-name">Select</h3>
		<p class="component-desc">Styled native <code class="demo-code">&lt;select&gt;</code> — matches <code class="demo-code">Input</code> exactly (same height, border, font, focus ring). Use when a <code class="demo-code">SegmentGroup</code> would have more than three options or when you need <code class="demo-code">optgroup</code> separators. Wrap with <code class="demo-code">FormField</code> for labelling. Supports flat <code class="demo-code">options</code> or grouped <code class="demo-code">groups</code>.</p>

		<div class="demo-row">
			<span class="demo-label">flat options</span>
			<div class="demo-items" style="max-width: 260px; width: 100%;">
				<FormField label="Scope" id="demo-select-scope">
					<Select
						id="demo-select-scope"
						options={[
							{ value: 'global', label: 'Global (all registries)' },
							{ value: 'go',     label: 'Go Modules' },
							{ value: 'npm',    label: 'NPM' },
							{ value: 'pip',    label: 'PIP' },
							{ value: 'docker', label: 'Docker' },
							{ value: 'git',    label: 'Git' }
						]}
					/>
				</FormField>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">placeholder</span>
			<div class="demo-items" style="max-width: 260px; width: 100%;">
				<Select
					placeholder="Choose a license…"
					value=""
					options={[
						{ value: 'MIT',      label: 'MIT' },
						{ value: 'Apache-2', label: 'Apache-2.0' },
						{ value: 'GPL-3',    label: 'GPL-3.0' }
					]}
				/>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">with key icon</span>
			<div class="demo-items" style="max-width: 260px; width: 100%;">
				<Select
					icon="shield-check"
					placeholder="— role —"
					options={[
						{ value: 'operator', label: 'Operator' },
						{ value: 'analyst',  label: 'Analyst' },
						{ value: 'auditor',  label: 'Auditor' },
						{ value: 'readonly', label: 'Read-only' }
					]}
				/>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">optgroups</span>
			<div class="demo-items" style="max-width: 260px; width: 100%;">
				<Select
					groups={[
						{
							group: 'Copyleft',
							options: [
								{ value: 'GPL-2.0',  label: 'GPL-2.0' },
								{ value: 'GPL-3.0',  label: 'GPL-3.0' },
								{ value: 'AGPL-3.0', label: 'AGPL-3.0' },
								{ value: 'LGPL-2.1', label: 'LGPL-2.1' }
							]
						},
						{
							group: 'Permissive',
							options: [
								{ value: 'MIT',        label: 'MIT' },
								{ value: 'Apache-2.0', label: 'Apache-2.0' },
								{ value: 'BSD-3',      label: 'BSD-3-Clause' }
							]
						}
					]}
				/>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">disabled</span>
			<div class="demo-items" style="max-width: 200px; width: 100%;">
				<Select
					disabled
					options={[{ value: 'npm', label: 'NPM' }]}
					value="npm"
				/>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Combobox -->
	<ShowcaseBlock component="Combobox">
		<h3 class="component-name">Combobox</h3>
		<p class="component-desc">Typeahead with add-your-own — the allowlist/scope entry control. Type to filter suggestions, click or <code class="demo-code">↵</code> to add a chip, and if nothing matches it offers to add the raw value. Backspace on an empty input removes the last chip.</p>

		<div class="demo-row">
			<span class="demo-label">Allowed domains</span>
			<div class="demo-items" style="width: 100%; max-width: 440px;">
				<Combobox
					bind:value={comboValue}
					suggestions={['github.com','npmjs.org','pypi.org','crates.io','docker.io','golang.org','maven.apache.org','rubygems.org']}
					placeholder="Add a domain…"
				/>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Tooltip -->
	<ShowcaseBlock component="Tooltip">
		<h3 class="component-name">Tooltip</h3>
		<p class="component-desc">Hover-revealed context — wraps any trigger element, not just buttons. Use the <code class="demo-code">tip</code> snippet for rich content (styled spans, badges). <code class="demo-code">delay</code> defaults to 0; add 200–400ms for non-critical hints.</p>

		<div class="demo-row">
			<span class="demo-label">placement</span>
			<div class="demo-items">
				<Tooltip content="Top tooltip" placement="top">
					<Button variant="ghost" size="sm">Top</Button>
				</Tooltip>
				<Tooltip content="Bottom tooltip" placement="bottom">
					<Button variant="ghost" size="sm">Bottom</Button>
				</Tooltip>
				<Tooltip content="Left tooltip" placement="left">
					<Button variant="ghost" size="sm">Left</Button>
				</Tooltip>
				<Tooltip content="Right tooltip" placement="right">
					<Button variant="ghost" size="sm">Right</Button>
				</Tooltip>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">delay</span>
			<div class="demo-items">
				<Tooltip content="Appears after 400ms" delay={400}>
					<Button variant="ghost" size="sm">Delayed</Button>
				</Tooltip>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">rich content</span>
			<div class="demo-items">
				<Tooltip>
					{#snippet tip()}
						<span style="color: var(--accent); font-family: var(--mono); font-size: 0.72rem;">
							agent.01
						</span>
						<span style="color: var(--fg-dim); font-size: 0.72rem;"> — healthy</span>
					{/snippet}
					<Chip color="success">Hover me</Chip>
				</Tooltip>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">on non-button</span>
			<div class="demo-items">
				<Tooltip content="This status means the agent is reachable" placement="right">
					<StatusBadge status="healthy" bordered />
				</Tooltip>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- StepSwitcher -->
	<ShowcaseBlock component="StepSwitcher">
		<h3 class="component-name">StepSwitcher</h3>
		<p class="component-desc">A composite of the two ways to pick from a short ordered list: the chevrons nudge to the neighbouring value, and the value itself opens an <code class="demo-code">ActionsMenu</code> of the whole set. Stepping alone costs four clicks to reach the far end and never shows what else exists; a menu alone makes &ldquo;the next one&rdquo; a two-step aim. The value is the single tab stop &mdash; &larr;/&rarr; step, Enter opens the menu.</p>
		<div class="demo-row">
			<span class="demo-label">scale</span>
			<div class="demo-items">
				<StepSwitcher options={levelOpts} value={levelVal} onpick={(v) => (levelVal = v)} label="Impact" />
				<code class="demo-code">{levelVal}</code>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">wrap</span>
			<div class="demo-items">
				<StepSwitcher
					options={[{ value: 'system', label: 'System' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'oled', label: 'OLED' }]}
					value={wrapVal}
					onpick={(v) => (wrapVal = v)}
					label="Theme"
					wrap
				/>
				<code class="demo-code">no natural extremes &rarr; the ends come around</code>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">disabled</span>
			<div class="demo-items">
				<StepSwitcher options={levelOpts} value="high" onpick={() => {}} label="Impact" disabled />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ViewToggle -->
	<ShowcaseBlock component="ViewToggle">
		<h3 class="component-name">ViewToggle</h3>
		<p class="component-desc">Segmented view-mode switcher for mutually exclusive display modes (table/grid, list/kanban). Not for page navigation — use <code class="demo-code">Tabs</code> for that. Renders as a compact pill-style control that fits inline with a <code class="demo-code">SectionBar</code>.</p>
		<div class="demo-row">
			<span class="demo-label">3 options</span>
			<div class="demo-items">
				<ViewToggle options={viewToggleOpts} value={viewToggleVal} onchange={(v) => (viewToggleVal = v)} />
				<code class="demo-code">active: {viewToggleVal}</code>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">2 options</span>
			<div class="demo-items">
				<ViewToggle
					options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]}
					value="list"
					onchange={() => {}}
				/>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- SearchInput -->
	<ShowcaseBlock component="SearchInput">
		<h3 class="component-name">SearchInput</h3>
		<p class="component-desc">Filterable search field styled for inline use above a <code class="demo-code">DataTable</code> or inside a <code class="demo-code">Panel</code> header. Bind <code class="demo-code">value</code> and forward <code class="demo-code">oninput</code> to filter your data reactively. Not a form submission input — use <code class="demo-code">Input</code> for that.</p>
		<div class="demo-row">
			<span class="demo-label">default</span>
			<div class="demo-items">
				<SearchInput bind:value={searchVal} placeholder="Filter agents…" />
				{#if searchVal}
					<code class="demo-code">"{searchVal}"</code>
				{/if}
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">custom placeholder</span>
			<div class="demo-items">
				<SearchInput value="" placeholder="Search vendors by name…" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- CommandPalette -->
	<ShowcaseBlock component="CommandPalette">
		<h3 class="component-name">CommandPalette</h3>
		<p class="component-desc">The operator's ⌘K launcher — a fixed overlay for fast navigation and actions. Groups commands, filters on type, and navigates with <code class="demo-code">↑</code>/<code class="demo-code">↓</code>/<code class="demo-code">↵</code>. Press <code class="demo-code">⌘K</code> globally or use the trigger variant of <code class="demo-code">SearchInput</code> to open. Pass <code class="demo-code">commands</code> to supply your own groups; the default set is a reference skeleton.</p>
		<div class="demo-row">
			<span class="demo-label">trigger</span>
			<div class="demo-items">
				<SearchInput
					variant="command-trigger"
					placeholder="Search commands…"
					onclick={() => (cmdOpen = true)}
				/>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">last selected</span>
			<div class="demo-items">
				{#if lastCmd}
					<code class="demo-code">"{lastCmd}"</code>
				{:else}
					<span style="color: var(--fg-dim); font-size: 0.78rem;">—</span>
				{/if}
			</div>
		</div>
		<CommandPalette bind:open={cmdOpen} onselect={(item) => (lastCmd = item.label)} />
	</ShowcaseBlock>

	<!-- SectionBar -->
	<ShowcaseBlock component="SectionBar">
		<h3 class="component-name">SectionBar</h3>
		<p class="component-desc">Full-width labeled divider for separating named groups within a scrolling panel. The gradient line draws the eye to the label without adding visual weight. Compose with a <code class="demo-code">ViewToggle</code> or action buttons on the right side of a flex container.</p>
		<div class="demo-row">
			<span class="demo-label">default</span>
			<div class="demo-items demo-items--wide">
				<SectionBar label="Active Agents" />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">with controls</span>
			<div class="demo-items demo-items--wide" style="display:flex;align-items:center;gap:12px;">
				<SectionBar label="Vendor Risk" />
				<ViewToggle
					options={[{ value: 'table', label: 'Table' }, { value: 'grid', label: 'Grid' }]}
					value="table"
					onchange={() => {}}
				/>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ActionsMenu -->
	<ShowcaseBlock component="ActionsMenu">
		<h3 class="component-name">ActionsMenu</h3>
		<p class="component-desc">Contextual dropdown triggered by a ⋮ kebab button. Items support optional icons, destructive styling, and disabled state. Pass a custom <code class="demo-code">trigger</code> snippet to replace the default kebab with any element.</p>
		<div class="demo-row">
			<span class="demo-label">default</span>
			<div class="demo-items">
				<ActionsMenu items={demoVendorItems} />
				{#if lastAction}<span style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);">→ {lastAction}</span>{/if}
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">bottom-start</span>
			<div class="demo-items">
				<ActionsMenu items={demoVendorItems} placement="bottom-start" />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">custom trigger</span>
			<div class="demo-items">
				<ActionsMenu items={demoVendorItems}>
					{#snippet trigger({ open, toggle })}
						<button type="button" onclick={toggle} style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface-raised);border:1px solid var(--border-strong);border-radius:3px;color:{open ? 'var(--accent)' : 'var(--fg-dim)'};font-family:var(--mono);font-size:0.68rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;">
							<Icon name="settings-2" size={13} /> Options
						</button>
					{/snippet}
				</ActionsMenu>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">in table row</span>
			<div class="demo-items demo-items--wide">
				<div style="width:100%;max-width:420px;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
					{#each ['Acme Corp', 'DataSync Ltd', 'Infra.io'] as vendor}
						<div style="display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid var(--border);background:var(--bg-elev);">
							<span style="flex:1;font-size:0.85rem;">{vendor}</span>
							<span style="font-family:var(--mono);font-size:0.68rem;color:var(--fg-dim);">In Progress</span>
							<ActionsMenu items={demoVendorItems} />
						</div>
					{/each}
				</div>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ExportMenu -->
	<ShowcaseBlock component="ExportMenu">
		<h3 class="component-name">ExportMenu</h3>
		<p class="component-desc">Download icon button with a format picker dropdown (CSV, JSON, PDF, Print). Wraps <code class="demo-code">ActionsMenu</code> with a preset items list. Limit formats via the <code class="demo-code">formats</code> prop.</p>
		<div class="demo-row">
			<span class="demo-label">all formats</span>
			<div class="demo-items">
				<ExportMenu onformat={(f) => (lastExport = f)} />
				{#if lastExport}<span style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);">→ {lastExport.toUpperCase()}</span>{/if}
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">csv + json</span>
			<div class="demo-items">
				<ExportMenu formats={['csv', 'json']} onformat={(f) => (lastExport = f)} />
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">disabled</span>
			<div class="demo-items">
				<ExportMenu disabled onformat={() => {}} />
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="PageContextMenu">
		<h3 class="component-name">PageContextMenu</h3>
		<p class="component-desc">
			The toolbar a list page wears: active filters as removable chips, search, grouped filters,
			sort, secondary actions, an overflow menu and one primary. Every control is host state — the
			toolbar renders the chips you give it and calls back, it never holds a filter itself.
		</p>
		<div class="ctx-frame">
			<PageContextMenu
				chips={ctxChips}
				search={{ value: ctxSearch, set: (v) => (ctxSearch = v), placeholder: 'Search vendors…' }}
				filterGroups={[
					{
						title: 'Criticality',
						options: [
							{ v: 'critical', l: 'Critical' },
							{ v: 'high', l: 'High' },
							{ v: 'low', l: 'Low' }
						],
						current: ctxCriticality,
						set: (v) => (ctxCriticality = v)
					},
					{
						title: 'Status',
						options: [
							{ v: 'current', l: 'Current' },
							{ v: 'overdue', l: 'Overdue' }
						],
						current: ctxStatus,
						set: (v) => (ctxStatus = v)
					}
				]}
				onClear={clearCtx}
				sort={{
					options: [
						{ v: 'name', l: 'Name' },
						{ v: 'reviewed', l: 'Last reviewed' }
					],
					key: ctxSortKey,
					dir: ctxSortDir,
					set: (k, d) => {
						ctxSortKey = k;
						ctxSortDir = d;
					}
				}}
				secondary={[{ label: 'Import', icon: 'upload', onclick: () => {} }]}
				menu={[
					{ kind: 'header', label: 'Bulk' },
					{ label: 'Export all', icon: 'download', onclick: () => {} },
					{ kind: 'separator' },
					{ label: 'Delete selected', icon: 'trash-2', destructive: true, onclick: () => {} }
				]}
				primary={{ label: 'Add vendor', icon: 'plus', onclick: () => {} }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="EdgeToolbarCard">
		<h3 class="component-name">EdgeToolbarCard</h3>
		<p class="component-desc">
			A card with a toolbar docked to one of its four edges. It takes both a
			<code class="demo-code">toolbar</code> snippet and children, which is why it never appeared in
			the builder registry — there is nothing to place on its own.
		</p>
		<div class="edge-grid">
			{#each ['left', 'right', 'top', 'bottom'] as const as edge (edge)}
				<EdgeToolbarCard {edge}>
					{#snippet toolbar()}
						<IconToolbar
							orientation={edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal'}
							items={[
								{ icon: 'search', label: 'Find', onclick: () => {} },
								{ icon: 'filter', label: 'Filter', onclick: () => {}, badge: 2 },
								{ icon: 'settings-2', label: 'Settings', onclick: () => {} }
							]}
						/>
					{/snippet}
					<div class="edge-body">
						<span class="edge-label">edge="{edge}"</span>
					</div>
				</EdgeToolbarCard>
			{/each}
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="BreakoutStack">
		<h3 class="component-name">BreakoutStack</h3>
		<p class="component-desc">
			Lifts an overlay out of its container on hover — the overlay grows past the card's bounds
			instead of being clipped by them. <code class="demo-code">breakout</code> is how far it may
			exceed the container, <code class="demo-code">grow</code> its scale at rest.
		</p>
		<div class="breakout-grid">
			{#each [{ b: 0.25, g: 1.15 }, { b: 0.5, g: 1.45 }, { b: 0.8, g: 1.8 }] as cfg (cfg.b)}
				<BreakoutStack breakout={cfg.b} grow={cfg.g}>
					{#snippet container()}
						<div class="breakout-card">
							<span class="breakout-caption">breakout {cfg.b} · grow {cfg.g}</span>
						</div>
					{/snippet}
					{#snippet overlay()}
						<div class="breakout-badge">
							<Icon name="shield-check" size={18} />
						</div>
					{/snippet}
				</BreakoutStack>
			{/each}
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="SubFooter">
		<h3 class="component-name">SubFooter</h3>
		<p class="component-desc">
			The thin strip under a page's main footer — two snippets, one pinned to each end. Shown with
			both ends filled and with only one, because a single-ended strip is the case that reveals
			whether it is a flex row or a grid.
		</p>
		<div class="footer-stack">
			<SubFooter>
				{#snippet start()}
					<span class="footer-note">© 2026 Armornet</span>
				{/snippet}
				{#snippet end()}
					<span class="footer-note">v1.14.2 · dev-cc5c1b69</span>
				{/snippet}
			</SubFooter>
			<SubFooter>
				{#snippet start()}
					<span class="footer-note">Start only — the end stays empty, not centred.</span>
				{/snippet}
			</SubFooter>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2rem;
	}

	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 88px;
		flex-shrink: 0;
	}

	.demo-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.demo-items--wide {
		flex: 1;
		min-width: 0;
	}

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.demo-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 480px;
	}
	.ctx-frame {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		padding: 0.6rem;
	}

	.edge-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}
	.edge-body {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 110px;
	}
	.edge-label {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg-dim);
	}

	.breakout-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
		padding: 1.25rem 0;
	}
	.breakout-card {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 150px;
		height: 96px;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
	}
	.breakout-caption {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.breakout-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--border-accent);
		background: var(--bg);
		color: var(--accent);
	}

	.footer-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.footer-note {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}

	/* ── chip studio hand-off ── */
	.block-head {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.tune {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.tune:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.08);
	}
	.tune:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.cut-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.cut-cell {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		text-align: left;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: transparent;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.cut-cell:hover {
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.05);
	}
	.cut-note {
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	.block-note {
		margin-top: 1.25rem;
		font-size: 0.66rem;
		line-height: 1.6;
		color: var(--fg-dim);
	}
	.block-note strong {
		font-family: var(--mono);
		font-weight: 400;
		color: var(--fg-muted);
	}
</style>
