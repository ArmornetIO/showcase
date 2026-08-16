import { describe, it, expect } from 'vitest';
import { isAdjustableRadius } from './preview-radius.js';

// The selection rule is the whole point of preview-radius: force radius onto
// everything and you square off avatars and status dots, which are round on
// purpose. Only genuine *corners* should follow the slider.

describe('isAdjustableRadius', () => {
	it('adjusts ordinary corner radii', () => {
		expect(isAdjustableRadius('6px')).toBe(true);
		expect(isAdjustableRadius('8px')).toBe(true);
		expect(isAdjustableRadius('10px 10px 0px 0px')).toBe(true);
	});

	it('leaves circles alone', () => {
		expect(isAdjustableRadius('50%')).toBe(false);
	});

	it('leaves pills alone', () => {
		expect(isAdjustableRadius('999px')).toBe(false);
		expect(isAdjustableRadius('100px')).toBe(false);
	});

	it('ignores square corners, which have no radius to restyle', () => {
		expect(isAdjustableRadius('0px')).toBe(false);
		expect(isAdjustableRadius('')).toBe(false);
	});

	it('is safe on values it cannot parse', () => {
		expect(isAdjustableRadius('inherit')).toBe(false);
	});
});
