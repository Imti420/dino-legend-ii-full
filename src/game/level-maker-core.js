// level-maker-core.js — pure logic for the Dino Legend Level Maker. NO DOM, NO canvas, no engine imports.
// The agent builds the editor UI + playtest hook around this. Everything here is unit-testable in Node.
// World units: x = pixels travelled along the track (same units as LEVEL.length). G = ground y.

export const G = 308, W = 640;
export const LEVEL_VERSION = 1;
export const LIMITS = { maxObjects: 400, minLength: 6000, maxLength: 30000, safeStart: 700, bossArena: 1500, endPad: 400, maxSegments: 12, minSegLen: 1200, xSnap: 20, brutalPerKpx: 40 };
export const jumpSpan = (speed) => speed * 0.62;                       // px travelled during one jump (same "U" as the Director)
export const LANES = { ground: null, low: G - 70, mid: G - 130, high: G - 200 };   // y for air objects; null = enemy's own ground y

/* ---------- catalog metadata (overlay). w/h/hp come from the engine's `def` registry at runtime: see buildCatalog ----------
   lane:  "ground" walks the floor | "air" flies (user picks low/mid/high) | "gate" wall-type trap with opts | "trap" timed hazard on floor/ceiling | "fall" falls from sky
   lethal: counts as a ground-lethal hazard for the fairness spacing rule (needs a jump/duck to pass).
   lockY: AI/spawn controls y; the editor must not let the user set a lane.
   cost:  difficulty points (used for the difficulty meter).  opts: editable options -> allowed values. */
export const META = {
  // legacy (Acts I–II). Agent: fill label/lane from the registry if different.
  cactus: { label: "Cactus", lane: "ground", lethal: true, cost: 1 }, bat: { label: "Ember Bat", lane: "air", lethal: false, cost: 1 }, vine: { label: "Vine", lane: "trap", lethal: true, cost: 2 }, boulder: { label: "Ice Boulder", lane: "ground", lethal: true, cost: 2 }, shade: { label: "Shade", lane: "ground", lethal: true, cost: 2 }, stalactite: { label: "Stalactite", lane: "fall", lethal: false, cost: 2, lockY: true }, beetle: { label: "Crystal Beetle", lane: "ground", lethal: false, cost: 2 }, drone: { label: "Drone", lane: "air", lethal: false, cost: 2 },
  saw: { label: "Saw", lane: "ground", lethal: true, cost: 2 }, ptero: { label: "Pterodactyl", lane: "air", lethal: false, cost: 2 },
  raptor: { label: "Raptor", lane: "ground", lethal: true, cost: 2 }, scorp: { label: "Scorpion", lane: "ground", lethal: true, cost: 2 },
  snake: { label: "Snake", lane: "ground", lethal: true, cost: 2 }, golem: { label: "Golem", lane: "ground", lethal: true, cost: 4 },
  thunderbird: { label: "Thunderbird", lane: "air", lethal: false, cost: 3 }, bolt: { label: "Bolt", lane: "fall", lethal: false, cost: 2, lockY: true },
  meteor: { label: "Meteor", lane: "fall", lethal: false, cost: 2, lockY: true }, geyser: { label: "Geyser", lane: "trap", lethal: true, cost: 3 },
  // Act III
  glitch_raptor: { label: "Glitch Raptor", lane: "ground", lethal: true, cost: 4 },
  laser_gate: { label: "Laser Gate", lane: "gate", lethal: true, cost: 3, lockY: true, opts: { high: [false, true] } },
  scarab: { label: "Scarab", lane: "ground", lethal: true, cost: 1 }, sand_cobra: { label: "Sand Cobra", lane: "ground", lethal: true, cost: 4 },
  gale_hawk: { label: "Gale Hawk", lane: "air", lethal: false, cost: 3, lockY: false }, cloud_manta: { label: "Cloud Manta", lane: "air", lethal: false, cost: 3, lockY: true },
  angler: { label: "Anglerfish", lane: "air", lethal: false, cost: 4 }, jelly: { label: "Jellyfish", lane: "air", lethal: false, cost: 2 },
  cinder_shard: { label: "Cinder Shard", lane: "fall", lethal: false, cost: 2, lockY: true }, void_raptor: { label: "Void Raptor", lane: "ground", lethal: true, cost: 4 },
  // Act IV
  bone_hound: { label: "Bone Hound", lane: "ground", lethal: true, cost: 4 }, grave_wisp: { label: "Grave Wisp", lane: "air", lethal: false, cost: 2 },
  crystal_beetle: { label: "Crystal Beetle", lane: "ground", lethal: false, cost: 2 }, prism_bat: { label: "Prism Bat", lane: "air", lethal: false, cost: 2 },
  thunder_rhino: { label: "Thunder Rhino", lane: "ground", lethal: true, cost: 5 }, bolt_strike: { label: "Bolt Strike", lane: "trap", lethal: true, cost: 3, lockY: true },
  cog_crab: { label: "Cog Crab", lane: "ground", lethal: true, cost: 3 }, piston_press: { label: "Piston Press", lane: "trap", lethal: true, cost: 3, lockY: true },
  shadow_self: { label: "Shadow Self", lane: "air", lethal: false, cost: 3, lockY: true }, star_wisp: { label: "Star Wisp", lane: "air", lethal: false, cost: 2 },
};
export const BOSSES = { pharaoh: "tomb", leviathan: "trench", extinction: "genesis", hydra: "crystal", chronos: "citadel", umbra: "void" };   // boss -> its home biome
export const BOSS_COST = 60;

/* Merge metadata with the engine registry. `registry` = the `def` store: { name: {w,h,hp,...} }. Unknown registry entries get a generic ground enemy entry. */
export function buildCatalog(registry) {
  const out = {};
  for (const [id, d] of Object.entries(registry)) { const m = META[id] || { label: id, lane: "ground", lethal: true, cost: 2 }; out[id] = { id, w: d.w, h: d.h, hp: d.hp, hidden: !META[id], ...m }; }
  return out;
}

/* ---------- data model ---------- */
export function newLevel(biome = "neon") {
  return { v: LEVEL_VERSION, name: "Untitled", author: "", length: 12000, speed: [600, 760], segments: [{ from: 0, to: 12000, biome }], objects: [], boss: null, verified: false, clearMs: 0 };
}
// object: { id, x, t, lane?: "low"|"mid"|"high", opts?: {...}, g?: groupId }
let _id = 1; export const uid = () => "o" + (_id++).toString(36) + Math.random().toString(36).slice(2, 5);
export const snapX = (x, snap = LIMITS.xSnap) => Math.round(x / snap) * snap;
export const speedAt = (lv, x) => lv.speed[0] + (lv.speed[1] - lv.speed[0]) * Math.min(1, Math.max(0, x / lv.length));
export const biomeAt = (lv, x) => (lv.segments.find((s) => x >= s.from && x < s.to) || lv.segments[lv.segments.length - 1]).biome;
export function setLength(lv, length) {           // resizing keeps segments contiguous and drops objects beyond the end
  length = Math.max(LIMITS.minLength, Math.min(LIMITS.maxLength, Math.round(length / 100) * 100));
  const segs = lv.segments.filter((s) => s.from < length).map((s) => ({ ...s, to: Math.min(s.to, length) })); segs[segs.length - 1].to = length;
  return { ...lv, length, segments: segs, objects: lv.objects.filter((o) => o.x < length - LIMITS.endPad) };
}
export function splitSegment(lv, x, biome) {      // paint a biome from x to the end of the segment containing x
  const i = lv.segments.findIndex((s) => x > s.from + LIMITS.minSegLen && x < s.to - LIMITS.minSegLen); if (i < 0) return lv;
  const s = lv.segments[i]; return { ...lv, segments: [...lv.segments.slice(0, i), { from: s.from, to: x, biome: s.biome }, { from: x, to: s.to, biome }, ...lv.segments.slice(i + 1)] };
}
export function paintSegment(lv, i, biome) { const segs = lv.segments.map((s, j) => (j === i ? { ...s, biome } : s)); return { ...lv, segments: mergeSame(segs) }; }
export function mergeSame(segs) { const out = []; for (const s of segs) { const p = out[out.length - 1]; if (p && p.biome === s.biome) p.to = s.to; else out.push({ ...s }); } return out; }
export function moveBoundary(lv, i, x) {          // drag the boundary between segment i and i+1
  const a = lv.segments[i], b = lv.segments[i + 1]; if (!a || !b) return lv; x = snapX(x, 100);
  x = Math.max(a.from + LIMITS.minSegLen, Math.min(b.to - LIMITS.minSegLen, x));
  const segs = lv.segments.map((s, j) => (j === i ? { ...s, to: x } : j === i + 1 ? { ...s, from: x } : s)); return { ...lv, segments: segs };
}

/* ---------- stamps: turn Director patterns into placeable object groups ---------- */
export function patternToObjects(pattern, x0, speed) {
  const span = jumpSpan(speed), g = "g" + uid();
  return pattern.beats.map(([u, t, opts]) => ({ id: uid(), x: snapX(x0 + u * span), t, ...(opts ? { opts } : {}), g }));
}
export const stampsFromLevels = (levels) => levels.flatMap((L) => L.patterns.map((p) => ({ key: `${L.id}:${p.id}`, name: p.id.replace(/_/g, " "), d: p.d, biome: L.biome, pattern: p })));

/* ---------- validation / fairness / difficulty ---------- */
export function validate(lv, catalog, biomeKeys) {
  const errors = [], warnings = [], L = LIMITS;
  if (!lv.name || lv.name.length > 32) errors.push("Name must be 1–32 characters.");
  if (lv.length < L.minLength || lv.length > L.maxLength) errors.push(`Length must be ${L.minLength}–${L.maxLength} px.`);
  if (!(lv.speed[0] >= 500 && lv.speed[1] <= 920 && lv.speed[0] <= lv.speed[1])) errors.push("Speed must be 500–920 and start ≤ end.");
  const sg = lv.segments; if (!sg.length || sg[0].from !== 0 || sg[sg.length - 1].to !== lv.length) errors.push("Biome segments must cover the whole level.");
  for (let i = 0; i < sg.length; i++) { if (i && sg[i].from !== sg[i - 1].to) errors.push("Biome segments have a gap."); if (sg[i].to - sg[i].from < L.minSegLen) errors.push(`Segment ${i + 1} is shorter than ${L.minSegLen} px.`); if (biomeKeys && !biomeKeys.includes(sg[i].biome)) errors.push(`Unknown biome "${sg[i].biome}".`); }
  if (sg.length > L.maxSegments) errors.push(`Max ${L.maxSegments} biome segments.`);
  if (lv.objects.length > L.maxObjects) errors.push(`Max ${L.maxObjects} objects.`);
  if (lv.boss && !BOSSES[lv.boss]) errors.push("Unknown boss.");
  const maxX = lv.length - (lv.boss ? L.bossArena : L.endPad); let cost = lv.boss ? BOSS_COST : 0; const lethal = [];
  for (const o of lv.objects) {
    const c = catalog[o.t]; if (!c) { errors.push(`Unknown object "${o.t}".`); continue; }
    if (o.x < L.safeStart) errors.push(`${c.label} at ${o.x}px is inside the ${L.safeStart}px safe start.`);
    if (o.x > maxX) errors.push(`${c.label} at ${o.x}px is inside the ${lv.boss ? "boss arena" : "finish pad"}.`);
    if (c.opts) for (const [k, vals] of Object.entries(o.opts || {})) if (!c.opts[k] || !c.opts[k].includes(vals)) errors.push(`${c.label}: bad option ${k}.`);
    if (o.lane && (c.lockY || c.lane === "ground" || c.lane === "gate" || c.lane === "trap" || c.lane === "fall")) warnings.push(`${c.label}: lane ignored.`);
    cost += c.cost; if (c.lethal) lethal.push(o);
  }
  lethal.sort((a, b) => a.x - b.x);
  for (let i = 1; i < lethal.length; i++) { const a = lethal[i - 1], b = lethal[i]; if (a.g && a.g === b.g) continue;
    const need = jumpSpan(speedAt(lv, b.x)) * 0.9, gap = b.x - a.x;
    if (gap < need) errors.push(`Unfair: ${catalog[a.t].label} and ${catalog[b.t].label} at ${a.x}px are only ${Math.round(gap)}px apart (need ${Math.round(need)}).`); }
  const perK = (cost / lv.length) * 1000; if (perK > L.brutalPerKpx) warnings.push(`Very dense (${perK.toFixed(0)} pts/1000px). Players may bounce off.`);
  if (lv.boss && biomeAt(lv, lv.length - 1) !== BOSSES[lv.boss]) warnings.push(`${lv.boss} fights look best in the "${BOSSES[lv.boss]}" biome.`);
  if (lv.objects.length < 8 && !lv.boss) warnings.push("Very few objects. Add more to make a real level.");
  return { errors, warnings, stats: { cost, perK: Math.round(perK * 10) / 10, count: lv.objects.length, rating: perK < 8 ? "Chill" : perK < 16 ? "Normal" : perK < 26 ? "Hard" : perK < 40 ? "Expert" : "Brutal" } };
}
export const canPublish = (lv, catalog, keys) => lv.verified && validate(lv, catalog, keys).errors.length === 0;
export const markDirty = (lv) => ({ ...lv, verified: false, clearMs: 0 });      // call after ANY edit: a level must be re-cleared to publish

/* ---------- share codes: DL1-<base64url(json)>-<checksum> ---------- */
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).padStart(7, "0").slice(-6); };
const b64 = (s) => { const u = new TextEncoder().encode(s); let b = ""; u.forEach((c) => (b += String.fromCharCode(c))); return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64 = (s) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))); };
export function encode(lv) {
  const c = { v: lv.v, n: lv.name, a: lv.author, l: lv.length, s: lv.speed, g: lv.segments.map((x) => [x.to, x.biome]), b: lv.boss, k: lv.clearMs,
    o: lv.objects.map((o) => [o.x, o.t, o.lane || 0, o.opts || 0, o.g || 0]) };
  const j = b64(JSON.stringify(c)); return `DL${lv.v}-${j}-${fnv(j)}`;
}
export function decode(code) {
  try { const [pre, j, sum] = code.trim().split("-"); if (!/^DL\d+$/.test(pre) || fnv(j) !== sum) return { error: "Code is damaged or edited." };
    const c = JSON.parse(unb64(j)); let from = 0; const segments = c.g.map(([to, biome]) => { const s = { from, to, biome }; from = to; return s; });
    return { level: { v: c.v, name: String(c.n).slice(0, 32), author: String(c.a || "").slice(0, 24), length: c.l, speed: c.s, segments, boss: c.b, verified: false, clearMs: 0,
      objects: c.o.map(([x, t, lane, opts, g]) => ({ id: uid(), x, t, ...(lane ? { lane } : {}), ...(opts ? { opts } : {}), ...(g ? { g } : {}) })) } };   // verified is NEVER trusted from a code: the player must clear it themselves
  } catch { return { error: "Could not read that code." }; }
}

/* ---------- convert to what the engine plays ---------- */
export function toRuntime(lv, catalog) {
  const spawnList = [...lv.objects].sort((a, b) => a.x - b.x).map((o) => { const c = catalog[o.t];
    return { x: o.x, t: o.t, opts: o.opts || {}, y: c.lockY || c.lane === "ground" ? undefined : LANES[o.lane || "mid"] }; });
  return { id: "custom", name: lv.name, custom: true, authored: true, biome: lv.segments[0].biome, segments: lv.segments, length: lv.length, speed: lv.speed, boss: lv.boss, spawnList, shower: 0 };
}

/* ---------- undo / redo (snapshots; levels are small) ---------- */
export class History {
  constructor(initial, cap = 100) { this.a = [JSON.stringify(initial)]; this.i = 0; this.cap = cap; }
  push(lv) { this.a = this.a.slice(0, this.i + 1); this.a.push(JSON.stringify(lv)); if (this.a.length > this.cap) this.a.shift(); this.i = this.a.length - 1; }
  undo() { if (this.i > 0) this.i--; return JSON.parse(this.a[this.i]); }
  redo() { if (this.i < this.a.length - 1) this.i++; return JSON.parse(this.a[this.i]); }
  get canUndo() { return this.i > 0; } get canRedo() { return this.i < this.a.length - 1; }
}