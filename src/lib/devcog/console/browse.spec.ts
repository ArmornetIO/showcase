import { describe, it, expect } from 'vitest';
import { currentApp, loadAppIndex, parseAppIndex, APP_INDEX_URL } from './browse.js';
import { alignmentCookie, readAlignment } from './align.js';

const APPS = [
	{ name: 'console', path: '/', root: true },
	{ name: 'showcase', path: '/showcase' },
	{ name: 'breach', path: '/breach' }
];

describe('currentApp', () => {
	it('resolves the way the engine does: longest claim, else the root', () => {
		expect(currentApp(APPS, '/')).toBe('console');
		expect(currentApp(APPS, '/overview')).toBe('console');
		expect(currentApp(APPS, '/showcase')).toBe('showcase');
		expect(currentApp(APPS, '/showcase/primitives/button')).toBe('showcase');
	});

	it('is segment-aware, so /breach does not claim /breach-admin', () => {
		expect(currentApp(APPS, '/breach-admin')).toBe('console');
	});

	it('names nothing when there is no root and no claim', () => {
		expect(currentApp([{ name: 'showcase', path: '/showcase' }], '/x')).toBeUndefined();
	});
});

describe('parseAppIndex', () => {
	it('keeps well-formed entries and drops the rest', () => {
		const got = parseAppIndex({ apps: [...APPS, { name: 1 }, null] });
		expect(got?.map((a) => a.name)).toEqual(['console', 'showcase', 'breach']);
	});

	it('reads anything else as no index, not a crash', () => {
		expect(parseAppIndex(null)).toBeNull();
		expect(parseAppIndex({ apps: 'nope' })).toBeNull();
	});
});

describe('loadAppIndex', () => {
	it('fetches the framework path and treats a miss as no index', async () => {
		let asked = '';
		const miss = (async (url: string) => {
			asked = url;
			return new Response('404 page not found', { status: 404 });
		}) as typeof fetch;

		expect(await loadAppIndex(miss)).toBeNull();
		expect(asked).toBe(APP_INDEX_URL);
	});

	it('treats a network failure as no index', async () => {
		const down = (async () => {
			throw new TypeError('fetch failed');
		}) as typeof fetch;

		expect(await loadAppIndex(down)).toBeNull();
	});
});

describe('alignment cookie', () => {
	it('round-trips through a cookie header shared with other cookies', () => {
		const set = alignmentCookie('devcog_console', { group: 'browse', open: true });
		expect(set).toMatch(/; Path=\/;/);

		const header = `a=b; ${set.split(';')[0]}; c=1.x`;
		expect(readAlignment(header, 'devcog_console')).toEqual({ group: 'browse', open: true });
	});

	it('reads a value it did not write as absent', () => {
		expect(readAlignment('devcog_console=browse', 'devcog_console')).toBeNull();
		expect(readAlignment('devcog_console=2.x', 'devcog_console')).toBeNull();
		expect(readAlignment('', 'devcog_console')).toBeNull();
	});
});
