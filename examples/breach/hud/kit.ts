// ── breach-hud · what each side is wearing ───────────────────────────────────
// A loadout per roster class, so the table shows eight people rather than eight
// palette swaps of one.
//
// It is only a list of KEYS. Nothing here draws anything, and nothing here
// imports the Outfitter's catalogue — worn items live in the character model
// (the library's `character/wearables.ts`), so a HUD needs the key and the model does the
// rest. That is the whole payoff of moving cosmetics into the figure: the seat
// plate, the table strip and the log feed all started showing hats without one
// line of overlay code, because they were already drawing a `Figure`.
//
// The colour is NOT here on purpose: every call site already knows its seat's
// colour, and a second copy of "what colour is this side" is the one thing
// guaranteed to disagree with the flag flying beside it.

export const KIT: Record<string, string[]> = {
	maintainer: ['hat.beanie', 'emblem.chevron'],
	fixture: ['hat.hardhat', 'emblem.bars'],
	state: ['hat.beret', 'emblem.keyhole'],
	zeroday: ['hat.horns', 'emblem.skull'],
	architect: ['hat.tophat', 'emblem.crown'],
	segment: ['hat.headset', 'emblem.ring'],
	hunter: ['hat.cap', 'emblem.eye'],
	attribute: ['hat.halo', 'emblem.zero']
};

export const kitFor = (key: string): string[] => KIT[key] ?? [];
