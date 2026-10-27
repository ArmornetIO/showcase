// One console per page.
//
// The framework injects a console into every app in development; some apps also
// mount their own, carrying host tool groups the injected one cannot — a group
// body is a snippet, and a snippet from the app's Svelte runtime cannot render
// in the bundle's. So the app's console wins, and the injected one stands down
// while any app console is mounted.
//
// Coordinated through the document because the two consoles are separate
// bundles with nothing in common but it.
//
// An app that mounts its own console should also DECLARE it in its HTML with
// `<meta name="devcog" content="app">`. Its console usually mounts well after
// the injected one's script runs (lazily, after hydration), and without the
// declaration the page shows the framework console first and then swaps.

const ATTR = 'data-devcog-app';
const DECLARED = 'meta[name="devcog"][content="app"]';

/** Marks the page as having an app-mounted console. Returns the release. */
export function claimPage(): () => void {
	const el = document.documentElement;
	el.setAttribute(ATTR, String(Number(el.getAttribute(ATTR) ?? 0) + 1));
	let released = false;
	return () => {
		if (released) return;
		released = true;
		const n = Number(el.getAttribute(ATTR) ?? 1) - 1;
		if (n > 0) el.setAttribute(ATTR, String(n));
		else el.removeAttribute(ATTR);
	};
}

export function appOwnsPage(): boolean {
	return document.documentElement.hasAttribute(ATTR) || document.querySelector(DECLARED) !== null;
}

/** Calls back whenever app ownership may have changed. Returns the stop. */
export function watchOwnership(onChange: (appOwns: boolean) => void): () => void {
	const obs = new MutationObserver(() => onChange(appOwnsPage()));
	obs.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });
	return () => obs.disconnect();
}
