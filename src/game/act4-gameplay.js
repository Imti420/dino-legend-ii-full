// act4-gameplay.js — levels 18–22 ("The Afterlight"), boss data/scripts/weak zones, enemy behaviours.
// Same engine contract as act3-gameplay.js (registry `def`, shared `api`). Art lives in act4-art.js.
import { drawSprite, ACT4_BIOMES, BOSS_DRAW4, BOSS_SIZE4, renderBoss } from "./act4-art.js";
export { ACT4_BIOMES, BOSS_DRAW4, BOSS_SIZE4, renderBoss };

/* ---------- bosses ---------- */
export const BOSS_META_ACT4 = {
  hydra: { name: "Prism Hydra", blurb: "Three heads, one heart. Each head telegraphs a different attack. Hit the heart when it opens." },
  chronos: { name: "Chronos Engine", blurb: "A clock that eats time. Dodge the hammer, outrun the gears, hit the core when the chime ends." },
  umbra: { name: "Umbra Rex", blurb: "It is you, with everything you lost. Three phases. The crack in its chest is the only door." },
};
export const BOSS_STATS_ACT4 = {                  // hp tuned for ~70–110 s fights
  hydra: { ...BOSS_SIZE4.hydra, hp: 150 },
  chronos: { ...BOSS_SIZE4.chronos, hp: 170 },
  umbra: { ...BOSS_SIZE4.umbra, hp: 220 },
};
export const PHASES_ACT4 = { hydra: [0.5], chronos: [0.5], umbra: [0.66, 0.33] };
// Script ops: ["wait",s] ["tell",name,s] [name] ["stun",s] (opens weak point: boss.vuln=true for s seconds).
export const SCRIPTS_ACT4 = {
  hydra: [["wait", .7], ["tell", "shards", .6], ["shards"], ["wait", .8], ["tell", "beam", .8], ["beam"], ["stun", 1.5], ["wait", .5],
    ["tell", "spit", .5], ["spit"], ["wait", 1.0], ["tell", "sweep", .6], ["sweep"], ["wait", .9]],
  hydra_p2: [["wait", .35], ["tell", "beam", .55], ["beam"], ["stun", 1.1], ["tell", "shards", .4], ["shards"], ["wait", .4],
    ["tell", "spit", .3], ["spit"], ["tell", "spit", .3], ["spit"], ["wait", .4], ["tell", "roar", .45], ["sweep"], ["wait", .5]],
  chronos: [["wait", .8], ["tell", "slam", .65], ["slam"], ["wait", .9], ["tell", "gears", .5], ["gears"], ["wait", 1.1], ["tell", "chime", .8], ["chime"], ["stun", 1.6],
    ["tell", "steam", .45], ["steam"], ["wait", 1.0]],
  chronos_p2: [["wait", .4], ["tell", "slam", .42], ["slam"], ["wait", .4], ["tell", "gears", .35], ["gears"], ["wait", .5], ["tell", "chime", .55], ["chime"], ["stun", 1.1],
    ["tell", "steam", .3], ["steam"], ["tell", "slam", .35], ["slam"], ["wait", .5]],
  umbra: [["wait", .7], ["tell", "bite", .5], ["bite"], ["wait", .8], ["tell", "dash", .55], ["dash"], ["stun", 1.4], ["wait", .5],
    ["tell", "roar", .5], ["shockwave"], ["wait", 1.0]],
  umbra_p2: [["wait", .4], ["tell", "dash", .4], ["dash"], ["wait", .3], ["tell", "clones", .5], ["clones"], ["stun", 1.2], ["tell", "bite", .35], ["bite"],
    ["wait", .4], ["tell", "roar", .4], ["shockwave"], ["wait", .5]],
  umbra_p3: [["wait", .25], ["tell", "eclipse", .6], ["eclipse"], ["wait", .5], ["tell", "dash", .3], ["dash"], ["stun", .9],
    ["tell", "clones", .35], ["clones"], ["wait", .3], ["tell", "bite", .25], ["bite"], ["tell", "nova", .45], ["nova"], ["wait", .4], ["tell", "dash", .25], ["dash"], ["wait", .4]],
};
export function bossWeakZone(b) {
  if (b.type === "hydra") return b.vuln ? { x: b.x + 150, y: b.y + 92, w: 52, h: 52 } : null;
  if (b.type === "chronos") return b.vuln ? { x: b.x + 76, y: b.y + 78, w: 68, h: 68 } : null;
  if (b.type === "umbra") return b.vuln ? { x: b.x + 70, y: b.y + 76, w: 54, h: 66 } : null;
  return null;
}
export function bossBody(b) {
  if (b.type === "hydra") return { x: b.x + 110, y: b.y + 70, w: 128, h: 110 };
  if (b.type === "chronos") return { x: b.x + 40, y: b.y + 60, w: 140, h: 150 };
  return { x: b.x + 60, y: b.y + 50, w: 110, h: 150 };
}
export function drawAct4Boss(ctx, b) { renderBoss(ctx, b, BOSS_DRAW4[b.type]); }

/* ---------- boss attack implementations (engine calls these by script op name) ----------
   Each takes (b, a) where `a` is the shared api. They only use primitives already in the act3 contract:
   api.make({kind:"proj", ...}), a.burst, a.sfx, a.player. Wire them into the boss runner's op table. */
export function registerAct4BossOps(ops, api) {
  const G = 308, shot = (o) => api.make({ kind: "proj", visual: "orb", screen: true, w: 18, h: 18, hp: 1, hittable: true, hurts: true, ...o });
  // HYDRA
  ops.shards = (b) => { for (let i = 0; i < 5; i++) shot({ x: b.x + 20, y: b.y + 20, vx: -300 - i * 30, vy: -80 + i * 70, visual: "shard" }); };
  ops.beam = (b) => api.make({ kind: "beam", x: 0, y: b.y + 90, w: b.x + 10, h: 22, life: .9, warn: .0, hurts: true });
  ops.spit = (b, a) => { shot({ x: b.x + 10, y: G - 40, vx: -380, w: 22, h: 22 }); a.sfx.tick(); };
  ops.sweep = (b) => api.make({ kind: "wave", x: b.x, y: G - 26, w: 70, h: 26, vx: -420, life: 2.2, hurts: true });
  // CHRONOS
  ops.slam = (b, a) => { a.shake?.(.35); api.make({ kind: "wave", x: b.x + 4, y: G - 34, w: 60, h: 34, vx: -460, life: 1.8, hurts: true }); };
  ops.gears = (b) => { for (let i = 0; i < 3; i++) api.make({ kind: "proj", visual: "gear", screen: false, x: b.x + 10, y: G - 40, w: 38, h: 38, vx: -300 - i * 90, hp: 99, hittable: false, hurts: true, delay: i * .55 }); };
  ops.chime = (b, a) => { a.burst(b.x + 110, b.y + 112, "#ffe27a", 18, 220, { ring: true }); };      // purely visual: marks the end of the tell, then the script stuns
  ops.steam = (b) => api.make({ kind: "cloud", x: b.x - 140, y: G - 120, w: 140, h: 120, life: 1.2, hurts: true });
  // UMBRA
  ops.bite = (b) => api.make({ kind: "zone", x: b.x - 40, y: b.y + 40, w: 70, h: 80, life: .22, hurts: true });
  ops.dash = (b) => { b.dashing = .8; b.vxBoss = -620; };                                            // engine: move boss left at vxBoss, then glide back
  ops.shockwave = (b, a) => { a.shake?.(.4); api.make({ kind: "wave", x: b.x, y: G - 40, w: 50, h: 40, vx: -480, life: 1.8, hurts: true }); };
  ops.clones = (b, a) => { for (let i = 0; i < 3; i++) api.make({ kind: "enemy", type: "shadow_self", x: 640 + i * 140, y: G - 74, hp: 1 }); };
  ops.eclipse = (b) => { b.eclipse = 2.2; };                                                           // engine: darken screen to 70% for 2.2 s, only boss + player + hazards stay lit
  ops.nova = (b, a) => { a.burst(b.x + 100, b.y + 100, "#ffffff", 30, 320, { ring: true }); for (let i = 0; i < 8; i++) shot({ x: b.x + 70, y: b.y + 90, vx: -260 - (i % 4) * 60, vy: -240 + i * 70, visual: "orb" }); };
}

/* ---------- enemy behaviours ---------- */
export function registerAct4Enemies(def, S, api) {
  const put = (ctx, key, i, e, o = {}) => {
    const set = S[key], k = Math.floor(i) % set.length, x = e.x + e.w / 2, y = e.y + e.h + (o.dy || 0);
    drawSprite(ctx, set[k], x, y, o); if (e.flash > 0) drawSprite(ctx, S.flash[key][k], x, y, { ...o, alpha: Math.min(1, e.flash * 10) });
  };
  const G = 308;

  // L18 — bone hound: crouches (tell), leaps in an arc, then runs. Stomp it while it crouches or after it lands.
  def("bone_hound", { role: "rusher", hp: 2, w: 44, h: 34, extra: 60, stompable: true, pts: 80, material: "bone",
    ai(e, dt, a) { e.st += dt; const dx = e.x - a.player.x; e.vyH = e.vyH || 0;
      if (e.state === "idle" && dx < 300 && dx > 170) { e.state = "tell"; e.st = 0; e.extra = -20; }
      else if (e.state === "tell" && e.st > .42) { e.state = "leap"; e.st = 0; e.extra = 400; e.vyH = -560; a.sfx.tick(); }
      else if (e.state === "leap") { e.vyH += 1500 * dt; e.y += e.vyH * dt; if (e.y >= G - e.h) { e.y = G - e.h; e.vyH = 0; e.state = "run"; e.extra = 90; } } },
    draw(ctx, e) { if (e.state === "tell") put(ctx, "boneHoundTell", e.age * 10, e, { dy: 2 }); else put(ctx, "boneHound", e.age * 12, e, { dy: 2 }); } });

  // L18 — grave wisp: drifts, fades out every 1.8 s (cannot be hit while faded). Shoot or stomp while it is bright.
  def("grave_wisp", { role: "trap", hp: 1, w: 24, h: 36, extra: 30, stompable: true, pts: 60, material: "ghost",
    spawn(e) { e.y = 90 + Math.random() * 130; e.baseY = e.y; e.ph = Math.random() * 6; },
    ai(e, dt) { e.y = e.baseY + Math.sin(e.age * 2 + e.ph) * 30; const dim = Math.sin(e.age * 3.5 + e.ph) > .55; e.hittable = !dim; e.dim = dim; },
    draw(ctx, e) { put(ctx, "graveWisp", e.age * 8, e, { alpha: e.dim ? .25 : .95, dy: 4 }); } });

  // L19 — crystal beetle: shell closed for 1.5 s (bounces you, safe to touch from above), pops open for 0.9 s (flashes pink) = the stomp window.
  def("crystal_beetle", { role: "trap", hp: 2, w: 34, h: 24, extra: 60, stompable: true, pts: 100, material: "stone",
    ai(e, dt) { const c = e.age % 2.4; e.open = c > 1.5; e.hittable = e.open; e.armored = !e.open; },
    draw(ctx, e) { put(ctx, e.open ? "beetleOpen" : "beetle", 0, e, { dy: 2 }); if (!e.open && e.age % 2.4 > 1.2) { ctx.globalAlpha = .5 + .5 * Math.sin(e.age * 40); ctx.fillStyle = "#ff6ae0"; ctx.fillRect(e.x + 6, e.y - 4, 22, 2); ctx.globalAlpha = 1; } } });

  // L19 — prism bat: zig-zags in a tight wave, then swoops once to the player's height.
  def("prism_bat", { role: "zoner", hp: 1, w: 40, h: 22, extra: 70, pts: 70, material: "flesh",
    spawn(e) { e.y = 70 + Math.random() * 80; e.baseY = e.y; },
    ai(e, dt, a) { e.st += dt; if (e.state === "idle") { e.y = e.baseY + Math.sin(e.age * 7) * 34; if (e.x < a.player.x + 300) { e.state = "swoop"; e.st = 0; e.targetY = Math.min(G - 40, a.player.y + 30); } } else if (e.state === "swoop") { e.y += (e.targetY - e.y) * Math.min(1, dt * 4); e.x -= 120 * dt; if (e.st > .8) { e.state = "climb"; e.st = 0; } } else e.y -= 180 * dt; },
    draw(ctx, e) { put(ctx, "prismBat", e.age * 12, e); } });

  // L20 — thunder rhino: stamps (tell, horn sparks), then charges in a straight line. Only stompable once it is winded.
  def("thunder_rhino", { role: "rusher", hp: 3, w: 58, h: 40, extra: 20, stompable: false, pts: 140, material: "flesh",
    ai(e, dt, a) { e.st += dt; const dx = e.x - a.player.x;
      if (e.state === "idle" && dx < 440 && dx > 220) { e.state = "tell"; e.st = 0; e.extra = -10; }
      else if (e.state === "tell" && e.st > .7) { e.state = "charge"; e.st = 0; e.extra = 520; a.sfx.tick(); }
      else if (e.state === "charge" && e.st > 1.3) { e.state = "winded"; e.st = 0; e.extra = 0; e.stompable = true; }
      else if (e.state === "winded" && e.st > 1.0) { e.state = "run"; e.extra = 60; e.stompable = false; } },
    draw(ctx, e) { const ch = e.state === "tell" || e.state === "charge"; put(ctx, ch ? "rhinoCharge" : "rhino", e.age * (e.state === "charge" ? 18 : 9), e, { dy: 2 }); } });

  // L20 — bolt strike: warning ring on the ground, 0.7 s later a lightning column. Pure timing trap (not hittable).
  def("bolt_strike", { role: "trap", hp: 99, w: 34, h: 6, hittable: false, hurts: false, pts: 0, extra: 0,
    ai(e, dt) { e.st += dt; e.warn = e.st > .1 && e.st <= .8; e.on = e.st > .8 && e.st <= 1.05; e.hurts = e.on; e.y = e.on ? 0 : G - 6; e.h = e.on ? G : 6; },
    draw(ctx, e) { const cx = e.x + e.w / 2;
      if (e.warn) { ctx.globalAlpha = .4 + .5 * Math.sin(e.st * 40); ctx.strokeStyle = "#ffee40"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, G - 2, 20, 5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      if (e.on) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, 0); for (let y = 30; y < G; y += 30) ctx.lineTo(cx + (Math.random() - .5) * 26, y); ctx.lineTo(cx, G); ctx.stroke(); ctx.strokeStyle = "#ffee40"; ctx.lineWidth = 2; ctx.stroke(); } } });

  // L21 — cog crab: scuttles, curls into a ball and rolls (not stompable while rolling, hurts), then uncurls tired = stomp window.
  def("cog_crab", { role: "swarm", hp: 2, w: 34, h: 26, extra: 70, stompable: true, pts: 100, material: "metal",
    ai(e, dt, a) { e.st += dt; const dx = e.x - a.player.x;
      if (e.state === "idle" && dx < 320) { e.state = "curl"; e.st = 0; e.extra = 0; e.stompable = false; }
      else if (e.state === "curl" && e.st > .35) { e.state = "roll"; e.st = 0; e.extra = 400; }
      else if (e.state === "roll" && e.st > .9) { e.state = "tired"; e.st = 0; e.extra = 0; e.stompable = true; }
      else if (e.state === "tired" && e.st > .9) { e.state = "walk"; e.extra = 80; } },
    draw(ctx, e) { if (e.state === "roll" || e.state === "curl") put(ctx, "cogBall", 0, e, { rot: -e.age * 14, ay: .5, dy: -e.h / 2 }); else put(ctx, "cogCrab", e.age * 10, e, { dy: 2 }); } });

  // L21 — piston press: ceiling piston. Shakes (warn), slams to the floor, retracts. Walk through the up-phase.
  def("piston_press", { role: "trap", hp: 99, w: 64, h: 40, hittable: false, hurts: false, pts: 0, extra: 0,
    ai(e, dt) { e.st += dt; const ph = e.st % 2.0; let ext = 40; if (ph < 1.2) ext = 40; else if (ph < 1.55) ext = 70; else if (ph < 1.7) ext = 40 + (G - 40) * ((ph - 1.55) / .15); else if (ph < 1.95) ext = G; else ext = G - (G - 40) * ((ph - 1.95) / .05);
      e.y = 0; e.h = ext; e.shake = ph >= 1.2 && ph < 1.55; e.hurts = ext > 150; },
    draw(ctx, e) { const sx = e.shake ? (Math.random() - .5) * 3 : 0, x = e.x + sx; ctx.fillStyle = "#3a2210"; ctx.fillRect(x + 22, 0, 20, e.h - 14); ctx.fillStyle = "#c08a34"; ctx.fillRect(x + 26, 0, 4, e.h - 14); ctx.fillStyle = "#5a3a10"; ctx.fillRect(x, e.h - 22, e.w, 22); ctx.fillStyle = "#e0b060"; ctx.fillRect(x, e.h - 22, e.w, 4); ctx.fillStyle = "#1a0e06"; for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 14, e.h - 6, 8, 6);
      if (e.shake) { ctx.globalAlpha = .5; ctx.fillStyle = "#ff4a3a"; ctx.fillRect(e.x, G - 3, e.w, 3); ctx.globalAlpha = 1; } } });

  // L22 — shadow self: flies at the height YOU were at 0.6 s ago. Keep changing altitude; do not be predictable.
  def("shadow_self", { role: "swarm", hp: 1, w: 44, h: 40, extra: 110, stompable: true, pts: 90, material: "ghost",
    init: () => ({ hist: [] }),
    ai(e, dt, a) { const p = a.player; e.hist.push([a.now, p.y]); while (e.hist.length > 90) e.hist.shift(); const past = e.hist.find((h) => a.now - h[0] <= .6) || e.hist[0]; const ty = Math.min(G - e.h, past[1] + 20); e.y += (ty - e.y) * Math.min(1, dt * 14); },
    draw(ctx, e) { put(ctx, "shadowDino", e.age * 12, e, { alpha: .9 }); } });

  // L22 — star wisp: slow figure-8, pulls toward the player's lane. One hit pops it into a ring of 4 sparks (hurts). Shoot it far away.
  def("star_wisp", { role: "trap", hp: 1, w: 24, h: 36, extra: 40, stompable: false, pts: 70, material: "ghost",
    spawn(e) { e.y = 80 + Math.random() * 120; e.baseY = e.y; e.ph = Math.random() * 6; },
    ai(e, dt, a) { e.baseY += (Math.min(G - 80, a.player.y) - e.baseY) * dt * .6; e.y = e.baseY + Math.sin(e.age * 2.4 + e.ph) * 26; },
    onDeath(e, a) { a.burst(e.x + 12, e.y + 18, "#ffe27a", 12, 200, { ring: true }); if (Math.hypot(e.x + 12 - (a.player.x + 40), e.y + 18 - (a.player.y + 40)) < 70) a.hurt(); },
    draw(ctx, e) { put(ctx, "starWisp", e.age * 8, e, { dy: 4 }); } });
}

/* ---------- levels 18–22 (append to LEVELS; merge ACT4_BIOMES into BIOMES) ---------- */
export const LEVELS_ACT4 = [
  { id: 18, name: "Ossuary Fields", biome: "bone", tag: "Bone", length: 18000, speed: [660, 850], par: 3600, shower: 0, boss: null,
    blurb: "The graveyard of everything that ran before you. Some of it still does.",
    foes: [["Bone hound", "Crouches before it leaps. Stomp it on the crouch."], ["Grave wisp", "Fades in and out. Hit it only while it is bright."]],
    spawns: [{ t: "bone_hound", w: .32 }, { t: "grave_wisp", w: .24 }, { t: "scorp", w: .12 }, { t: "ptero", w: .16 }, { t: "cactus", w: .16 }],
    patterns: [
      { id: "hound_solo", d: 1, len: 3, beats: [[0, "bone_hound"]] },
      { id: "wisp_pair", d: 2, len: 3.4, beats: [[0, "grave_wisp"], [1.4, "grave_wisp"]] },
      { id: "hound_wisp", d: 3, len: 4.6, beats: [[0, "bone_hound"], [1.0, "grave_wisp"], [2.8, "bone_hound"]] },
      { id: "bone_run", d: 4, len: 5.8, beats: [[0, "bone_hound"], [.8, "bone_hound"], [2.4, "grave_wisp"], [3.6, "scorp"], [4.6, "bone_hound"]] }] },
  { id: 19, name: "Prism Caverns", biome: "crystal", tag: "Crystal", length: 16500, speed: [670, 860], par: 4000, shower: 0, boss: "hydra",
    blurb: "A cave where the light has teeth. The guardian has three heads and one heart.",
    foes: [["Crystal beetle", "Armoured until it pops open. Stomp it while it flashes pink."], ["Prism bat", "Zig-zags, then swoops to your height."], ["Prism Hydra", BOSS_META_ACT4.hydra.blurb]],
    spawns: [{ t: "crystal_beetle", w: .3 }, { t: "prism_bat", w: .28 }, { t: "drone", w: .14 }, { t: "saw", w: .14 }, { t: "golem", w: .14 }],
    patterns: [
      { id: "beetle_solo", d: 1, len: 3, beats: [[0, "crystal_beetle"]] },
      { id: "bat_pair", d: 2, len: 3.4, beats: [[0, "prism_bat"], [.7, "prism_bat"]] },
      { id: "beetle_bats", d: 3, len: 4.6, beats: [[0, "crystal_beetle"], [1.4, "prism_bat"], [2.4, "crystal_beetle"]] },
      { id: "prism_gauntlet", d: 4, len: 5.8, beats: [[0, "prism_bat"], [.6, "crystal_beetle"], [2.2, "saw"], [3.4, "prism_bat"], [4.6, "crystal_beetle"]] }] },
  { id: 20, name: "Thunder Plains", biome: "storm", tag: "Storm", length: 19000, speed: [680, 880], par: 3700, shower: 0, boss: null,
    blurb: "An open plain and a sky that keeps score. Rhinos run on the lightning.",
    foes: [["Thunder rhino", "Sparks on the horn mean a charge. Stomp it when it is winded."], ["Bolt strike", "A yellow ring on the ground. Leave before it fires."]],
    spawns: [{ t: "thunder_rhino", w: .28 }, { t: "bolt_strike", w: .28 }, { t: "bolt", w: .14 }, { t: "thunderbird", w: .14 }, { t: "raptor", w: .16 }],
    patterns: [
      { id: "rhino_solo", d: 1, len: 3.4, beats: [[0, "thunder_rhino"]] },
      { id: "strike_line", d: 2, len: 3.6, beats: [[0, "bolt_strike"], [1.2, "bolt_strike"], [2.4, "bolt_strike"]] },
      { id: "rhino_strike", d: 3, len: 5, beats: [[0, "thunder_rhino"], [2.0, "bolt_strike"], [3.4, "raptor"]] },
      { id: "storm_front", d: 4, len: 6.2, beats: [[0, "bolt_strike"], [.8, "thunder_rhino"], [2.6, "bolt_strike"], [3.4, "thunderbird"], [4.8, "bolt_strike"]] }] },
  { id: 21, name: "Clockwork Citadel", biome: "citadel", tag: "Gears", length: 16500, speed: [690, 890], par: 4300, shower: 0, boss: "chronos",
    blurb: "Time is a machine here, and the machine has a keeper.",
    foes: [["Cog crab", "Rolls at you. Stomp it when it uncurls, tired."], ["Piston press", "The ceiling shakes before it falls. Time the gap."], ["Chronos Engine", BOSS_META_ACT4.chronos.blurb]],
    spawns: [{ t: "cog_crab", w: .3 }, { t: "piston_press", w: .26 }, { t: "drone", w: .14 }, { t: "saw", w: .16 }, { t: "golem", w: .14 }],
    patterns: [
      { id: "crab_solo", d: 1, len: 3, beats: [[0, "cog_crab"]] },
      { id: "piston_pair", d: 2, len: 4, beats: [[0, "piston_press"], [2.0, "piston_press"]] },
      { id: "crab_press", d: 3, len: 5, beats: [[0, "cog_crab"], [1.4, "cog_crab"], [3.0, "piston_press"]] },
      { id: "assembly_line", d: 4, len: 6.4, beats: [[0, "piston_press"], [1.4, "cog_crab"], [2.8, "saw"], [3.8, "piston_press"], [5.2, "cog_crab"]] }] },
  { id: 22, name: "The Afterlight", biome: "void", tag: "Afterlight", length: 17000, speed: [700, 920], par: 5600, shower: 0, boss: "umbra",
    blurb: "The last road ends where the light does. Something waits there wearing your shape.",
    foes: [["Shadow self", "Flies at the height you were at a moment ago. Stay unpredictable."], ["Star wisp", "Pops into sparks. Shoot it from a distance."], ["Umbra Rex", BOSS_META_ACT4.umbra.blurb]],
    spawns: [{ t: "shadow_self", w: .28 }, { t: "star_wisp", w: .22 }, { t: "void_raptor", w: .14 }, { t: "glitch_raptor", w: .12 }, { t: "cinder_shard", w: .12 }, { t: "bone_hound", w: .12 }],
    patterns: [
      { id: "shadow_solo", d: 1, len: 3, beats: [[0, "shadow_self"]] },
      { id: "star_drift", d: 2, len: 3.6, beats: [[0, "star_wisp"], [1.2, "star_wisp"], [2.4, "shadow_self"]] },
      { id: "echo_choir", d: 3, len: 5, beats: [[0, "shadow_self"], [.8, "shadow_self"], [2.2, "void_raptor"], [3.6, "star_wisp"]] },
      { id: "last_light", d: 4, len: 6.6, beats: [[0, "shadow_self"], [.6, "star_wisp"], [1.8, "bone_hound"], [3.0, "glitch_raptor"], [4.2, "shadow_self"], [5.4, "void_raptor"]] }] },
];
export const ACT4_SETPIECES = {
  18: "Ribcage Run — giant ribcages arch over the track; wisps swarm out of the gaps and the moon dims between arches.",
  19: "Refraction Hall — beams bounce between crystal pillars; a pink line warns each bounce one beat early.",
  20: "The Long Storm — lightning columns walk across the plain in a rolling line; rhinos stampede between strikes.",
  21: "Midnight Chime — on every chime the whole factory stops for one beat, then all pistons fall at once; use the pause to cross.",
  22: "Everything You Were — a 20-second parade of one of every Act I–IV enemy, then the shadows merge into one.",
};