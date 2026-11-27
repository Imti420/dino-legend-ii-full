// act3-gameplay.js — levels 13–17, boss data/scripts/weak zones, and enemy behaviours for the Act III roster.
// Written against the engine contract from the Legend III master prompt (enemy registry `def`, shared `api`).
// NOT run inside the engine yet — the agent wires + tests it. Art lives in act3-art.js (verified in the lab).
import { drawSprite, ACT3_BIOMES, BOSS_DRAW, BOSS_SIZE, renderBoss } from "./act3-art.js";
export { ACT3_BIOMES, BOSS_DRAW, BOSS_SIZE, renderBoss };

/* ---------- bosses ---------- */
export const BOSS_META_ACT3 = {
  pharaoh: { name: "Sun Pharaoh", blurb: "Gold, scarabs and a sun in his chest. Dodge the beam, then hit the disk while it is open." },
  leviathan: { name: "Abyss Leviathan", blurb: "The jaws are bait. The lantern is the weakness. Shoot it when it flares." },
  extinction: { name: "Extinction", blurb: "The comet that ended your kind has come back with a face. Crack the shell, then burn the core." },
};
export const BOSS_STATS = {                       // w/h come from art; hp tuned for ~60–90 s fights
  pharaoh: { ...BOSS_SIZE.pharaoh, hp: 120 },
  leviathan: { ...BOSS_SIZE.leviathan, hp: 130 },
  extinction: { ...BOSS_SIZE.extinction, hp: 170 },
};
export const PHASES_ACT3 = { pharaoh: [0.5], leviathan: [0.5], extinction: [0.66, 0.33] };
// Script ops: ["wait",s] ["tell",name,s] [name] ["stun",s] (opens the weak point, boss.vuln=true for s seconds).
export const SCRIPTS_ACT3 = {
  pharaoh: [["wait", .7], ["tell", "slam", .55], ["slam"], ["wait", .9], ["tell", "beam", .75], ["beam"], ["stun", 1.5], ["wait", .6],
    ["tell", "scarabs", .45], ["scarabs"], ["wait", 1.1], ["tell", "roar", .5], ["sandwave"], ["wait", 1.0]],
  pharaoh_p2: [["wait", .35], ["tell", "slam", .38], ["slam"], ["wait", .4], ["tell", "beam", .55], ["beam"], ["stun", 1.1],
    ["tell", "sunfall", .4], ["sunfall"], ["wait", .5], ["tell", "scarabs", .3], ["scarabs"], ["wait", .5], ["tell", "roar", .35], ["sandwave"], ["wait", .5]],
  leviathan: [["wait", .8], ["tell", "jaw", .7], ["jaw"], ["wait", 1.0], ["tell", "flash", .6], ["flash"], ["stun", 1.6],
    ["wait", .5], ["tell", "tentacles", .45], ["tentacles"], ["wait", .9], ["tell", "bubbles", .4], ["bubbles"], ["wait", 1.0]],
  leviathan_p2: [["wait", .4], ["tell", "jaw", .45], ["jaw"], ["wait", .4], ["tell", "flash", .45], ["flash"], ["stun", 1.1],
    ["tell", "tentacles", .3], ["tentacles"], ["wait", .4], ["tell", "bubbles", .3], ["bubbles"], ["tell", "jaw", .4], ["jaw"], ["wait", .5]],
  extinction: [["wait", .6], ["tell", "slam", .5], ["slam"], ["wait", .8], ["tell", "meteors", .35], ["meteors"], ["wait", .9], ["tell", "orbs", .35], ["orbs"], ["wait", .9]],
  extinction_p2: [["wait", .35], ["tell", "laser", .5], ["laser"], ["stun", 1.2], ["tell", "meteors", .25], ["meteors"], ["wait", .5],
    ["tell", "slam", .3], ["slam"], ["wait", .4], ["tell", "orbs", .25], ["orbs"], ["wait", .5]],
  extinction_p3: [["wait", .25], ["tell", "nova", .5], ["nova"], ["wait", .5], ["tell", "laser", .35], ["laser"], ["stun", .9],
    ["tell", "meteors", .2], ["meteors"], ["wait", .3], ["tell", "slam", .22], ["slam"], ["wait", .3], ["tell", "nova", .35], ["nova"], ["wait", .4]],
};
// Where the player must hit for full damage (world-space rect). Elsewhere = chip damage (<=15%) + CLANG.
export function bossWeakZone(b) {
  if (b.type === "pharaoh") return b.vuln ? { x: b.x + 70, y: b.y + 60, w: 36, h: 36 } : null;
  if (b.type === "leviathan") { const t = b.anim, lx = 92 + Math.sin(t * 1.5) * 8, ly = -14 + Math.sin(t * 2) * 5; return { x: b.x + lx - 14, y: b.y + ly - 8, w: 28, h: 28 }; }
  if (b.type === "extinction") return (b.phase || 1) >= 2 ? { x: b.x + 60, y: b.y + 60, w: 80, h: 80 } : null;
  return null;
}
export function bossBody(b) {                     // what hurts the player on contact
  if (b.type === "pharaoh") return { x: b.x + 40, y: b.y + 50, w: 90, h: 120 };
  if (b.type === "leviathan") return { x: b.x + 4, y: b.y + 50, w: 170, h: 120 };
  return { x: b.x + 28, y: b.y + 28, w: 144, h: 144 };
}
export function drawAct3Boss(ctx, b) { renderBoss(ctx, b, BOSS_DRAW[b.type]); }

/* ---------- enemy behaviours (registry `def` from enemies.js) ---------- */
export function registerAct3Enemies(def, S, api) {
  const put = (ctx, key, i, e, o = {}) => {
    const set = S[key], k = Math.floor(i) % set.length, x = e.x + e.w / 2, y = e.y + e.h + (o.dy || 0);
    drawSprite(ctx, set[k], x, y, o); if (e.flash > 0) drawSprite(ctx, S.flash[key][k], x, y, { ...o, alpha: Math.min(1, e.flash * 10) });
  };
  const G = 308;

  // L13 — blinks forward in a glitch burst, then pounces. Counter: bait the blink, stomp on recovery.
  def("glitch_raptor", { role: "rusher", hp: 2, w: 46, h: 42, extra: 30, stompable: true, pts: 80, material: "metal",
    ai(e, dt, a) { e.st += dt; const dx = e.x - a.player.x;
      if (e.state === "idle" && dx < 270 && dx > 150) { e.state = "tell"; e.st = 0; e.extra = -40; }
      else if (e.state === "tell" && e.st > .38) { a.burst(e.x + 20, e.y + 20, "#ff2aa0", 8, 120); e.x -= 130; a.burst(e.x + 20, e.y + 20, "#2ad8ff", 8, 120); e.state = "pounce"; e.st = 0; e.extra = 360; a.sfx.tick(); }
      else if (e.state === "pounce" && e.st > .5) { e.state = "recover"; e.st = 0; e.extra = 0; }          // stompable window
      else if (e.state === "recover" && e.st > .5) { e.state = "run"; e.extra = 70; } },
    draw(ctx, e) { if (e.state === "tell") put(ctx, "glitchRaptorTell", e.age * 14, e, { dy: 2 }); else put(ctx, "glitchRaptor", e.age * 12, e); } });

  // L13 — laser gate: posts + a beam that toggles on a 2-count. variant e.high => duck, else jump.
  def("laser_gate", { role: "trap", hp: 99, w: 150, h: 14, hittable: false, hurts: false, pts: 0, extra: 0,
    init: () => ({ on: false, high: Math.random() < .5 }),
    spawn(e) { e.y = e.high ? G - 96 : G - 30; e.h = 12; },
    ai(e, dt) { e.st += dt; const ph = e.st % 1.6; e.warn = ph > 1.0 && ph <= 1.2; e.on = ph > 1.2; e.hurts = e.on; },
    draw(ctx, e) { const y = e.y; ctx.fillStyle = "#1a1030"; ctx.fillRect(e.x - 6, G - 120, 10, 120); ctx.fillRect(e.x + e.w - 4, G - 120, 10, 120);
      ctx.fillStyle = "#2ad8ff"; ctx.fillRect(e.x - 6, y - 4, 10, 20); ctx.fillRect(e.x + e.w - 4, y - 4, 10, 20);
      if (e.warn) { ctx.globalAlpha = .5; ctx.fillStyle = "#ff2a9a"; ctx.fillRect(e.x, y + 5, e.w, 2); ctx.globalAlpha = 1; }
      if (e.on) { ctx.fillStyle = "#ff2a9a"; ctx.fillRect(e.x, y, e.w, 12); ctx.fillStyle = "#fff"; ctx.fillRect(e.x, y + 4, e.w, 4); } } });

  // L14 — scarab: hops in a swarm. Stomp the line for a chain.
  def("scarab", { role: "swarm", hp: 1, w: 26, h: 18, extra: 120, stompable: true, pts: 15, material: "bone",
    ai(e, dt, a) { e.hop = (e.hop ?? Math.random()) + dt; if (e.hop > .7) { e.hop = 0; e.vyH = -300; } e.vyH = (e.vyH || 0) + 1500 * dt; e.y += e.vyH * dt; if (e.y > G - e.h) { e.y = G - e.h; e.vyH = 0; } },
    draw(ctx, e) { put(ctx, "scarab", e.age * 14, e); } });

  // L14 — cobra: hidden mound, rises with a flared hood (tell), spits at head height, sinks. Only hittable while up.
  def("sand_cobra", { role: "zoner", hp: 3, w: 34, h: 74, extra: 0, hittable: false, pts: 110, material: "flesh", init: () => ({ up: 0 }),
    ai(e, dt, a) { e.st += dt; const dx = e.x - a.player.x;
      if (e.state === "idle" && dx < 280) { e.state = "rise"; e.st = 0; }
      else if (e.state === "rise" && e.st > .45) { e.state = "spit"; e.st = 0; e.hittable = true; e.hurts = true; }
      else if (e.state === "spit" && e.st > .35) { e.state = "up"; e.st = 0; api.make({ kind: "proj", visual: "orb", screen: true, x: e.x - 8, y: e.y + 24, w: 16, h: 16, vx: -330, hp: 1, hittable: true, hurts: true }); a.sfx.tick(); }
      else if (e.state === "up" && e.st > 1.1) { e.state = "sink"; e.st = 0; e.hittable = false; e.hurts = false; }
      e.up = e.state === "rise" ? Math.min(1, e.st / .45) : e.state === "sink" ? Math.max(0, 1 - e.st / .4) : e.state === "idle" ? 0 : 1; },
    draw(ctx, e) { ctx.fillStyle = "#8a5a1e"; ctx.beginPath(); ctx.ellipse(e.x + 17, G - 2, 22, 6, 0, 0, 7); ctx.fill();
      if (e.up > 0) { ctx.save(); ctx.beginPath(); ctx.rect(e.x - 20, G - 80, 80, 80); ctx.clip(); put(ctx, "sandCobra", e.state === "spit" ? 2 : e.age * 3, e, { dy: (1 - e.up) * 70 + 2 }); ctx.restore(); } } });

  // L15 — gale hawk: cruises high, locks your height (mark), dives in a straight line, climbs out.
  def("gale_hawk", { role: "zoner", hp: 2, w: 56, h: 30, extra: 40, pts: 70, material: "flesh",
    spawn(e) { e.y = 50 + Math.random() * 40; e.baseY = e.y; },
    ai(e, dt, a) { e.st += dt;
      if (e.state === "idle") { e.y = e.baseY + Math.sin(e.age * 3) * 6; if (e.x < a.player.x + 340) { e.state = "mark"; e.st = 0; e.targetY = Math.min(G - 60, a.player.y + 40); } }
      else if (e.state === "mark" && e.st > .5) { e.state = "dive"; e.st = 0; }
      else if (e.state === "dive") { e.y += (e.targetY - e.y) * Math.min(1, dt * 5); e.x -= 220 * dt; if (e.st > .6) { e.state = "climb"; e.st = 0; } }
      else if (e.state === "climb") { e.y -= 240 * dt; } },
    draw(ctx, e, a) { if (e.state === "mark") { ctx.globalAlpha = .5 + .5 * Math.sin(e.age * 40); ctx.fillStyle = "#ff3040"; ctx.fillRect(e.x - 300, e.targetY + 14, 300, 2); ctx.globalAlpha = 1; }
      if (e.state === "dive") put(ctx, "galeHawkDive", 0, e); else put(ctx, "galeHawk", e.age * 9, e); } });

  // L15 — cloud manta: glides at mid height and drops charged pods that leave a 0.7 s electric patch.
  def("cloud_manta", { role: "zoner", hp: 3, w: 70, h: 34, extra: 15, pts: 90, material: "flesh",
    spawn(e) { e.y = G - 190; e.drop = 0.9; },
    ai(e, dt, a) { e.y = G - 190 + Math.sin(e.age * 1.8) * 12; e.drop -= dt; if (e.drop <= 0 && e.x < 560) { e.drop = 1.5; api.make({ kind: "proj", visual: "orb", screen: false, x: e.x + 30, y: e.y + 30, w: 14, h: 14, vy: 260, hp: 1, hittable: true, hurts: true, pod: true }); } },
    draw(ctx, e) { put(ctx, "cloudManta", e.age * 5, e, { dy: 4 }); } });

  // L16 — anglerfish: lure flares (tell) then lunges open-jawed. Shoot the lure = instant kill + heat cell.
  def("angler", { role: "rusher", hp: 3, w: 56, h: 44, extra: 20, pts: 120, material: "flesh",
    spawn(e) { e.y = G - 130; e.baseY = e.y; },
    ai(e, dt, a) { e.st += dt; const dx = e.x - a.player.x;
      if (e.state === "idle") { e.y = e.baseY + Math.sin(e.age * 2.4) * 8; if (dx < 260) { e.state = "lure"; e.st = 0; e.extra = -30; } }
      else if (e.state === "lure" && e.st > .55) { e.state = "lunge"; e.st = 0; e.extra = 400; e.vyL = (a.player.y - e.y) * 1.4; }
      else if (e.state === "lunge") { e.y += Math.max(-200, Math.min(200, e.vyL)) * dt; if (e.st > .6) { e.state = "idle"; e.extra = 60; e.st = 0; } } },
    draw(ctx, e) { put(ctx, "angler", e.state === "lunge" ? 2 : e.state === "lure" ? 1 : 0, e, { dy: 2 }); if (e.state === "lure") { ctx.globalAlpha = .4 + .4 * Math.sin(e.age * 30); ctx.fillStyle = "#ffe860"; ctx.beginPath(); ctx.arc(e.x + 6, e.y - 6, 22, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } } });

  // L16 — jellyfish: drifts. Popping it close shocks you (ring), so shoot it at range or stomp-chain away.
  def("jelly", { role: "trap", hp: 1, w: 34, h: 56, extra: 25, stompable: false, pts: 60, material: "ghost",
    spawn(e) { e.y = 60 + Math.random() * 120; e.baseY = e.y; e.ph = Math.random() * 6; },
    ai(e, dt) { e.y = e.baseY + Math.sin(e.age * 1.6 + e.ph) * 26; },
    onDeath(e, a) { a.burst(e.x + 17, e.y + 20, "#e090ff", 14, 180, { ring: true }); if (Math.hypot(e.x + 17 - (a.player.x + 40), e.y + 20 - (a.player.y + 40)) < 80) a.hurt(); },
    draw(ctx, e) { put(ctx, "jelly", e.age * 3, e, { alpha: .92 }); } });

  // L17 — cinder shard: falling comet fragment, bounces once, keeps burning along the ground.
  def("cinder_shard", { role: "zoner", hp: 1, w: 32, h: 28, extra: 0, pts: 40, material: "stone",
    spawn(e) { e.y = -30; e.x = 360 + Math.random() * 260; e.vyH = 260; e.bounced = false; },
    ai(e, dt) { e.vyH += 900 * dt; e.y += e.vyH * dt; e.x -= 120 * dt; if (e.y + e.h > G) { e.y = G - e.h; if (!e.bounced) { e.bounced = true; e.vyH = -420; } else { e.vyH = 0; e.extra = 140; } } },
    draw(ctx, e) { put(ctx, "cinderShard", e.age * 12, e); } });

  // L17 — void raptor: replays YOUR jumps ~0.9 s late (needs api.jumpLog = array of performance times, maintained in requestJump()).
  def("void_raptor", { role: "swarm", hp: 2, w: 46, h: 42, extra: 70, stompable: true, pts: 90, material: "ghost",
    ai(e, dt, a) { const log = a.jumpLog || []; if (e.y >= G - e.h - 1) { const due = log.find((tj) => a.now() - tj > .9 && a.now() - tj < .95); if (due) { e.vyH = -900; } } e.vyH = (e.vyH || 0) + 2700 * dt; e.y += e.vyH * dt; if (e.y > G - e.h) { e.y = G - e.h; e.vyH = 0; } },
    draw(ctx, e) { put(ctx, "voidRaptor", e.age * 12, e, { alpha: .9 }); } });
}

/* ---------- levels 13–17 (append to LEVELS; merge ACT3_BIOMES into BIOMES) ---------- */
// Patterns use the Director format from the master prompt: [atU, kind, opts], U = one jump span.
export const LEVELS_ACT3 = [
  { id: 13, name: "Neon Ruins", biome: "neon", tag: "Neon", length: 17500, speed: [600, 790], par: 3400, shower: 0, boss: null,
    blurb: "A dead city that never turned its lights off. Glitch raptors blink, laser gates breathe.",
    foes: [["Glitch raptor", "Telegraphs a blink, then pounces. Stomp it on recovery."], ["Laser gate", "A pink line warns you. Low beam: jump. High beam: duck."]],
    spawns: [{ t: "glitch_raptor", w: .3 }, { t: "laser_gate", w: .26 }, { t: "drone", w: .16 }, { t: "saw", w: .14 }, { t: "ptero", w: .14 }],
    patterns: [
      { id: "gate_pair", d: 1, len: 3.4, beats: [[0, "laser_gate", { high: false }], [1.8, "laser_gate", { high: true }]] },
      { id: "blink_bait", d: 2, len: 3.2, beats: [[0, "glitch_raptor"], [1.6, "laser_gate", { high: false }]] },
      { id: "raptor_duo", d: 3, len: 4.4, beats: [[0, "glitch_raptor"], [.8, "glitch_raptor"], [2.8, "laser_gate", { high: true }]] },
      { id: "drone_gate_saw", d: 4, len: 5.4, beats: [[0, "drone"], [1.2, "laser_gate", { high: false }], [2.8, "saw"], [4.2, "glitch_raptor"]] }] },
  { id: 14, name: "Sun Tomb", biome: "tomb", tag: "Tomb", length: 15500, speed: [610, 800], par: 3800, shower: 0, boss: "pharaoh",
    blurb: "The avenue of sphinxes ends at a god who keeps a sun in his chest.",
    foes: [["Scarab swarm", "Stomp the line for a chain."], ["Sand cobra", "Only hittable when its hood is up."], ["Sun Pharaoh", BOSS_META_ACT3.pharaoh.blurb]],
    spawns: [{ t: "scarab", w: .34 }, { t: "sand_cobra", w: .26 }, { t: "golem", w: .12 }, { t: "scorp", w: .14 }, { t: "meteor", w: .14 }],
    patterns: [
      { id: "scarab_line", d: 1, len: 3, beats: [[0, "scarab"], [.25, "scarab"], [.5, "scarab"], [.75, "scarab"], [1.0, "scarab"]] },
      { id: "cobra_gap", d: 2, len: 3.6, beats: [[0, "sand_cobra"], [2.0, "scarab"], [2.25, "scarab"]] },
      { id: "cobra_trio", d: 3, len: 5, beats: [[0, "sand_cobra"], [1.5, "sand_cobra"], [3.0, "sand_cobra"]] },
      { id: "golem_swarm", d: 4, len: 5.6, beats: [[0, "golem"], [2.6, "scarab"], [2.85, "scarab"], [3.1, "scarab"], [4.4, "sand_cobra"]] }] },
  { id: 15, name: "Cloud Spine", biome: "sky", tag: "Sky", length: 18500, speed: [620, 810], par: 3600, shower: 0, boss: null,
    blurb: "A stone bridge above the clouds. The wind is not alone up here.",
    foes: [["Gale hawk", "Marks your height with a red line, then dives."], ["Cloud manta", "Drops charged pods. Do not stand under it."]],
    spawns: [{ t: "gale_hawk", w: .32 }, { t: "cloud_manta", w: .24 }, { t: "thunderbird", w: .12 }, { t: "raptor", w: .16 }, { t: "bolt", w: .16 }],
    patterns: [
      { id: "hawk_solo", d: 1, len: 3, beats: [[0, "gale_hawk"]] },
      { id: "hawk_v", d: 2, len: 3.6, beats: [[0, "gale_hawk"], [.5, "gale_hawk"], [1.0, "gale_hawk"]] },
      { id: "manta_pods", d: 3, len: 4.6, beats: [[0, "cloud_manta"], [2.4, "raptor"], [3.4, "gale_hawk"]] },
      { id: "storm_bridge", d: 4, len: 5.8, beats: [[0, "cloud_manta"], [.6, "bolt"], [2.0, "gale_hawk"], [3.4, "raptor"], [4.6, "bolt"]] }] },
  { id: 16, name: "Abyssal Trench", biome: "trench", tag: "Deep", length: 16000, speed: [630, 820], par: 4200, shower: 0, boss: "leviathan",
    blurb: "No sun this deep. Only lanterns, and the thing that owns the biggest one.",
    foes: [["Anglerfish", "A flaring lure means a lunge. Shoot the lure."], ["Jellyfish", "Pop it at range. Close up, it shocks you."], ["Abyss Leviathan", BOSS_META_ACT3.leviathan.blurb]],
    spawns: [{ t: "angler", w: .3 }, { t: "jelly", w: .3 }, { t: "snake", w: .12 }, { t: "drone", w: .14 }, { t: "scorp", w: .14 }],
    patterns: [
      { id: "jelly_drift", d: 1, len: 3, beats: [[0, "jelly"], [1.2, "jelly"]] },
      { id: "angler_solo", d: 2, len: 3.4, beats: [[0, "angler"]] },
      { id: "jelly_curtain", d: 3, len: 4.6, beats: [[0, "jelly"], [.4, "jelly"], [.8, "jelly"], [2.6, "angler"]] },
      { id: "deep_gauntlet", d: 4, len: 6, beats: [[0, "angler"], [1.4, "jelly"], [2.4, "angler"], [3.6, "jelly"], [4.6, "scorp"]] }] },
  { id: 17, name: "Genesis", biome: "genesis", tag: "Extinction", length: 15000, speed: [650, 860], par: 5200, shower: 8, boss: "extinction",
    blurb: "The day the sky fell. You were there. You ran. Now it wants you back.",
    foes: [["Cinder shard", "Comet fragments that bounce once and keep burning."], ["Void raptor", "Replays your jumps 0.9 s late. Be consistent."], ["Extinction", BOSS_META_ACT3.extinction.blurb]],
    spawns: [{ t: "cinder_shard", w: .3 }, { t: "void_raptor", w: .2 }, { t: "glitch_raptor", w: .1 }, { t: "golem", w: .1 }, { t: "meteor", w: .16 }, { t: "geyser", w: .14 }],
    patterns: [
      { id: "shard_rain", d: 1, len: 3, beats: [[0, "cinder_shard"], [.8, "cinder_shard"], [1.6, "cinder_shard"]] },
      { id: "echo_pair", d: 2, len: 3.8, beats: [[0, "void_raptor"], [1.6, "cactus"], [2.6, "void_raptor"]] },
      { id: "extinction_run", d: 3, len: 5, beats: [[0, "cinder_shard"], [.5, "cinder_shard"], [1.6, "void_raptor"], [3.0, "geyser"], [3.8, "golem"]] },
      { id: "last_stand", d: 4, len: 6.4, beats: [[0, "void_raptor"], [.7, "void_raptor"], [2.0, "cinder_shard"], [2.4, "cinder_shard"], [3.6, "golem"], [5.0, "glitch_raptor"]] }] },
];
export const ACT3_SETPIECES = {
  13: "Blackout Run — the city grid dies in sections; only neon edges are visible, gates blink on the music beat.",
  14: "Sphinx Avenue — scarab streams pour from the sphinx statues; chain-stomp them across the whole avenue.",
  15: "Skybridge Collapse — arches crumble behind you and the bridge ends in a gap you must clear by jump + dive-slam.",
  16: "Lantern Field — a hundred glowing lures; only the real anglerfish lunges. Read the bluff.",
  17: "The Fall — a 25-second comet storm, then every earlier enemy type appears for one beat each.",
};