<script lang="ts">
	// /settings/identity — IDP connector management
	//
	// Admin-only. List, add, edit, delete connectors.
	// "Add connector" opens a right drawer with a 2-step flow:
	//   Step 1: connector type picker
	//   Step 2: type-specific form
	//
	// API stubs:
	//   GET /api/admin/orgs/:id/connectors → Connector[]
	//   POST /api/admin/orgs/:id/connectors → Connector
	//   PUT /api/admin/orgs/:id/connectors/:cid → Connector
	//   DELETE /api/admin/orgs/:id/connectors/:cid → 204
	//   POST /api/admin/orgs/:id/connectors/:cid/test → { ok, error? }

	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import FormField from '$lib/primitives/FormField.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Textarea from '$lib/primitives/Textarea.svelte';
	import Modal from '$lib/layout/Modal.svelte';
	import Tabs from '$lib/layout/Tabs.svelte';
	import type { Tab } from '$lib/layout/Tabs.svelte';
	import type { ChipColor } from '$lib/primitives/Chip.svelte';
	import ChipInput from '$lib/primitives/ChipInput.svelte';
	import FileUpload from '$lib/primitives/FileUpload.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';

	type ConnectorType = 'oidc' | 'saml' | 'ldap' | 'microsoft' | 'github';
	type ConnectorStatus = 'active' | 'error';

	type Connector = {
		id: string;
		type: ConnectorType;
		name: string;
		status: ConnectorStatus;
		created_at: string;
	};

	// ── Mock data ─────────────────────────────────────────────────────────────

	let connectors = $state<Connector[]>([
		{ id: 'c1', type: 'github', name: 'GitHub SSO', status: 'active', created_at: '2026-01-14' },
		{ id: 'c2', type: 'oidc', name: 'Okta OIDC', status: 'error', created_at: '2026-03-02' }
	]);

	// ── UI state ──────────────────────────────────────────────────────────────

	let activeTab = $state('connectors');
	let drawerOpen = $state(false);
	let drawerStep = $state<1 | 2>(1);
	let selectedType = $state<ConnectorType | null>(null);
	let editingConnector = $state<Connector | null>(null);

	// Forms
	let oidcIssuer = $state('');
	let oidcClientId = $state('');
	let oidcClientSecret = $state('');
	let oidcScopes = $state<string[]>(['openid', 'email', 'profile']);
	let samlSsoUrl = $state('');
	let samlCaCert = $state('');
	let samlCaCertFilename = $state('');
	let samlSpKey = $state('');
	let samlSpKeyFilename = $state('');
	let ldapHost = $state('');
	let ldapBindDn = $state('');
	let ldapBindPw = $state('');
	let ldapUserBase = $state('');
	let ldapUserFilter = $state('(objectClass=person)');
	let ldapAttrUid = $state('uid');
	let ldapAttrEmail = $state('mail');
	let ldapAttrName = $state('cn');
	let entraClientId = $state('');
	let entraClientSecret = $state('');
	let entraTenant = $state('common');
	let entraGroupAllowlist = $state<string[]>([]);
	let ghClientId = $state('');
	let ghClientSecret = $state('');
	let ghOrgAllowlist = $state<string[]>([]);

	// Secret reveal state
	let oidcSecretReplace = $state(false);
	let entraSecretReplace = $state(false);
	let ghSecretReplace = $state(false);

	// Test connection
	let testLoading = $state(false);
	let testResult = $state<null | { ok: boolean; message: string }>(null);

	// Delete confirm
	let showDeleteModal = $state(false);
	let deletingConnector = $state<Connector | null>(null);

	// Toast
	let toast = $state('');

	// ── Tabs ──────────────────────────────────────────────────────────────────

	const TABS: Tab[] = [
		{ id: 'connectors', label: 'Connectors' },
		{ id: 'group-mappings', label: 'Group Mappings' }
	];

	// ── Connector type defs ───────────────────────────────────────────────────

	const TYPE_META: Record<ConnectorType, { label: string; desc: string; icon: string }> = {
		oidc: { label: 'OIDC', desc: 'Any standards-compliant provider', icon: '⬡' },
		saml: { label: 'SAML 2.0', desc: 'Enterprise SAML', icon: '🔑' },
		ldap: { label: 'LDAP / Active Directory', desc: 'On-premise directory', icon: '🗂' },
		microsoft: { label: 'Microsoft Entra ID', desc: 'Azure AD / Entra', icon: '⊞' },
		github: { label: 'GitHub', desc: 'GitHub OAuth App', icon: '' }
	};

	const STATUS_CHIP: Record<ConnectorStatus, ChipColor> = {
		active: 'success',
		error: 'error'
	};

	// ── Actions ───────────────────────────────────────────────────────────────

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2800);
	}

	function openAdd() {
		editingConnector = null;
		selectedType = null;
		drawerStep = 1;
		drawerOpen = true;
		testResult = null;
	}

	function openEdit(c: Connector) {
		editingConnector = c;
		selectedType = c.type;
		drawerStep = 2;
		drawerOpen = true;
		testResult = null;
		// Pre-fill with dummy values for edit mode
		if (c.type === 'github') { ghClientId = 'Iv1.abc123'; ghClientSecret = ''; ghSecretReplace = false; }
		if (c.type === 'oidc') { oidcIssuer = 'https://acme.okta.com'; oidcClientId = 'acme-client'; oidcClientSecret = ''; oidcSecretReplace = false; }
	}

	function confirmDelete(c: Connector) {
		deletingConnector = c;
		showDeleteModal = true;
	}

	async function doDelete() {
		if (!deletingConnector) return;
		await new Promise((r) => setTimeout(r, 600));
		connectors = connectors.filter((c) => c.id !== deletingConnector!.id);
		showDeleteModal = false;
		showToast(`${deletingConnector.name} deleted`);
		deletingConnector = null;
	}

	function selectType(t: ConnectorType) {
		selectedType = t;
		drawerStep = 2;
		testResult = null;
	}

	async function testConnection() {
		testLoading = true;
		testResult = null;
		await new Promise((r) => setTimeout(r, 1200));
		testLoading = false;
		// Alternate success/error for mockup
		const ok = Math.random() > 0.4;
		testResult = ok
			? { ok: true, message: 'Connected successfully' }
			: { ok: false, message: 'Could not reach issuer: connection timeout' };
	}

	async function saveConnector() {
		if (!selectedType) return;
		await new Promise((r) => setTimeout(r, 800));
		if (editingConnector) {
			connectors = connectors.map((c) =>
				c.id === editingConnector!.id ? { ...c, name: TYPE_META[selectedType!].label + ' (updated)' } : c
			);
			showToast('Connector updated');
		} else {
			const newConn: Connector = {
				id: `c${Date.now()}`,
				type: selectedType,
				name: TYPE_META[selectedType].label,
				status: 'active',
				created_at: new Date().toISOString().slice(0, 10)
			};
			connectors = [...connectors, newConn];
			showToast('Connector added');
		}
		drawerOpen = false;
	}
</script>

<svelte:head><title>Identity Providers — Armornet</title></svelte:head>

{#if toast}
	<div class="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[var(--bg-elev)] border border-[var(--accent)] rounded-lg text-[0.78rem] font-mono text-[var(--fg)] shadow-[var(--shadow-card)] flex items-center gap-2">
		<span class="text-[var(--accent)]">✓</span>{toast}
	</div>
{/if}

<LayoutHeader eyebrow="// settings · identity">
	{#snippet title()}Identity <span class="text-[var(--accent)]">providers.</span>{/snippet}
	{#snippet lede()}Configure how users authenticate with your Armornet workspace.{/snippet}
	{#snippet actions()}
		<Button variant="primary" size="sm" onclick={openAdd}>+ Add connector</Button>
	{/snippet}
</LayoutHeader>

<div class="mb-4">
	<Tabs tabs={TABS} bind:active={activeTab} />
</div>

{#if activeTab === 'connectors'}
	{#if connectors.length === 0}
		<div class="flex flex-col items-center gap-4 py-16 text-center border border-[var(--border)] rounded-lg bg-[var(--bg-elev)]">
			<p class="text-[0.85rem] text-[var(--fg-muted)] font-medium">No connectors configured</p>
			<p class="text-[0.72rem] text-[var(--fg-dim)]">Add one to enable SSO for your workspace.</p>
			<Button variant="ghost" size="sm" onclick={openAdd}>+ Add connector</Button>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each connectors as conn}
				<div class="flex items-center gap-4 px-5 py-4 border border-[var(--border)] rounded-lg bg-[var(--bg-elev)]">
					<span class="text-xl w-8 text-center shrink-0" aria-hidden="true">{TYPE_META[conn.type].icon}</span>
					<div class="flex-1 min-w-0">
						<div class="text-[0.82rem] font-semibold text-[var(--fg)]">{conn.name}</div>
						<div class="flex items-center gap-2 mt-[3px]">
							<span class="font-mono text-[0.62rem] uppercase tracking-wider text-[var(--fg-dim)]">{TYPE_META[conn.type].label}</span>
							<span class="text-[var(--fg-dim)] text-[0.62rem]">·</span>
							<span class="font-mono text-[0.62rem] text-[var(--fg-dim)]">Added {conn.created_at}</span>
						</div>
					</div>
					<Chip look="filled" color={STATUS_CHIP[conn.status]}>{conn.status}</Chip>
					<div class="flex items-center gap-2 shrink-0">
						<button
							class="px-3 py-1 text-[0.65rem] font-mono uppercase tracking-wider border border-[var(--border)] rounded-[4px] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-[border-color,color] duration-150 cursor-pointer bg-transparent"
							onclick={() => openEdit(conn)}
						>
							Edit
						</button>
						<button
							class="px-3 py-1 text-[0.65rem] font-mono uppercase tracking-wider border border-[rgba(252,165,165,0.3)] rounded-[4px] text-[var(--palette-red)] hover:border-[rgba(252,165,165,0.7)] transition-[border-color] duration-150 cursor-pointer bg-transparent"
							onclick={() => confirmDelete(conn)}
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

{:else}
	<div class="flex flex-col items-center gap-3 py-16 border border-dashed border-[var(--border)] rounded-lg text-center">
		<p class="text-[0.8rem] font-medium text-[var(--fg-muted)]">Group Mappings</p>
		<p class="text-[0.7rem] text-[var(--fg-dim)]">Map IdP groups to Armornet roles. Coming soon.</p>
	</div>
{/if}

<!-- Right drawer overlay -->
{#if drawerOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-[99]"
		onclick={() => (drawerOpen = false)}
		aria-hidden="true"
	></div>

	<!-- Drawer panel -->
	<div class="fixed right-0 top-0 bottom-0 w-[480px] max-w-[95vw] z-[100] bg-[var(--bg-elev)] border-l border-[var(--border)] overflow-y-auto flex flex-col">
		<!-- Drawer header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
			<div>
				<span class="font-mono text-[0.62rem] tracking-[0.18em] uppercase text-[var(--fg-dim)]">
					{editingConnector ? '// edit connector' : '// add connector'}
				</span>
				{#if drawerStep === 2 && selectedType}
					<p class="text-[0.85rem] font-semibold text-[var(--fg)] mt-[2px] flex items-center gap-2">
						<span>{TYPE_META[selectedType].icon}</span>
						{TYPE_META[selectedType].label}
					</p>
				{/if}
			</div>
			<button
				class="text-[var(--fg-dim)] hover:text-[var(--fg)] text-lg bg-transparent border-none cursor-pointer p-1"
				onclick={() => (drawerOpen = false)}
				aria-label="Close drawer"
			>×</button>
		</div>

		<!-- Drawer body -->
		<div class="flex-1 px-6 py-5 overflow-y-auto">
			{#if drawerStep === 1}
				<!-- Step 1: type picker -->
				<p class="text-[0.72rem] text-[var(--fg-dim)] mb-4">Choose the type of identity provider to configure.</p>
				<div class="grid grid-cols-1 gap-3">
					{#each Object.entries(TYPE_META) as [type, meta]}
						<button
							class="flex items-center gap-4 p-4 border border-[var(--border)] rounded-lg bg-transparent text-left cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-faint)] transition-[border-color,background] duration-150"
							onclick={() => selectType(type as ConnectorType)}
						>
							<span class="text-xl w-8 text-center shrink-0">{meta.icon}</span>
							<div>
								<div class="text-[0.82rem] font-semibold text-[var(--fg)]">{meta.label}</div>
								<div class="text-[0.65rem] text-[var(--fg-dim)]">{meta.desc}</div>
							</div>
							<span class="ml-auto text-[var(--fg-dim)] text-sm">→</span>
						</button>
					{/each}
				</div>

			{:else if drawerStep === 2 && selectedType}
				<!-- Step 2: type-specific form -->
				<div class="flex flex-col gap-5" style="max-width: none">
					{#if !editingConnector}
						<button
							class="text-[0.68rem] font-mono text-[var(--fg-dim)] hover:text-[var(--accent)] underline-offset-2 hover:underline cursor-pointer bg-transparent border-none text-left self-start"
							onclick={() => (drawerStep = 1)}
						>← Back to type picker</button>
					{/if}

					{#if selectedType === 'oidc'}
						<FormField label="Issuer URL" id="oidc-issuer" required>
							<Input id="oidc-issuer" placeholder="https://accounts.example.com" bind:value={oidcIssuer} />
						</FormField>
						<FormField label="Client ID" id="oidc-cid" required>
							<Input id="oidc-cid" placeholder="client_id" bind:value={oidcClientId} />
						</FormField>
						<FormField label="Client Secret" id="oidc-cs" required>
							{#if editingConnector && !oidcSecretReplace}
								<div class="flex items-center gap-3 px-3 py-2.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg">
									<span class="font-mono text-[0.8rem] text-[var(--fg-dim)]">••••••••</span>
									<button class="ml-auto text-[0.68rem] font-mono text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none" onclick={() => (oidcSecretReplace = true)}>Replace</button>
								</div>
							{:else}
								<Input id="oidc-cs" type="password" placeholder="client_secret" bind:value={oidcClientSecret} />
							{/if}
						</FormField>
						<FormField label="Scopes" id="oidc-scopes" hint="Comma or Enter to add. Default: openid email profile.">
							<ChipInput bind:value={oidcScopes} placeholder="Add scope…" />
						</FormField>

					{:else if selectedType === 'saml'}
						<FormField label="SSO URL" id="saml-sso" required>
							<Input id="saml-sso" placeholder="https://idp.example.com/saml/sso" bind:value={samlSsoUrl} />
						</FormField>
						<FormField label="Entity ID (SP)" id="saml-eid" hint="Pre-filled from your deployment.">
							<Input id="saml-eid" value="urn:armornet:acme-security" readonly />
						</FormField>
						<FormField label="CA Certificate" id="saml-ca" hint="PEM format. Drag & drop, paste, or browse.">
							<FileUpload bind:value={samlCaCert} bind:filename={samlCaCertFilename} accept=".pem,.crt,.cer" />
						</FormField>
						<FormField label="SP Signing Key" id="saml-spkey" hint="Optional. PEM format.">
							<FileUpload bind:value={samlSpKey} bind:filename={samlSpKeyFilename} accept=".pem,.key" />
						</FormField>

					{:else if selectedType === 'ldap'}
						<FormField label="Host : Port" id="ldap-host" required>
							<Input id="ldap-host" placeholder="ldap.example.com:389" bind:value={ldapHost} />
						</FormField>
						<FormField label="Bind DN" id="ldap-dn" required>
							<Input id="ldap-dn" placeholder="cn=admin,dc=example,dc=com" bind:value={ldapBindDn} />
						</FormField>
						<FormField label="Bind Password" id="ldap-pw" required>
							<Input id="ldap-pw" type="password" placeholder="password" bind:value={ldapBindPw} />
						</FormField>
						<FormField label="User Search Base" id="ldap-base" required>
							<Input id="ldap-base" placeholder="ou=users,dc=example,dc=com" bind:value={ldapUserBase} />
						</FormField>
						<FormField label="User Filter" id="ldap-filter">
							<Input id="ldap-filter" placeholder="(objectClass=person)" bind:value={ldapUserFilter} />
						</FormField>
						<div class="border-t border-[var(--border)] pt-4">
							<p class="text-[0.62rem] tracking-[0.15em] uppercase font-mono text-[var(--fg-dim)] mb-3">Attribute Mappings</p>
							<div class="flex flex-col gap-3">
								<FormField label="UID attribute" id="ldap-uid">
									<Input id="ldap-uid" placeholder="uid" bind:value={ldapAttrUid} />
								</FormField>
								<FormField label="Email attribute" id="ldap-email">
									<Input id="ldap-email" placeholder="mail" bind:value={ldapAttrEmail} />
								</FormField>
								<FormField label="Name attribute" id="ldap-name">
									<Input id="ldap-name" placeholder="cn" bind:value={ldapAttrName} />
								</FormField>
							</div>
						</div>

					{:else if selectedType === 'microsoft'}
						<FormField label="Client ID" id="entra-cid" required>
							<Input id="entra-cid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" bind:value={entraClientId} />
						</FormField>
						<FormField label="Client Secret" id="entra-cs" required>
							{#if editingConnector && !entraSecretReplace}
								<div class="flex items-center gap-3 px-3 py-2.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg">
									<span class="font-mono text-[0.8rem] text-[var(--fg-dim)]">••••••••</span>
									<button class="ml-auto text-[0.68rem] font-mono text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none" onclick={() => (entraSecretReplace = true)}>Replace</button>
								</div>
							{:else}
								<Input id="entra-cs" type="password" placeholder="client_secret" bind:value={entraClientSecret} />
							{/if}
						</FormField>
						<FormField label="Tenant" id="entra-tenant" hint="Use 'common' to allow any Entra tenant.">
							<Input id="entra-tenant" placeholder="common" bind:value={entraTenant} />
						</FormField>
						<FormField label="Group Allowlist" id="entra-groups" hint="Optional. Only users in these groups can sign in.">
							<ChipInput bind:value={entraGroupAllowlist} placeholder="Add group ID…" />
						</FormField>

					{:else if selectedType === 'github'}
						<FormField label="Client ID" id="gh-cid" required>
							<Input id="gh-cid" placeholder="Iv1.xxxxxxxxxxxx" bind:value={ghClientId} />
						</FormField>
						<FormField label="Client Secret" id="gh-cs" required>
							{#if editingConnector && !ghSecretReplace}
								<div class="flex items-center gap-3 px-3 py-2.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg">
									<span class="font-mono text-[0.8rem] text-[var(--fg-dim)]">••••••••</span>
									<button class="ml-auto text-[0.68rem] font-mono text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none" onclick={() => (ghSecretReplace = true)}>Replace</button>
								</div>
							{:else}
								<Input id="gh-cs" type="password" placeholder="client_secret" bind:value={ghClientSecret} />
							{/if}
						</FormField>
						<FormField label="Org / Team Allowlist" id="gh-orgs" hint="Optional. Format: org or org/team.">
							<ChipInput bind:value={ghOrgAllowlist} placeholder="Add org or team…" />
						</FormField>
					{/if}

					<!-- Test connection -->
					{#if testResult}
						<div
							class="flex items-center gap-2 px-3 py-2 rounded-md text-[0.72rem] font-mono border {testResult.ok ? 'bg-[rgba(52,211,153,0.06)] border-[rgba(52,211,153,0.3)] text-[var(--palette-emerald-l)]' : 'bg-[rgba(252,165,165,0.06)] border-[rgba(252,165,165,0.3)] text-[var(--palette-red)]'}"
						>
							{testResult.ok ? '✓' : '✗'}
							{testResult.message}
						</div>
					{/if}
					<Button variant="ghost" size="sm" loading={testLoading} onclick={testConnection}>
						Test connection
					</Button>
				</div>
			{/if}
		</div>

		<!-- Drawer footer -->
		{#if drawerStep === 2}
			<div class="shrink-0 px-6 py-4 border-t border-[var(--border)] flex gap-3">
				<Button variant="primary" size="md" onclick={saveConnector}>
					{editingConnector ? 'Save changes' : 'Add connector'}
				</Button>
				<Button variant="ghost" size="sm" onclick={() => (drawerOpen = false)}>Cancel</Button>
			</div>
		{/if}
	</div>
{/if}

<!-- Delete confirm modal -->
<Modal
	open={showDeleteModal}
	title="Delete connector"
	variant="danger"
	onclose={() => (showDeleteModal = false)}
>
	<div class="flex flex-col gap-4">
		{#if deletingConnector && connectors.length === 1}
			<div class="flex items-start gap-3 p-3 bg-[rgba(252,165,165,0.08)] border border-[rgba(252,165,165,0.25)] rounded-md">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-[var(--palette-red)] shrink-0 mt-[1px]" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
				<p class="text-[0.72rem] text-[var(--palette-red)] leading-relaxed">
					<strong>Warning:</strong> Deleting the only connector will lock all users out of this organization.
				</p>
			</div>
		{/if}
		<p class="text-[0.8rem] text-[var(--fg-muted)]">
			Delete <strong class="text-[var(--fg)]">{deletingConnector?.name}</strong>? Users who rely on this connector will not be able to sign in.
		</p>
		<div class="flex gap-3">
			<Button variant="danger" size="md" onclick={doDelete}>Delete connector</Button>
			<Button variant="ghost" size="md" onclick={() => (showDeleteModal = false)}>Cancel</Button>
		</div>
	</div>
</Modal>
