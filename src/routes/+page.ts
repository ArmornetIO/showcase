import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

// Design Patterns is the entry point: the rules come before the parts. The
// component index that used to live here moved to /overview and keeps its
// sidebar entry, so the brand link still lands somewhere real.
export const load = () => {
	redirect(307, `${base}/design-patterns`);
};
