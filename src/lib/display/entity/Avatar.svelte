<script lang="ts">
	interface AvatarProps {
		initials: string;
		size?: number;
		/**
		 * `round` is for a PERSON — a byline, an author card. The hairline square is
		 * for an entity: a service, an org, a node. Same component because the
		 * construction is identical; the shape is the only thing that says which
		 * kind of thing this is, so it is a prop rather than a second component.
		 */
		shape?: 'square' | 'round';
	}

	let { initials, size = 32, shape = 'square' }: AvatarProps = $props();
</script>

<div
	class="avatar"
	data-shape={shape}
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{Math.round(size * 0.34)}px"
	aria-label={initials}
>
	{initials}
</div>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-hairline);
		background: rgba(94, 234, 212, 0.08);
		border: 1px solid rgba(94, 234, 212, 0.25);
		font-family: var(--mono);
		font-weight: 700;
		color: var(--accent);
		user-select: none;
		flex-shrink: 0;
		line-height: 1;
	}

	.avatar[data-shape='round'] {
		border-radius: 999px;
	}
</style>
