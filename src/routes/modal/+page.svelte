<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import Button from '$lib/primitives/actions/Button.svelte';
	import Modal from '$lib/display/modal/Modal.svelte';
	import SelectionModal from '$lib/display/modal/SelectionModal.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { SelectionItem } from '$lib/display/modal/SelectionModal.svelte';

	let modalDefault = $state(false);
	let modalDanger = $state(false);
	let modalWarn = $state(false);
	let modalSuccess = $state(false);
	let modalNoClose = $state(false);
	let modalLg = $state(false);

	// SelectionModal demos
	let selSingle = $state(false);
	let selMulti = $state(false);
	let selSearchable = $state(false);
	let selSingleResult = $state<string>('');
	let selMultiResult = $state<string[]>([]);

	const frameworkItems: SelectionItem[] = [
		{ value: 'soc2', label: 'SOC 2 Type II', description: 'Trust service criteria for security, availability, and confidentiality' },
		{ value: 'iso27001', label: 'ISO 27001', description: 'International standard for information security management' },
		{ value: 'nist-csf', label: 'NIST CSF', description: 'Cybersecurity framework for critical infrastructure' },
		{ value: 'pci-dss', label: 'PCI DSS', description: 'Payment card industry data security standard' },
		{ value: 'hipaa', label: 'HIPAA', description: 'Health insurance portability and accountability act' },
		{ value: 'cis', label: 'CIS Controls', description: 'Center for Internet Security top 18 controls' }
	];

	const assigneeItems: SelectionItem[] = [
		{ value: 'alice@co.io', label: 'Alice Chen', description: 'Security Lead' },
		{ value: 'bob@co.io', label: 'Bob Martins', description: 'Compliance Analyst' },
		{ value: 'carol@co.io', label: 'Carol Kim', description: 'Risk Manager' },
		{ value: 'dave@co.io', label: 'Dave Osei', description: 'Engineering' }
	];
</script>

<svelte:head>
	<title>Modal — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<!-- SelectionModal -->
	<ShowcaseBlock component="SelectionModal">
		<h3 class="component-name">SelectionModal</h3>
		<p class="component-desc">
			Reusable modal for picking one or many items from a list — used by the framework picker,
			assignee manager, and template switcher. Supports single-select, multi-select, and optional
			search filtering.
		</p>
		<div class="blade-ctrl">
			<div class="bc-group">
				<span class="bc-label">SINGLE-SELECT</span>
				<div class="bc-btns">
					<button class="bc-btn" title="Single select" onclick={() => (selSingle = true)}>
						<Icon name="check-circle" size={13} />
					</button>
				</div>
			</div>
			<span class="bc-sep" aria-hidden="true"></span>
			<div class="bc-group">
				<span class="bc-label">MULTI-SELECT</span>
				<div class="bc-btns">
					<button class="bc-btn" title="Multi select" onclick={() => (selMulti = true)}>
						<Icon name="clipboard-check" size={13} />
					</button>
				</div>
			</div>
			<span class="bc-sep" aria-hidden="true"></span>
			<div class="bc-group">
				<span class="bc-label">SEARCHABLE</span>
				<div class="bc-btns">
					<button class="bc-btn" title="Searchable" onclick={() => (selSearchable = true)}>
						<Icon name="search" size={13} />
					</button>
				</div>
			</div>
		</div>
		{#if selSingleResult}
			<p style="margin: 8px 0 0; font-size: 0.8rem; color: var(--accent); font-family: var(--mono);">
				Selected: {selSingleResult}
			</p>
		{/if}
		{#if selMultiResult.length}
			<p style="margin: 8px 0 0; font-size: 0.8rem; color: var(--accent); font-family: var(--mono);">
				Selected: {selMultiResult.join(', ')}
			</p>
		{/if}
	</ShowcaseBlock>

	<!-- Modal -->
	<ShowcaseBlock component="Modal">
		<h3 class="component-name">Modal</h3>
		<p class="component-desc">Focused overlay for confirmations and short forms. <code class="demo-code">variant</code> tints the border to communicate severity (<code class="demo-code">danger</code> for destructive, <code class="demo-code">warn</code> for reversible, <code class="demo-code">success</code> for completion). Set <code class="demo-code">closable={false}</code> to require an explicit action — use sparingly, only for required acknowledgements.</p>
		<div class="blade-ctrl">
			<!-- Variant triggers -->
			<div class="bc-group">
				<span class="bc-label">VARIANT</span>
				<div class="bc-btns">
					<button class="bc-btn" title="Default" onclick={() => (modalDefault = true)}
						><Icon name="circle" size={13} /></button
					>
					<button class="bc-btn bc-danger" title="Danger" onclick={() => (modalDanger = true)}
						><Icon name="x-circle" size={13} /></button
					>
					<button class="bc-btn bc-warn" title="Warn" onclick={() => (modalWarn = true)}
						><Icon name="alert-triangle" size={13} /></button
					>
					<button
						class="bc-btn bc-success"
						title="Success"
						onclick={() => (modalSuccess = true)}
						><Icon name="check-circle-2" size={13} /></button
					>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Size -->
			<div class="bc-group">
				<span class="bc-label">SIZE</span>
				<div class="bc-btns">
					<button class="bc-btn" title="Large (640px)" onclick={() => (modalLg = true)}>
						<Icon name="maximize" size={13} />
					</button>
				</div>
			</div>

			<span class="bc-sep" aria-hidden="true"></span>

			<!-- Behaviour -->
			<div class="bc-group">
				<span class="bc-label">BEHAVIOUR</span>
				<div class="bc-btns">
					<button
						class="bc-btn"
						title="Non-closable (no Esc / × button)"
						onclick={() => (modalNoClose = true)}
					>
						<Icon name="lock" size={13} />
					</button>
				</div>
			</div>
		</div>
	</ShowcaseBlock>
</div>

<!-- SelectionModal instances -->
<SelectionModal
	open={selSingle}
	title="Select framework"
	items={frameworkItems}
	selected={selSingleResult ? [selSingleResult] : []}
	onconfirm={(vals) => { selSingleResult = vals[0] ?? ''; selSingle = false; }}
	onclose={() => (selSingle = false)}
/>

<SelectionModal
	open={selMulti}
	title="Assign reviewers"
	items={assigneeItems}
	selected={selMultiResult}
	multiselect
	onconfirm={(vals) => { selMultiResult = vals; selMulti = false; }}
	onclose={() => (selMulti = false)}
/>

<SelectionModal
	open={selSearchable}
	title="Select frameworks"
	items={frameworkItems}
	selected={[]}
	multiselect
	searchable
	onconfirm={() => (selSearchable = false)}
	onclose={() => (selSearchable = false)}
/>

<!-- Modal instances (rendered outside the block so they portal correctly) -->
<Modal open={modalDefault} title="Default Modal" onclose={() => (modalDefault = false)}>
	<p style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6;">
		This is the default modal variant. It uses the accent color border and can contain any
		content via the children snippet.
	</p>
	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={() => (modalDefault = false)}>Cancel</Button>
		<Button size="sm" onclick={() => (modalDefault = false)}>Confirm</Button>
	{/snippet}
</Modal>

<Modal
	open={modalDanger}
	title="Delete Agent"
	variant="danger"
	onclose={() => (modalDanger = false)}
>
	<p style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6;">
		This action will permanently remove the agent and all associated data. This cannot be
		undone.
	</p>
	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={() => (modalDanger = false)}>Cancel</Button>
		<Button size="sm" onclick={() => (modalDanger = false)}>Delete</Button>
	{/snippet}
</Modal>

<Modal
	open={modalWarn}
	title="Archive Vendor"
	variant="warn"
	onclose={() => (modalWarn = false)}
>
	<p style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6;">
		Archiving this vendor will hide it from active assessments. You can restore it at any time
		from the archive view.
	</p>
	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={() => (modalWarn = false)}>Cancel</Button>
		<Button size="sm" onclick={() => (modalWarn = false)}>Archive</Button>
	{/snippet}
</Modal>

<Modal
	open={modalSuccess}
	title="Invite Sent"
	variant="success"
	onclose={() => (modalSuccess = false)}
>
	<p style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6;">
		An invitation has been sent to the specified email address. They will receive access
		instructions within a few minutes.
	</p>
	{#snippet footer()}
		<Button size="sm" onclick={() => (modalSuccess = false)}>Done</Button>
	{/snippet}
</Modal>

<Modal open={modalNoClose} title="Required Action" closable={false}>
	<p style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6;">
		This modal cannot be dismissed with Escape or the × button. You must take an explicit
		action.
	</p>
	{#snippet footer()}
		<Button size="sm" onclick={() => (modalNoClose = false)}>Acknowledge</Button>
	{/snippet}
</Modal>

<Modal open={modalLg} title="Large Modal" size="lg" onclose={() => (modalLg = false)}>
	<p
		style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6; margin-bottom: 12px;"
	>
		Large modals are useful for forms or content-heavy confirmations. The body scrolls
		independently when content overflows.
	</p>
	<p style="color: var(--fg-dim); font-size: 0.875rem; line-height: 1.6;">
		Max width is 640px. The body area has a max-height of <code
			style="color: var(--accent); background: rgba(94,234,212,0.08); padding: 1px 5px; border-radius: 2px;"
			>calc(90vh - 140px)</code
		> before scrolling kicks in.
	</p>
	{#snippet footer()}
		<Button variant="ghost" size="sm" onclick={() => (modalLg = false)}>Cancel</Button>
		<Button size="sm" onclick={() => (modalLg = false)}>Save Changes</Button>
	{/snippet}
</Modal>

<style>
	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.blade-ctrl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.bc-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bc-label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		color: var(--fg-muted, rgba(156, 163, 175, 0.45));
	}
	.bc-btns {
		display: flex;
		gap: 4px;
	}
	.bc-sep {
		width: 1px;
		height: 44px;
		background: rgba(255, 255, 255, 0.07);
		flex-shrink: 0;
		align-self: center;
	}
	.bc-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.06);
	}
	.bc-btn.bc-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}
	.bc-btn.bc-success {
		color: #34d399;
		border-color: rgba(52, 211, 153, 0.3);
	}
	.bc-btn.bc-success:hover {
		background: rgba(52, 211, 153, 0.1);
		border-color: rgba(52, 211, 153, 0.6);
	}
	.bc-btn.bc-warn {
		color: #fcd34d;
		border-color: rgba(252, 211, 77, 0.3);
	}
	.bc-btn.bc-warn:hover {
		background: rgba(252, 211, 77, 0.1);
		border-color: rgba(252, 211, 77, 0.6);
	}
	.bc-btn.bc-danger {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.3);
	}
	.bc-btn.bc-danger:hover {
		background: rgba(252, 165, 165, 0.1);
		border-color: rgba(252, 165, 165, 0.6);
	}
</style>
