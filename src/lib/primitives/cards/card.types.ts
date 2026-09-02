export type CardType = 'composite' | 'article' | 'data-input' | 'profile' | 'stat' | 'doc' | 'summary' | 'hud' | 'pricing';
export type CardVariant = 'accent' | 'cyan' | 'emerald' | 'blue' | 'amber';

export interface CompositeCardItem {
	label: string;
	headline: string;
	href?: string;
	variant?: CardVariant;
}

export interface ArticleCardAuthor {
	initials: string;
	name: string;
	date?: string;
}

export type DataInputMode = 'info' | 'form';
export type DataInputFieldType = 'text' | 'email' | 'select' | 'textarea';

export interface DataInputInfoRow {
	icon: string;
	sublabel: string;
	value: string;
	variant?: CardVariant;
}

export interface DataInputField {
	type: DataInputFieldType;
	label: string;
	name: string;
	placeholder?: string;
	options?: string[];
	rows?: number;
	span?: 1 | 2;
	required?: boolean;
}

export type StatCardVariant = 'default' | 'accent' | 'warn' | 'error' | 'dim';
export type StatCardSize = 'sm' | 'md' | 'md-long' | 'lg' | 'xl';

export type DocCardStatus = 'draft' | 'active' | 'approved';

export type SummaryVariant = 'default' | 'accent' | 'success' | 'warn' | 'error';

export interface SummaryItem {
	label: string;
	value: number | string;
	variant?: SummaryVariant;
	highlight?: boolean;
}
