<script lang="ts">
	// /admin/users — User management
	//
	// Admin-only. Members table + pending invites table.
	// Role changes go through FGA — the badge reflects the actual relation stored.
	//
	// API stubs:
	//   GET  /api/admin/orgs/:id/users → OrgUser[]
	//   PATCH /api/admin/orgs/:id/users/:uid { role } → OrgUser
	//   DELETE /api/admin/orgs/:id/users/:uid → 204
	//   GET  /api/admin/orgs/:id/invites → Invite[]
	//   POST /api/admin/orgs/:id/invites { email, role } → Invite
	//   POST /api/admin/orgs/:id/invites/:iid/resend → 204
	//   DELETE /api/admin/orgs/:id/invites/:iid → 204

	import Avatar from '$lib/display/Avatar.svelte';
	import DataTable from '$lib/display/table/DataTable.svelte';
	import ActionsMenu from '$lib/primitives/ActionsMenu.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import FormField from '$lib/primitives/FormField.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Select from '$lib/primitives/Select.svelte';
	import StatusDot from '$lib/primitives/StatusDot.svelte';
	import Tabs from '$lib/layout/Tabs.svelte';
	import Modal from '$lib/layout/Modal.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import type { Tab } from '$lib/layout/Tabs.svelte';
	import type { ActionMenuItem } from '$lib/primitives/ActionsMenu.svelte';
	import type { TableColumn } from '$lib/display/table/DataTable.svelte';
	import type { ChipColor } from '$lib/primitives/Chip.svelte';
	import type { StatusLevel } from '$lib/primitives/StatusDot.svelte';

	type Role = 'owner' | 'admin' | 'member';
	type UserStatus = 'active' | 'suspended';
	type InviteStatus = 'pending' | 'expired';

	type OrgUser = {
		id: string;
		name: string;
		email: string;
		role: Role;
		status: UserStatus;
		joined: string;
		avatar_initials: string;
	};

	type Invite = {
		id: string;
		email: string;
		role: Exclude<Role, 'owner'>;
		invited_by: string;
		expires_at: string;
		status: InviteStatus;
	};

	// ── Seed data ─────────────────────────────────────────────────────────────

	let users = $state<OrgUser[]>([
		{ id: 'u1', name: 'Dana Reyes', email: 'dana@acme.io', role: 'owner', status: 'active', joined: '2024-11-02', avatar_initials: 'DR' },
		{ id: 'u2', name: 'Jordan Kim', email: 'jordan@acme.io', role: 'admin', status: 'active', joined: '2024-11-15', avatar_initials: 'JK' },
		{ id: 'u3', name: 'Alex Pruitt', email: 'alex@acme.io', role: 'member', status: 'active', joined: '2025-01-08', avatar_initials: 'AP' },
		{ id: 'u4', name: 'Sam Okafor', email: 'sam@acme.io', role: 'member', status: 'suspended', joined: '2025-03-12', avatar_initials: 'SO' }
	]);

	let invites = $state<Invite[]>([
		{ id: 'i1', email: 'morgan@acme.io', role: 'member', invited_by: 'dana@acme.io', expires_at: '2026-06-20', status: 'pending' },
		{ id: 'i2', email: 'riley@acme.io', role: 'admin', invited_by: 'jordan@acme.io', expires_at: '2026-06-08', status: 'expired' }
	]);

	// ── UI state ──────────────────────────────────────────────────────────────

	let activeTab = $state('members');
	let showInviteModal = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state('member');
	let inviteLoading = $state(false);
	let inviteError = $state('');

	// Role change popover
	let rolePopoverUserId = $state<string | null>(null);
	let pendingRole = $state<Role | null>(null);
	let roleLoading = $state(false);

	let toast = $state('');

	// ── Tabs ──────────────────────────────────────────────────────────────────

	const TABS: Tab[] = $derived([
		{ id: 'members', label: `Members (${users.length})` },
		{ id: 'invites', label: `Invites (${invites.filter((i) => i.status === 'pending').length})` }
	]);

	// ── Table columns ─────────────────────────────────────────────────────────

	const USER_COLUMNS: TableColumn<OrgUser>[] = [
		{ key: 'name', header: 'User' },
		{ key: 'role', header: 'Role' },
		{ key: 'status', header: 'Status' },
		{ key: 'joined', header: 'Joined' },
		{ key: '_actions', header: '' }
	];

	const INVITE_COLUMNS: TableColumn<Invite>[] = [
		{ key: 'email', header: 'Email' },
		{ key: 'role', header: 'Role' },
		{ key: 'invited_by', header: 'Invited by' },
		{ key: 'expires_at', header: 'Expires' },
		{ key: 'status', header: 'Status' },
		{ key: '_actions', header: '' }
	];

	// ── Helpers ───────────────────────────────────────────────────────────────

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2800);
	}

	async function changeRole(userId: string, role: Role) {
		roleLoading = true;
		await new Promise((r) => setTimeout(r, 600));
		users = users.map((u) => (u.id === userId ? { ...u, role } : u));
		roleLoading = false;
		rolePopoverUserId = null;
		pendingRole = null;
		showToast('Role updated');
	}

	async function toggleSuspend(u: OrgUser) {
		await new Promise((r) => setTimeout(r, 400));
		const next: UserStatus = u.status === 'suspended' ? 'active' : 'suspended';
		users = users.map((x) => (x.id === u.id ? { ...x, status: next } : x));
		showToast(next === 'suspended' ? `${u.name} suspended` : `${u.name} reactivated`);
	}

	async function removeUser(u: OrgUser) {
		await new Promise((r) => setTimeout(r, 400));
		users = users.filter((x) => x.id !== u.id);
		showToast(`${u.name} removed`);
	}

	async function resendInvite(inv: Invite) {
		await new Promise((r) => setTimeout(r, 400));
		invites = invites.map((i) => i.id === inv.id ? { ...i, expires_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: 'pending' as const } : i);
		showToast(`Invite resent to ${inv.email}`);
	}

	async function revokeInvite(inv: Invite) {
		await new Promise((r) => setTimeout(r, 400));
		invites = invites.filter((i) => i.id !== inv.id);
		showToast(`Invite to ${inv.email} revoked`);
	}

	async function sendInvite() {
		if (!inviteEmail.trim()) { inviteError = 'Email is required.'; return; }
		inviteError = '';
		inviteLoading = true;
		await new Promise((r) => setTimeout(r, 900));
		inviteLoading = false;
		invites = [...invites, {
			id: `i${Date.now()}`,
			email: inviteEmail,
			role: inviteRole as Exclude<Role, 'owner'>,
			invited_by: 'dana@acme.io',
			expires_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
			status: 'pending'
		}];
		showToast(`Invite sent to ${inviteEmail}`);
		showInviteModal = false;
		inviteEmail = '';
		inviteRole = 'member';
		activeTab = 'invites';
	}

	// ── Display helpers ───────────────────────────────────────────────────────

	const ROLE_CHIP: Record<Role, ChipColor> = { owner: 'warn', admin: 'blue', member: 'accent' };
	const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
	const STATUS_DOT: Record<UserStatus, StatusLevel> = { active: 'healthy', suspended: 'offline' };
	const INVITE_STATUS_CHIP: Record<InviteStatus, ChipColor> = { pending: 'warn', expired: 'default' };

	function userMenuItems(u: OrgUser): ActionMenuItem[] {
		const items: ActionMenuItem[] = [
			{
				label: 'Change role',
				onclick: () => { rolePopoverUserId = u.id; pendingRole = u.role; }
			}
		];
		items.push({
			label: u.status === 'suspended' ? 'Reactivate' : 'Suspend',
			destructive: u.status !== 'suspended',
			onclick: () => toggleSuspend(u)
		});
		if (u.role !== 'owner') {
			items.push({ label: 'Remove', destructive: true, onclick: () => removeUser(u) });
		}
		return items;
	}

	function inviteMenuItems(inv: Invite): ActionMenuItem[] {
		const items: ActionMenuItem[] = [];
		if (inv.status === 'pending') items.push({ label: 'Resend', onclick: () => resendInvite(inv) });
		items.push({ label: 'Revoke', destructive: true, onclick: () => revokeInvite(inv) });
		return items;
	}

	const roleSelectOptions = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'member', label: 'Member' }
	];
</script>

<svelte:head><title>Users — Armornet</title></svelte:head>

{#if toast}
	<div class="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[var(--bg-elev)] border border-[var(--accent)] rounded-lg text-[0.78rem] font-mono text-[var(--fg)] shadow-[var(--shadow-card)] flex items-center gap-2">
		<span class="text-[var(--accent)]">✓</span>{toast}
	</div>
{/if}

<!-- Role change popover -->
{#if rolePopoverUserId}
	{@const targetUser = users.find((u) => u.id === rolePopoverUserId)!}
	<div
		class="fixed inset-0 z-[98]"
		onclick={() => { rolePopoverUserId = null; }}
		aria-hidden="true"
	></div>
	<div
		class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[99] w-[280px] bg-[var(--bg-elev)] border border-[var(--border-strong)] rounded-xl shadow-[var(--shadow-card)] p-4 flex flex-col gap-3"
	>
		<p class="text-[0.72rem] font-mono uppercase tracking-wider text-[var(--fg-dim)]">Change role — {targetUser.name}</p>
		{#each (['admin', 'member'] as const) as r}
			<button
				class="flex items-center gap-3 p-3 rounded-lg border text-left cursor-pointer transition-[border-color,background] duration-150 {pendingRole === r ? 'border-[var(--accent)] bg-[var(--accent-faint)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'}"
				onclick={() => (pendingRole = r)}
			>
				<Chip look="filled" color={ROLE_CHIP[r]}>{ROLE_LABELS[r]}</Chip>
				<span class="text-[0.72rem] text-[var(--fg-muted)]">{r === 'admin' ? 'Manage users & settings' : 'Read/write resources'}</span>
				{#if pendingRole === r}
					<span class="ml-auto text-[var(--accent)] text-[0.7rem]">✓</span>
				{/if}
			</button>
		{/each}
		<div class="flex gap-2 pt-1">
			<Button variant="primary" size="sm" loading={roleLoading} onclick={() => pendingRole && changeRole(rolePopoverUserId!, pendingRole)}>
				Apply
			</Button>
			<Button variant="ghost" size="sm" onclick={() => { rolePopoverUserId = null; }}>Cancel</Button>
		</div>
	</div>
{/if}

<LayoutHeader eyebrow="// admin · users">
	{#snippet title()}User <span class="text-[var(--accent)]">management.</span>{/snippet}
	{#snippet lede()}Manage members and pending invites for Acme Security.{/snippet}
	{#snippet actions()}
		<Button variant="primary" size="sm" onclick={() => { showInviteModal = true; inviteEmail = ''; inviteRole = 'member'; inviteError = ''; }}>
			+ Invite user
		</Button>
	{/snippet}
</LayoutHeader>

<div class="mb-4">
	<Tabs tabs={TABS} bind:active={activeTab} />
</div>

{#if activeTab === 'members'}
	<DataTable columns={USER_COLUMNS} rows={users} empty="No members found.">
		{#snippet cell(key, row)}
			{#if key === 'name'}
				<div class="flex items-center gap-3">
					<Avatar initials={row.avatar_initials} size={28} />
					<div>
						<div class="text-[0.8rem] text-[var(--fg)] font-medium leading-tight">{row.name}</div>
						<div class="text-[0.65rem] text-[var(--fg-dim)]">{row.email}</div>
					</div>
				</div>
			{:else if key === 'role'}
				<Chip look="filled" color={ROLE_CHIP[row.role]}>{ROLE_LABELS[row.role]}</Chip>
			{:else if key === 'status'}
				<span class="flex items-center gap-2 text-[0.72rem] text-[var(--fg-muted)]">
					<StatusDot status={STATUS_DOT[row.status]} />{row.status}
				</span>
			{:else if key === 'joined'}
				<span class="text-[0.72rem]">{row.joined}</span>
			{:else if key === '_actions'}
				<ActionsMenu items={userMenuItems(row)} />
			{/if}
		{/snippet}
	</DataTable>

{:else}
	<DataTable columns={INVITE_COLUMNS} rows={invites} empty="No invites.">
		{#snippet cell(key, row)}
			{#if key === 'email'}
				<span class="text-[0.78rem] text-[var(--fg-muted)]">{row.email}</span>
			{:else if key === 'role'}
				<Chip look="filled" color={ROLE_CHIP[row.role]}>{ROLE_LABELS[row.role]}</Chip>
			{:else if key === 'invited_by'}
				<span class="text-[0.72rem]">{row.invited_by}</span>
			{:else if key === 'expires_at'}
				<span class="text-[0.72rem]">{row.expires_at}</span>
			{:else if key === 'status'}
				<Chip look="filled" color={INVITE_STATUS_CHIP[row.status]}>{row.status}</Chip>
			{:else if key === '_actions'}
				<ActionsMenu items={inviteMenuItems(row)} />
			{/if}
		{/snippet}
	</DataTable>
{/if}

<!-- Invite modal -->
<Modal
	open={showInviteModal}
	title="Invite a team member"
	size="md"
	onclose={() => (showInviteModal = false)}
>
	<div class="flex flex-col gap-5">
		<div class="px-3 py-[0.6rem] bg-[var(--surface-raised)] border border-[var(--border)] rounded-md text-[0.72rem] text-[var(--fg-dim)] leading-relaxed">
			We'll email a secure invite link. The recipient authenticates via your org's identity provider and is auto-joined.
		</div>
		<FormField label="Email address" required id="inv-email" error={inviteError}>
			<Input id="inv-email" type="email" placeholder="colleague@company.com" bind:value={inviteEmail} />
		</FormField>
		<FormField label="Role" id="inv-role">
			<Select id="inv-role" options={roleSelectOptions} bind:value={inviteRole} class="!w-full" />
		</FormField>
		<div class="flex gap-3">
			<Button variant="primary" size="md" loading={inviteLoading} onclick={sendInvite}>
				Send invite
			</Button>
			<Button variant="ghost" size="md" onclick={() => (showInviteModal = false)}>Cancel</Button>
		</div>
	</div>
</Modal>
