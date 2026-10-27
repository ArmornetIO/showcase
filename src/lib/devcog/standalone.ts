// The framework's console: what compose injects into every page in development,
// so an app that never mounted <DevCog> still has one. Built on its own into
// compose/devcog (see its vite.config.ts), never imported by an app.
//
// It lives in a shadow root. The page is somebody else's — any app, any
// stylesheet — so neither side may style the other. The design tokens come in
// with it, rescoped from :root to the shadow host; the one thing that does not
// carry over is the page's theme attribute, so this console is always the
// default theme.
import { mount, unmount } from 'svelte';
import DevCog from './DevCog.svelte';
import { DEVCOG_ATTR } from './qa/nits.svelte.js';
import { appOwnsPage, watchOwnership } from './presence.js';
import tokens from '../tokens.css?raw';

// A page can reach this script twice — two injectors, or an app that also
// loads it — and two framework consoles would share one cookie and one set of
// keyboard handlers.
const BOOTED = Symbol.for('compose.devcog');

// Inherited text styles from the page stop at the host; the tokens do not,
// which is why they are declared here rather than inherited.
const HOST_RESET = ':host { all: initial; color: var(--fg); font-family: var(--sans); }';

function shadowSheet(css: string): string {
	// @import would be fetched relative to the page, which serves none of them.
	return css.replace(/@import[^;]*;/g, '').replaceAll(':root', ':host') + '\n' + HOST_RESET;
}

function boot(): void {
	const host = document.createElement('div');
	// The element inspector skips anything carrying this; clicks inside a
	// shadow root retarget to its host, so marking the host covers all of it.
	host.setAttribute(DEVCOG_ATTR, '');
	const shadow = host.attachShadow({ mode: 'open' });
	const style = document.createElement('style');
	style.textContent = shadowSheet(tokens);
	const target = document.createElement('div');
	shadow.append(style, target);

	let cog: ReturnType<typeof mount> | undefined;
	const sync = (appOwns: boolean) => {
		if (appOwns && cog) {
			void unmount(cog);
			cog = undefined;
			host.remove();
		} else if (!appOwns && !cog) {
			document.body.append(host);
			cog = mount(DevCog, { target, props: { injected: true } });
		}
	};
	sync(appOwnsPage());
	watchOwnership(sync);
}

const w = window as unknown as Record<symbol, boolean>;
if (!w[BOOTED]) {
	w[BOOTED] = true;
	boot();
}
