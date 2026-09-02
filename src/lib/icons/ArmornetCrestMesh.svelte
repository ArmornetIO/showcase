<script lang="ts" module>
	/** The shield silhouettes this mark can be cut on. */
	export type CrestMeshShape =
		| 'crest'
		| 'crestwide'
		| 'crestsharp'
		| 'crestnotch'
		| 'crestkey'
		| 'merlon'
		| 'bastille'
		| 'crestear'
		| 'crestspur'
		| 'heater'
		| 'keel'
		| 'flared'
		| 'peaked'
		| 'notched'
		| 'bouche'
		| 'keyed'
		| 'notchspur'
		| 'clipped'
		| 'keyclip'
		| 'notchclip'
		| 'bevel'
		| 'octant'
		| 'slab'
		| 'eared'
		| 'crowned'
		| 'blade'
		| 'wedge'
		| 'spiked'
		| 'spurred';

	// Ordered soft → hard. The set is meant to be read as a run: the same shield
	// under progressively sharper treatment, not eleven unrelated badges.
	export const CREST_MESH_SHAPES: CrestMeshShape[] = [
		'crest',
		'crestwide',
		'crestsharp',
		'crestnotch',
		'crestkey',
		'merlon',
		'bastille',
		'crestear',
		'crestspur',
		'heater',
		'keel',
		'flared',
		'peaked',
		'notched',
		'bouche',
		'keyed',
		'notchspur',
		'clipped',
		'keyclip',
		'notchclip',
		'bevel',
		'octant',
		'slab',
		'eared',
		'crowned',
		'blade',
		'wedge',
		'spiked',
		'spurred'
	];


	export type Pt = readonly [number, number];

	/**
	 * The interior, lifted verbatim from `ICONS.crestlink` — the glyph the console
	 * already draws at the centre of the mesh for a control-plane node.
	 *
	 * Verbatim is the point. This mark exists to put the product's own centre
	 * object behind a shield wall, so the moment the satellites get re-placed to
	 * "fit" a silhouette it stops being that object and becomes a drawing of one.
	 * A shield that cannot take the figure at 1:1 scales the WHOLE figure (see
	 * `fit`) rather than moving any part of it.
	 *
	 * Two earlier interiors are worth recording as dead ends. Satellites on one
	 * radius at even angles is a wheel, and a wheel at logo size is a circle with
	 * texture. Satellites on seeded noise is worse: it reads as a smudge and
	 * nothing about it looks decided.
	 *
	 * One departure from crestlink: the TOP PAIR is dropped, leaving three. Five
	 * satellites fill the shield edge to edge and leave the wall nothing to
	 * enclose; three sit in the middle of it and let the shield be the shape.
	 *
	 * Everything else is crestlink's own treatment, including RINGED satellites
	 * against the one solid hub. The ring is what makes a satellite read as
	 * somewhere an edge terminates rather than as a dot on a stick, and it is the
	 * only thing distinguishing a satellite from the hub.
	 *
	 * The three that remain keep their crestlink coordinates exactly. Losing the
	 * top pair moves the figure's centre of mass down, so the whole group is
	 * shifted back up by `FIGURE_DY` — as a group, never node by node.
	 */
	export const CRESTLINK_HUB: Pt = [12, 11];
	export const CRESTLINK_HUB_R = 1.3;
	export const CRESTLINK_NODE_R = 1;
	export const CRESTLINK_NODES: readonly Pt[] = [
		[8, 14],
		[16, 14],
		[12, 16.5]
	];
	// Geometric centring reads as a gap at the top, so this overshoots it.
	// The figure is bottom-heavy (one small hub over three satellites and their
	// spokes) and the shield is top-heavy (it tapers to a point), so the two
	// optical centres sit either side of the bbox centre and the error compounds.
	const FIGURE_DY = -2.5;
	// Three dots occupy far less of the field than five did; without this the
	// figure floats in the middle of an empty shield.
	const FIGURE_SCALE = 1.15;

	/**
	 * A shield outline as segments rather than a `d` string.
	 *
	 * Both walls come off this one declaration: `outlinePath` emits the true
	 * curve, `outlinePoly` samples it so the mitre can offset it into the inner
	 * wall. Hand-cutting a second curve per shield is how the two contours drift
	 * apart the moment a silhouette gets tuned, and a shield whose inset is off by
	 * a hair reads as a printing fault.
	 */
	export type Seg = { to: Pt } | { c1: Pt; c2: Pt; to: Pt };

	export interface ShapeDef {
		start: Pt;
		segs: readonly Seg[];
		/**
		 * `[scale, dy]` for the crestlink figure, about (12,12). Uniform only — a
		 * non-uniform fit would distort the one thing that has to stay itself.
		 * Every shield in this set takes the figure at 1:1; the hook stays because
		 * the next one might not.
		 */
		fit?: readonly [number, number];
	}

	// Every shield lives in the same 24 box, is symmetric on x=12, and is a
	// SHIELD — a heraldic silhouette a viewer names on sight. An earlier set went
	// exploring (hexagons, ziggurats, split fangs); interesting shapes, but they
	// stopped reading as armour, which is the one thing the mark has to say.
	export const CREST_MESH_GEOMETRY: Record<CrestMeshShape, ShapeDef> = {
		// The shipped crest's own wall — peaked crown, straight flanks, long sweep
		// to a soft point. The baseline.
		crest: {
			start: [12, 2.1],
			segs: [
				{ to: [20.1, 5.3] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 5.3] }
			]
		},
		// ── The crest family ─────────────────────────────────────────────────
		// All of these keep crest's three defining moves: a crown of two STRAIGHT
		// diagonals (not a bow, and not a flat top), flanks that run dead vertical
		// for a third of the height, and one long sweep to a soft point. Only the
		// crown treatment changes. That shared body is why they read as one house
		// rather than as more options.
		//
		// The crown line is y = 2.1 + 0.395·|x−12|; every peak, tower and notch
		// below is placed ON it, which is what keeps the family coherent.

		// Crest at a shallower crown and a slightly wider body — the quiet sibling.
		crestwide: {
			start: [12, 3],
			segs: [
				{ to: [20.4, 5.6] },
				{ to: [20.4, 12.9] },
				{ c1: [20.4, 17.4], c2: [16.9, 20.6], to: [12, 21.9] },
				{ c1: [7.1, 20.6], c2: [3.6, 17.4], to: [3.6, 12.9] },
				{ to: [3.6, 5.6] }
			]
		},
		// Crest with the crown driven up and the shoulders dropped — the same
		// shield, read as taller.
		crestsharp: {
			start: [12, 1.6],
			segs: [
				{ to: [20.1, 6] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 6] }
			]
		},
		// The peak split by a V. Two peaklets sit ON the crown line, so the notch
		// reads as taken OUT of the crest rather than as a different crown.
		crestnotch: {
			start: [12, 4.5],
			segs: [
				{ to: [13.9, 2.85] },
				{ to: [20.1, 5.3] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 5.3] },
				{ to: [10.1, 2.85] }
			]
		},
		// The peak split by a square slot instead of a V — crest crossed with
		// keyed. The slot bottom cannot go below ~4.6: its two inner corners are
		// right angles, so they mitre 1.48 down, and the hub is under them.
		crestkey: {
			start: [10.4, 2.73],
			segs: [
				{ to: [10.4, 4.6] },
				{ to: [13.6, 4.6] },
				{ to: [13.6, 2.73] },
				{ to: [20.1, 5.3] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 5.3] }
			]
		},
		// Battlements on a crest body. The crown goes flat to carry them — merlons
		// stepped along a diagonal read as a staircase, not as a wall.
		merlon: {
			start: [6.4, 3],
			segs: [
				{ to: [8.6, 3] },
				{ to: [8.6, 4.5] },
				{ to: [10, 4.5] },
				{ to: [10, 3] },
				{ to: [14, 3] },
				{ to: [14, 4.5] },
				{ to: [15.4, 4.5] },
				{ to: [15.4, 3] },
				{ to: [17.6, 3] },
				{ to: [20.1, 5.3] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 5.3] }
			]
		},
		// Square towers at the shoulders, flanking the crest's own peak.
		//
		// Two things decide whether this reads as a skyline or as one wide notch:
		// the towers have to clear the peak (level with it, the peak becomes a bump
		// between two blocks), and their inner edge has to come well in from the
		// shoulder — leave the full diagonal exposed and the gap either side of the
		// peak swallows the towers whole.
		bastille: {
			start: [12, 2.1],
			segs: [
				{ to: [16, 3.68] },
				{ to: [16, 1.5] },
				{ to: [20.1, 1.5] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 1.5] },
				{ to: [8, 1.5] },
				{ to: [8, 3.68] }
			]
		},
		// Horns thrown off the shoulders where the crown meets the flank. Stubby on
		// purpose — carried any further out they stop being horns on a shield and
		// turn into two slivers with a shield behind them.
		crestear: {
			start: [12, 2.1],
			segs: [
				{ to: [18.4, 4.63] },
				{ to: [20.9, 3.9] },
				{ to: [20.1, 6] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 17.4], c2: [16.7, 20.5], to: [12, 21.9] },
				{ c1: [7.3, 20.5], c2: [3.9, 17.4], to: [3.9, 12.9] },
				{ to: [3.9, 6] },
				{ to: [3.1, 3.9] },
				{ to: [5.6, 4.63] }
			]
		},
		// Crest with the sweep stopped short and a spur dropped below it.
		crestspur: {
			start: [12, 2.1],
			segs: [
				{ to: [20.1, 5.3] },
				{ to: [20.1, 12.9] },
				{ c1: [20.1, 16.8], c2: [17.2, 19.4], to: [13.2, 20.5] },
				{ to: [12, 22.1] },
				{ to: [10.8, 20.5] },
				{ c1: [6.8, 19.4], c2: [3.9, 16.8], to: [3.9, 12.9] },
				{ to: [3.9, 5.3] }
			]
		},
		// The plain heater: shallow top, straight flanks, curved sweep to a point.
		// The one everybody draws, and the control the others are judged against.
		heater: {
			start: [12, 3],
			segs: [
				{ c1: [15.4, 3], c2: [18.2, 3.1], to: [19.8, 3.4] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 3.4] },
				{ c1: [5.8, 3.1], c2: [8.6, 3], to: [12, 3] }
			]
		},
		// Keel: round-bottomed, no point at all. The only shield here that varies the
		// BOTTOM rather than the top, which is why it earns a slot — every other
		// silhouette in the set is decided above the waist.
		keel: {
			start: [12, 3],
			segs: [
				{ c1: [15.4, 3], c2: [18.2, 3.1], to: [19.8, 3.4] },
				{ to: [19.8, 12.6] },
				{ c1: [19.8, 18.2], c2: [16.6, 21.4], to: [12, 21.4] },
				{ c1: [7.4, 21.4], c2: [4.2, 18.2], to: [4.2, 12.6] },
				{ to: [4.2, 3.4] },
				{ c1: [5.8, 3.1], c2: [8.6, 3], to: [12, 3] }
			]
		},
		// Flared: the flanks swell past the shoulders and draw back in, so the
		// widest line is below the top edge rather than on it. The bell has to stay
		// wide down to the waist — pinch it early and the figure runs out of room.
		flared: {
			start: [12, 3.2],
			segs: [
				{ c1: [15.4, 3.2], c2: [18.6, 3.6], to: [20.4, 5.4] },
				{ c1: [20.9, 9], c2: [20.5, 12], to: [19.8, 14.4] },
				{ c1: [18.2, 17.4], c2: [15, 19.9], to: [12, 21.6] },
				{ c1: [9, 19.9], c2: [5.8, 17.4], to: [4.2, 14.4] },
				{ c1: [3.5, 12], c2: [3.1, 9], to: [3.6, 5.4] },
				{ c1: [5.4, 3.6], c2: [8.6, 3.2], to: [12, 3.2] }
			]
		},
		// Notched: the heraldic bouche — a small V cut out of the top edge. It was
		// a real lance rest, which is why it reads as armour and not as damage.
		notched: {
			start: [12, 4.6],
			segs: [
				{ to: [13.6, 3.2] },
				{ c1: [16, 3.05], c2: [18.3, 3.15], to: [19.8, 3.4] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 3.4] },
				{ c1: [5.7, 3.15], c2: [8, 3.05], to: [10.4, 3.2] }
			]
		},
		// Bouche: the same lance rest cut wide and shallow instead of deep. Two
		// notches this far apart in proportion do not read as the same idea twice.
		bouche: {
			start: [12, 4.2],
			segs: [
				{ to: [14.6, 3.2] },
				{ c1: [16.6, 3.1], c2: [18.4, 3.2], to: [19.8, 3.4] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 3.4] },
				{ c1: [5.6, 3.2], c2: [7.4, 3.1], to: [9.4, 3.2] }
			]
		},
		// Keyed: a square slot where the bouche is a V. The slot cannot go much
		// deeper than this — its two inner corners mitre a full 1.48 down, and the
		// hub is directly beneath them.
		keyed: {
			start: [10.6, 2.9],
			segs: [
				{ to: [10.6, 4.6] },
				{ to: [13.4, 4.6] },
				{ to: [13.4, 2.9] },
				{ c1: [16, 2.9], c2: [18.3, 3.05], to: [19.8, 3.3] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 3.3] },
				{ c1: [5.7, 3.05], c2: [8, 2.9], to: [10.6, 2.9] }
			]
		},
		// Notched top, spurred bottom — the notch answered at the other end.
		notchspur: {
			start: [12, 4.6],
			segs: [
				{ to: [13.6, 3.2] },
				{ c1: [16, 3.05], c2: [18.3, 3.15], to: [19.8, 3.4] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 15.6], c2: [16.8, 18.6], to: [13.2, 19.8] },
				{ to: [12, 21.9] },
				{ to: [10.8, 19.8] },
				{ c1: [7.2, 18.6], c2: [4.2, 15.6], to: [4.2, 11.4] },
				{ to: [4.2, 3.4] },
				{ c1: [5.7, 3.15], c2: [8, 3.05], to: [10.4, 3.2] }
			]
		},
		// Clipped: flat top with both corners taken off at 45°. The quietest
		// geometric move in the set — no points, no notch, just a bevel.
		clipped: {
			start: [12, 2.8],
			segs: [
				{ to: [17.4, 2.8] },
				{ to: [19.8, 5.2] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 5.2] },
				{ to: [6.6, 2.8] }
			]
		},
		// Crowned: eared, plus a centre peak — three points across the top, cut
		// straight so the crown reads as one decision rather than two stacked.
		crowned: {
			start: [12, 2.2],
			segs: [
				{ to: [14.8, 4.2] },
				{ to: [18.6, 3.3] },
				{ to: [20.2, 1.8] },
				{ to: [19.6, 5.4] },
				{ to: [19.6, 11.6] },
				{ c1: [19.6, 16], c2: [16.3, 19.6], to: [12, 21.6] },
				{ c1: [7.7, 19.6], c2: [4.4, 16], to: [4.4, 11.6] },
				{ to: [4.4, 5.4] },
				{ to: [3.8, 1.8] },
				{ to: [5.4, 3.3] },
				{ to: [9.2, 4.2] }
			]
		},
		// Keyed slot on a clipped top — the two favourites in one cut.
		keyclip: {
			start: [10.6, 3],
			segs: [
				{ to: [10.6, 4.7] },
				{ to: [13.4, 4.7] },
				{ to: [13.4, 3] },
				{ to: [17.4, 3] },
				{ to: [19.8, 5.4] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 5.4] },
				{ to: [6.6, 3] }
			]
		},
		// V notch on a clipped top — the softer half of the same pairing.
		notchclip: {
			start: [12, 4.4],
			segs: [
				{ to: [13.5, 3] },
				{ to: [17.4, 3] },
				{ to: [19.8, 5.4] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 5.4] },
				{ to: [6.6, 3] },
				{ to: [10.5, 3] }
			]
		},
		// Bevel: clipped, but the chamfers run far enough in that the top edge
		// becomes the short side and the shield reads octagonal.
		bevel: {
			start: [12, 2.6],
			segs: [
				{ to: [15.4, 2.6] },
				{ to: [19.8, 7] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 7] },
				{ to: [8.6, 2.6] }
			]
		},
		// Octant: chamfered at the corners AND at the waist. The waist cut has to
		// stay below y≈12 — take it higher and it eats the side satellites.
		octant: {
			start: [12, 2.8],
			segs: [
				{ to: [17.4, 2.8] },
				{ to: [19.8, 5.2] },
				{ to: [19.8, 11.8] },
				{ to: [19, 14.4] },
				{ c1: [17.4, 17.2], c2: [14.8, 19.8], to: [12, 21.6] },
				{ c1: [9.2, 19.8], c2: [6.6, 17.2], to: [5, 14.4] },
				{ to: [4.2, 11.8] },
				{ to: [4.2, 5.2] },
				{ to: [6.6, 2.8] }
			]
		},
		// Slab: chamfered top, chamfered flat base. No point at either end, which
		// makes it the one shape in the set that will sit in a row of type.
		slab: {
			start: [12, 2.8],
			segs: [
				{ to: [17.4, 2.8] },
				{ to: [19.8, 5.2] },
				{ to: [19.8, 15.4] },
				{ to: [16.4, 20.4] },
				{ to: [7.6, 20.4] },
				{ to: [4.2, 15.4] },
				{ to: [4.2, 5.2] },
				{ to: [6.6, 2.8] }
			]
		},
		// Eared: the heater with a small sharp point drawn up out of each top
		// corner. The top edge stays near-flat and the ear is SHORT — sweeping the
		// whole edge up into the corners instead turns the top into one broad
		// scoop, which reads as a chalice, not as ears.
		eared: {
			start: [12, 3.4],
			segs: [
				{ c1: [14.6, 3.4], c2: [17, 3.3], to: [18.6, 3.2] },
				{ to: [20.2, 1.6] },
				{ to: [19.6, 5.2] },
				{ to: [19.6, 11.6] },
				{ c1: [19.6, 16], c2: [16.3, 19.6], to: [12, 21.6] },
				{ c1: [7.7, 19.6], c2: [4.4, 16], to: [4.4, 11.6] },
				{ to: [4.4, 5.2] },
				{ to: [3.8, 1.6] },
				{ to: [5.4, 3.2] },
				{ c1: [7, 3.3], c2: [9.4, 3.4], to: [12, 3.4] }
			]
		},
		// Peaked: the heater with a single centre point instead of a flat top. The
		// quietest way to stop a shield reading as generic.
		peaked: {
			start: [12, 2.4],
			segs: [
				{ c1: [14.8, 3.2], c2: [17.6, 3.5], to: [19.8, 3.6] },
				{ to: [19.8, 11.4] },
				{ c1: [19.8, 16], c2: [16.4, 19.6], to: [12, 21.6] },
				{ c1: [7.6, 19.6], c2: [4.2, 16], to: [4.2, 11.4] },
				{ to: [4.2, 3.6] },
				{ c1: [6.4, 3.5], c2: [9.2, 3.2], to: [12, 2.4] }
			]
		},
		// Blade: clipped, then every remaining edge straightened. The chamfer is
		// the only thing separating it from spiked's horns.
		blade: {
			start: [12, 2.8],
			segs: [
				{ to: [17.4, 2.8] },
				{ to: [19.8, 5.2] },
				{ to: [19.8, 11.8] },
				{ to: [12, 21.8] },
				{ to: [4.2, 11.8] },
				{ to: [4.2, 5.2] },
				{ to: [6.6, 2.8] }
			]
		},
		// Wedge: clipped top, and the flanks converge from there all the way down.
		// They have to start wider than the others to clear the satellites before
		// the taper closes on them.
		wedge: {
			start: [12, 2.8],
			segs: [
				{ to: [18.2, 2.8] },
				{ to: [20.6, 5.2] },
				{ to: [19, 15.6] },
				{ to: [12, 21.8] },
				{ to: [5, 15.6] },
				{ to: [3.4, 5.2] },
				{ to: [5.8, 2.8] }
			]
		},
		// Spiked: every edge straight, and the top run climbs out to a hard horn at
		// each corner. No curve anywhere — the others are drawn, this one is cut,
		// which is the whole difference in read.
		spiked: {
			start: [12, 4.4],
			segs: [
				{ to: [20.4, 1.8] },
				{ to: [19.8, 6.2] },
				{ to: [19.8, 12.6] },
				{ to: [12, 21.8] },
				{ to: [4.2, 12.6] },
				{ to: [4.2, 6.2] },
				{ to: [3.6, 1.8] }
			]
		},
		// Spurred: eared, and the bottom sweep stops short so a small spur drops
		// below it. Same move top and bottom, which is what keeps it a shield
		// rather than a shield with something stuck on.
		spurred: {
			start: [12, 3.4],
			segs: [
				{ c1: [14.6, 3.4], c2: [17, 3.3], to: [18.6, 3.2] },
				{ to: [20.2, 1.6] },
				{ to: [19.6, 5.2] },
				{ to: [19.6, 11.6] },
				{ c1: [19.6, 15.6], c2: [16.8, 18.6], to: [13.2, 19.8] },
				{ to: [12, 21.9] },
				{ to: [10.8, 19.8] },
				{ c1: [7.2, 18.6], c2: [4.4, 15.6], to: [4.4, 11.6] },
				{ to: [4.4, 5.2] },
				{ to: [3.8, 1.6] },
				{ to: [5.4, 3.2] },
				{ c1: [7, 3.3], c2: [9.4, 3.4], to: [12, 3.4] }
			]
		}
	};

	const f = (v: number) => Math.round(v * 100) / 100;
	const xy = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

	export function outlinePath(g: ShapeDef): string {
		const body = g.segs
			.map((s) => ('c1' in s ? `C${xy(s.c1)} ${xy(s.c2)} ${xy(s.to)}` : `L${xy(s.to)}`))
			.join(' ');
		return `M${xy(g.start)} ${body} Z`;
	}

	/** Sample a cubic, excluding its start so runs concatenate without doubling. */
	function cubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, steps: number): Pt[] {
		const out: Pt[] = [];
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const u = 1 - t;
			const a = u * u * u;
			const b = 3 * u * u * t;
			const c = 3 * u * t * t;
			const d = t * t * t;
			out.push([
				a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
				a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]
			]);
		}
		return out;
	}

	/** The outline as a polygon. 12 steps a curve keeps the facets sub-pixel. */
	export function outlinePoly(g: ShapeDef, steps = 12): Pt[] {
		const pts: Pt[] = [g.start];
		let at = g.start;
		for (const s of g.segs) {
			if ('c1' in s) pts.push(...cubic(at, s.c1, s.c2, s.to, steps));
			else pts.push(s.to);
			at = s.to;
		}
		// A closing segment back to the start would duplicate it; drop the repeat.
		if (pts.length > 1) {
			const last = pts[pts.length - 1];
			if (last[0] === g.start[0] && last[1] === g.start[1]) pts.pop();
		}
		return pts;
	}

	/**
	 * Offset a clockwise polygon inward by `t`, vertex by vertex along the angle
	 * bisector, so the result is a true parallel wall.
	 *
	 * Scaling the outline about a centre is the obvious shortcut and it is wrong:
	 * it insets the top and the bottom by different amounts on anything taller
	 * than it is wide, and on a pointed shield the two contours visibly diverge at
	 * the tip. Mitring costs a dozen lines and holds for every shape.
	 */
	export function insetPoints(p: readonly Pt[], t: number): Pt[] {
		const len = p.length;
		// Inward normal of edge i → i+1. Clockwise in SVG's y-down space means the
		// interior is to the (-dy, dx) side.
		const nrm = p.map((_, i) => {
			const [x1, y1] = p[i];
			const [x2, y2] = p[(i + 1) % len];
			const dx = x2 - x1;
			const dy = y2 - y1;
			const L = Math.hypot(dx, dy) || 1;
			return [-dy / L, dx / L] as const;
		});
		return p.map(([x, y], i) => {
			const a = nrm[(i - 1 + len) % len];
			const b = nrm[i];
			// The mitre: the one point sitting `t` from BOTH adjacent edges.
			const k = 1 + (a[0] * b[0] + a[1] * b[1]);
			if (k < 1e-3) return [x, y] as const; // degenerate spike — leave it
			return [x + (t * (a[0] + b[0])) / k, y + (t * (a[1] + b[1])) / k] as const;
		});
	}

	export const insetPolygon = (p: readonly Pt[], t: number) =>
		`M${insetPoints(p, t).map(xy).join(' L')} Z`;

	/**
	 * Hub → every satellite, stopped ON the ring instead of run through to the
	 * satellite's centre.
	 *
	 * crestlink itself draws the spoke to the centre, and at console scale that is
	 * fine. As a logo it is not: the stub inside the ring fills the one counter
	 * the figure has, and at favicon size the satellite silts up into a bullseye
	 * dot indistinguishable from the hub. Ending the spoke on the ring leaves all
	 * three circles open, so the ring keeps reading as a place an edge ARRIVES at
	 * rather than as a dot someone drew a circle around.
	 *
	 * The trim lands on the ring's centreline, not outside it — the cap is then
	 * covered by the ring's own stroke and the join is seamless. Stopping short of
	 * the ring instead leaves a visible hairline gap at large sizes.
	 */
	export const CRESTLINK_SPOKES = CRESTLINK_NODES.map((n) => {
		const dx = n[0] - CRESTLINK_HUB[0];
		const dy = n[1] - CRESTLINK_HUB[1];
		const L = Math.hypot(dx, dy) || 1;
		const end: Pt = [
			n[0] - (dx / L) * CRESTLINK_NODE_R,
			n[1] - (dy / L) * CRESTLINK_NODE_R
		];
		return `M${xy(CRESTLINK_HUB)} L${xy(end)}`;
	}).join('');

	/**
	 * Where the crestlink figure sits inside a given shield: uniform scale `k`
	 * and an offset. One source, because two consumers need it in two forms —
	 * the line mark wants an SVG transform, the chrome cut wants real coordinates
	 * to hang tubes and ball joints off. Deriving the placement twice is how they
	 * would end up drawing two different logos.
	 */
	function figureFit(g: ShapeDef) {
		const [fk, dy] = g.fit ?? [1, 0];
		const k = fk * FIGURE_SCALE;
		return { k, tx: 12 - 12 * k, ty: 12 - 12 * k + dy + FIGURE_DY };
	}

	export function fitTransform(g: ShapeDef): string {
		const { k, tx, ty } = figureFit(g);
		return `translate(${f(tx)} ${f(ty)}) scale(${k})`;
	}

	export interface PlacedFigure {
		hub: Pt;
		nodes: Pt[];
		hubR: number;
		nodeR: number;
	}

	/** The same placement as `fitTransform`, resolved to coordinates. */
	export function placeFigure(g: ShapeDef): PlacedFigure {
		const { k, tx, ty } = figureFit(g);
		const at = ([x, y]: Pt): Pt => [k * x + tx, k * y + ty];
		return {
			hub: at(CRESTLINK_HUB),
			nodes: CRESTLINK_NODES.map(at),
			hubR: CRESTLINK_HUB_R * k,
			nodeR: CRESTLINK_NODE_R * k
		};
	}

	/** First hit of the ray `o + t·d`, t > 0, against a closed polygon. */
	export function rayHit(o: Pt, d: Pt, poly: readonly Pt[]): Pt {
		let best = Infinity;
		let hit: Pt = o;
		for (let i = 0; i < poly.length; i++) {
			const a = poly[i];
			const b = poly[(i + 1) % poly.length];
			const ex = b[0] - a[0];
			const ey = b[1] - a[1];
			const den = d[0] * ey - d[1] * ex;
			if (Math.abs(den) < 1e-9) continue;
			const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
			const u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
			if (t > 1e-6 && u >= 0 && u <= 1 && t < best) {
				best = t;
				hit = [o[0] + d[0] * t, o[1] + d[1] * t];
			}
		}
		return hit;
	}
</script>

<script lang="ts">
	/**
	 * Armornet crest, mesh cut — the shield with the console's mesh centre in it.
	 *
	 * The interior is `ICONS.crestlink`: a solid hub, straight spokes, ringed
	 * satellites, all at one weight. Which shield it sits behind is what this
	 * component is for choosing, so the figure stays fixed and only the wall
	 * around it varies.
	 *
	 * `variant="filled"` inverts the mark: the shield becomes a solid and the
	 * figure is KNOCKED OUT of it rather than drawn in a second colour. Painting
	 * the figure in a background colour would pin the mark to one background;
	 * knocking it out lets whatever is behind show through, so the inverse works
	 * on a photo, a card, or a favicon without a second asset.
	 *
	 * Two rules hold whatever the interior becomes:
	 *
	 * · The wall and the figure share ONE weight, as crestlink does. Draw the
	 *   interior finer than the wall and the mark turns into a silhouette with a
	 *   smudge in it — the shield does all the work and the figure reads as fill.
	 * · The inner wall is MITRED off the outer, and both come off one segment
	 *   list, so the two contours cannot disagree about the silhouette.
	 *
	 * Sibling marks: `ArmornetCrest.svelte` (the A monogram, shipped brand mark)
	 * and `ArmornetCrestHub.svelte` (the A spelled out of hub-and-spoke).
	 */
	interface CrestMeshProps {
		size?: number;
		/** Brand colour of the whole mark. */
		color?: string;
		/** Overrides the interior only. Defaults to `color` — the mark is monochrome. */
		meshColor?: string;
		/** Which shield the crestlink figure is cut into. */
		shape?: CrestMeshShape;
		/**
		 * 'outline' draws the mark in line; 'filled' inverts it — a solid shield
		 * with the figure punched through to whatever is behind.
		 */
		variant?: 'outline' | 'filled';
		/** The hairline wall inside the shield — depth. Drop it below ~32px. */
		innerWall?: boolean;
		/** Blurred underlay behind the mark — atmosphere, not structure. */
		glow?: boolean;
		title?: string;
		class?: string;
		style?: string;
	}

	let {
		size = 64,
		color = 'var(--accent)',
		meshColor,
		shape = 'crest',
		variant = 'outline',
		innerWall = true,
		glow = true,
		title = 'Armornet',
		class: cls = '',
		style = ''
	}: CrestMeshProps = $props();

	const ink = $derived(meshColor ?? color);
	const g = $derived(CREST_MESH_GEOMETRY[shape]);

	// Scoped so several marks can share a page without their defs colliding.
	const uid = $props.id();
	const haloId = `cmesh-halo-${uid}`;
	const markId = `cmesh-mark-${uid}`;
	const cutId = `cmesh-cut-${uid}`;

	const WALL_W = 0.5;
	const outline = $derived(outlinePath(g));
	const inner = $derived(insetPolygon(outlinePoly(g), 1.05));
	const fit = $derived(fitTransform(g));
</script>

<svg
	class="crest {cls}"
	{style}
	width={size}
	height={size}
	viewBox="-1 -1 26 26"
	role="img"
	aria-label={title}
>
	<title>{title}</title>

	<defs>
		<filter id={haloId} x="-45%" y="-45%" width="190%" height="190%">
			<feGaussianBlur stdDeviation="0.7" />
		</filter>

		{#if variant === 'filled'}
			<!-- White keeps, black cuts. The satellites are stroked with NO fill so
			     each one cuts a ring and leaves its own centre solid — the same
			     hollow dot the outline variant draws, read the other way round. -->
			<mask id={cutId} maskUnits="userSpaceOnUse" x="-1" y="-1" width="26" height="26">
				<rect x="-1" y="-1" width="26" height="26" fill="#fff" />
				{#if innerWall}
					<path d={inner} fill="none" stroke="#000" stroke-width="0.4" />
				{/if}
				<g
					transform={fit}
					fill="none"
					stroke="#000"
					stroke-width={WALL_W}
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d={CRESTLINK_SPOKES} />
					{#each CRESTLINK_NODES as [cx, cy] (cx + ':' + cy)}
						<circle {cx} {cy} r={CRESTLINK_NODE_R} />
					{/each}
					<circle cx={CRESTLINK_HUB[0]} cy={CRESTLINK_HUB[1]} r={CRESTLINK_HUB_R} fill="#000" />
				</g>
			</mask>
		{/if}

		<g id={markId} fill="none" stroke={color} stroke-linecap="round" stroke-linejoin="round">
			{#if variant === 'filled'}
				<path d={outline} fill={color} stroke-width={WALL_W} mask="url(#{cutId})" />
			{:else}
				<path d={outline} stroke-width={WALL_W} />
				{#if innerWall}
					<path d={inner} stroke-width="0.18" stroke-opacity="0.45" />
				{/if}

				<g transform={fit} stroke={ink} stroke-width={WALL_W}>
					<path d={CRESTLINK_SPOKES} />
					<!-- Ringed, as crestlink draws them: a satellite is somewhere an edge
					     terminates, and the ring is the only thing telling it from the hub. -->
					{#each CRESTLINK_NODES as [cx, cy] (cx + ':' + cy)}
						<circle {cx} {cy} r={CRESTLINK_NODE_R} />
					{/each}
					<circle
						cx={CRESTLINK_HUB[0]}
						cy={CRESTLINK_HUB[1]}
						r={CRESTLINK_HUB_R}
						fill={ink}
						stroke="none"
					/>
				</g>
			{/if}
		</g>
	</defs>

	{#if glow}
		<use href="#{markId}" filter="url(#{haloId})" opacity="0.5" />
	{/if}
	<use href="#{markId}" />
</svg>

<style>
	.crest {
		display: inline-block;
		flex-shrink: 0;
		vertical-align: middle;
	}
</style>
