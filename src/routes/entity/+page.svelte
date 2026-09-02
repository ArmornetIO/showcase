<script lang="ts">
	// The entity-detail surfaces: the tabs that fill a record's body and the two
	// drawers that open one. They had no page because each is a fragment of a
	// screen rather than a widget — a tab with no tab strip, a drawer with
	// nothing behind it. Here the strip and the backdrop are the page's job, so
	// the components can be looked at for what they own.
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import EntityOverviewTab from '$lib/display/tabs/EntityOverviewTab.svelte';
	import EventLogTab from '$lib/display/tabs/EventLogTab.svelte';
	import VerdictLogTab from '$lib/display/tabs/VerdictLogTab.svelte';
	import IncidentDrawer from '$lib/display/drawer/IncidentDrawer.svelte';
	import OverviewDrawer from '$lib/display/drawer/OverviewDrawer.svelte';
	import PersonListPanel from '$lib/display/entity/PersonListPanel.svelte';
	import Tabs from '$lib/navigation/Tabs.svelte';
	import Button from '$lib/primitives/actions/Button.svelte';
	import type { LogEventVM } from '$lib/display/tabs/eventLog.js';
	import type { VerdictEntryVM } from '$lib/display/tabs/VerdictLogTab.svelte';
	import type { IncidentDrawerData } from '$lib/display/drawer/IncidentDrawer.svelte';
	import type { PersonListItem } from '$lib/display/entity/PersonListPanel.svelte';

	const EVENTS: LogEventVM[] = [
		{ tone: 'up', msg: 'Agent reconnected after 4m offline', ts: '2m ago' },
		{ tone: 'denied', msg: 'Blocked npm install of event-stream@3.3.6', ts: '18m ago' },
		{ tone: 'relay', msg: 'Relayed 1.2 GB to upstream proxy', ts: '41m ago' },
		{ tone: 'degraded', msg: 'DNS resolver latency above 400ms', ts: '1h ago' },
		{ tone: 'sync', msg: 'Policy bundle synced (rev 2291)', ts: '3h ago' },
		{ tone: 'error', msg: 'Agent Line heartbeat missed once', ts: '5h ago' },
		{ tone: 'down', msg: 'Agent went offline', ts: '5h ago' }
	];

	const VERDICTS: VerdictEntryVM[] = [
		{
			id: 'v1',
			verdict: 'denied',
			source: 'dns',
			target: 'cdn.telemetry-collect.io',
			reason: 'matched indicator list: exfil-c2',
			ts: '09:41:02'
		},
		{
			id: 'v2',
			verdict: 'permitted',
			source: 'proxy',
			target: 'registry.npmjs.org',
			ts: '09:40:55'
		},
		{
			id: 'v3',
			verdict: 'denied',
			source: 'supply-chain',
			target: 'pypi:colourama',
			reason: 'typosquat of colorama',
			ts: '09:38:17'
		},
		{ id: 'v4', verdict: 'permitted', source: 'dns', target: 'github.com', ts: '09:37:41' }
	];

	let verdictFilter = $state('all');
	const FILTERS = [
		{ id: 'all', label: 'All' },
		{ id: 'denied', label: 'Denied' },
		{ id: 'permitted', label: 'Permitted' }
	];
	// The component takes an ALREADY-filtered list — filtering is the host's job,
	// so the page has to actually do it or the chips would be decorative.
	const visibleVerdicts = $derived(
		verdictFilter === 'all' ? VERDICTS : VERDICTS.filter((v) => v.verdict === verdictFilter)
	);

	let copied = $state<string | null>(null);
	function copy(label: string) {
		copied = label;
		setTimeout(() => (copied = null), 1400);
	}

	let tab = $state('overview');

	const INCIDENT: IncidentDrawerData = {
		ecosystem: 'npm',
		package: 'event-stream',
		version: '3.3.6',
		threatType: 'malicious_dependency',
		threatScore: 94,
		cve: 'CVE-2018-1000851',
		description:
			'A transitive dependency added in a patch release exfiltrated wallet credentials from applications that bundled it. The payload was obfuscated and only activated in production builds.',
		recommendation:
			'Pin to 3.3.4 and rebuild. Rotate any credentials that were present in a build environment that resolved 3.3.6.',
		agents: ['build-runner-02', 'build-runner-05', 'dev-laptop-tr'],
		firstSeen: '2026-08-28 14:02 UTC',
		lastSeen: '2026-08-30 09:41 UTC',
		count: 17
	};

	let incidentOpen = $state(false);
	let overviewOpen = $state(false);

	let people = $state<PersonListItem[]>([
		{ id: 'p1', label: 'security-lead', sublabel: 'whole assessment', color: 'accent' },
		{ id: 'p2', label: 'infra-oncall', sublabel: 'section 4 only' }
	]);
	let removingId = $state<string | null>(null);

	function addPerson(who: string) {
		people = [...people, { id: crypto.randomUUID(), label: who }];
	}
	function removePerson(id: string) {
		removingId = id;
		setTimeout(() => {
			people = people.filter((p) => p.id !== id);
			removingId = null;
		}, 400);
	}
</script>

<svelte:head>
	<title>Entity detail — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="EntityOverviewTab EventLogTab VerdictLogTab">
		<h3 class="component-name">Entity tabs</h3>
		<p class="component-desc">
			The three bodies a record's detail view switches between. Each is presentational and hidden
			section by section when its prop is empty, so a host shows only what it has. The tab strip is
			this page's, not theirs.
		</p>
		<div class="framed">
			<Tabs
				tabs={[
					{ id: 'overview', label: 'Overview' },
					{ id: 'events', label: 'Event log' },
					{ id: 'verdicts', label: 'Verdicts' }
				]}
				bind:active={tab}
			/>
			<div class="tab-body">
				{#if tab === 'overview'}
					<EntityOverviewTab
						stats={[
							{ label: 'Status', value: 'Connected', live: true },
							{ label: 'Mode', value: 'enforce' },
							{ label: 'Endpoint', value: 'agent-04.mesh.internal:4317', mono: true, truncate: true },
							{ label: 'Version', value: 'v1.14.2', mono: true },
							{ label: 'Uptime', value: '6d 4h' },
							{ label: 'Org', value: 'Northwind Security' }
						]}
						highlights={[
							{ label: 'DNS interception', detail: '1.4k/hr', count: 23, countLabel: 'denied' },
							{ label: 'Supply-chain scan', detail: '9 ecosystems', count: 2, countLabel: 'blocked' },
							{ label: 'Relay', detail: '1.2 GB/day' }
						]}
						events={EVENTS.slice(0, 4)}
						credentials={[
							{ label: 'Agent ID', value: 'agt_01M1AFBDYVDXY3', copyable: true },
							{ label: 'Enrollment token', value: '••••••••••••', masked: true, actionLabel: 'Rotate' }
						]}
						copiedLabel={copied}
						oncopy={copy}
						onaction={() => {}}
					/>
				{:else if tab === 'events'}
					<EventLogTab events={EVENTS} />
				{:else}
					<VerdictLogTab
						stats={{ total: 4128, denied: 312, permitted: 3816 }}
						filters={FILTERS}
						activeFilter={verdictFilter}
						entries={visibleVerdicts}
						onfilter={(id) => (verdictFilter = id)}
					/>
				{/if}
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="EventLogTab">
		<h3 class="component-name">EventLogTab — empty</h3>
		<p class="component-desc">
			The state a brand-new record is in. Worth its own demo because it is the one a reader sees
			first and the one that rots unnoticed.
		</p>
		<div class="framed framed--pad">
			<EventLogTab events={[]} title="Event log" emptyText="No activity recorded yet." />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="IncidentDrawer">
		<h3 class="component-name">IncidentDrawer</h3>
		<p class="component-desc">
			The click-through for one blast-radius interception — what the package was, how dangerous, who
			was exposed, and the recommended action. Read-only by design: the
			<code class="demo-code">triage</code> snippet is where a caller drops disposition controls, so
			the drawer carries no workflow state. Esc or the scrim closes it.
		</p>
		<div class="demo-row">
			<Button variant="primary" size="sm" onclick={() => (incidentOpen = true)}>
				Open incident
			</Button>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="OverviewDrawer">
		<h3 class="component-name">OverviewDrawer</h3>
		<p class="component-desc">
			The lighter right-pinned card: icon, title, role, a stat grid, a note and one way onward.
			Suits an overview page precisely because there is nothing to page through — unlike the tabbed
			<code class="demo-code">NodeDrawer</code>.
		</p>
		<div class="demo-row">
			<Button variant="primary" size="sm" onclick={() => (overviewOpen = true)}>
				Open overview
			</Button>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="PersonListPanel">
		<h3 class="component-name">PersonListPanel</h3>
		<p class="component-desc">
			Add-and-remove list of people, with chip colour carrying scope — accent for whole-assessment
			ownership, default for a narrower one. Removal here runs a short delay so the
			<code class="demo-code">removingId</code> state is visible.
		</p>
		<div class="panel-grid">
			<PersonListPanel
				title="Assignees"
				icon="users"
				items={people}
				placeholder="Add by handle…"
				hint="Assignees can answer and submit sections."
				{removingId}
				onAdd={addPerson}
				onRemove={removePerson}
			/>
			<PersonListPanel
				title="Reviewers"
				icon="clipboard-check"
				items={[]}
				placeholder="Add by handle…"
				disabled
				disabledHint="Reviewers open once the assessment is submitted."
				onAdd={() => {}}
				onRemove={() => {}}
			/>
		</div>
	</ShowcaseBlock>
</div>

<IncidentDrawer
	open={incidentOpen}
	incident={INCIDENT}
	onclose={() => (incidentOpen = false)}
	threatColor="var(--palette-violet)"
	severityColor="var(--palette-red)"
	severityLabel="CRITICAL"
>
	{#snippet triage()}
		<div class="triage">
			<Button variant="primary" size="sm">Create rule</Button>
			<Button variant="ghost" size="sm">Send to tracker</Button>
		</div>
	{/snippet}
</IncidentDrawer>

<OverviewDrawer
	open={overviewOpen}
	title="agent-04"
	role="Enforcing proxy"
	accent="var(--accent-emerald)"
	icon="shield-check"
	stats={[
		{ label: 'Status', value: 'Connected' },
		{ label: 'Mode', value: 'enforce' },
		{ label: 'Uptime', value: '6d 4h' },
		{ label: 'Denied / 24h', value: '312' }
	]}
	note="Rerouted twice in the last hour — upstream resolver is flapping."
	ctaLabel="View full record →"
	oncta={() => (overviewOpen = false)}
	onclose={() => (overviewOpen = false)}
/>

<style>
	.framed {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		overflow: hidden;
	}
	.framed--pad {
		padding: 0.75rem;
	}
	.tab-body {
		padding: 0.85rem;
		border-top: 1px solid var(--border);
	}
	.demo-row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	.panel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 0.75rem;
	}
	.triage {
		display: flex;
		gap: 0.5rem;
	}
</style>
