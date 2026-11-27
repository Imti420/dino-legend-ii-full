/** Enemy registry — roles, tells, better presence. Drawn via art.paint where possible. */
import { getPainted, drawSprite, shatter } from "./art.js";

const GROUND = 308;

const BAT_PAL = { a: ["#5b2a86", "#8a4fc0", "#33164f"], b: ["#2a1440", "#4a2a6a", "#150a26"], o: "#ff7a1a", w: "#fff0b0" };
const BAT_UP = [
  "..b.........b..",
  ".bab.......bab.",
  "baab...a...baab",
  ".bbaaa.aoa.aabb",
  "...bbaaaaaabb..",
  ".....baaaab....",
  "......b..b.....",
];
const BAT_DN = [
  "...............",
  "..b.........b..",
  ".bab...a...bab.",
  "baabaa.ao.abaab",
  ".bbaaaaaaaaabb.",
  "...bbaaa.aabb..",
  ".....b....b....",
];

const SAW_PAL = { m: ["#8a9098", "#c0c8d0", "#4a5058"], e: "#ff4a10", s: "#fff0a0" };
const SAW_ROWS = [
  "....m.m.m....",
  "..m.mmmmm.m..",
  ".mmmmemmmmmm.",
  "mmmmmsmmmmmmm",
  ".mmmmemmmmmm.",
  "..m.mmmmm.m..",
  "....m.m.m....",
];

const DRONE_PAL = { c: ["#6a7686", "#a8b4c4", "#3a4450"], e: "#ff1030", w: "#e8f0ff" };
const DRONE_ROWS = [
  "..ccccc..",
  ".ccccccc.",
  "ccceweccc",
  ".ccccccc.",
  "..c...c..",
];

const BEETLE_PAL = { s: ["#1b5a7a", "#2ad0ff", "#0a2a3a"], b: ["#0e2a3a", "#1b5a7a", "#08121c"], e: "#7ff0ff" };
const BEETLE_ROWS = [
  "..sss..",
  ".sbsbs.",
  "sbbbbbs",
  "sbeebbs",
  ".sbbbs.",
  "s.....s",
];

const GOLEM_PAL = { s: ["#6b6b72", "#85858c", "#3a3a42"], e: "#ff6a1a", d: "#55555c" };
const GOLEM_ROWS = [
  "...sss...",
  "..sssss..",
  ".sseses.",
  "sssssssss",
  "sssssssss",
  ".ssd.dss.",
  "..sd.ds..",
  "..d...d..",
];

export const ENEMIES = {};

export function def(kind, d) {
  ENEMIES[kind] = {
    hp: 1,
    w: 40,
    h: 40,
    role: "rusher",
    extra: 0,
    hittable: true,
    hurts: true,
    stompable: false,
    pts: 30,
    material: "flesh",
    ...d,
  };
  return ENEMIES[kind];
}

function frames(key, rowSets, pal, scale = 3) {
  return rowSets.map((rows, i) => getPainted(key + i, rows, pal, { scale }));
}

def("bat", {
  role: "swarm",
  hp: 1,
  w: 48,
  h: 36,
  extra: 40,
  pts: 40,
  material: "flesh",
  stompable: true,
  init: () => ({ ph: Math.random() * 6, baseY: 0 }),
  ai(e, dt, a) {
    e.st = (e.st || 0) + dt;
    if (!e.baseY) e.baseY = e.y;
    e.y = e.baseY + Math.sin(e.st * 3.2 + (e.ph || 0)) * 12;
    // dive-bat: dive at jump apex if close
    if (e.state !== "dive" && a.player && !a.player.onGround && e.x - a.player.x < 160 && e.x > a.player.x) {
      e.state = "dive";
      e.extra = 180;
    }
    if (e.state === "dive") {
      e.y += 220 * dt;
      if (e.y > GROUND - e.h) {
        e.y = GROUND - e.h;
        e.state = "idle";
        e.extra = 40;
      }
    }
  },
  draw(ctx, e) {
    const fr = frames("bat", [BAT_UP, BAT_DN], BAT_PAL, 3);
    const f = fr[Math.floor((e.st || 0) * 10) % 2];
    drawSprite(ctx, f.img, e.x + e.w / 2, e.y + e.h, {
      flash: e.flash || 0,
      flashImg: f.flash,
      sx: e.state === "dive" ? 1.15 : 1,
      sy: e.state === "dive" ? 0.85 : 1,
    });
  },
});

def("saw", {
  role: "trap",
  hp: 99,
  w: 44,
  h: 44,
  extra: 170,
  hittable: false,
  hurts: true,
  stompable: false,
  pts: 0,
  material: "metal",
  init: () => ({ spin: 0 }),
  ai(e, dt) {
    e.spin = (e.spin || 0) + dt * 18;
    e.st = (e.st || 0) + dt;
  },
  draw(ctx, e) {
    const f = getPainted("saw0", SAW_ROWS, SAW_PAL, { scale: 3 });
    drawSprite(ctx, f.img, e.x + e.w / 2, e.y + e.h, { rot: e.spin || 0, ax: 0.5, ay: 0.5 });
    // ground sparks
    if (Math.floor((e.st || 0) * 20) % 2) {
      ctx.fillStyle = "#ffb040";
      ctx.fillRect(e.x + 8, e.y + e.h - 4, 3, 3);
      ctx.fillRect(e.x + e.w - 12, e.y + e.h - 2, 2, 2);
    }
  },
});

def("drone", {
  role: "zoner",
  hp: 2,
  w: 40,
  h: 28,
  extra: 20,
  pts: 55,
  material: "metal",
  stompable: false,
  init: () => ({ ph: Math.random() * 6, fireCd: 1.1, eye: true }),
  ai(e, dt, a) {
    e.st = (e.st || 0) + dt;
    e.y = GROUND - 130 + Math.sin(e.st * 2.2 + (e.ph || 0)) * 14;
    e.fireCd = (e.fireCd ?? 1.1) - dt;
    if (e.fireCd <= 0.35 && e.fireCd > 0) e.state = "tell";
    if (e.fireCd <= 0 && e.x < a.W - 60) {
      e.fireCd = 1.6;
      e.state = "fire";
      // lead the shot
      const px = a.player.x + 40;
      const py = a.player.y + 40;
      a.spawnProj?.(e.x, e.y + 10, px - e.x, py - e.y);
    }
  },
  onHit(e, amt, a) {
    // eye shot = instant if high damage or super
    if (amt >= 3 && e.eye) {
      e.hp = 0;
      a.popText?.(e.x, e.y - 8, "EYE!");
      return false;
    }
    return false;
  },
  onDeath(e, a) {
    a.dropHeat?.(e.x, e.y);
  },
  draw(ctx, e) {
    const f = getPainted("drone0", DRONE_ROWS, DRONE_PAL, { scale: 3 });
    const tell = e.state === "tell";
    drawSprite(ctx, f.img, e.x + e.w / 2, e.y + e.h, {
      flash: e.flash || 0,
      flashImg: f.flash,
      sy: tell ? 0.9 : 1,
      sx: tell ? 1.1 : 1,
    });
    if (tell) {
      ctx.fillStyle = "#ff1030";
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin((e.st || 0) * 20);
      ctx.fillRect(e.x + e.w / 2 - 3, e.y + 6, 6, 6);
      ctx.globalAlpha = 1;
    }
  },
});

def("beetle", {
  role: "tank",
  hp: 3,
  w: 48,
  h: 48,
  extra: 40,
  pts: 70,
  material: "crystal",
  stompable: true,
  stompDmg: 3,
  init: () => ({ shell: true }),
  onHit(e, amt, a) {
    if (e.shell && amt < 2 && !e._fromStomp) {
      a.popText?.(e.x, e.y - 6, "CLANG");
      a.spark?.(e.x + e.w / 2, e.y + 10);
      // reflect spark visual only
      return true;
    }
    return false;
  },
  onDeath(e, a) {
    a.spawnBeetleMini?.(e.x);
    a.spawnBeetleMini?.(e.x + 28);
  },
  draw(ctx, e) {
    const f = getPainted("beetle0", BEETLE_ROWS, BEETLE_PAL, { scale: 4 });
    drawSprite(ctx, f.img, e.x + e.w / 2, e.y + e.h, { flash: e.flash || 0, flashImg: f.flash });
  },
});

def("golem", {
  role: "tank",
  hp: 6,
  w: 72,
  h: 96,
  extra: -30,
  pts: 140,
  material: "stone",
  stompable: false,
  init: () => ({ armor: true, state: "idle", st: 0 }),
  ai(e, dt, a) {
    e.st = (e.st || 0) + dt;
    if (e.state === "idle" && e.x < a.player.x + 280) {
      e.state = "wind";
      e.st = 0;
    } else if (e.state === "wind" && e.st > 0.55) {
      e.state = "slam";
      e.st = 0;
      a.spawnWave?.(e.x, 1);
      a.shake?.(0.3);
    } else if (e.state === "slam" && e.st > 0.45) {
      e.state = "exposed";
      e.st = 0;
      e.armor = false;
    } else if (e.state === "exposed" && e.st > 1.2) {
      e.state = "idle";
      e.armor = true;
      e.st = 0;
      e.hp = Math.min(e.hp + 1, 6);
    }
  },
  onHit(e, amt, a) {
    if (e.armor) {
      a.spark?.(e.x + e.w, e.y + 40);
      a.popText?.(e.x, e.y - 6, "CLANG");
      a.sfx?.tick?.();
      return true;
    }
    return false;
  },
  draw(ctx, e) {
    const f = getPainted("golem0", GOLEM_ROWS, GOLEM_PAL, { scale: 4 });
    const squash = e.state === "slam" ? 1.15 : e.state === "wind" ? 0.92 : 1;
    drawSprite(ctx, f.img, e.x + e.w / 2, e.y + e.h, {
      sx: squash,
      sy: e.state === "wind" ? 1.08 : 1,
      flash: e.flash || 0,
      flashImg: f.flash,
    });
    if (!e.armor) {
      ctx.fillStyle = "#ff6a1a";
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin((e.st || 0) * 10);
      ctx.fillRect(e.x + e.w * 0.35, e.y + e.h * 0.35, e.w * 0.3, 16);
      ctx.globalAlpha = 1;
    }
  },
});

def("raptor", {
  role: "rusher",
  hp: 2,
  w: 46,
  h: 44,
  extra: 20,
  stompable: true,
  pts: 60,
  material: "flesh",
  init: () => ({ state: "idle", st: 0, vyH: 0 }),
  ai(e, dt, a) {
    e.st = (e.st || 0) + dt;
    const dx = e.x - a.player.x;
    if (e.state === "idle" && dx < 240 && dx > 70) {
      if (!a.player.onGround) {
        e.state = "leap";
        e.st = 0;
        e.vyH = -640;
        e.extra = 320;
      } else {
        e.state = "crouch";
        e.st = 0;
        e.extra = -70;
      }
    } else if (e.state === "crouch" && e.st > 0.4) {
      e.state = "pounce";
      e.st = 0;
      e.extra = 420;
    }
    if (e.state === "leap" || e.state === "pounce") {
      if (e.state === "leap") {
        e.vyH += 1900 * dt;
        e.y += e.vyH * dt;
        if (e.y > GROUND - e.h) {
          e.y = GROUND - e.h;
          e.state = "run";
          e.extra = 40;
        }
      }
      if (e.state === "pounce" && e.st > 0.35) {
        e.state = "run";
        e.extra = 40;
      }
    }
  },
});

def("shade", {
  role: "trap",
  hp: 3,
  w: 34,
  h: 60,
  extra: 25,
  pts: 80,
  material: "ghost",
  stompable: true,
  init: () => ({ phase: 0, solid: false, flick: 0 }),
  ai(e, dt) {
    e.phase = (e.phase || 0) + dt;
    const p = e.phase % 1.4;
    e.flick = p > 0.7 && p < 0.95 ? 1 : 0;
    e.solid = p >= 0.95;
    e.hurts = e.solid;
    e.y = GROUND - 60 + Math.sin(e.phase * 3) * 6;
  },
});

def("thunderbird", {
  role: "zoner",
  hp: 2,
  w: 52,
  h: 32,
  extra: 30,
  pts: 60,
  material: "flesh",
  stompable: true,
  init: () => ({ baseY: 0, state: "cruise", st: 0, ph: Math.random() * 6, markY: 0 }),
  ai(e, dt, a) {
    e.st = (e.st || 0) + dt;
    if (!e.baseY) e.baseY = e.y;
    if (e.state === "cruise") {
      e.y = e.baseY + Math.sin(e.st * 3 + (e.ph || 0)) * 10;
      if (e.x < a.player.x + 300) {
        e.state = "mark";
        e.st = 0;
        e.markY = a.player.y;
      }
    } else if (e.state === "mark" && e.st >= 0.45) {
      e.state = "dive";
      e.st = 0;
    } else if (e.state === "dive") {
      e.y += 380 * dt;
      e.x -= 140 * dt;
      if (e.y > GROUND - 70) e.state = "climb";
    } else if (e.state === "climb") {
      e.y -= 220 * dt;
    }
  },
});

export function materialDeath(e, chunks, burst, api) {
  const d = ENEMIES[e.kind];
  const mat = d?.material || "flesh";
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  if (e._sprite) shatter(chunks, e._sprite, e.x, e.y, { n: mat === "metal" ? 5 : 4, power: mat === "stone" ? 160 : 260 });
  if (mat === "crystal") burst(cx, cy, "#7ff0ff", 16, 200, { ring: true });
  else if (mat === "metal") burst(cx, cy, "#ffb040", 14, 180);
  else if (mat === "ghost") burst(cx, cy, "#6affc0", 12, 140);
  else if (mat === "stone") burst(cx, cy, "#85858c", 10, 120);
  else burst(cx, cy, "#e85d04", 12, 170);
  d?.onDeath?.(e, api);
}
