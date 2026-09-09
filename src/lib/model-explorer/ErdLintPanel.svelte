<script lang="ts">
	// ── ErdLintPanel — the lint overlay's findings drawer ──────────────────────
	// Sits in the inspector's slot and is mutually exclusive with it: lint is a
	// MODE you turn on, and a drawer that swapped itself out every time you
	// clicked a finding would make the list unusable to work down.
	//
	// Findings are grouped by rule rather than by table because the reader's
	// question is "does this rule hold" — a rule with one hit is a defect, the
	// same hit buried under its table is trivia.
	import Icon from '../icons/Icon.svelte';
	import IconButton from '../primitives/actions/IconButton.svelte';
	import { LINT_RULES, type LintReport, type LintRule, type LintFinding } from './erd-lint.js';

	let {
		report,
		selected = null,
		onjump,
		onclose
	}: {
		report: LintReport;
		selected?: string | null;
		onjump: (table: string) => void;
		onclose: () => void;
	} = $props();

	let open = $state<Record<string, boolean>>({});
	// Rules stay in LINT_RULES order — severity first, so name drift is never
	// scrolled past to reach housekeeping.
	const sections = $derived(
		(Object.keys(LINT_RULES) as LintRule[])
			.map((rule) => ({ rule, meta: LINT_RULES[rule], items: report.findings.filter((f) => f.rule === rule) }))
			.filter((s) => s.items.length > 0)
	);

	function label(f: LintFinding): string {
		return f.column ? `${f.table}.${f.column}` : f.table || 'schema';
	}
</script>

<aside class="erd-lint">
	<div class="erd-lint-head">
		<div>
			<div class="erd-lint-title"><Icon name="clipboard-list" size={14} /> lint</div>
			<div class="erd-lint-sub">
				{report.total} findings across {sections.length} rules
			</div>
		</div>
		<IconButton icon="log-out" label="Close lint" size="sm" onclick={onclose} />
	</div>

	{#if report.total === 0}
		<p class="erd-lint-clean">Nothing to report — every rule holds.</p>
	{/if}

	{#each sections as s (s.rule)}
		<section class="erd-lint-sec">
			<button
				class="erd-lint-rule"
				onclick={() => (open[s.rule] = !(open[s.rule] ?? true))}
				style:--rule={s.meta.color}
			>
				<span class="erd-lint-dot"></span>
				<span class="erd-lint-name">{s.meta.label}</span>
				<span class="erd-lint-count">{s.items.length}</span>
				<Icon name={(open[s.rule] ?? true) ? 'chevron-down' : 'chevron-right'} size={12} />
			</button>
			{#if open[s.rule] ?? true}
				<p class="erd-lint-blurb">{s.meta.blurb}</p>
				<ul class="erd-lint-list">
					{#each s.items as f, i (label(f) + i)}
						<li>
							<button
								class="erd-lint-item"
								class:on={selected === f.table}
								disabled={!f.table}
								onclick={() => f.table && onjump(f.table)}
							>
								<span class="erd-lint-where" style:--rule={s.meta.color}>{label(f)}</span>
								<span class="erd-lint-msg">{f.message}</span>
								{#if f.fix}
									<span class="erd-lint-fix">{f.fix}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</aside>

<style>
	.erd-lint {
		position: absolute;
		top: 12px;
		right: 14px;
		bottom: 12px;
		width: 340px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: color-mix(in srgb, var(--bg-elev) 94%, transparent);
		backdrop-filter: blur(8px);
		padding: 14px;
		z-index: 7;
		box-shadow: var(--shadow-card);
	}
	.erd-lint-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}
	.erd-lint-title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--fg);
	}
	.erd-lint-sub {
		margin-top: 4px;
		font-size: 0.66rem;
		color: var(--fg-muted);
	}
	.erd-lint-clean {
		margin: 18px 0;
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg-muted);
	}
	.erd-lint-sec {
		margin-top: 14px;
	}
	.erd-lint-rule {
		display: flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		padding: 5px 6px;
		border: none;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--fg);
		cursor: pointer;
		text-align: left;
	}
	.erd-lint-rule:hover {
		background: var(--bg-hover, color-mix(in srgb, var(--fg) 6%, transparent));
	}
	.erd-lint-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--rule);
		flex: none;
	}
	.erd-lint-name {
		font-family: var(--mono);
		font-size: 0.74rem;
		font-weight: 600;
		flex: 1;
	}
	.erd-lint-count {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg-muted);
	}
	.erd-lint-blurb {
		margin: 2px 0 8px 21px;
		font-size: 0.64rem;
		line-height: 1.45;
		color: var(--fg-muted);
	}
	.erd-lint-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.erd-lint-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 6px 8px;
		border: 1px solid transparent;
		border-left: 2px solid var(--rule);
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
		background: color-mix(in srgb, var(--rule) 7%, transparent);
		color: var(--fg);
		cursor: pointer;
		text-align: left;
	}
	.erd-lint-item:hover:not(:disabled) {
		background: color-mix(in srgb, var(--rule) 15%, transparent);
	}
	.erd-lint-item.on {
		border-color: var(--accent);
		border-left-color: var(--rule);
	}
	.erd-lint-item:disabled {
		cursor: default;
	}
	.erd-lint-where {
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--rule);
		overflow-wrap: anywhere;
	}
	.erd-lint-msg {
		font-size: 0.65rem;
		line-height: 1.4;
		color: var(--fg-dim);
	}
	.erd-lint-fix {
		font-family: var(--mono);
		font-size: 0.63rem;
		color: var(--fg-muted);
		overflow-wrap: anywhere;
	}
	.erd-lint-fix::before {
		content: '→ ';
	}
</style>
