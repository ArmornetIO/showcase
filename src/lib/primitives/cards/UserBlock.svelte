<script lang="ts">
	interface Props {
		/** Single letter or short initials displayed in the avatar box. */
		initials: string;
		name: string;
		email?: string;
		role?: string;
		class?: string;
	}

	let { initials, name, email, role, class: cls = '' }: Props = $props();
</script>

<div class="user-block {cls}">
	<div class="ub-avatar">{initials}</div>
	<div class="ub-meta">
		<div class="ub-name">{name}</div>
		{#if email}
			<div class="ub-email">{email}</div>
		{/if}
	</div>
	{#if role}
		<span class="ub-role">{role}</span>
	{/if}
</div>

<style>
	.user-block {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 20px 22px;
	}
	.ub-avatar {
		width: 42px;
		height: 42px;
		flex-shrink: 0;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		background: var(--surface-raised);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
		font-family: var(--mono-display);
		font-weight: 700;
		font-size: 16px;
		box-shadow: 0 0 14px -6px var(--accent);
	}
	.ub-meta {
		flex: 1;
		min-width: 0;
	}
	.ub-name {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 13.5px;
		color: var(--fg);
		margin-bottom: 4px;
	}
	.ub-email {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--fg-dim);
	}
	.ub-role {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--accent);
		background: var(--accent-faint);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-control);
		padding: 3px 8px;
		flex-shrink: 0;
	}
</style>
