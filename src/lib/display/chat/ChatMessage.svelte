<script lang="ts">
	export type ChatRole = 'user' | 'assistant' | 'system';

	interface Props {
		role: ChatRole;
		content: string;
		timestamp?: number;
		/** Display name shown above the bubble. Defaults to the role's generic label. */
		author: string;
	}

	let { role, content, timestamp, author = 'CLAUDE' }: Props = $props();

	const timeStr = $derived(
		timestamp
			? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: null
	);
</script>

<div
	class="msg-wrap"
	class:msg-user={role === 'user'}
	class:msg-assistant={role === 'assistant'}
	class:msg-system={role === 'system'}
>
	{#if role !== 'system'}
		<div class="msg-role">{author}</div>
	{/if}
	<div class="msg-bubble">
		{content}
		{#if timeStr}
			<span class="msg-time">{timeStr}</span>
		{/if}
	</div>
</div>

<style>
	.msg-wrap {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 6px 12px;
	}
	.msg-wrap.msg-user {
		align-items: flex-end;
	}
	.msg-wrap.msg-assistant {
		align-items: flex-start;
	}
	.msg-wrap.msg-system {
		align-items: center;
	}

	.msg-role {
		font-family: var(--mono);
		font-size: 8px;
		letter-spacing: 0.2em;
		color: var(--fg-dim);
	}
	.msg-user .msg-role {
		color: rgba(94, 234, 212, 0.5);
	}

	.msg-bubble {
		font-family: var(--mono);
		font-size: 11px;
		line-height: 1.6;
		padding: 8px 12px;
		border-radius: var(--radius-inset);
		max-width: 88%;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.msg-user .msg-bubble {
		background: rgba(94, 234, 212, 0.08);
		border: 1px solid rgba(94, 234, 212, 0.2);
		color: var(--fg);
	}
	.msg-assistant .msg-bubble {
		background: var(--bg-elev);
		border: 1px solid var(--border);
		color: var(--fg-muted);
	}
	.msg-system .msg-bubble {
		background: transparent;
		border: none;
		color: var(--fg-dim);
		font-size: 9px;
		letter-spacing: 0.1em;
		font-style: italic;
		max-width: 100%;
		text-align: center;
		padding: 4px 0;
	}

	.msg-time {
		display: block;
		font-size: 8px;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
		margin-top: 4px;
	}
	.msg-user .msg-time {
		text-align: right;
	}
</style>
