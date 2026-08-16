<script lang="ts">
	// /console/org/agent-clients — Agent Client (OAuth2 credential) management
	//
	// The org's agent clients: the client_id / client_secret pairs a deployed agent
	// uses to authenticate to the control plane. Today the console can only create,
	// list and delete; this surface adds read, rename and secret rotation.
	//
	// The crux of the screen is the ONE-TIME SECRET REVEAL. `client_secret` comes
	// back from exactly two calls (create + rotate) and is never readable again —
	// so the reveal is a modal the operator cannot dismiss by accident, and the
	// only recovery for a lost secret is another rotation (which takes the agent
	// offline a second time). Both flows render the same `oneTimeSecret` snippet.
	//
	// API stubs — app-ui/src/lib/api/agent-clients.ts is the contract:
	//   listAgentClients(orgId)                  GET    …/agent-clients          → AgentClient[]
	//   getAgentClient(orgId, agentId)           GET    …/agent-clients/:id      → AgentClient
	//   createAgentClient(orgId, name)           POST   …/agent-clients          → CreatedAgentClient
	//   renameAgentClient(orgId, agentId, name)  PATCH  …/agent-clients/:id      → AgentClient      (admin)
	//   rotateAgentSecret(orgId, agentId)        POST   …/agent-clients/:id/rotate-secret
	//                                                                            → RotatedAgentSecret (admin)
	//   deleteAgentClient(orgId, agentId)        DELETE …/agent-clients/:id      → 204
	//
	// Every function throws with the server's error string; nothing returns a
	// status flag, so all failures land in the inline error slots below.
	//
	// Data shapes (snake_case, straight off the wire):
	//   AgentClient        { client_id, name }
	//   CreatedAgentClient { client_id, client_secret, name }
	//   RotatedAgentSecret { client_id, client_secret }
	//
	// Deliberately NOT shown: online/offline, last-seen, created-at. The contract
	// returns two fields and nothing else — inventing a status column here would
	// promise data no endpoint serves.

	import Button from '$lib/primitives/Button.svelte';
	import IconButton from '$lib/primitives/IconButton.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import FormField from '$lib/primitives/FormField.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import SectionBar from '$lib/primitives/SectionBar.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import Modal from '$lib/layout/Modal.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';

	type AgentClient = { client_id: string; name: string };
	type Role = 'admin' | 'member';
	type DataMode = 'populated' | 'empty' | 'error';

	const ORG_ID = '9f1c2d84-5b3a-4e17-9c6f-2a70e1d4b8c3';
	const mkId = (agent: string) => `agent:${ORG_ID}:${agent}`;

	// ── Seed data ─────────────────────────────────────────────────────────────

	const SEED: AgentClient[] = [
		{ client_id: mkId('0b7d4f21-9a3c-4d58-b1e6-7c2f80a5d934'), name: 'edge-dnsproxy-lhr1' },
		{ client_id: mkId('3e58c9a0-77b2-4f61-8d0a-15c9be47f2d1'), name: 'supply-chain-scanner' },
		{ client_id: mkId('c41a06f9-2d8e-4b35-a7c2-9f60d3e18b47'), name: 'threat-intel-collector' },
		{ client_id: mkId('7a92be34-1c05-4e88-9b3d-6e04f7a2c150'), name: 'notifier-prod' }
	];

	// ── Demo controls (mockup only — not part of the real surface) ────────────

	let role = $state<Role>('admin');
	let dataMode = $state<DataMode>('populated');
	const isAdmin = $derived(role === 'admin');

	let clients = $state<AgentClient[]>([...SEED]);
	const rows = $derived(dataMode === 'populated' ? clients : []);
	const listError = $derived(
		dataMode === 'error' ? '503: agent client directory unavailable (identity: dial tcp: connection refused)' : ''
	);

	function setDataMode(m: DataMode) {
		dataMode = m;
		expandedId = null;
		if (m === 'populated') clients = [...SEED];
	}

	// ── List state ────────────────────────────────────────────────────────────

	let expandedId = $state<string | null>(null);
	let rowEls = $state<Record<string, HTMLButtonElement | null>>({});
	let copied = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	function toggleRow(id: string) {
		expandedId = expandedId === id ? null : id;
		renamingId = null;
	}

	async function copy(text: string, key: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			/* mockup: clipboard may be blocked in an iframe */
		}
		copied = key;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = null), 1600);
	}

	/** ArrowUp/ArrowDown walk the list without a mouse; Home/End jump the ends. */
	function onListKeydown(e: KeyboardEvent) {
		const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
		if (!keys.includes(e.key)) return;
		const ids = rows.map((r) => r.client_id);
		const active = document.activeElement as HTMLElement | null;
		const cur = ids.findIndex((id) => rowEls[id] === active);
		if (cur === -1) return;
		e.preventDefault();
		const next =
			e.key === 'ArrowDown'
				? Math.min(cur + 1, ids.length - 1)
				: e.key === 'ArrowUp'
					? Math.max(cur - 1, 0)
					: e.key === 'Home'
						? 0
						: ids.length - 1;
		rowEls[ids[next]]?.focus();
	}

	// client_id is `agent:<org-uuid>:<agent-uuid>` — 80+ chars. The list shows the
	// agent segment (the only part that varies within an org); the full string
	// lives in the expanded detail and on the copy button.
	function agentSegment(clientId: string): string {
		const seg = clientId.split(':');
		return seg[2] ?? clientId;
	}
	const shortSeg = (clientId: string) => agentSegment(clientId).slice(0, 8);

	// ── Rename (inline, admin only) ───────────────────────────────────────────

	let renamingId = $state<string | null>(null);
	let renameDraft = $state('');
	let renameBusy = $state(false);
	let renameError = $state('');

	function startRename(c: AgentClient) {
		renamingId = c.client_id;
		renameDraft = c.name;
		renameError = '';
	}
	function cancelRename() {
		renamingId = null;
		renameError = '';
	}
	async function commitRename(c: AgentClient) {
		const name = renameDraft.trim();
		if (!name || name === c.name) return cancelRename();
		renameBusy = true;
		renameError = '';
		await pause(450);
		if (dataMode === 'error') {
			renameError = '403: renaming an agent client requires the admin role';
			renameBusy = false;
			return;
		}
		clients = clients.map((x) => (x.client_id === c.client_id ? { ...x, name } : x));
		renameBusy = false;
		renamingId = null;
	}
	function onRenameKeydown(e: KeyboardEvent, c: AgentClient) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitRename(c);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			cancelRename();
		}
	}

	// ── Create ────────────────────────────────────────────────────────────────

	let createOpen = $state(false);
	let createName = $state('');
	let createBusy = $state(false);
	let createError = $state('');

	function openCreate() {
		createOpen = true;
		createName = '';
		createError = '';
	}
	async function submitCreate() {
		const name = createName.trim();
		if (!name) return;
		createBusy = true;
		createError = '';
		await pause(600);
		if (dataMode === 'error') {
			createError = '409: an agent client named "' + name + '" already exists in this org';
			createBusy = false;
			return;
		}
		const created = {
			client_id: mkId(fakeUuid()),
			client_secret: fakeSecret(),
			name
		};
		clients = [...clients, { client_id: created.client_id, name: created.name }];
		createBusy = false;
		createOpen = false;
		openReveal('create', created.client_id, created.client_secret, created.name);
	}

	// ── Rotate secret (two-step: consequence → one-time reveal) ───────────────

	let rotateTarget = $state<AgentClient | null>(null);
	let rotateTyped = $state('');
	let rotateBusy = $state(false);
	let rotateError = $state('');
	const rotateArmed = $derived(!!rotateTarget && rotateTyped.trim() === rotateTarget.name);

	function openRotate(c: AgentClient) {
		rotateTarget = c;
		rotateTyped = '';
		rotateError = '';
	}
	async function submitRotate() {
		if (!rotateTarget || !rotateArmed) return;
		rotateBusy = true;
		rotateError = '';
		await pause(700);
		if (dataMode === 'error') {
			rotateError = '403: rotating an agent secret requires the admin role';
			rotateBusy = false;
			return;
		}
		const target = rotateTarget;
		rotateBusy = false;
		rotateTarget = null;
		openReveal('rotate', target.client_id, fakeSecret(), target.name);
	}

	// ── Delete / revoke ───────────────────────────────────────────────────────

	let deleteTarget = $state<AgentClient | null>(null);
	let deleteTyped = $state('');
	let deleteBusy = $state(false);
	let deleteError = $state('');
	const deleteArmed = $derived(!!deleteTarget && deleteTyped.trim() === deleteTarget.name);

	function openDelete(c: AgentClient) {
		deleteTarget = c;
		deleteTyped = '';
		deleteError = '';
	}
	async function submitDelete() {
		if (!deleteTarget || !deleteArmed) return;
		deleteBusy = true;
		deleteError = '';
		await pause(500);
		if (dataMode === 'error') {
			deleteError = '403: revoking an agent client requires the admin role';
			deleteBusy = false;
			return;
		}
		clients = clients.filter((x) => x.client_id !== deleteTarget!.client_id);
		if (expandedId === deleteTarget.client_id) expandedId = null;
		deleteBusy = false;
		deleteTarget = null;
	}

	// ── One-time secret reveal (shared by create + rotate) ────────────────────

	type Reveal = {
		origin: 'create' | 'rotate';
		client_id: string;
		client_secret: string;
		name: string;
	};

	let reveal = $state<Reveal | null>(null);
	let ack = $state(false);
	let secretHidden = $state(false);
	// Set when the operator tries to Escape out of the reveal before acknowledging.
	let dismissBlocked = $state(false);

	function openReveal(origin: Reveal['origin'], client_id: string, client_secret: string, name: string) {
		reveal = { origin, client_id, client_secret, name };
		ack = false;
		secretHidden = false;
		dismissBlocked = false;
	}

	// The reveal is the only moment this string exists in readable form, so a
	// stray Escape must not throw it away. Re-assert `open` and say why.
	function blockRevealDismiss() {
		if (!reveal) return;
		dismissBlocked = true;
		const held = reveal;
		reveal = null;
		queueMicrotask(() => (reveal = held));
	}

	function closeReveal() {
		if (!ack) return;
		reveal = null;
	}

	const credentialsYaml = (r: Reveal) =>
		['auth:', `  client_id: ${r.client_id}`, `  client_secret: ${r.client_secret}`].join('\n');

	// ── Helpers ───────────────────────────────────────────────────────────────

	const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const hex = (n: number) =>
		Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
	const fakeUuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
	const fakeSecret = () => `as_${hex(8)}${hex(8)}${hex(8)}${hex(8)}`;

	const FOCUS =
		'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] focus:outline-none';
</script>

<!-- ══ One-time secret reveal ═════════════════════════════════════════════════
     Rendered identically after create and after rotate. Nothing in here implies
     the value can be fetched again, because it cannot. -->
{#snippet oneTimeSecret(r: Reveal)}
	<div class="space-y-4">
		<div
			class="border border-amber-400/40 bg-amber-400/[0.05] rounded-sm px-3.5 py-3 flex gap-3 items-start"
		>
			<div class="text-amber-300 mt-px shrink-0"><Icon name="key" size={16} /></div>
			<div class="space-y-1.5">
				<p class="text-[12px] text-amber-200/95 leading-snug">
					This is the only time this secret is readable. It is stored hashed — no page, no API
					call and no support request can show it again.
				</p>
				<p class="text-[11px] text-[var(--fg-dim)] leading-snug">
					Copy it into the agent's config now. If it is lost, the only way forward is another
					rotation — which takes <span class="text-[var(--fg)]">{r.name}</span> offline a second time.
				</p>
			</div>
		</div>

		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="text-[10px] text-[var(--fg-dim)] uppercase tracking-widest w-24 shrink-0"
					>client_id</span
				>
				<code
					class="flex-1 min-w-0 truncate font-mono text-[11px] text-[var(--fg)] bg-black/25 border border-[var(--border)] rounded-sm px-2 py-1.5"
					>{r.client_id}</code
				>
				<IconButton
					icon={copied === 'r-id' ? 'check' : 'copy'}
					size="sm"
					label="Copy client_id"
					onclick={() => copy(r.client_id, 'r-id')}
				/>
			</div>

			<div class="flex items-center gap-2">
				<span class="text-[10px] text-amber-300/90 uppercase tracking-widest w-24 shrink-0"
					>client_secret</span
				>
				<code
					class="flex-1 min-w-0 truncate font-mono text-[11px] text-amber-200 bg-black/25 border border-amber-400/30 rounded-sm px-2 py-1.5 select-all"
					>{secretHidden ? '•'.repeat(r.client_secret.length) : r.client_secret}</code
				>
				<IconButton
					icon={secretHidden ? 'eye' : 'eye-off'}
					size="sm"
					label={secretHidden ? 'Show secret' : 'Hide secret (shoulder-surfing)'}
					onclick={() => (secretHidden = !secretHidden)}
				/>
				<IconButton
					icon={copied === 'r-secret' ? 'check' : 'copy'}
					size="sm"
					variant="primary"
					label="Copy client_secret"
					onclick={() => copy(r.client_secret, 'r-secret')}
				/>
			</div>
		</div>

		<div>
			<SectionBar label="Paste into agent.yaml" />
			<div class="mt-2 flex items-start gap-2">
				<pre
					class="flex-1 min-w-0 overflow-x-auto font-mono text-[10.5px] leading-relaxed text-[var(--fg-dim)] bg-black/25 border border-[var(--border)] rounded-sm px-2.5 py-2">{secretHidden
						? credentialsYaml({ ...r, client_secret: '•'.repeat(20) })
						: credentialsYaml(r)}</pre>
				<Button
					variant="ghost"
					size="sm"
					class={FOCUS}
					onclick={() => copy(credentialsYaml(r), 'r-yaml')}
				>
					{copied === 'r-yaml' ? 'COPIED' : 'COPY BLOCK'}
				</Button>
			</div>
		</div>

		{#if r.origin === 'rotate'}
			<p class="text-[11px] text-[var(--fg-dim)] leading-snug border-l-2 border-rose-400/40 pl-3">
				The previous secret stopped authenticating the moment this one was issued.
				<span class="text-[var(--fg)]">{r.name}</span> is offline until this secret is installed and the
				agent restarts.
			</p>
		{/if}

		<label
			class="flex items-start gap-2.5 cursor-pointer border-t border-[var(--border)] pt-3.5 {dismissBlocked &&
			!ack
				? 'text-amber-200'
				: 'text-[var(--fg)]'}"
		>
			<input
				type="checkbox"
				class="mt-0.5 accent-teal-300 {FOCUS}"
				bind:checked={ack}
				aria-describedby="ack-help"
			/>
			<span class="text-[12px] leading-snug">
				I have stored this secret somewhere safe. I understand it cannot be shown again.
			</span>
		</label>
		{#if dismissBlocked && !ack}
			<p id="ack-help" class="text-[11px] text-amber-300 -mt-2 pl-6" role="alert">
				This window will not close until you acknowledge — closing it discards the secret for good.
			</p>
		{:else}
			<p id="ack-help" class="sr-only">Required before this window can be closed.</p>
		{/if}
	</div>
{/snippet}

<div class="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
	<LayoutHeader
		eyebrow="// agent clients"
		sub="oauth2 client credentials · org {ORG_ID.slice(0, 8)}"
	>
		{#snippet icon()}<Icon name="key" size={18} />{/snippet}
		{#snippet title()}Agent Clients{/snippet}
		{#snippet meta()}
			<span class="font-mono text-[11px] text-[var(--fg-dim)]">
				{rows.length}
				{rows.length === 1 ? 'client' : 'clients'}
			</span>
		{/snippet}
		{#snippet lede()}
			Every deployed agent authenticates to the control plane with its own
			<code class="text-[var(--accent)]">client_id</code> /
			<code class="text-[var(--accent)]">client_secret</code>. Secrets are stored hashed and are
			readable exactly once — at issue.
		{/snippet}
		{#snippet actions()}
			<Button variant="primary" size="sm" class={FOCUS} onclick={openCreate}>
				<Icon name="plus" size={12} /> NEW AGENT CLIENT
			</Button>
		{/snippet}
	</LayoutHeader>

	<div class="max-w-[1100px] mx-auto px-6 pb-24 space-y-5">
		<!-- ── Demo controls (mockup scaffolding, not the shipped surface) ──── -->
		<div
			class="flex flex-wrap items-center gap-x-6 gap-y-2 border border-dashed border-[var(--border)] rounded-sm px-3 py-2"
		>
			<span class="text-[9px] uppercase tracking-widest text-[var(--fg-muted)]">mockup state</span>
			<div class="flex items-center gap-1.5">
				<span class="text-[10px] text-[var(--fg-dim)]">caller</span>
				{#each ['admin', 'member'] as r (r)}
					<Button
						shape="pill"
						size="xs"
						tone="accent"
						class={FOCUS}
						pressed={role === r}
						onclick={() => (role = r as Role)}>{r}</Button
					>
				{/each}
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-[10px] text-[var(--fg-dim)]">data</span>
				{#each ['populated', 'empty', 'error'] as m (m)}
					<Button
						shape="pill"
						size="xs"
						tone={m === 'error' ? 'danger' : 'accent'}
						class={FOCUS}
						pressed={dataMode === m}
						onclick={() => setDataMode(m as DataMode)}>{m}</Button
					>
				{/each}
			</div>
		</div>

		<!-- ── Caller cannot mutate: say so once, up top ────────────────────── -->
		{#if !isAdmin}
			<div
				class="flex items-center gap-2.5 border border-[var(--border)] bg-white/[0.02] rounded-sm px-3 py-2"
			>
				<span class="text-[var(--fg-dim)]"><Icon name="lock" size={13} /></span>
				<p class="text-[11.5px] text-[var(--fg-dim)]">
					You have the <span class="text-[var(--fg)]">member</span> role. Agent clients are visible
					to you, but renaming, rotating and revoking need an org admin — those actions are shown
					disabled rather than hidden, so you know they exist and what to ask for.
				</p>
			</div>
		{/if}

		<!-- ── Error state ──────────────────────────────────────────────────── -->
		{#if listError}
			<div
				class="border border-rose-400/40 bg-rose-400/[0.05] rounded-sm px-3.5 py-3 flex items-start gap-3"
			>
				<span class="text-rose-300 mt-px shrink-0"><Icon name="alert-triangle" size={15} /></span>
				<div class="flex-1 min-w-0">
					<p class="text-[12px] text-rose-200">Could not load agent clients.</p>
					<p class="font-mono text-[11px] text-[var(--fg-dim)] mt-1 break-all">{listError}</p>
				</div>
				<Button variant="ghost" size="sm" class={FOCUS} onclick={() => setDataMode('populated')}>
					<Icon name="refresh-cw" size={12} /> RETRY
				</Button>
			</div>
		{/if}

		<!-- ── Empty state ──────────────────────────────────────────────────── -->
		{#if dataMode === 'empty'}
			<div class="border border-[var(--border)] rounded-sm">
				<EmptyState
					variant="card"
					message="No agent clients yet"
					sub="Every agent you deploy needs its own credential pair. Create one, install the secret on the agent, and it will appear in the mesh."
				>
					{#snippet icon()}<span class="text-[var(--fg-dim)]"><Icon name="key" size={22} /></span
						>{/snippet}
				</EmptyState>
				<div class="flex justify-center pb-6">
					<Button variant="primary" size="sm" class={FOCUS} onclick={openCreate}>
						<Icon name="plus" size={12} /> CREATE THE FIRST ONE
					</Button>
				</div>
			</div>
		{/if}

		<!-- ── List ─────────────────────────────────────────────────────────── -->
		{#if rows.length > 0}
			<div class="flex items-center justify-between">
				<SectionBar label="Provisioned clients" />
			</div>

			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<ul
				class="border border-[var(--border)] rounded-sm divide-y divide-[var(--border)] overflow-hidden"
				onkeydown={onListKeydown}
			>
				{#each rows as c (c.client_id)}
					{@const open = expandedId === c.client_id}
					<li class="bg-white/[0.015]">
						<!-- Row header: the expander is its own button so the trailing
						     controls stay independently focusable (no nested buttons). -->
						<div class="flex items-center gap-2 px-3 py-2.5">
							<button
								bind:this={rowEls[c.client_id]}
								type="button"
								class="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-sm {FOCUS}"
								aria-expanded={open}
								aria-controls="detail-{c.client_id}"
								onclick={() => toggleRow(c.client_id)}
							>
								<span class="text-[var(--fg-dim)] shrink-0">
									<Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
								</span>
								<span class="text-[13px] text-[var(--fg)] truncate max-w-[280px]">{c.name}</span>
								<code
									class="font-mono text-[10.5px] text-[var(--fg-muted)] truncate hidden sm:inline"
									title={c.client_id}
								>
									agent:…:{shortSeg(c.client_id)}…
								</code>
							</button>

							<IconButton
								icon={copied === c.client_id ? 'check' : 'copy'}
								size="sm"
								label="Copy full client_id for {c.name}"
								onclick={() => copy(c.client_id, c.client_id)}
							/>
						</div>

						<!-- Detail / expansion -->
						{#if open}
							<div
								id="detail-{c.client_id}"
								class="px-3 pb-3.5 pt-1 border-t border-[var(--border)] bg-black/15 space-y-3.5"
							>
								<div>
									<div class="text-[9px] uppercase tracking-widest text-[var(--fg-dim)] mb-1.5">
										client_id
									</div>
									<div class="flex items-center gap-2">
										<code
											class="flex-1 min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-[var(--fg)] bg-black/30 border border-[var(--border)] rounded-sm px-2 py-1.5 select-all"
											>{c.client_id}</code
										>
										<IconButton
											icon={copied === 'd-' + c.client_id ? 'check' : 'copy'}
											size="sm"
											label="Copy client_id"
											onclick={() => copy(c.client_id, 'd-' + c.client_id)}
										/>
									</div>
									<p class="text-[10px] text-[var(--fg-muted)] mt-1.5">
										<span class="text-[var(--fg-dim)]">agent</span> :
										<span class="text-[var(--fg-dim)]">org</span>
										{ORG_ID.slice(0, 8)}… :
										<span class="text-[var(--fg-dim)]">agent</span>
										{agentSegment(c.client_id)}
									</p>
								</div>

								<div>
									<div class="text-[9px] uppercase tracking-widest text-[var(--fg-dim)] mb-1.5">
										client_secret
									</div>
									<div
										class="flex items-center gap-2 text-[11px] text-[var(--fg-muted)] bg-black/20 border border-dashed border-[var(--border)] rounded-sm px-2.5 py-2"
									>
										<Icon name="lock" size={12} />
										<span>Stored hashed. Not retrievable — rotation issues a new one.</span>
									</div>
								</div>

								<!-- Rename (inline; the only mutable field) -->
								<div>
									<div class="text-[9px] uppercase tracking-widest text-[var(--fg-dim)] mb-1.5">
										name
									</div>
									{#if renamingId === c.client_id}
										<div class="flex items-center gap-2">
											<!-- svelte-ignore a11y_autofocus -->
											<input
												autofocus
												class="flex-1 min-w-0 bg-[var(--bg)] border border-teal-300/40 text-[var(--fg)] font-mono text-[12px] px-2 py-1.5 rounded-sm {FOCUS}"
												bind:value={renameDraft}
												aria-label="New name for {c.name}"
												onkeydown={(e) => onRenameKeydown(e, c)}
											/>
											<Button
												variant="primary"
												size="sm"
												class={FOCUS}
												loading={renameBusy}
												disabled={renameBusy || !renameDraft.trim()}
												onclick={() => commitRename(c)}>SAVE</Button
											>
											<Button variant="ghost" size="sm" class={FOCUS} onclick={cancelRename}
												>CANCEL</Button
											>
										</div>
										<p class="text-[10px] text-[var(--fg-muted)] mt-1.5">
											Enter saves · Escape cancels. Renaming is cosmetic — the client_id and secret
											are untouched, and the agent keeps running.
										</p>
										{#if renameError}
											<p class="text-[11px] text-rose-300 mt-1.5 font-mono" role="alert">
												{renameError}
											</p>
										{/if}
									{:else}
										<div class="flex items-center gap-2">
											<span class="text-[12.5px] text-[var(--fg)] flex-1 truncate">{c.name}</span>
											<Button
												variant="ghost"
												size="sm"
												class={FOCUS}
												disabled={!isAdmin}
												onclick={() => startRename(c)}
											>
												<Icon name={isAdmin ? 'pencil' : 'lock'} size={11} /> RENAME
											</Button>
										</div>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border)]">
									<div class="pt-3 flex flex-wrap items-center gap-2 w-full">
										<Button
											variant="ghost"
											size="sm"
											class={FOCUS}
											disabled={!isAdmin}
											onclick={() => openRotate(c)}
										>
											<Icon name={isAdmin ? 'refresh-cw' : 'lock'} size={11} /> ROTATE SECRET
										</Button>
										<Button
											variant="ghost-danger"
											size="sm"
											class={FOCUS}
											disabled={!isAdmin}
											onclick={() => openDelete(c)}
										>
											<Icon name={isAdmin ? 'trash-2' : 'lock'} size={11} /> REVOKE
										</Button>
										{#if !isAdmin}
											<span class="text-[10.5px] text-[var(--fg-muted)] ml-1">
												Requires the admin role — the server returns 403 for a member.
											</span>
										{/if}
									</div>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="flex items-center gap-4 text-[10px] text-[var(--fg-muted)] font-mono">
				<span>↑ ↓ move</span>
				<span>Enter expand</span>
				<span>Tab reaches every action</span>
				<span>Esc closes dialogs</span>
			</div>
		{/if}
	</div>

	<!-- Copy confirmations announced for screen readers -->
	<div class="sr-only" role="status" aria-live="polite">
		{copied ? 'Copied to clipboard' : ''}
	</div>
</div>

<!-- ══ Create ════════════════════════════════════════════════════════════════ -->
<Modal
	open={createOpen}
	title="New agent client"
	size="md"
	onclose={() => (createOpen = false)}
>
	<div class="space-y-3">
		<FormField
			label="Name"
			id="new-agent-name"
			required
			hint="How this credential is identified in the console. Can be renamed later; the client_id cannot."
		>
			<Input
				id="new-agent-name"
				bind:value={createName}
				placeholder="edge-dnsproxy-lhr1"
				onkeydown={(e) => e.key === 'Enter' && submitCreate()}
			/>
		</FormField>
		<p class="text-[11px] text-[var(--fg-dim)] leading-snug">
			Creating issues a client_secret that is shown once, on the next screen.
		</p>
		{#if createError}
			<p class="text-[11px] text-rose-300 font-mono" role="alert">{createError}</p>
		{/if}
	</div>
	{#snippet footer()}
		<Button variant="ghost" size="sm" class={FOCUS} onclick={() => (createOpen = false)}
			>CANCEL</Button
		>
		<Button
			variant="primary"
			size="sm"
			class={FOCUS}
			loading={createBusy}
			disabled={createBusy || !createName.trim()}
			onclick={submitCreate}>CREATE + ISSUE SECRET</Button
		>
	{/snippet}
</Modal>

<!-- ══ Rotate — step 1 of 2: the consequence ═════════════════════════════════ -->
<Modal
	open={!!rotateTarget}
	title="Rotate client secret"
	variant="danger"
	size="md"
	onclose={() => (rotateTarget = null)}
>
	{#if rotateTarget}
		<div class="space-y-4">
			<div class="flex items-center gap-2">
				<Chip color="error">{rotateTarget.name}</Chip>
				<code class="font-mono text-[10.5px] text-[var(--fg-muted)] truncate"
					>agent:…:{shortSeg(rotateTarget.client_id)}…</code
				>
			</div>

			<p class="text-[13px] text-[var(--fg)] leading-snug">
				Rotating takes this agent offline. There is no overlap window.
			</p>

			<ul class="space-y-2.5">
				{#each [{ icon: 'zap', text: 'The new secret is live the instant you confirm — not on a schedule, not after a grace period.' }, { icon: 'x', text: 'The current secret stops authenticating at that same instant. Nothing is issued twice; the old and new never both work.' }, { icon: 'power', text: `${rotateTarget.name} stays offline — no heartbeat, no config pushes, no telemetry — until the new secret is installed on it and it restarts.` }, { icon: 'eye-off', text: 'The new secret is readable exactly once, on the next screen. Lose it and your only recourse is rotating again, which repeats this outage.' }] as line (line.text)}
					<li class="flex items-start gap-2.5">
						<span class="text-rose-300 mt-px shrink-0"
							><Icon name={line.icon as 'zap'} size={13} /></span
						>
						<span class="text-[11.5px] text-[var(--fg-dim)] leading-snug">{line.text}</span>
					</li>
				{/each}
			</ul>

			<div class="border-t border-[var(--border)] pt-3.5">
				<FormField
					label="Type {rotateTarget.name} to confirm"
					id="rotate-confirm"
					hint="Deliberate friction — this is not a reversible click."
				>
					<Input
						id="rotate-confirm"
						bind:value={rotateTyped}
						placeholder={rotateTarget.name}
						status={rotateTyped && !rotateArmed ? 'warn' : 'default'}
						onkeydown={(e) => e.key === 'Enter' && rotateArmed && submitRotate()}
					/>
				</FormField>
			</div>

			{#if rotateError}
				<p class="text-[11px] text-rose-300 font-mono" role="alert">{rotateError}</p>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" size="sm" class={FOCUS} onclick={() => (rotateTarget = null)}
			>CANCEL</Button
		>
		<Button
			variant="danger"
			size="sm"
			class={FOCUS}
			loading={rotateBusy}
			disabled={!rotateArmed || rotateBusy}
			onclick={submitRotate}>ROTATE NOW — TAKES AGENT OFFLINE</Button
		>
	{/snippet}
</Modal>

<!-- ══ Rotate step 2 / Create step 2: the one-time reveal ════════════════════
     Not closable: no ×, and Escape is caught and refused until acknowledged. -->
<Modal
	open={!!reveal}
	title={reveal?.origin === 'rotate' ? 'New secret — copy it now' : 'Agent client created — copy the secret now'}
	variant="warn"
	size="lg"
	closable={false}
	onclose={blockRevealDismiss}
>
	{#if reveal}
		{@render oneTimeSecret(reveal)}
	{/if}
	{#snippet footer()}
		<span class="text-[10.5px] text-[var(--fg-muted)] mr-auto">
			{copied?.startsWith('r-') ? 'Copied to clipboard.' : 'Nothing here can be recovered later.'}
		</span>
		<Button
			variant="primary"
			size="sm"
			class={FOCUS}
			disabled={!ack}
			onclick={closeReveal}
		>
			DONE — SECRET STORED
		</Button>
	{/snippet}
</Modal>

<!-- ══ Delete / revoke ═══════════════════════════════════════════════════════ -->
<Modal
	open={!!deleteTarget}
	title="Revoke agent client"
	variant="danger"
	size="md"
	onclose={() => (deleteTarget = null)}
>
	{#if deleteTarget}
		<div class="space-y-4">
			<div class="flex items-center gap-2">
				<Chip color="error">{deleteTarget.name}</Chip>
				<code class="font-mono text-[10.5px] text-[var(--fg-muted)] truncate"
					>agent:…:{shortSeg(deleteTarget.client_id)}…</code
				>
			</div>
			<p class="text-[13px] text-[var(--fg)] leading-snug">
				Revoking is permanent. This client_id can never authenticate again.
			</p>
			<ul class="space-y-2.5">
				{#each [{ icon: 'power', text: 'Any agent running under this credential drops off the control plane immediately.' }, { icon: 'x', text: 'The client_id is not reissued. Bringing the agent back means creating a new client and reconfiguring it.' }] as line (line.text)}
					<li class="flex items-start gap-2.5">
						<span class="text-rose-300 mt-px shrink-0"
							><Icon name={line.icon as 'power'} size={13} /></span
						>
						<span class="text-[11.5px] text-[var(--fg-dim)] leading-snug">{line.text}</span>
					</li>
				{/each}
			</ul>
			<div class="border-t border-[var(--border)] pt-3.5">
				<FormField label="Type {deleteTarget.name} to confirm" id="delete-confirm">
					<Input
						id="delete-confirm"
						bind:value={deleteTyped}
						placeholder={deleteTarget.name}
						status={deleteTyped && !deleteArmed ? 'warn' : 'default'}
						onkeydown={(e) => e.key === 'Enter' && deleteArmed && submitDelete()}
					/>
				</FormField>
			</div>
			{#if deleteError}
				<p class="text-[11px] text-rose-300 font-mono" role="alert">{deleteError}</p>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<Button variant="ghost" size="sm" class={FOCUS} onclick={() => (deleteTarget = null)}
			>CANCEL</Button
		>
		<Button
			variant="danger"
			size="sm"
			class={FOCUS}
			loading={deleteBusy}
			disabled={!deleteArmed || deleteBusy}
			onclick={submitDelete}>REVOKE PERMANENTLY</Button
		>
	{/snippet}
</Modal>
