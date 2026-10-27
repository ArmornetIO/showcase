// ── What the office's windows look out on ────────────────────────────────────
// Each is a `MapSky` (game/map.ts): one of sky-gl's views with its tones. A map
// lists the ones a match may get and the match's `scenery` picks one, so every
// seat sees the same. A new sky is an entry here and a place in a map's list.
import type { MapSky } from 'showcase';

/** 110 floors of 4.2m. */
const ALTITUDE = 110 * 4.2;

const NIGHT = {
	zenith: ['--bg', '--palette-blue', 0.2],
	horizon: ['--palette-violet', '--bg', 0.6],
	haze: ['--palette-amber', '--bg', 0.75]
} satisfies Partial<MapSky>;

const DAY: NonNullable<MapSky['day']> = {
	zenith: ['--palette-blue', '--palette-sky', 0.45],
	horizon: ['--palette-sky', '--fg', 0.5],
	haze: ['--palette-sky', '--fg', 0.6],
	facade: ['--palette-slate', '--fg', 0.3],
	sun: ['--palette-amber', '--fg', 0.4]
};

export const SKIES = {
	/** The city 110 floors down, at whatever hour it is where you are. */
	city: {
		view: 'city',
		altitude: ALTITUDE,
		...NIGHT,
		facade: ['--bg', '--palette-slate', 0.25],
		windows: [['--palette-amber', '--fg', 0.4], ['--fg', '--palette-sky', 0.3], '--palette-yellow'],
		street: '--palette-amber',
		lit: 0.45,
		moon: { tone: ['--fg', '--palette-amber', 0.1], yaw: 2.4, el: 0.35, size: 0.025 },
		time: 'adaptive',
		day: DAY
	},
	/** The next tower, close enough to touch: brick across a light well, its
	 *  own windows lit, and a strip of the hour's sky above it. */
	brick: {
		view: 'brick',
		altitude: ALTITUDE,
		...NIGHT,
		facade: ['--palette-red', '--bg', 0.5],
		windows: [['--palette-amber', '--fg', 0.3], ['--palette-yellow', '--bg', 0.2], ['--fg', '--palette-sky', 0.3]],
		street: ['--fg', '--palette-amber', 0.15],
		lit: 0.35,
		time: 'adaptive',
		day: { ...DAY, facade: ['--palette-red', '--palette-amber', 0.35] }
	},
	/** More office: a corridor round ours, the same shop lights and carpet,
	 *  doors to rooms nobody has a badge for. No hour: it has no outside. */
	hall: {
		view: 'hall',
		altitude: 0,
		zenith: '--bg',
		horizon: '--bg',
		haze: '--bg',
		facade: ['--border-strong', '--bg-elev', 0.55],
		windows: [['--palette-amber', '--bg', 0.45], ['--bg-elev', '--palette-slate', 0.12], '--fg'],
		street: ['--fg', '--palette-amber', 0.1],
		lit: 0
	},
	/** The city on the 31st, always at night: a harvest moon low over the
	 *  south-east, bats across it, the towers burning orange and green,
	 *  lightning far off. */
	haunted: {
		view: 'city',
		altitude: ALTITUDE,
		zenith: ['--bg', '--palette-purple', 0.22],
		horizon: ['--palette-orange', '--bg', 0.62],
		haze: ['--palette-purple', '--bg', 0.6],
		facade: ['--bg', '--palette-purple', 0.12],
		windows: ['--palette-orange', ['--palette-green', '--bg', 0.2], ['--palette-yellow', '--palette-orange', 0.4]],
		street: ['--palette-orange', '--palette-amber', 0.5],
		lit: 0.32,
		moon: { tone: ['--palette-orange', '--palette-yellow', 0.35], yaw: 2.5, el: 0.16, size: 0.075 },
		haunted: true
	}
} satisfies Record<string, MapSky>;
