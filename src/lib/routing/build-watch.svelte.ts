/**
 * Whether the server now serves a newer build of this app than the tab runs.
 *
 * compose stamps every page with the build it came from (a `compose-build`
 * meta) and every HTML response with the build it serves now (the
 * `X-Compose-Build` header). Asking for this page again and comparing the two
 * is the whole check. Under a dev server there is no meta, so nothing is ever
 * stale.
 */
class BuildWatch {
	/** True once the server answers with a different build than this tab's. */
	stale = $state(false);

	readonly current =
		typeof document === 'undefined'
			? ''
			: (document.querySelector<HTMLMetaElement>('meta[name="compose-build"]')?.content ?? '');

	/** Ask now. A failed request leaves `stale` as it was. */
	async check(): Promise<boolean> {
		if (!this.current || this.stale) return this.stale;
		try {
			const res = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
			const served = res.headers.get('X-Compose-Build');
			if (served && served !== this.current) this.stale = true;
		} catch {
			// Offline or mid-deploy; the next check answers.
		}
		return this.stale;
	}

	/** Check on an interval and whenever the tab is shown again; returns the teardown. */
	start(everyMs = 5 * 60_000): () => void {
		const onShow = () => {
			if (document.visibilityState === 'visible') void this.check();
		};
		const timer = setInterval(() => void this.check(), everyMs);
		document.addEventListener('visibilitychange', onShow);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onShow);
		};
	}
}

export const buildWatch = new BuildWatch();
