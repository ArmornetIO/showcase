// ── Skills, as glyphs ────────────────────────────────────────────────────────
// A skill is a picture and a number. `SOC +3` makes a player read two tokens
// and translate one of them; a mouth with a `+3` next to it is read at the speed
// of seeing. The words survive in the tooltip for the one time somebody needs
// them, and nowhere else.
import type { IconName } from 'showcase';
import type { Skill } from '../internal/rules.js';

export const SKILL_GLYPH: Record<Skill, IconName> = {
	social: 'users',
	tech: 'cpu',
	opsec: 'eye-off',
	analysis: 'radar'
};
