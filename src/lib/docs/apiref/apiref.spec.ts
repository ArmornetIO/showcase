// The derivations the reference makes off the island. They are what decides
// which access line is worth printing and which operations sit "nearby", so a
// wrong one is a page that quietly says the wrong thing about authorization.
import { describe, it, expect } from 'vitest';
import {
	bodyFieldsOf,
	detailFor,
	exampleFor,
	isNotable,
	kindCounts,
	lineSections,
	sampleFor,
	siblingsOf,
	tupleFor
} from './apiref.js';
import type { ApiIsland, Endpoint } from './types.js';

function ep(over: Partial<Endpoint> & Pick<Endpoint, 'id' | 'path'>): Endpoint {
	return {
		method: 'get',
		summary: over.id,
		auth: { kind: 'authenticated', label: 'Signed in', detail: 'A valid credential is required.' },
		curl: 'curl …',
		...over
	};
}

describe('tupleFor', () => {
	it('reads the organization relation out of an org_role label', () => {
		const t = tupleFor(
			ep({
				id: 'a',
				path: '/api/risks',
				auth: {
					kind: 'org_role',
					label: 'Org risk approver',
					detail: 'Requires the risk_approver relation on your active organization.'
				}
			})
		);
		expect(t).toEqual({
			relation: 'risk_approver',
			objectType: 'organization',
			source: 'active organization',
			param: undefined
		});
	});

	it('splits an object label into type and relation, and names the path param', () => {
		const t = tupleFor(
			ep({
				id: 'b',
				path: '/api/agent-clients/{id}',
				auth: {
					kind: 'object',
					label: 'agent client editor',
					detail: 'Requires the editor relation on the agent client named by {id}.'
				}
			})
		);
		expect(t).toMatchObject({ relation: 'editor', objectType: 'agent_client', param: 'id' });
	});

	it('has no tuple for the kinds that check no relation', () => {
		expect(tupleFor(ep({ id: 'c', path: '/api/health' }))).toBeNull();
	});
});

describe('isNotable', () => {
	const orgRole = (label: string) =>
		ep({ id: label, path: '/x', auth: { kind: 'org_role', label, detail: '' } });

	it('stays quiet on the default rule and speaks up on a stronger one', () => {
		expect(isNotable(orgRole('Org member'))).toBe(false);
		expect(isNotable(orgRole('Org admin'))).toBe(true);
	});
});

describe('kindCounts / detailFor', () => {
	const endpoints = [
		ep({ id: '1', path: '/a' }),
		ep({ id: '2', path: '/b' }),
		ep({
			id: '3',
			path: '/c',
			auth: { kind: 'public', label: 'Public', detail: 'No credential required.' }
		})
	];

	it('counts kinds commonest first', () => {
		expect(kindCounts(endpoints)).toEqual([
			{ kind: 'authenticated', count: 2 },
			{ kind: 'public', count: 1 }
		]);
	});

	it('quotes the spec wording a kind uses most often', () => {
		expect(detailFor(endpoints, 'public')).toBe('No credential required.');
		expect(detailFor(endpoints, 'god_admin')).toBe('');
	});
});

describe('siblingsOf', () => {
	it('ranks the same path, then children, then the parent — and drops the rest', () => {
		const all = [
			ep({ id: 'self', path: '/api/vendors/{id}' }),
			ep({ id: 'other-verb', path: '/api/vendors/{id}', method: 'delete' }),
			ep({ id: 'child', path: '/api/vendors/{id}/contacts' }),
			ep({ id: 'parent', path: '/api/vendors' }),
			ep({ id: 'stranger', path: '/api/risks' })
		];
		expect(siblingsOf(all, all[0]).map((e) => e.id)).toEqual(['other-verb', 'child', 'parent']);
	});
});

describe('bodyFieldsOf', () => {
	const island = {
		schemas: { Vendor: [{ name: 'name', type: 'string' }] }
	} as unknown as ApiIsland;

	it('follows a $ref body into the schema map', () => {
		expect(bodyFieldsOf(island, ep({ id: 'x', path: '/v', body: 'Vendor' }))).toEqual([
			{ name: 'name', type: 'string' }
		]);
	});

	it('prefers inline fields when the body is not a named schema', () => {
		const inline = [{ name: 'note', type: 'string' }];
		expect(bodyFieldsOf(island, ep({ id: 'y', path: '/v', fields: inline }))).toBe(inline);
	});
});

describe('exampleFor', () => {
	const island = {
		schemas: {
			Vendor: [
				{ name: 'id', type: 'string' },
				{ name: 'created_at', type: 'string' },
				{ name: 'active', type: 'boolean' },
				{ name: 'tier', type: 'string', enum: ['critical', 'standard'] }
			]
		}
	} as unknown as ApiIsland;

	it('shapes a body out of the declared schema, never invented names', () => {
		const out = exampleFor(
			island,
			ep({ id: 'z', path: '/v', responses: [{ code: '200', desc: 'OK', schema: 'Vendor' }] })
		);
		expect(out).toContain('"id": "…"');
		expect(out).toContain('"created_at": "2026-09-12T03:11:48Z"');
		expect(out).toContain('"active": true');
		expect(out).toContain('"tier": "critical"');
	});

	it('shows nothing where there is no body to show', () => {
		expect(
			exampleFor(island, ep({ id: 'n', path: '/v', responses: [{ code: '204', desc: 'No content' }] }))
		).toBeNull();
	});
});

describe('sampleFor', () => {
	const e = ep({ id: 's', path: '/api/vendors/{id}', method: 'get', curl: 'curl -X GET …' });

	it('hands cURL back the command the spec itself emitted', () => {
		expect(sampleFor('cURL', e, 'https://armornet.example.com')).toBe('curl -X GET …');
	});

	it('spells path parameters as placeholders everywhere else', () => {
		expect(sampleFor('TypeScript', e, 'https://armornet.example.com')).toContain(
			'https://armornet.example.com/api/vendors/<id>'
		);
	});
});

describe('lineSections', () => {
	it('orders the handshake and files everything else by name', () => {
		const { steps, discovery, other } = lineSections({
			url: 'wss://example/v1/line',
			protocol: 'line',
			description: '',
			messages: [
				{ name: 'LineNotify', direction: 'recv', description: 'n' },
				{ name: 'DiscoveryRequest', direction: 'send', description: 'd' },
				{ name: 'LineOpen', direction: 'send', description: 'o' },
				{ name: 'IdentityCertify', direction: '', description: 'i' }
			]
		});
		expect(steps.map((s) => s.msg)).toEqual(['LineOpen', 'LineNotify']);
		expect(discovery.map((m) => m.dir)).toEqual(['agent → server']);
		expect(other.map((m) => m.msg)).toEqual(['IdentityCertify']);
	});
});
