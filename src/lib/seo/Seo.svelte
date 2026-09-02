<script lang="ts">
	import type { SeoProps } from './types.js';

	let {
		title,
		description,
		canonical,
		noindex = false,
		nofollow = false,
		og,
		twitter,
		themeColor
	}: SeoProps = $props();

	const robots = $derived(`${noindex ? 'noindex' : 'index'}, ${nofollow ? 'nofollow' : 'follow'}`);
	const ogTitle = $derived(og?.title ?? title);
	const ogDescription = $derived(og?.description ?? description);
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if canonical}<link rel="canonical" href={canonical} />{/if}
	<meta name="robots" content={robots} />
	{#if themeColor}<meta name="theme-color" content={themeColor} />{/if}

	<!-- Open Graph -->
	<meta property="og:title" content={ogTitle} />
	{#if ogDescription}<meta property="og:description" content={ogDescription} />{/if}
	{#if og?.type}<meta property="og:type" content={og.type} />{/if}
	{#if og?.url}<meta property="og:url" content={og.url} />{/if}
	{#if og?.siteName}<meta property="og:site_name" content={og.siteName} />{/if}
	{#if og?.image}<meta property="og:image" content={og.image} />{/if}
	{#if og?.imageAlt}<meta property="og:image:alt" content={og.imageAlt} />{/if}
	{#if og?.article?.publishedTime}
		<meta property="article:published_time" content={og.article.publishedTime} />
	{/if}
	{#if og?.article?.modifiedTime}
		<meta property="article:modified_time" content={og.article.modifiedTime} />
	{/if}
	{#if og?.article?.authors}
		{#each og.article.authors as author}
			<meta property="article:author" content={author} />
		{/each}
	{/if}
	{#if og?.article?.tags}
		{#each og.article.tags as tag}
			<meta property="article:tag" content={tag} />
		{/each}
	{/if}

	<!-- Twitter -->
	{#if twitter?.card}<meta name="twitter:card" content={twitter.card} />{/if}
	{#if twitter?.site}<meta name="twitter:site" content={twitter.site} />{/if}
	{#if twitter?.creator}<meta name="twitter:creator" content={twitter.creator} />{/if}
	{#if twitter?.title ?? ogTitle}
		<meta name="twitter:title" content={twitter?.title ?? ogTitle} />
	{/if}
	{#if twitter?.description ?? ogDescription}
		<meta name="twitter:description" content={twitter?.description ?? ogDescription} />
	{/if}
	{#if twitter?.image}<meta name="twitter:image" content={twitter.image} />{/if}
	{#if twitter?.imageAlt}<meta name="twitter:image:alt" content={twitter.imageAlt} />{/if}
</svelte:head>
