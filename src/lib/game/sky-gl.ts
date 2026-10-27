// ── game/sky-gl — the city outside the windows ───────────────────────────────
// A map with a `sky` stands `altitude` metres up a tower. What its windows look
// out on is not geometry: one triangle covering the screen, drawn after the map
// with its depth at the far plane, so it only shades the pixels no wall, floor
// or ceiling already claimed — the panes. Behind a wall it costs nothing.
//
// Three views (`MapSky.view`), each a few planes or a grid the ray is solved
// against rather than a mesh:
//
//  · city  — marches the ray across a grid of city lots (a DDA, one lot a
//            step), meeting each lot's tower as a box: so the towers have
//            tops, sides and parallax as you walk past the glass, and the
//            streets carry traffic. Past the last step a carpet of lights under
//            haze; above every roof, sky — stars, a moon or a sun and,
//            haunted, bats across it.
//  · brick — a neighbour's wall all round, `GAP` out from ours: one box exit.
//  · hall  — a corridor round ours: box exit, floor, ceiling and a row of lamps.
//
// The hour (`MapSky.time`) moves a sun and turns the tones toward `day`; that
// blend is done here in JS per frame, so the shader only ever sees one palette.
import { createProgram } from '../mesh-studio/gl/context.js';
import type { MapSky, Tone } from './map.js';
import { mix3, type RGB } from './map-gl.js';

const SKY_VERT = `#version 300 es
out vec2 vP;
void main() {
	vP = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
	gl_Position = vec4(vP, 1.0, 1.0);
}`;

// Lots are B metres; every 4th column and 3rd row of lots is a street. The
// lots round the map's own tower stay empty — a plaza 150m across — or the
// nearest neighbour would fill a whole wall of glass.
const SKY_FRAG = `#version 300 es
precision highp float;
in vec2 vP;
uniform vec3 uF; uniform vec3 uR; uniform vec3 uU; uniform vec3 uEye;
uniform float uAlt; uniform float uTime; uniform float uSeed; uniform float uLitShare; uniform float uHaunt; uniform float uGlass;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHaze; uniform vec3 uFacade; uniform vec3 uStreet; uniform vec3 uBeacon;
uniform vec3 uWin[3];
uniform vec4 uMoon; uniform vec3 uMoonC;
uniform int uView; uniform float uDay; uniform vec4 uRoom; uniform float uCeil;
out vec4 o;

const float B = 48.0;
const float SET = 6.0;
const float TOP = 820.0;
const int STEPS = 112;

float hash(vec2 p) {
	vec3 q = fract(vec3(p.xyx) * 0.1031 + uSeed);
	q += dot(q, q.yzx + 33.33);
	return fract((q.x + q.y) * q.z);
}

bool isStreet(vec2 c) { return mod(c.x, 4.0) == 0.0 || mod(c.y, 3.0) == 0.0; }

float height(vec2 c) {
	if (isStreet(c)) return 0.0;
	float r = length((c + 0.5) * B);
	if (r < 150.0) return 0.0;
	float h = hash(c);
	float core = exp(-r / 1600.0);
	if (h > 0.965) return 300.0 + 380.0 * hash(c + 7.0) * (0.4 + core);
	return 18.0 + 220.0 * h * h * h * (0.3 + core) + 40.0 * hash(c + 3.0);
}

// Haunted, one tick in a dozen-odd a window drops out.
float gutter(vec2 cell, vec2 c) {
	return uHaunt < 0.5 ? 1.0 : step(0.07, hash(vec2(floor(uTime * 6.0) + c.x, cell.x + cell.y * 31.0 + c.y)));
}

vec3 facade(vec3 p, vec3 n, vec2 c, float t) {
	float u = abs(n.x) > 0.5 ? p.z : p.x;
	vec2 g = vec2(u / 3.0, p.y / 3.8);
	vec2 cell = floor(g), f = fract(g);
	// Through the glass a window's edge is a smudge, not a line.
	float k = 0.02 + uGlass * 0.2;
	float pane = smoothstep(0.18 - k, 0.18 + k, f.x) * smoothstep(0.82 + k, 0.82 - k, f.x) * smoothstep(0.28 - k, 0.28 + k, f.y) * smoothstep(0.88 + k, 0.88 - k, f.y);
	float b = hash(c + 1.7);
	vec3 win = b < 0.34 ? uWin[0] : b < 0.67 ? uWin[1] : uWin[2];
	// A floor is in use or it is not; within one, most windows are lit.
	float floorOn = step(hash(vec2(cell.y, c.x * 7.0 + c.y * 13.0)), uLitShare * 1.5);
	float on = floorOn * step(0.25, hash(cell + c * 57.0 + n.xz * 3.0)) * gutter(cell, c);
	float shade = 0.55 + 0.25 * abs(n.x) + 0.2 * max(dot(n, uMoon.xyz), 0.0);
	vec3 glass = mix(uFacade, uHaze, 0.3 + 0.4 * uDay) * shade;
	vec3 close = mix(uFacade * shade * 0.8, mix(glass, win, on), pane);
	// Far off a window is a fraction of a pixel: draw the average, not shimmer.
	vec3 blur = uFacade * shade * 0.7 + win * uLitShare * 0.3;
	return mix(close, blur, max(smoothstep(250.0, 1400.0, t), uGlass * 0.55));
}

vec3 roof(vec3 p, vec2 c, float h) {
	vec2 m = (c + 0.5) * B;
	float beacon = step(240.0, h) * step(length(p.xz - m), 3.5) * step(0.55, fract(uTime * 0.7 + hash(c)));
	return mix(uFacade * 0.45, uBeacon * 1.3, beacon);
}

// Two lanes on a street, one each way: dashes of light drifting along it.
float lane(float across, float along, float id, float side) {
	float d = abs(across - (side > 0.0 ? 0.4 : 0.6));
	float flow = along / 9.0 - side * uTime * (1.5 + hash(vec2(id, side)));
	float car = step(0.72, fract(flow)) * step(0.45, hash(vec2(floor(flow), id + side * 17.0)));
	return car * step(d, 0.05);
}

vec3 ground(vec3 p, float t) {
	vec2 c = floor(p.xz / B), f = p.xz / B - c;
	bool ax = mod(c.x, 4.0) == 0.0, az = mod(c.y, 3.0) == 0.0;
	vec3 avg = uStreet * 0.3;
	float soft = max(smoothstep(500.0, 2000.0, t), uGlass * 0.5);
	if (!ax && !az) return mix(uFacade * 0.3 + uStreet * 0.05, avg * 0.5, soft);
	vec3 col = uStreet * 0.16;
	float lamps = 0.0, fwd = 0.0, back = 0.0;
	if (ax) {
		lamps += step(abs(f.x - 0.5), 0.46) < 0.5 ? step(0.8, fract(p.z / 14.0)) : 0.0;
		fwd += lane(f.x, p.z, c.x, 1.0);
		back += lane(f.x, p.z, c.x, -1.0);
	}
	if (az) {
		lamps += step(abs(f.y - 0.5), 0.46) < 0.5 ? step(0.8, fract(p.x / 14.0)) : 0.0;
		fwd += lane(f.y, p.x, c.y + 50.0, 1.0);
		back += lane(f.y, p.x, c.y + 50.0, -1.0);
	}
	col += uStreet * min(lamps, 1.0) * 0.9 * (1.0 - uDay) + mix(uStreet, vec3(1.0), 0.6) * min(fwd, 1.0) + uBeacon * min(back, 1.0);
	return mix(col, avg, soft);
}

vec3 sky(vec3 d) {
	float e = d.y;
	vec3 c = mix(uHorizon, uZenith, smoothstep(-0.05, 0.55, e));
	c = mix(c, uHaze, exp(-abs(e) * 22.0) * 0.55);
	vec2 sp = vec2(atan(d.x, -d.z), asin(clamp(e, -1.0, 1.0))) * 180.0;
	vec2 sc = floor(sp);
	float st = hash(sc + 11.0);
	if (st > 0.992)
		c += vec3(0.9) * (1.0 - uGlass * 0.6) * (1.0 - uDay) * smoothstep(0.3, 0.0, length(fract(sp) - 0.5)) * (0.55 + 0.45 * sin(uTime * 2.0 + st * 80.0)) * smoothstep(0.04, 0.3, e);
	if (uMoon.w <= 0.0) return c;
	vec3 md = uMoon.xyz;
	float facing = dot(d, md);
	if (facing <= 0.0) return c;
	vec3 mr = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
	vec3 mu = cross(mr, md);
	vec2 q = vec2(dot(d, mr), dot(d, mu)) / sin(uMoon.w);
	float r = length(q);
	c += uMoonC * 0.35 * exp(-max(r - 1.0, 0.0) * 0.8) * step(1.0, r);
	// The same disc is the sun by day: no craters on it.
	float craters = 0.2 * (1.0 - uDay) * (smoothstep(0.35, 0.2, length(q - vec2(-0.3, 0.25))) + smoothstep(0.25, 0.1, length(q - vec2(0.38, -0.2))) + smoothstep(0.2, 0.08, length(q - vec2(0.1, 0.5))) + smoothstep(0.3, 0.15, length(q - vec2(-0.1, -0.45))));
	c = mix(c, uMoonC * (1.0 - craters), smoothstep(1.0 + uGlass * 0.08, 0.97 - uGlass * 0.12, r));
	if (uHaunt < 0.5) return c;
	for (int i = 0; i < 7; i++) {
		float fi = float(i);
		vec2 at = vec2(fract(uTime * (0.03 + 0.03 * hash(vec2(fi, 9.0))) + hash(vec2(fi, 1.0))) * 9.0 - 4.5,
			(hash(vec2(fi, 2.0)) - 0.5) * 2.6 + 0.3 * sin(uTime * 1.3 + fi * 2.0));
		vec2 b = (q - at) / (0.2 + 0.12 * hash(vec2(fi, 4.0)));
		float flap = sin(uTime * 13.0 + fi * 3.0) * 0.7;
		float wing = step(abs(b.x), 1.0) * step(abs(b.y - flap * abs(b.x) + 0.25 * b.x * b.x), 0.16 * (1.0 - abs(b.x)) + 0.03);
		float body = step(length(b * vec2(1.6, 1.0)), 0.2);
		c = mix(c, uZenith * 0.25, max(wing, body));
	}
	return c;
}

vec3 city(vec3 rd) {
	vec3 ro = vec3(uEye.x, uEye.y + uAlt, uEye.z);
	vec3 col = vec3(0.0);
	float t = -1.0;
	vec2 c = floor(ro.xz / B);
	vec2 s = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
	vec2 inv = 1.0 / max(abs(rd.xz), vec2(1e-6));
	vec2 tMax = ((c + max(s, 0.0)) * B - ro.xz) * s * inv;
	vec2 tD = B * inv;
	vec3 rdi = 1.0 / mix(rd, vec3(1e-6), vec3(lessThan(abs(rd), vec3(1e-6))));
	bool open = false;
	for (int i = 0; i < STEPS; i++) {
		float tExit = min(tMax.x, tMax.y);
		float h = height(c);
		if (h > 0.0) {
			vec3 t0 = (vec3(c.x * B + SET, 0.0, c.y * B + SET) - ro) * rdi;
			vec3 t1 = (vec3((c.x + 1.0) * B - SET, h, (c.y + 1.0) * B - SET) - ro) * rdi;
			vec3 tn = min(t0, t1), tf = max(t0, t1);
			float a = max(max(tn.x, tn.y), tn.z), b = min(min(tf.x, tf.y), tf.z);
			if (a <= b && b > 0.0) {
				t = a;
				vec3 p = ro + rd * a;
				col = tn.y >= a ? roof(p, c, h) : facade(p, tn.x >= a ? vec3(-s.x, 0.0, 0.0) : vec3(0.0, 0.0, -s.y), c, a);
				break;
			}
		}
		if (rd.y < 0.0) {
			float tg = -ro.y / rd.y;
			if (tg <= tExit) {
				t = tg;
				col = ground(ro + rd * tg, tg);
				break;
			}
		}
		if (rd.y >= 0.0 && ro.y + rd.y * tExit > TOP) { open = true; break; }
		if (tMax.x < tMax.y) { tMax.x += tD.x; c.x += s.x; } else { tMax.y += tD.y; c.y += s.y; }
	}
	if (t < 0.0 && rd.y < 0.0 && !open) {
		// Out of steps on the way down: the city past them, as a carpet of lights.
		t = -ro.y / rd.y;
		vec3 p = ro + rd * t;
		float lit = mix(step(0.88, hash(floor(p.xz / 24.0) + 5.0)), 0.12, uGlass * 0.5);
		col = uFacade * 0.3 + uStreet * (0.15 + lit * 0.9 * exp(-t / 5000.0)) * (1.0 - uDay * 0.8);
	}
	if (t < 0.0) return sky(rd);
	return mix(col, uHaze, 1.0 - exp(-t / 4200.0));
}

// Where a ray from the eye leaves the box pad metres round the room, and
// the wall's own axis there: x for a wall facing ±x.
float boxExit(vec3 ro, vec3 rd, float pad, out bool onX) {
	float tx = rd.x > 0.0 ? (uRoom.y + pad - ro.x) / rd.x : rd.x < 0.0 ? (uRoom.x - pad - ro.x) / rd.x : 1e9;
	float tz = rd.z > 0.0 ? (uRoom.w + pad - ro.z) / rd.z : rd.z < 0.0 ? (uRoom.z - pad - ro.z) / rd.z : 1e9;
	onX = tx < tz;
	return min(tx, tz);
}

// The neighbour stands GAP out on every side and ROOF above our floor; the
// light well between falls away into the dark.
const float GAP = 7.0;
const float ROOF = 13.0;

vec3 brick(vec3 rd) {
	bool onX;
	float t = boxExit(uEye, rd, GAP, onX);
	vec3 p = uEye + rd * t;
	if (p.y > ROOF) return sky(rd);
	float u = onX ? p.z : p.x;
	// Running bond: every other course shifted half a brick.
	float row = floor(p.y / 0.09);
	float bu = u / 0.24 + mod(row, 2.0) * 0.5;
	float joint = step(0.07, fract(bu)) * step(0.14, fract(p.y / 0.09));
	vec3 b = uFacade * (0.8 + 0.4 * hash(vec2(floor(bu), row)));
	vec3 wall = mix(mix(uFacade * 0.45, b, joint), uFacade * 0.85, min(smoothstep(12.0, 40.0, t) + uGlass * 0.3, 1.0));
	// Its windows: one a bay, a floor apart, lined up with ours.
	vec2 w = vec2(u / 3.6, p.y / 4.2);
	float pane = step(0.3, fract(w.x)) * step(fract(w.x), 0.7) * step(0.25, fract(w.y)) * step(fract(w.y), 0.75);
	float on = step(hash(floor(w) + 23.0), uLitShare * 0.8) * gutter(floor(w), vec2(onX ? 1.0 : 2.0, 0.0));
	// The wall is lit by our own windows near our floor, by the day from above,
	// and by nothing at all the further down the well it goes. Its lit
	// windows are their own light.
	float spill = exp(-max(t - GAP, 0.0) / 14.0) * exp(-abs(p.y - 1.8) / 5.0);
	wall = wall * (0.25 + 0.55 * uDay * smoothstep(-30.0, ROOF, p.y)) + uStreet * spill * 0.12;
	vec3 dark = mix(uFacade * 0.2, uZenith, 0.5);
	vec3 col = mix(wall, mix(dark, uWin[int(hash(floor(w) + 4.0) * 2.99)], on), pane);
	return mix(col, uZenith * 0.15, smoothstep(0.0, -70.0, p.y));
}

// A corridor CW wide round ours, its ceiling uCeil, lamps hung LAMP below it
// every 4m down the middle — the same shop lights as the office.
const float CW = 4.0;
const float LAMP = 1.4;

vec3 hall(vec3 rd) {
	vec3 ro = uEye;
	bool onX;
	float tw = boxExit(ro, rd, CW, onX);
	float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
	float tc = rd.y > 0.0 ? (uCeil - ro.y) / rd.y : 1e9;
	float t = min(tw, min(tf, tc));
	vec3 p = ro + rd * t;
	// Which arm of the ring a point is in, and where its lamps are.
	bool ns = p.z < uRoom.z || p.z > uRoom.w;
	float along = ns ? p.x : p.z;
	float mid = ns ? (p.z < 0.0 ? uRoom.z - CW / 2.0 : uRoom.w + CW / 2.0) : (p.x < 0.0 ? uRoom.x - CW / 2.0 : uRoom.y + CW / 2.0);
	float across = (ns ? p.z : p.x) - mid;
	float lampAt = floor(along / 4.0 + 0.5) * 4.0;
	// A lamp crossed on the way up wins over the ceiling behind it.
	float ty = rd.y > 0.0 ? (uCeil - LAMP - ro.y) / rd.y : 1e9;
	if (ty < t) {
		vec3 q = ro + rd * ty;
		bool qns = q.z < uRoom.z || q.z > uRoom.w;
		float qa = qns ? q.x : q.z;
		float qm = qns ? (q.z < 0.0 ? uRoom.z - CW / 2.0 : uRoom.w + CW / 2.0) : (q.x < 0.0 ? uRoom.x - CW / 2.0 : uRoom.y + CW / 2.0);
		if (abs((qns ? q.z : q.x) - qm) < 0.12 && abs(qa - floor(qa / 4.0 + 0.5) * 4.0) < 0.6)
			return mix(uStreet, uZenith, smoothstep(6.0, 45.0, ty));
	}
	vec3 lamp = ns ? vec3(lampAt, uCeil - LAMP, mid) : vec3(mid, uCeil - LAMP, lampAt);
	float d = length(lamp - p);
	float pool = ceil(clamp(1.0 - d / 5.0, 0.0, 1.0) * 4.0) / 4.0;
	vec3 col;
	if (t == tf) {
		// Carpet, and the same 2m grid ours is ruled with.
		vec2 g = abs(fract(p.xz / 2.0 + 0.5) - 0.5);
		col = mix(uWin[1], uFacade * 0.6, step(min(g.x, g.y), 0.012));
	} else if (t == tc) {
		col = uFacade * 0.35;
	} else {
		// The far wall: a door every 8m, its name lit over it.
		float da = abs(fract(along / 8.0) - 0.5) * 8.0;
		float door = step(da, 0.8) * step(p.y, 2.2);
		float plate = step(da, 0.5) * step(2.3, p.y) * step(p.y, 2.6);
		col = mix(mix(uFacade, uWin[0], door), uWin[2], plate);
		if (plate > 0.5) return mix(col, uZenith, smoothstep(6.0, 45.0, t));
	}
	col *= 0.3 + pool * 0.9;
	return mix(col, uZenith, smoothstep(6.0, 45.0, t));
}

void main() {
	vec3 rd = normalize(uF + uR * vP.x + uU * vP.y);
	vec3 col = uView == 1 ? brick(rd) : uView == 2 ? hall(rd) : city(rd);
	// Lightning, far off and seldom: the whole night blinks.
	if (uHaunt > 0.5 && uView != 2) {
		float k = uTime * 1.5;
		col += uHaze * step(0.985, hash(vec2(floor(k), 3.0))) * pow(1.0 - fract(k), 3.0) * 0.8;
	}
	// The pane between you and all of it: greyed a little, tinted to the night,
	// dimmed, and a faint sheen that slides as you turn your head.
	col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uGlass * 0.35);
	col = mix(col, mix(uFacade, uHaze, 0.5), uGlass * 0.25) * (1.0 - uGlass * 0.3);
	float sheen = pow(max(sin(dot(rd, vec3(0.55, 1.0, 0.35)) * 9.0 + 1.3), 0.0), 6.0);
	col += uHaze * sheen * uGlass * 0.12;
	o = vec4(col, 1.0);
}`;

/** Where the sky is seen from: the eye, its turn and the lens — the same
 *  yaw (0 looks −z) and pitch as `view`. */
export interface SkyView {
	eye: { x: number; y: number; z: number };
	yaw: number;
	pitch: number;
	fovy: number;
	aspect: number;
	/** Seconds. */
	time: number;
	/** The map's walls the views stand round (`MapDef.bounds`). */
	room: { x0: number; x1: number; z0: number; z1: number };
}

const NAMES = [
	'uF', 'uR', 'uU', 'uEye', 'uAlt', 'uTime', 'uSeed', 'uLitShare', 'uHaunt', 'uGlass', 'uZenith', 'uHorizon', 'uHaze',
	'uFacade', 'uStreet', 'uBeacon', 'uWin', 'uMoon', 'uMoonC', 'uView', 'uDay', 'uRoom', 'uCeil'
] as const;

const VIEWS = { city: 0, brick: 1, hall: 2 } as const;

const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** The hour a sky shows now: its own, or the player's clock. */
export function skyHour(sky: MapSky, now?: Date): number {
	if (sky.time !== 'adaptive') return sky.time ?? 21;
	const d = now ?? new Date();
	return d.getHours() + d.getMinutes() / 60;
}

/** The sun at `hour`: up in the east (+x) at 6, south (+z) at noon, down in
 *  the west at 18, under the floor all night. `yaw` and `el` as the moon's. */
export function sunAt(hour: number) {
	const a = ((hour - 6) / 12) * Math.PI;
	return { yaw: Math.PI / 2 + a, el: Math.sin(a) * 0.95 };
}

/** How far into day the sky is, 0 night to 1, and how much the sun sits on
 *  the horizon, 0 to 1 — zero both for a sky with no `day`. */
export function daylight(sky: MapSky, hour: number) {
	if (!sky.day) return { day: 0, dusk: 0 };
	const { el } = sunAt(hour);
	return { day: smooth(-0.08, 0.2, el), dusk: Math.exp(-((el / 0.15) ** 2)) };
}

/** The sky's program on `gl`. `draw` leaves its own program bound: rebind yours
 *  after. Call it once the map is drawn, with depth testing on and before
 *  anything that clears depth. */
export function createSky(gl: WebGL2RenderingContext) {
	const prog = createProgram(gl, SKY_VERT, SKY_FRAG);
	const U = Object.fromEntries(NAMES.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<(typeof NAMES)[number], WebGLUniformLocation | null>;
	return {
		draw(sky: MapSky, tone: (t: Tone) => RGB, v: SkyView) {
			const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
			const f = [sy * cp, sp, -cy * cp];
			const r = [cy, 0, sy];
			const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
			const k = Math.tan(v.fovy / 2);
			gl.useProgram(prog);
			gl.uniform3fv(U.uF, f);
			gl.uniform3fv(U.uR, r.map((x) => x * k * v.aspect));
			gl.uniform3fv(U.uU, u.map((x) => x * k));
			gl.uniform3f(U.uEye, v.eye.x, v.eye.y, v.eye.z);
			gl.uniform1f(U.uAlt, sky.altitude);
			gl.uniform1f(U.uTime, v.time);
			gl.uniform1f(U.uSeed, ((sky.seed ?? 1) * 0.618034) % 1);
			const hour = skyHour(sky);
			const { day, dusk } = daylight(sky, hour);
			// Night's tones, turned toward day's by the sun; the horizon burns the
			// sun's colour while it sits on it.
			const by = (night: Tone, lit?: Tone) => (lit && day > 0 ? mix3(tone(night), tone(lit), day) : tone(night));
			const horizon = by(sky.horizon, sky.day?.horizon);
			gl.uniform1f(U.uDay, day);
			gl.uniform1f(U.uLitShare, sky.lit * (1 - 0.7 * day));
			gl.uniform1f(U.uHaunt, sky.haunted ? 1 : 0);
			gl.uniform1f(U.uGlass, sky.glass ?? 0.5);
			gl.uniform1i(U.uView, VIEWS[sky.view ?? 'city']);
			gl.uniform4f(U.uRoom, v.room.x0, v.room.x1, v.room.z0, v.room.z1);
			gl.uniform1f(U.uCeil, sky.ceiling ?? 4.2);
			gl.uniform3fv(U.uZenith, by(sky.zenith, sky.day?.zenith));
			gl.uniform3fv(U.uHorizon, sky.day && dusk > 0 ? mix3(horizon, tone(sky.day.sun), dusk * 0.5) : horizon);
			gl.uniform3fv(U.uHaze, by(sky.haze, sky.day?.haze));
			gl.uniform3fv(U.uFacade, by(sky.facade, sky.day?.facade));
			gl.uniform3fv(U.uStreet, tone(sky.street));
			gl.uniform3fv(U.uBeacon, tone('--palette-red'));
			gl.uniform3fv(U.uWin, sky.windows.flatMap((w) => tone(w)));
			// One disc in the sky: the sun while it is up, else the moon.
			const sun = sunAt(hour);
			const m = sky.day && day > 0.5 ? { ...sun, size: 0.035, tone: sky.day.sun } : sky.moon;
			if (m) {
				const ce = Math.cos(m.el);
				gl.uniform4f(U.uMoon, Math.sin(m.yaw) * ce, Math.sin(m.el), -Math.cos(m.yaw) * ce, m.size);
				gl.uniform3fv(U.uMoonC, tone(m.tone));
			} else gl.uniform4f(U.uMoon, 0, 1, 0, 0);
			// Behind everything the map drew, and never in front of what comes after.
			gl.depthMask(false);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.depthMask(true);
		},
		dispose: () => gl.deleteProgram(prog)
	};
}
