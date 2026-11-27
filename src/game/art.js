/** Pixel art painter + death chunks for Dino Legend III */
export function paint(rows, pal, { scale = 2, outline = "#07060d", shade = true } = {}) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x, y) => {
    const c = rows[y]?.[x];
    return c && c !== "." && c !== " " ? c : null;
  };
  const cv = document.createElement("canvas");
  cv.width = (w + 2) * scale;
  cv.height = (h + 2) * scale;
  const g = cv.getContext("2d");
  const put = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
  };
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const ch = at(x, y);
      if (!ch) {
        if (outline && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) put(x, y, outline);
        continue;
      }
      const ramp = pal[ch];
      if (!ramp) continue;
      let col = typeof ramp === "string" ? ramp : ramp[0];
      if (shade && typeof ramp !== "string") {
        if (!at(x, y - 1)) col = ramp[1] || col;
        else if (!at(x, y + 1)) col = ramp[2] || col;
      }
      put(x, y, col);
    }
  }
  return cv;
}

export function silhouette(img, color = "#fff") {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function grade(img, tint, a = 0.22) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = a;
  g.fillStyle = tint;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function drawSprite(ctx, img, x, y, o = {}) {
  if (!img) return;
  const { sx = 1, sy = 1, rot = 0, flip = false, alpha = 1, flash = 0, flashImg, ax = 0.5, ay = 1 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (rot) ctx.rotate(rot);
  ctx.scale((flip ? -1 : 1) * sx, sy);
  ctx.drawImage(img, -img.width * ax, -img.height * ay);
  if (flash > 0 && flashImg) {
    ctx.globalAlpha = flash * alpha;
    ctx.drawImage(flashImg, -img.width * ax, -img.height * ay);
  }
  ctx.restore();
}

export function shatter(chunks, img, x, y, { n = 4, power = 240, up = 220, life = 1.0 } = {}) {
  if (!img) return;
  const cw = Math.max(1, img.width / n);
  const ch = Math.max(1, img.height / n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      chunks.push({
        img,
        sx: i * cw,
        sy: j * ch,
        w: cw,
        h: ch,
        x: x + i * cw,
        y: y + j * ch,
        vx: ((i - (n - 1) / 2) * power) / n + (Math.random() - 0.5) * 60,
        vy: -up * (0.4 + Math.random()),
        rot: 0,
        vr: (Math.random() - 0.5) * 14,
        life,
        max: life,
        bounced: false,
      });
    }
  }
}

export function stepChunks(chunks, dt, ground) {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    c.vy += 1500 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    c.life -= dt;
    if (c.y + c.h >= ground && !c.bounced) {
      c.y = ground - c.h;
      c.vy *= -0.35;
      c.vx *= 0.6;
      c.bounced = true;
    }
    if (c.life <= 0) chunks.splice(i, 1);
  }
}

export function drawChunks(ctx, chunks) {
  for (const c of chunks) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.life / (c.max * 0.4));
    ctx.translate(Math.round(c.x + c.w / 2), Math.round(c.y + c.h / 2));
    ctx.rotate(c.rot);
    ctx.drawImage(c.img, c.sx, c.sy, c.w, c.h, -c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
}

/** Cache painted frames: key -> canvas */
const cache = new Map();
export function getPainted(key, rows, pal, opts) {
  if (cache.has(key)) return cache.get(key);
  const img = paint(rows, pal, opts);
  const flash = silhouette(img, "#ffffff");
  const entry = { img, flash };
  cache.set(key, entry);
  return entry;
}

export function clearArtCache() {
  cache.clear();
}
