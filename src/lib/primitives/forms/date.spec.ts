import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, orderForLocale, type DateOutput } from './date.js';

const today = '2026-09-29';

describe('parseDate', () => {
	it.each([
		['03/04/2026', 'mdy', '2026-03-04'],
		['03/04/2026', 'dmy', '2026-04-03'],
		['26/03/04', 'ymd', '2026-03-04'],
		['03/04', 'dmy', '2026-04-03'],
		['3.4.26', 'dmy', '2026-04-03'],
		// A four-digit leading year overrides the configured order.
		['2026-03-04', 'dmy', '2026-03-04']
	] as const)('%s as %s → %s', (raw, order, want) => {
		expect(parseDate(raw, { order, today })).toBe(want);
	});

	it.each([
		['oct 15', '2026-10-15'],
		['15 Oct 2026', '2026-10-15'],
		['Oct. 15, 2027', '2027-10-15'],
		['2026 october 15', '2026-10-15'],
		['tomorrow', '2026-09-30'],
		['+2w', '2026-10-13'],
		['-1y', '2025-09-29']
	])('%s → %s', (raw, want) => expect(parseDate(raw, { today })).toBe(want));

	it('matches month names in the given locale', () => {
		expect(parseDate('15 octobre 2026', { locale: 'fr', today })).toBe('2026-10-15');
		expect(parseDate('3 März 2026', { locale: 'de', today })).toBe('2026-03-03');
	});

	it('clamps month arithmetic to the end of the month', () => {
		expect(parseDate('+1m', { today: '2026-01-31' })).toBe('2026-02-28');
	});

	it.each(['02/30/2026', '13/13/2026', 'foo', '', 'oct 2026'])('refuses %j', (raw) => {
		expect(parseDate(raw, { order: 'mdy', today })).toBeNull();
	});
});

describe('orderForLocale', () => {
	it('reads the order from Intl', () => {
		expect([orderForLocale('en-US'), orderForLocale('en-GB'), orderForLocale('ja')]).toEqual(['mdy', 'dmy', 'ymd']);
	});
});

describe('formatDate', () => {
	it.each([
		[{ kind: 'date' }, '2026-10-15'],
		[{ kind: 'datetime' }, '2026-10-15T00:00:00.000Z'],
		[{ kind: 'datetime', zone: 'America/New_York' }, '2026-10-15T04:00:00.000Z'],
		[{ kind: 'datetime', zone: 'America/New_York', boundary: 'end' }, '2026-10-16T03:59:59.999Z'],
		[{ kind: 'datetime', zone: 'Asia/Tokyo' }, '2026-10-14T15:00:00.000Z'],
		[{ kind: 'epoch' }, 1792022400],
		[{ kind: 'pattern', pattern: 'dddd, MMMM D, YYYY' }, 'Thursday, October 15, 2026'],
		[{ kind: 'pattern', pattern: 'DD.MM.YY [KW]' }, '15.10.26 KW']
	] as [DateOutput, string | number][])('%j', (out, want) => {
		expect(formatDate('2026-10-15', out)).toBe(want);
	});

	it('uses the offset in force at that midnight across DST', () => {
		const ny: DateOutput = { kind: 'datetime', zone: 'America/New_York' };
		expect(formatDate('2026-11-01', ny)).toBe('2026-11-01T04:00:00.000Z');
		expect(formatDate('2026-11-02', ny)).toBe('2026-11-02T05:00:00.000Z');
	});

	it('hands the day to a custom formatter', () => {
		expect(formatDate('2026-10-15', (d) => d.replaceAll('-', ''))).toBe('20261015');
	});
});
