export interface OpenGraph {
	title?: string;
	description?: string;
	url?: string;
	siteName?: string;
	image?: string;
	imageAlt?: string;
	type?: 'website' | 'article' | 'profile' | 'book';
	article?: {
		publishedTime?: string;
		modifiedTime?: string;
		authors?: string[];
		tags?: string[];
	};
}

export interface TwitterCard {
	card?: 'summary' | 'summary_large_image';
	site?: string;
	creator?: string;
	title?: string;
	description?: string;
	image?: string;
	imageAlt?: string;
}

export interface SeoProps {
	title: string;
	description?: string;
	canonical?: string;
	noindex?: boolean;
	nofollow?: boolean;
	og?: OpenGraph;
	twitter?: TwitterCard;
	themeColor?: string;
}

export type JsonLdSchema = Record<string, unknown> & {
	'@context'?: string;
	'@type'?: string;
};
