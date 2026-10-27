<script lang="ts">
	// The editor's one outward action. The count is the point: it says how much is
	// pending, and lights only when there is something to send.
	import Icon from '../../icons/Icon.svelte';

	interface Props {
		count: number;
		/** The verb — "Commit", "Propose". */
		verb?: string;
		/** Shown at zero once something has been sent, so the bar can say the tree is clean. */
		done?: string;
		busy?: boolean;
		onclick: () => void;
	}

	let { count, verb = 'Commit', done, busy = false, onclick }: Props = $props();
</script>

<button
	type="button"
	class="flex items-center gap-1.5 rounded border px-2.5 py-1 font-(family-name:--mono) text-[0.6rem] tracking-[0.1em] uppercase disabled:opacity-45 {count >
	0
		? 'border-[var(--border-accent)] bg-[var(--accent-faint)] text-[var(--accent)] hover:bg-[var(--accent-faint-strong)]'
		: 'border-[var(--border)] text-[var(--fg-dim)]'}"
	{onclick}
	disabled={count === 0 || busy}
>
	<Icon name="git-merge" size={12} />
	{count > 0 ? `${verb} ${count}` : (done ?? verb)}
</button>
