// The maps Insider Threat can load. The first is the default; a map marked
// `dev` is offered only in a dev session.
import type { MapDef } from 'showcase';
import { STREET } from './street.js';
import { OFFICE, DOORS, type SwingDoor } from './office.js';
import { HALLOWEEN, HALLOWEEN_CUES } from './halloween.js';
import type { LocalCue } from './lighting.js';

export const MAPS: MapDef[] = [HALLOWEEN, OFFICE, STREET];

/** The cues a map fires for its own player, by map id. */
export const LOCAL_CUES: Record<string, LocalCue[]> = { [HALLOWEEN.id]: HALLOWEEN_CUES };

/** The maps dark enough to hand you a drone (insider/drone.ts). */
export const DRONE_MAPS = new Set([HALLOWEEN.id]);

/** The doors a map leaves for the scene to swing (insider/doors.ts), by map id. */
export const MAP_DOORS: Record<string, SwingDoor[]> = { [OFFICE.id]: DOORS, [HALLOWEEN.id]: DOORS };

/** A development session: the Vite dev server, or a binary whose config says
 *  `dev: true` (injected as __ARMORNET__.dev). Only these get debug tools or the
 *  dev maps; a player on the real deployment gets neither. */
export const DEV_SESSION =
	import.meta.env.DEV || (globalThis as { __ARMORNET__?: { dev?: boolean } }).__ARMORNET__?.dev === true;

/** The maps this session may pick from. */
export const OFFERED_MAPS = MAPS.filter((m) => !m.dev || DEV_SESSION);

/** The map to load for a choice, falling back to the default for an unknown
 *  id or a dev map outside a dev session. */
export const mapFor = (id: string | null) => OFFERED_MAPS.find((m) => m.id === id) ?? MAPS[0];
