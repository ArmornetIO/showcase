import { describe, it, expect } from 'vitest';
import { BREAKPOINTS } from './breakpoints.js';

describe('BREAKPOINTS', () => {
	it('sm is 640', () => expect(BREAKPOINTS.sm).toBe(640));
	it('md is 768', () => expect(BREAKPOINTS.md).toBe(768));
	it('lg is 1024', () => expect(BREAKPOINTS.lg).toBe(1024));
	it('sm < md < lg', () => {
		expect(BREAKPOINTS.sm).toBeLessThan(BREAKPOINTS.md);
		expect(BREAKPOINTS.md).toBeLessThan(BREAKPOINTS.lg);
	});
});
