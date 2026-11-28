/**
 * Level Maker UI — builds on level-maker-core.js
 * Full editor: palette, timeline, preview, playtest, share codes, My Levels.
 */
import * as LM from "./level-maker-core.js";

const STORAGE_KEY = "dino-legend-my-levels-v1";
const AUTOSAVE_KEY = "dino-legend-maker-draft-v1";

function loadMyLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 20) : [];
  } catch {
    return [];
  }
}
function saveMyLevels(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (_) {}
}
function loadDraft() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveDraft(lv) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(lv));
  } catch (_) {}
}

const ACT_MAP = {
  I: new Set(["cactus", "drone", "saw", "ptero", "raptor", "scorp", "snake", "golem", "bat", "vine", "boulder", "meteor"]),
  II: new Set(["thunderbird", "bolt", "geyser", "stalactite", "beetle", "shade"]),
  III: new Set(["glitch_raptor", "laser_gate", "scarab", "sand_cobra", "gale_hawk", "cloud_manta", "angler", "jelly", "cinder_shard", "void_raptor"]),
  IV: new Set(["bone_hound", "grave_wisp", "crystal_beetle", "prism_bat", "thunder_rhino", "bolt_strike", "cog_crab", "piston_press", "shadow_self", "star_wisp"]),
};

function actOf(id) {
  for (const [a, set] of Object.entries(ACT_MAP)) if (set.has(id)) return a;
  return "?";
}

export function openLevelMaker(api) {
  const { root, catalog, biomeKeys, levels, toRuntime, startAuthored } = api;
  const draft = loadDraft();
  let lv = draft && draft.v ? draft : LM.newLevel(biomeKeys.includes("neon") ? "neon" : biomeKeys[0] || "day");
  let hist = new LM.History(lv);
  let tool = null; // { t, opts }
  let selected = new Set();
  let playhead = 700;
  let zoom = 1; // timeline px per world px scale factor inverse
  let timelineScale = 0.08; // screen px per world px
  let filterAct = "all";
  let search = "";
  let autoTimer = null;
  let stamps = [];
  try {
    stamps = LM.stampsFromLevels(levels || []).slice(0, 40);
  } catch (_) {}

  const host = document.createElement("div");
  host.id = "level-maker";
  host.innerHTML = shellHTML();
  root.appendChild(host);
  const style = document.createElement("style");
  style.textContent = makerCSS();
  host.appendChild(style);

  const $ = (s) => host.querySelector(s);
  const preview = $("#lm-preview");
  const pctx = preview.getContext("2d");
  preview.width = 640;
  preview.height = 360;

  function push() {
    hist.push(lv);
    mark();
    renderAll();
  }
  function mark() {
    lv = LM.markDirty(lv);
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => saveDraft(lv), 500);
  }
  function setLv(next, record = true) {
    lv = next;
    if (record) hist.push(lv);
    mark();
    renderAll();
  }

  function renderAll() {
    renderTop();
    renderPalette();
    renderTimeline();
    renderInspector();
    renderProblems();
    drawPreview();
  }

  function renderTop() {
    const v = LM.validate(lv, catalog, biomeKeys);
    $("#lm-name").value = lv.name;
    $("#lm-len").textContent = lv.length + "px";
    $("#lm-spd").textContent = lv.speed[0] + "→" + lv.speed[1];
    $("#lm-rating").textContent = v.stats.rating + " · " + v.stats.perK + "/k";
    $("#lm-rating").dataset.r = v.stats.rating;
    const can = LM.canPublish(lv, catalog, biomeKeys);
    const pub = $("#lm-pub");
    pub.disabled = !can;
    pub.textContent = can ? "Publish" : lv.verified ? "Fix errors" : "Clear to publish";
    $("#lm-play").disabled = false;
    $("#lm-play").title = v.errors.length ? (v.errors.length + " problems — click to play anyway") : "Playtest this level";
    $("#lm-undo").disabled = !hist.canUndo;
    $("#lm-redo").disabled = !hist.canRedo;
  }

  function renderPalette() {
    const grid = $("#lm-grid");
    const q = search.toLowerCase();
    const items = Object.values(catalog).filter((c) => {
      if (c.hidden) return filterAct === "all";
      if (filterAct !== "all" && actOf(c.id) !== filterAct) return false;
      if (q && !c.label.toLowerCase().includes(q) && !c.id.includes(q)) return false;
      return true;
    });
    grid.innerHTML = items
      .map(
        (c) =>
          `<button type="button" class="lm-card ${tool && tool.t === c.id ? "on" : ""}" data-t="${c.id}" title="${c.label}">
        <span class="lm-pip">${"▮".repeat(Math.min(3, c.cost))}${"▯".repeat(Math.max(0, 3 - Math.min(3, c.cost)))}</span>
        <span class="lm-lab">${c.label}</span>
        <span class="lm-act">${actOf(c.id)}</span>
      </button>`
      )
      .join("");
  }

  function renderTimeline() {
    const track = $("#lm-track");
    const Wpx = Math.max(800, lv.length * timelineScale);
    track.style.width = Wpx + "px";
    // biome strip
    const bio = $("#lm-biomes");
    bio.innerHTML = lv.segments
      .map(
        (s, i) =>
          `<div class="lm-seg" data-i="${i}" style="left:${s.from * timelineScale}px;width:${(s.to - s.from) * timelineScale}px">${s.biome}</div>`
      )
      .join("");
    // objects
    const objs = $("#lm-objs");
    objs.innerHTML = lv.objects
      .map((o) => {
        const c = catalog[o.t];
        const sel = selected.has(o.id) ? " sel" : "";
        return `<div class="lm-dot${sel}" data-id="${o.id}" style="left:${o.x * timelineScale}px" title="${(c && c.label) || o.t}">●</div>`;
      })
      .join("");
    // playhead
    $("#lm-head").style.left = playhead * timelineScale + "px";
    // zones
    $("#lm-safe").style.width = LM.LIMITS.safeStart * timelineScale + "px";
    const endW = (lv.boss ? LM.LIMITS.bossArena : LM.LIMITS.endPad) * timelineScale;
    $("#lm-end").style.width = endW + "px";
    $("#lm-end").style.left = (lv.length - (lv.boss ? LM.LIMITS.bossArena : LM.LIMITS.endPad)) * timelineScale + "px";
  }

  function renderInspector() {
    const box = $("#lm-insp");
    const ids = [...selected];
    if (!ids.length) {
      box.innerHTML = `<div class="lm-muted">Select an object · or arm a tool and click the timeline</div>`;
      return;
    }
    const o = lv.objects.find((x) => x.id === ids[0]);
    if (!o) return;
    const c = catalog[o.t] || { label: o.t, lane: "ground" };
    const laneOpts =
      c.lane === "air" && !c.lockY
        ? `<label>Lane <select id="lm-lane">${["low", "mid", "high"]
            .map((l) => `<option value="${l}" ${o.lane === l ? "selected" : ""}>${l}</option>`)
            .join("")}</select></label>`
        : "";
    box.innerHTML = `
      <strong>${c.label}</strong> @ ${o.x}px
      <label>X <input type="number" id="lm-ox" value="${o.x}" step="20"/></label>
      ${laneOpts}
      <button type="button" class="lm-mini" id="lm-dup">Duplicate</button>
      <button type="button" class="lm-mini danger" id="lm-del">Delete</button>
    `;
    const ox = $("#lm-ox");
    if (ox)
      ox.onchange = () => {
        o.x = LM.snapX(+ox.value);
        push();
      };
    const lane = $("#lm-lane");
    if (lane)
      lane.onchange = () => {
        o.lane = lane.value;
        push();
      };
    const dup = $("#lm-dup");
    if (dup)
      dup.onclick = () => {
        const n = { ...o, id: LM.uid(), x: o.x + 40 };
        lv = { ...lv, objects: [...lv.objects, n] };
        selected = new Set([n.id]);
        push();
      };
    const del = $("#lm-del");
    if (del)
      del.onclick = () => {
        lv = { ...lv, objects: lv.objects.filter((x) => x.id !== o.id) };
        selected = new Set();
        push();
      };
  }

  function renderProblems() {
    const v = LM.validate(lv, catalog, biomeKeys);
    const el = $("#lm-probs");
    el.innerHTML =
      v.errors.map((e) => `<div class="lm-err" data-jump="1">${e}</div>`).join("") +
      v.warnings.map((w) => `<div class="lm-warn">${w}</div>`).join("") +
      (v.errors.length + v.warnings.length === 0 ? `<div class="lm-ok">No problems</div>` : "");
  }

  function drawPreview() {
    const g = pctx;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#0a0a12";
    g.fillRect(0, 0, 640, 360);
    const bKey = LM.biomeAt(lv, playhead);
    // simple biome strip (engine drawers need scroll; approximate)
    const cols = {
      neon: ["#0a0518", "#ff2a6a"],
      tomb: ["#1a1208", "#e8b060"],
      sky: ["#6ec8ff", "#fff"],
      trench: ["#020818", "#1a6a8a"],
      genesis: ["#100818", "#ff6a1a"],
      bone: ["#1a1810", "#c8b090"],
      prism: ["#081820", "#7ff0ff"],
      thunder: ["#0b1020", "#9fb4ff"],
      citadel: ["#14110f", "#ffb040"],
      void: ["#030308", "#ff2a6a"],
      day: ["#87b8e8", "#f0d090"],
      ash: ["#140808", "#8a2610"],
    };
    const c = cols[bKey] || cols.day;
    const gr = g.createLinearGradient(0, 0, 0, 308);
    gr.addColorStop(0, c[0]);
    gr.addColorStop(1, c[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 640, 308);
    g.fillStyle = "#1a1210";
    g.fillRect(0, 308, 640, 52);
    g.fillStyle = "rgba(0,200,80,0.12)";
    g.fillRect(0, 0, Math.max(0, LM.LIMITS.safeStart - (playhead - 320)), 360);
    // objects near playhead
    const viewL = playhead - 320;
    for (const o of lv.objects) {
      const sx = o.x - viewL;
      if (sx < -40 || sx > 680) continue;
      const meta = catalog[o.t] || { lane: "ground", label: o.t };
      let y = 308 - 40;
      if (meta.lane === "air") y = (LM.LANES[o.lane || "mid"] || 180) - 20;
      if (meta.lane === "fall") y = 40;
      g.fillStyle = selected.has(o.id) ? "#ffe066" : "#ff6a1a";
      g.fillRect(sx, y, 28, 28);
      g.fillStyle = "#fff";
      g.font = "9px monospace";
      g.fillText((meta.label || o.t).slice(0, 8), sx - 4, y - 4);
    }
    // player ghost
    g.fillStyle = "#e8d8c8";
    g.fillRect(120, 308 - 48, 36, 48);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(playhead - viewL - 1, 0, 2, 360);
  }

  function placeAt(worldX, lane) {
    if (!tool) return;
    const meta = catalog[tool.t] || { lane: "ground", lethal: true };
    let x = LM.snapX(Math.max(LM.LIMITS.safeStart, Math.min(lv.length - (lv.boss ? LM.LIMITS.bossArena : LM.LIMITS.endPad) - 20, worldX)));
    // Auto-nudge away from other lethal hazards so Playtest is not blocked
    if (meta.lethal !== false) {
      const need = Math.round(LM.jumpSpan(LM.speedAt(lv, x)) * 0.9);
      const sorted = [...lv.objects].sort((a, b) => a.x - b.x);
      for (let guard = 0; guard < 50; guard++) {
        let clash = false;
        for (const o of sorted) {
          const om = catalog[o.t];
          if (!om || !om.lethal) continue;
          if (Math.abs(o.x - x) < need) {
            x = LM.snapX(o.x + need);
            clash = true;
            break;
          }
        }
        if (!clash) break;
      }
      x = Math.min(x, lv.length - (lv.boss ? LM.LIMITS.bossArena : LM.LIMITS.endPad) - 20);
    }
    const o = { id: LM.uid(), x, t: tool.t };
    if (meta.lane === "air" && !meta.lockY) o.lane = lane || "mid";
    if (tool.opts) o.opts = { ...tool.opts };
    lv = { ...lv, objects: [...lv.objects, o] };
    selected = new Set([o.id]);
    playhead = x;
    push();
  }

  function close() {
    saveDraft(lv);
    host.remove();
  }

  // events
  host.addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]");
    if (t && t.dataset.t) {
      tool = { t: t.dataset.t };
      renderPalette();
      return;
    }
    const act = e.target.closest("[data-lm]");
    if (!act) return;
    const a = act.dataset.lm;
    if (a === "back") close();
    if (a === "undo") {
      lv = hist.undo();
      renderAll();
    }
    if (a === "redo") {
      lv = hist.redo();
      renderAll();
    }
    if (a === "play") playtest();
    if (a === "pub") publish();
    if (a === "import") importCode();
    if (a === "spread") {
      const need = Math.round(LM.jumpSpan(LM.speedAt(lv, LM.LIMITS.safeStart)) * 0.95);
      let x = LM.LIMITS.safeStart;
      const objs = [...lv.objects].sort((a, b) => a.x - b.x).map((o) => {
        const m = catalog[o.t];
        if (m && m.lethal) {
          if (o.x < x) o = { ...o, x: LM.snapX(x) };
          x = o.x + need;
        }
        return o;
      });
      lv = { ...lv, objects: objs };
      push();
    }
    if (a === "new") {
      lv = LM.newLevel(biomeKeys.includes("neon") ? "neon" : biomeKeys[0]);
      hist = new LM.History(lv);
      selected = new Set();
      renderAll();
    }
    if (a === "save") saveToMyLevels();
    if (a === "my") showMyLevels();
    if (a === "boss") {
      const b = act.dataset.boss || null;
      lv = { ...lv, boss: b === "none" ? null : b };
      push();
    }
  });

  $("#lm-name").addEventListener("change", () => {
    lv = { ...lv, name: $("#lm-name").value.slice(0, 32) };
    mark();
    renderTop();
  });
  $("#lm-search").addEventListener("input", (e) => {
    search = e.target.value;
    renderPalette();
  });
  host.querySelectorAll("[data-actf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterAct = btn.dataset.actf;
      host.querySelectorAll("[data-actf]").forEach((b) => b.classList.toggle("on", b.dataset.actf === filterAct));
      renderPalette();
    });
  });

  // timeline click
  $("#lm-scroll").addEventListener("click", (e) => {
    const track = $("#lm-track");
    const rect = track.getBoundingClientRect();
    const x = (e.clientX - rect.left) / timelineScale;
    if (e.target.classList.contains("lm-dot")) {
      selected = new Set([e.target.dataset.id]);
      playhead = lv.objects.find((o) => o.id === e.target.dataset.id)?.x || playhead;
      renderAll();
      return;
    }
    playhead = Math.max(0, Math.min(lv.length, LM.snapX(x)));
    if (tool) {
      placeAt(playhead, "mid");
    } else {
      renderTimeline();
      drawPreview();
    }
  });

  // preview click place
  preview.addEventListener("click", (e) => {
    const rect = preview.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 640;
    const sy = ((e.clientY - rect.top) / rect.height) * 360;
    const worldX = playhead - 320 + sx;
    const lane = sy < 120 ? "high" : sy < 200 ? "mid" : "low";
    if (tool) placeAt(worldX, lane);
  });

  // length / speed
  $("#lm-len-range").addEventListener("input", (e) => {
    setLv(LM.setLength(lv, +e.target.value), true);
  });
  $("#lm-spd0").addEventListener("change", (e) => {
    const a = Math.max(500, Math.min(920, +e.target.value));
    lv = { ...lv, speed: [a, Math.max(a, lv.speed[1])] };
    push();
  });
  $("#lm-spd1").addEventListener("change", (e) => {
    const b = Math.max(500, Math.min(920, +e.target.value));
    lv = { ...lv, speed: [Math.min(lv.speed[0], b), b] };
    push();
  });

  // keyboard
  const onKey = (e) => {
    if (!host.isConnected) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      lv = hist.undo();
      renderAll();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
      e.preventDefault();
      lv = hist.redo();
      renderAll();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selected.size) {
        lv = { ...lv, objects: lv.objects.filter((o) => !selected.has(o.id)) };
        selected = new Set();
        push();
      }
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const d = e.key === "ArrowLeft" ? -20 : 20;
      lv = {
        ...lv,
        objects: lv.objects.map((o) => (selected.has(o.id) ? { ...o, x: LM.snapX(o.x + d) } : o)),
      };
      push();
    }
  };
  window.addEventListener("keydown", onKey);

  function playtest() {
    const v = LM.validate(lv, catalog, biomeKeys);
    if (v.errors.length) {
      const msg = "This level has " + v.errors.length + " problem(s):\n\n• " + v.errors.slice(0, 4).join("\n• ") +
        "\n\nPlay anyway? (Publish still needs a clean clear.)";
      if (!confirm(msg)) return;
    }
    if (!lv.objects.length && !lv.boss) {
      alert("Place at least one enemy or a boss first.");
      return;
    }
    let runtime;
    try {
      runtime = toRuntime(lv, catalog);
    } catch (err) {
      alert("Could not build level: " + (err && err.message ? err.message : err));
      return;
    }
    if (!startAuthored) {
      alert("Play engine missing. Refresh the page and try again.");
      return;
    }
    host.style.display = "none";
    try {
      startAuthored(runtime, {
        mode: "test",
        onEnd: ({ cleared, clearMs, deathX }) => {
          host.style.display = "";
          if (cleared) {
            const clean = LM.validate(lv, catalog, biomeKeys).errors.length === 0;
            if (clean) {
              lv = { ...lv, verified: true, clearMs: clearMs || 0 };
              hist.push(lv);
              saveDraft(lv);
              alert("Cleared! Publish unlocked.");
            } else {
              alert("You finished, but fix the red problems before Publish.");
            }
          } else if (deathX != null) {
            playhead = Math.max(0, deathX);
          }
          renderAll();
        },
      });
    } catch (err) {
      host.style.display = "";
      alert("Playtest failed: " + (err && err.message ? err.message : err));
      console.error(err);
    }
  }

  function publish() {
    if (!LM.canPublish(lv, catalog, biomeKeys)) {
      alert("Clear the level in Playtest first, and fix all errors.");
      return;
    }
    const code = LM.encode(lv);
    const ta = document.createElement("textarea");
    ta.value = code;
    host.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      alert("Share code copied!\n\n" + code.slice(0, 80) + "…");
    } catch {
      prompt("Copy share code:", code);
    }
    ta.remove();
  }

  function importCode() {
    const code = prompt("Paste DL share code:");
    if (!code) return;
    const r = LM.decode(code);
    if (r.error) {
      alert(r.error);
      return;
    }
    lv = r.level;
    hist = new LM.History(lv);
    selected = new Set();
    renderAll();
  }

  function saveToMyLevels() {
    const list = loadMyLevels();
    const entry = { id: Date.now().toString(36), name: lv.name, saved: Date.now(), level: lv };
    const i = list.findIndex((x) => x.name === lv.name);
    if (i >= 0) list[i] = entry;
    else list.unshift(entry);
    saveMyLevels(list);
    alert("Saved to My Levels (" + Math.min(20, list.length) + "/20)");
  }

  function showMyLevels() {
    const list = loadMyLevels();
    if (!list.length) {
      alert("No saved levels yet.");
      return;
    }
    const names = list.map((x, i) => i + 1 + ". " + x.name).join("\n");
    const n = prompt("My Levels:\n" + names + "\n\nEnter number to load:");
    const idx = (+n || 0) - 1;
    if (idx < 0 || idx >= list.length) return;
    lv = list[idx].level;
    hist = new LM.History(lv);
    selected = new Set();
    renderAll();
  }

  // biome paint quick
  $("#lm-biome-sel").innerHTML = biomeKeys
    .map((b) => `<option value="${b}">${b}</option>`)
    .join("");
  $("#lm-biome-sel").onchange = (e) => {
    lv = LM.paintSegment(lv, 0, e.target.value);
    // paint all if single segment
    if (lv.segments.length === 1) lv = { ...lv, segments: [{ from: 0, to: lv.length, biome: e.target.value }] };
    push();
  };

  renderAll();
}

function shellHTML() {
  return `
  <div class="lm-root">
    <div class="lm-top">
      <button type="button" class="lm-btn" data-lm="back">← Back</button>
      <input id="lm-name" class="lm-name" maxlength="32" placeholder="Level name"/>
      <label class="lm-meta">Len <input id="lm-len-range" type="range" min="6000" max="30000" step="100" value="12000"/> <span id="lm-len">12000px</span></label>
      <label class="lm-meta">Spd <input id="lm-spd0" type="number" min="500" max="920" value="600" style="width:56px"/>→<input id="lm-spd1" type="number" min="500" max="920" value="760" style="width:56px"/> <span id="lm-spd"></span></label>
      <button type="button" class="lm-btn" id="lm-undo" data-lm="undo">Undo</button>
      <button type="button" class="lm-btn" id="lm-redo" data-lm="redo">Redo</button>
      <span id="lm-rating" class="lm-rating">Normal</span>
      <button type="button" class="lm-btn primary" id="lm-play" data-lm="play">▶ Playtest</button>
      <button type="button" class="lm-btn" id="lm-pub" data-lm="pub">Publish</button>
    </div>
    <div class="lm-main">
      <div class="lm-left">
        <canvas id="lm-preview" width="640" height="360"></canvas>
        <div id="lm-insp" class="lm-insp"></div>
        <div id="lm-probs" class="lm-probs"></div>
      </div>
      <div class="lm-pal">
        <div class="lm-tabs">
          <button type="button" data-actf="all" class="on">All</button>
          <button type="button" data-actf="I">I</button>
          <button type="button" data-actf="II">II</button>
          <button type="button" data-actf="III">III</button>
          <button type="button" data-actf="IV">IV</button>
        </div>
        <input id="lm-search" placeholder="Search…"/>
        <div id="lm-grid" class="lm-grid"></div>
        <div class="lm-boss">
          <div class="lm-muted">Boss</div>
          <button type="button" data-lm="boss" data-boss="none">None</button>
          <button type="button" data-lm="boss" data-boss="pharaoh">Pharaoh</button>
          <button type="button" data-lm="boss" data-boss="leviathan">Leviathan</button>
          <button type="button" data-lm="boss" data-boss="extinction">Extinction</button>
          <button type="button" data-lm="boss" data-boss="hydra">Hydra</button>
          <button type="button" data-lm="boss" data-boss="chronos">Chronos</button>
          <button type="button" data-lm="boss" data-boss="umbra">Umbra</button>
        </div>
        <label class="lm-meta">Biome <select id="lm-biome-sel"></select></label>
        <div class="lm-tools">
          <button type="button" data-lm="new">New</button>
          <button type="button" data-lm="save">Save</button>
          <button type="button" data-lm="my">My Levels</button>
          <button type="button" data-lm="import">Import code</button>
          <button type="button" data-lm="spread">Auto-spread</button>
        </div>
      </div>
    </div>
    <div class="lm-time" id="lm-scroll">
      <div id="lm-track" class="lm-track">
        <div id="lm-safe" class="lm-zone safe"></div>
        <div id="lm-end" class="lm-zone end"></div>
        <div id="lm-biomes" class="lm-biomes"></div>
        <div id="lm-objs" class="lm-objs"></div>
        <div id="lm-head" class="lm-head"></div>
      </div>
    </div>
  </div>`;
}

function makerCSS() {
  return `
#level-maker{position:absolute;inset:0;z-index:50;background:#0c0a10;color:#f0e6d8;font-family:ui-monospace,monospace;font-size:12px;display:flex;flex-direction:column;overflow:hidden}
.lm-root{display:flex;flex-direction:column;height:100%;min-height:0}
.lm-top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;background:#16121c;border-bottom:2px solid #3a2a20}
.lm-btn{background:#1a0c06;color:#ffb020;border:2px solid #ff6a1a;padding:6px 10px;cursor:pointer;font:700 12px monospace;min-height:36px}
.lm-btn:disabled{opacity:.4;cursor:not-allowed}
.lm-btn.primary{background:#ff6a1a;color:#000}
.lm-btn.danger{border-color:#c33;color:#f88}
.lm-name{flex:1;min-width:100px;background:#0a0810;border:2px solid #3a2a20;color:#fff;padding:6px 8px;font:700 13px monospace}
.lm-meta{display:flex;align-items:center;gap:4px;color:#c8b8a0}
.lm-rating{padding:4px 8px;background:#2a1a10;border:1px solid #5a3a20;border-radius:4px}
.lm-rating[data-r="Brutal"]{color:#ff4a4a}
.lm-rating[data-r="Expert"]{color:#ff8a20}
.lm-rating[data-r="Hard"]{color:#ffb020}
.lm-rating[data-r="Chill"]{color:#6affc0}
.lm-main{flex:1;display:flex;min-height:0;gap:0}
.lm-left{flex:1;display:flex;flex-direction:column;min-width:0;padding:8px}
#lm-preview{width:100%;max-width:640px;aspect-ratio:16/9;background:#000;image-rendering:pixelated;border:2px solid #3a2a20;cursor:crosshair}
.lm-insp,.lm-probs{padding:6px;max-height:90px;overflow:auto;background:#120e18;margin-top:6px;border:1px solid #2a2030}
.lm-err{color:#ff6a6a;cursor:pointer}.lm-warn{color:#ffb020}.lm-ok{color:#6affc0}.lm-muted{color:#8a7a6a}
.lm-pal{width:min(280px,36vw);background:#120e18;border-left:2px solid #3a2a20;display:flex;flex-direction:column;min-height:0;padding:6px}
.lm-tabs{display:flex;gap:4px;flex-wrap:wrap}
.lm-tabs button{flex:1;min-height:36px;background:#1a1218;border:1px solid #3a2a20;color:#c8b8a0;cursor:pointer}
.lm-tabs button.on{background:#ff6a1a;color:#000;font-weight:700}
#lm-search{margin:6px 0;padding:6px;background:#0a0810;border:1px solid #3a2a20;color:#fff;width:100%}
.lm-grid{flex:1;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:4px;align-content:start}
.lm-card{background:#1a1218;border:2px solid #3a2a20;color:#f0e6d8;padding:6px;cursor:pointer;text-align:left;min-height:44px;display:flex;flex-direction:column;gap:2px}
.lm-card.on{border-color:#ff6a1a;background:#2a1810}
.lm-lab{font-weight:700;font-size:11px}.lm-act{font-size:9px;color:#8a7a6a}.lm-pip{color:#ffb020;font-size:10px}
.lm-boss{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.lm-boss button{min-height:32px;padding:4px 6px;background:#1a1218;border:1px solid #5a3a20;color:#e8d8c8;cursor:pointer;font-size:10px}
.lm-tools{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.lm-tools button{min-height:36px;flex:1;background:#1a0c06;border:1px solid #ff6a1a;color:#ffb020;cursor:pointer}
.lm-time{height:72px;background:#0a0810;border-top:2px solid #3a2a20;overflow-x:auto;overflow-y:hidden}
.lm-track{position:relative;height:100%;min-width:100%}
.lm-zone{position:absolute;top:0;bottom:0;pointer-events:none}
.lm-zone.safe{left:0;background:rgba(0,200,80,.15)}
.lm-zone.end{background:rgba(200,40,40,.18)}
.lm-biomes{position:absolute;top:0;left:0;right:0;height:22px}
.lm-seg{position:absolute;top:0;height:22px;background:#2a2030;border-right:1px solid #ff6a1a;font-size:9px;padding:2px 4px;overflow:hidden;white-space:nowrap}
.lm-objs{position:absolute;top:24px;left:0;right:0;height:40px}
.lm-dot{position:absolute;top:8px;transform:translateX(-50%);cursor:pointer;color:#ff6a1a;font-size:14px}
.lm-dot.sel{color:#ffe066;filter:drop-shadow(0 0 4px #ff0)}
.lm-head{position:absolute;top:0;bottom:0;width:2px;background:#fff;transform:translateX(-1px);pointer-events:none}
.lm-mini{margin:2px;padding:4px 8px;min-height:32px;background:#1a0c06;border:1px solid #ff6a1a;color:#ffb020;cursor:pointer}
@media(max-width:700px){
  .lm-main{flex-direction:column}
  .lm-pal{width:100%;max-height:40vh;border-left:none;border-top:2px solid #3a2a20}
}
`;
}
