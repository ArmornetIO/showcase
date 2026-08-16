<script lang="ts">
	// /settings/org — Org settings
	//
	// Admin-only. General org metadata + danger zone (delete org).
	//
	// API stubs:
	//   PATCH /api/admin/orgs/:id { name, slug } → Org
	//   DELETE /api/orgs/:id → 204

	import Button from '$lib/primitives/Button.svelte';
	import FormField from '$lib/primitives/FormField.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Modal from '$lib/layout/Modal.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';

	// ── Mock data ─────────────────────────────────────────────────────────────

	let orgName = $state('Acme Security');
	let orgSlug = $state('acme-security');
	let originalSlug = $state('acme-security');
	let saving = $state(false);
	let saved = $state(false);
	let showSlugWarning = $derived(orgSlug !== originalSlug);

	// Danger zone
	let showDeleteModal = $state(false);
	let deleteConfirmText = $state('');
	let deleting = $state(false);
	const canConfirmDelete = $derived(deleteConfirmText === orgSlug);

	async function handleSave(e: Event) {
		e.preventDefault();
		saving = true;
		await new Promise((r) => setTimeout(r, 800));
		saving = false;
		saved = true;
		originalSlug = orgSlug;
		setTimeout(() => (saved = false), 2500);
	}

	async function handleDelete() {
		if (!canConfirmDelete) return;
		deleting = true;
		await new Promise((r) => setTimeout(r, 1000));
		deleting = false;
		showDeleteModal = false;
		deleteConfirmText = '';
		// In real app: redirect to logged-out state
	}
</script>

<svelte:head><title>Org Settings — Armornet</title></svelte:head>

{#if saved}
	<div class="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[var(--bg-elev)] border border-[var(--accent)] rounded-lg text-[0.78rem] font-mono text-[var(--fg)] shadow-[var(--shadow-card)] flex items-center gap-2">
		<span class="text-[var(--accent)]">✓</span> Settings saved
	</div>
{/if}

<LayoutHeader eyebrow="// settings · org">
	{#snippet title()}Org <span class="text-[var(--accent)]">settings.</span>{/snippet}
	{#snippet lede()}Manage your organization's name, slug, and billing plan.{/snippet}
</LayoutHeader>

<!-- Not-admin notice (FGA: shown when user lacks admin/owner relation) -->
<div class="hidden mb-6 p-4 border border-[rgba(252,211,77,0.3)] rounded-lg bg-[rgba(252,211,77,0.05)] flex items-center gap-3">
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-[var(--palette-amber)] shrink-0" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
	<p class="text-[0.75rem] text-[var(--palette-amber)]">You don't have permission to modify org settings.</p>
</div>

<div class="max-w-[580px] flex flex-col gap-8">
	<!-- General section -->
	<section>
		<h2 class="text-[0.65rem] tracking-[0.2em] uppercase font-mono text-[var(--fg-dim)] mb-4">General</h2>
		<form onsubmit={handleSave} class="flex flex-col gap-5">
			<div style="max-width: none">
				<FormField label="Org name" id="org-name" required>
					<Input id="org-name" bind:value={orgName} placeholder="Acme Security" />
				</FormField>
			</div>

			<div style="max-width: none">
				<FormField label="Slug" id="org-slug" hint={showSlugWarning ? undefined : "Used in your workspace URL."}>
					<Input id="org-slug" bind:value={orgSlug} placeholder="acme-security" />
				</FormField>
				{#if showSlugWarning}
					<div class="flex items-center gap-2 mt-2 px-3 py-2 bg-[rgba(252,211,77,0.06)] border border-[rgba(252,211,77,0.3)] rounded-md">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-[var(--palette-amber)] shrink-0" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
						<p class="text-[0.68rem] text-[var(--palette-amber)]">
							Changing your slug will break saved login URLs. Users will need to update their bookmarks.
						</p>
					</div>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<span class="text-[0.65rem] tracking-[0.15em] uppercase font-mono text-[var(--fg-dim)]">Plan</span>
				<Chip look="ghost" color="default">Starter · Free</Chip>
				<a href="/pricing" class="text-[0.68rem] text-[var(--accent)] hover:underline underline-offset-2">Upgrade →</a>
			</div>

			<div>
				<Button variant="primary" size="md" type="submit" loading={saving}>
					Save changes
				</Button>
			</div>
		</form>
	</section>

	<!-- Danger zone -->
	<section class="border border-[rgba(252,165,165,0.3)] rounded-lg p-5">
		<h2 class="text-[0.65rem] tracking-[0.2em] uppercase font-mono text-[var(--palette-red)] mb-4 flex items-center gap-2">
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
			Danger zone
		</h2>
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-[0.82rem] font-medium text-[var(--fg)]">Delete organization</p>
				<p class="text-[0.72rem] text-[var(--fg-dim)] mt-1 leading-relaxed">
					Permanently delete this organization, all members, connectors, and data. This cannot be undone.
				</p>
			</div>
			<Button variant="danger" size="sm" onclick={() => (showDeleteModal = true)}>
				Delete org
			</Button>
		</div>
	</section>
</div>

<!-- Delete confirm modal -->
<Modal
	open={showDeleteModal}
	title="Delete organization"
	variant="danger"
	onclose={() => { showDeleteModal = false; deleteConfirmText = ''; }}
>
	<div class="flex flex-col gap-4">
		<p class="text-[0.8rem] text-[var(--fg-muted)] leading-relaxed">
			This will permanently delete <strong class="text-[var(--fg)]">{orgName}</strong> and all associated data.
			This action <strong class="text-[var(--palette-red)]">cannot be undone</strong>.
		</p>
		<div class="p-3 bg-[rgba(252,165,165,0.06)] border border-[rgba(252,165,165,0.2)] rounded-md">
			<p class="text-[0.7rem] text-[var(--fg-dim)] font-mono">
				All members will lose access immediately. Connectors, assessments, and vendor data will be deleted.
			</p>
		</div>
		<div style="max-width: none">
			<FormField label="Type the org slug to confirm" id="delete-confirm">
				<Input
					id="delete-confirm"
					bind:value={deleteConfirmText}
					placeholder={orgSlug}
					status={deleteConfirmText && !canConfirmDelete ? 'error' : 'default'}
				/>
			</FormField>
		</div>
		<div class="flex gap-3">
			<Button
				variant="danger"
				size="md"
				disabled={!canConfirmDelete}
				loading={deleting}
				onclick={handleDelete}
			>
				Delete permanently
			</Button>
			<Button variant="ghost" size="md" onclick={() => { showDeleteModal = false; deleteConfirmText = ''; }}>
				Cancel
			</Button>
		</div>
	</div>
</Modal>
