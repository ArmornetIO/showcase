<script lang="ts">
	interface AvatarProps {
		initials: string;
		size?: number;
	}

	let { initials, size = 32 }: AvatarProps = $props();
</script>

<div
	class="avatar"
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
</style>
