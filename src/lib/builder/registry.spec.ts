import { describe, it, expect } from 'vitest';
import { REGISTRY, REGISTRY_MAP, CATEGORIES } from './registry.js';

// Keys that must exist on every component that exposes __trigger
const TRIGGER_PROP_KEYS = [
	'__trigger',
	'__triggerTitle',
	'__triggerMessage',
	'__drawerType',
	'__drawerPosition',
	'__drawerTitle',
	'__drawerIcon',
	'__drawerNodeId',
	'__drawerState',
	'__modalTitle',
	'__modalBody',
	'__modalVariant',
	'__modalSize'
] as const;

describe('REGISTRY structure', () => {
	it('has no duplicate IDs', () => {
		const ids = REGISTRY.map((c) => c.id);
		expect(ids).toHaveLength(new Set(ids).size);
	});

	it('REGISTRY_MAP mirrors REGISTRY exactly', () => {
		expect(REGISTRY_MAP.size).toBe(REGISTRY.length);
		for (const meta of REGISTRY) {
			expect(REGISTRY_MAP.get(meta.id)).toBe(meta);
		}
	});

	it('CATEGORIES covers every category value used', () => {
		const used = new Set(REGISTRY.map((c) => c.category));
		for (const cat of used) {
			expect(CATEGORIES, `Category "${cat}" used in REGISTRY but missing from CATEGORIES`).toContain(
				cat
			);
		}
	});

	it('every entry has required scalar fields', () => {
		for (const meta of REGISTRY) {
			expect(meta.id, `entry missing id`).toBeTruthy();
			expect(meta.label, `${meta.id}: missing label`).toBeTruthy();
			expect(meta.category, `${meta.id}: missing category`).toBeTruthy();
			expect(typeof meta.defaultW, `${meta.id}: defaultW must be number`).toBe('number');
			expect(typeof meta.defaultH, `${meta.id}: defaultH must be number`).toBe('number');
			expect(typeof meta.resizable, `${meta.id}: resizable must be boolean`).toBe('boolean');
			expect(typeof meta.placeable, `${meta.id}: placeable must be boolean`).toBe('boolean');
		}
	});
});

describe('prop definitions', () => {
	it('showWhen.key references an existing prop on the same component', () => {
		for (const meta of REGISTRY) {
			for (const [propKey, def] of Object.entries(meta.props)) {
				if (def.showWhen) {
					expect(
						meta.props[def.showWhen.key],
						`${meta.id}.${propKey}: showWhen.key "${def.showWhen.key}" is not a defined prop`
					).toBeDefined();
				}
			}
		}
	});

	it('enum props have at least one option and default is in options', () => {
		for (const meta of REGISTRY) {
			for (const [propKey, def] of Object.entries(meta.props)) {
				if (def.kind === 'enum') {
					expect(
						def.options?.length,
						`${meta.id}.${propKey}: enum prop has no options`
					).toBeGreaterThan(0);
					// A `multi` enum stores a comma-joined list, so every member has to
					// resolve — not just the whole string, which never matches an option
					// once it holds more than one.
					const parts = def.multi ? String(def.default).split(',').filter(Boolean) : [def.default];
					for (const part of parts) {
						expect(
							def.options,
							`${meta.id}.${propKey}: default value "${part}" not in options`
						).toContain(part);
					}
				}
			}
		}
	});

	it('number props have min ≤ default ≤ max when bounds are set', () => {
		for (const meta of REGISTRY) {
			for (const [propKey, def] of Object.entries(meta.props)) {
				if (def.kind === 'number') {
					const val = Number(def.default);
					if (def.min !== undefined) {
						expect(
							val,
							`${meta.id}.${propKey}: default ${val} < min ${def.min}`
						).toBeGreaterThanOrEqual(def.min);
					}
					if (def.max !== undefined) {
						expect(
							val,
							`${meta.id}.${propKey}: default ${val} > max ${def.max}`
						).toBeLessThanOrEqual(def.max);
					}
				}
			}
		}
	});
});

describe('trigger system', () => {
	it('at least one component exposes __trigger', () => {
		const withTrigger = REGISTRY.filter((m) => '__trigger' in m.props);
		expect(withTrigger.length).toBeGreaterThan(0);
	});

	it('every component with __trigger has all trigger prop keys', () => {
		const withTrigger = REGISTRY.filter((m) => '__trigger' in m.props);
		for (const meta of withTrigger) {
			for (const key of TRIGGER_PROP_KEYS) {
				expect(
					meta.props[key],
					`${meta.id} has __trigger but is missing "${key}"`
				).toBeDefined();
			}
		}
	});

	it('__trigger prop default is "none"', () => {
		for (const meta of REGISTRY.filter((m) => '__trigger' in m.props)) {
			expect(meta.props.__trigger.default, `${meta.id}.__trigger default should be "none"`).toBe(
				'none'
			);
		}
	});

	it('overlay components (Modal, NodeDrawer, AlertBlade) are not placeable', () => {
		const overlayIds = ['Modal', 'NodeDrawer', 'AlertBlade'];
		for (const id of overlayIds) {
			const meta = REGISTRY_MAP.get(id);
			expect(meta, `${id} must be in REGISTRY`).toBeDefined();
			expect(meta?.placeable, `${id} must have placeable: false`).toBe(false);
		}
	});
});
