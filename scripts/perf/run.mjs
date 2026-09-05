// ── perf/run — one target, one scenario, one result object ───────────────────
// No printing and no opinions. `compare.mjs` owns both.
import { chromium } from 'playwright';
import { probeSource } from './probe.js';

/** The session stub every driver in this repo uses. Without it `/` redirects to
 *  the login page, the scene never mounts, and two captures of the login page
 *  agree with each other perfectly — a comparison that passes because it is
 *  comparing two identical empty pages. */
const SESSION = {
	subject: 'p',
	org_id: 'p',
	org_name: 'P',
	org_role: 'admin',
	authenticated: true
};

/**
 * A scenario selector may be a list, and the first match wins.
 *
 * Not a convenience. Element names drift across the versions this exists to
 * compare — the marketing board's section went `#game` → `#showcase`, and the
 * hero's globe went from an SVG to a `canvas.gs` — so a single hardcoded
 * selector silently scrolls one build nowhere and then reports it as calm. A
 * list says "the thing I mean, however this build spells it", and still fails
 * loudly when no spelling matches.
 */
const asList = (v) => (Array.isArray(v) ? v : [v]);

/**
 * @param {string} baseUrl  e.g. http://127.0.0.1:5401
 * @param {object} scenario see perf-scenarios/
 * @param {object} [opts]   { gl, dom }
 */
export async function runOnce(baseUrl, scenario, opts = {}) {
	const { width, height, dpr } = scenario.viewport;
	const browser = await chromium.launch({
		args: [
			// Pinned so two targets are rendered by the same backend. Letting Chrome
			// choose means a comparison can turn on which GL backend it happened to
			// pick, which is not a property of either build.
			'--use-gl=angle',
			'--use-angle=default',
			'--enable-gpu-rasterization',
			'--ignore-gpu-blocklist',
			'--enable-precise-memory-info'
		]
	});
	try {
		const page = await browser.newPage({
			viewport: { width, height },
			// Headless Chromium reports devicePixelRatio 1, and every cost that
			// matters here scales with pixels. Without this the run measures a page
			// no user has.
			deviceScaleFactor: dpr
		});
		if (scenario.auth === 'stub-session') {
			await page.route('**/api/auth/session*', (r) =>
				r.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(SESSION)
				})
			);
		}

		await page.addInitScript(
			probeSource({ budgetMs: scenario.budgetMs, gl: !!opts.gl, dom: !!opts.dom })
		);

		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e)));

		await page.goto(baseUrl + scenario.path, { waitUntil: 'networkidle' });
		// SvelteKit's hydration navigation destroys an evaluate context mid-measure,
		// and a globe sized from `bind:clientWidth` is 0 until layout settles.
		await page.waitForTimeout(scenario.settleMs);

		if (scenario.scroll) {
			await page.evaluate((list) => {
				for (const s of list) {
					const el = document.querySelector(s);
					if (el) {
						el.scrollIntoView({ block: 'center' });
						return;
					}
				}
			}, asList(scenario.scroll));
			// The scenes gate on an IntersectionObserver with a half-screen margin;
			// measuring immediately measures a scene that has not started.
			await page.waitForTimeout(2500);
		}

		// Assert the thing under test is real and sized BEFORE believing any
		// number. A collapsed container renders a beautiful blank rectangle at a
		// beautiful frame rate.
		const canvases = await page.evaluate(() => globalThis.__perfProbe.canvases());
		const elements = await page.evaluate(() => document.querySelectorAll('*').length);
		if (scenario.expectSelector) {
			const wanted = asList(scenario.expectSelector);
			const hit = await page.evaluate(
				(list) => list.find((s) => !!document.querySelector(s)) ?? null,
				wanted
			);
			if (!hit) {
				throw new Error(
					`scenario "${scenario.name}" found none of [${wanted.join(', ')}] on ${baseUrl} — ` +
						`the page did not render what is being measured`
				);
			}
		}

		// The window opens AFTER settle, so the figure is steady state. Dividing
		// every hitch since page load by the hold time folds hydration, font swap
		// and GL init into a per-second rate for a page that stopped doing them.
		await page.evaluate(() => {
			globalThis.__perfProbe.startDom();
			globalThis.__perfProbe.reset();
		});
		await page.waitForTimeout(scenario.holdMs);

		const result = await page.evaluate(() => globalThis.__perfProbe.read());
		return { ...result, canvases, elements, errors: errors.slice(0, 5) };
	} finally {
		await browser.close();
	}
}
