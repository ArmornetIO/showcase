<script lang="ts">
	// The Model Explorer's ten components had no page: each one renders a live
	// report from the model daemon, and until now there was no baked report to
	// render them against. `fixtures.ts` is that report.
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import ErdDiagram from '$lib/model-explorer/ErdDiagram.svelte';
	import ErdOverviewView from '$lib/model-explorer/ErdOverviewView.svelte';
	import ErdLedgerView from '$lib/model-explorer/ErdLedgerView.svelte';
	import ErdCompareView from '$lib/model-explorer/ErdCompareView.svelte';
	import ErdEnvironmentsView from '$lib/model-explorer/ErdEnvironmentsView.svelte';
	import ErdCapturesView from '$lib/model-explorer/ErdCapturesView.svelte';
	import ViewToggle from '$lib/primitives/actions/ViewToggle.svelte';
	import {
		TABLES,
		FOREIGN_KEYS,
		GROUPS,
		DRIFT,
		NO_DRIFT,
		LEDGER,
		DIFF,
		CAPTURES,
		ENVIRONMENTS
	} from './fixtures.js';

	// Drift is the state worth designing against, but "nothing is wrong" is the
	// state the view is in most of the time — both are one click apart here so
	// the empty case cannot rot unseen.
	let drifted = $state(true);
	const report = $derived(drifted ? DRIFT : NO_DRIFT);

	let source = $state('live');
	let target = $state('ledger');
	let comparing = $state(false);

	function runCompare() {
		comparing = true;
		setTimeout(() => (comparing = false), 900);
	}
</script>

<svelte:head>
	<title>Model Explorer — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="ErdDiagram ErdLayer ErdTableList ErdToolbar ErdInspector">
		<h3 class="component-name">ErdDiagram</h3>
		<p class="component-desc">
			The schema diagram: a table list, a pannable canvas of tables and foreign keys, a toolbar for
			detail level and layout, and an inspector for the selected table. Composes
			<code class="demo-code">ErdTableList</code>, <code class="demo-code">ErdLayer</code>,
			<code class="demo-code">ErdToolbar</code> and <code class="demo-code">ErdInspector</code> —
			select a table to open the inspector.
		</p>
		<div class="stage stage--tall">
			<ErdDiagram tables={TABLES} foreignKeys={FOREIGN_KEYS} groups={GROUPS} />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ErdOverviewView">
		<h3 class="component-name">ErdOverviewView</h3>
		<p class="component-desc">
			The drift verdict: whether the schema on disk still matches the one that was applied, and what
			differs if not. Toggle to see the clean state — the one it holds most of the time.
		</p>
		<div class="toggle-row">
			<ViewToggle
				options={[
					{ value: 'drift', label: 'Has drift' },
					{ value: 'clean', label: 'Clean' }
				]}
				value={drifted ? 'drift' : 'clean'}
				onchange={(v: string) => (drifted = v === 'drift')}
			/>
		</div>
		<div class="stage">
			<ErdOverviewView {report} />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ErdLedgerView">
		<h3 class="component-name">ErdLedgerView</h3>
		<p class="component-desc">
			The migration ledger, carrying one row of every state it can show —
			<code class="demo-code">applied</code>, <code class="demo-code">pending</code>,
			<code class="demo-code">reverted</code>, and the two that mean someone rewrote history:
			<code class="demo-code">checksum_drift</code> and <code class="demo-code">orphan_applied</code>.
		</p>
		<div class="stage">
			<ErdLedgerView entries={LEDGER} />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ErdCompareView">
		<h3 class="component-name">ErdCompareView</h3>
		<p class="component-desc">
			A schema comparison and the SQL that would close it. Covers all four change classes, including
			a <code class="demo-code">DROP TABLE</code> flagged as data loss. The compare button runs a
			simulated round trip so the loading state is reachable.
		</p>
		<div class="stage">
			<ErdCompareView
				diff={DIFF}
				sources={[
					{ value: 'live', label: 'Live database' },
					{ value: 'ledger', label: 'Ledger head' },
					{ value: 'file', label: 'schema.sql' }
				]}
				bind:source
				bind:target
				loading={comparing}
				onCompare={runCompare}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ErdEnvironmentsView">
		<h3 class="component-name">ErdEnvironmentsView</h3>
		<p class="component-desc">
			Which migration each environment is on, as a matrix. One environment is deliberately
			unreachable — an environment that cannot be dialled is the case the matrix has to stay legible
			through.
		</p>
		<div class="stage">
			<ErdEnvironmentsView report={ENVIRONMENTS} />
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="ErdCapturesView">
		<h3 class="component-name">ErdCapturesView</h3>
		<p class="component-desc">
			Saved schema snapshots — what was captured, from where, and by whom. Sources are mixed
			(<code class="demo-code">live</code> and <code class="demo-code">file</code>) because the
			source detail is what tells two same-day captures apart.
		</p>
		<div class="stage">
			<ErdCapturesView captures={CAPTURES} />
		</div>
	</ShowcaseBlock>
</div>

<style>
	.stage {
		position: relative;
		min-height: 260px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg);
	}
	.stage--tall {
		height: 620px;
	}
	.toggle-row {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 0.6rem;
	}
</style>
