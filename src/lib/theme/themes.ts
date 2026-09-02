export type ThemeKey = 'dark' | 'light' | 'paper' | 'daylight' | 'oled' | 'high-contrast';
export type ThemeChoice = ThemeKey | 'system';
export type ThemeMode = 'light' | 'dark';

export interface Theme {
	key: ThemeKey;
	label: string;
	description: string;
	mode: ThemeMode;
	/** [background, accent, foreground, muted] — spec-only for the picker swatch. */
	swatch: [string, string, string, string];
}

export const THEMES: readonly Theme[] = [
	{
		key: 'dark',
		label: 'Dark',
		description: 'Near-black canvas with teal accent. The default.',
		mode: 'dark',
		swatch: ['#06070b', '#5eead4', '#e5edf0', '#a4b0b6']
	},
	{
		key: 'light',
		label: 'Light',
		description: 'Bright off-white with a deep teal accent.',
		mode: 'light',
		swatch: ['#f7f8fa', '#0e7868', '#0d1417', '#475259']
	},
	{
		key: 'paper',
		label: 'Paper',
		description: 'Warm tan ground, white cards. Low glare for long reading.',
		mode: 'light',
		swatch: ['#ece5d6', '#085c4d', '#15120c', '#423a2d']
	},
	{
		key: 'daylight',
		label: 'Daylight',
		description: 'Cool slate ground, near-black ink. For a bright room.',
		mode: 'light',
		swatch: ['#e4e9ef', '#0a6480', '#050c14', '#333f4c']
	},
	{
		key: 'oled',
		label: 'OLED',
		description: 'Pure black background for OLED displays.',
		mode: 'dark',
		swatch: ['#000000', '#5eead4', '#e5edf0', '#a4b0b6']
	},
	{
		key: 'high-contrast',
		label: 'High contrast',
		description: 'WCAG AAA contrast — black, white, yellow.',
		mode: 'dark',
		swatch: ['#000000', '#ffff00', '#ffffff', '#cccccc']
	}
] as const;

export const DEFAULT_DARK: ThemeKey = 'dark';
export const DEFAULT_LIGHT: ThemeKey = 'light';

export function getTheme(key: ThemeKey): Theme {
	return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

export function resolveChoice(choice: ThemeChoice, prefersLight: boolean): ThemeKey {
	if (choice === 'system') return prefersLight ? DEFAULT_LIGHT : DEFAULT_DARK;
	return choice;
}
