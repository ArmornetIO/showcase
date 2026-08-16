<script lang="ts">
	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import StatusDot from '$lib/primitives/StatusDot.svelte';
	import StatusBadge from '$lib/primitives/StatusBadge.svelte';
	import Toggle from '$lib/primitives/Toggle.svelte';
	import type { ToggleVariant } from '$lib/primitives/Toggle.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Textarea from '$lib/primitives/Textarea.svelte';
	import FormField from '$lib/primitives/FormField.svelte';
	import Select from '$lib/primitives/Select.svelte';
	import type { SelectOption } from '$lib/primitives/Select.svelte';
	import Combobox from '$lib/primitives/Combobox.svelte';
	import Tile from '$lib/primitives/Tile.svelte';
	import Tooltip from '$lib/primitives/Tooltip.svelte';
	import ViewToggle from '$lib/primitives/ViewToggle.svelte';
	import type { ViewToggleOption } from '$lib/primitives/ViewToggle.svelte';
	import SearchInput from '$lib/primitives/SearchInput.svelte';
	import CommandPalette from '$lib/primitives/CommandPalette.svelte';
	import SectionBar from '$lib/primitives/SectionBar.svelte';
	import type { StatusLevel } from '$lib/primitives/StatusDot.svelte';

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
	import ActionsMenu from '$lib/primitives/ActionsMenu.svelte';
	import ExportMenu from '$lib/primitives/ExportMenu.svelte';
	import type { ActionMenuItem } from '$lib/primitives/ActionsMenu.svelte';
	import type { ExportFormat } from '$lib/primitives/ExportMenu.svelte';
	import Icon from '$lib/icons/Icon.svelte';

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
		<h3 class="component-name">Chip</h3>
		<p class="component-desc">Inline label primitive with two looks that mirror <code class="demo-code">Button</code>'s ghost/solid split. <code class="demo-code">ghost</code> — border-only with sharp corners for semantic status annotations. <code class="demo-code">filled</code> — tinted pill shape for categorical tags and HTTP methods. Pass <code class="demo-code">pulse</code> for a live-signal dot.</p>
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
	</ShowcaseBlock>

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
</style>
