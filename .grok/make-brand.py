#!/usr/bin/env python3
"""Dino Legend brand cards from the in-game Chrome-dino sprites."""
from PIL import Image, ImageDraw

PAPER = (247, 247, 247)
INK = (83, 83, 83)
FIRE = (232, 93, 4)

SPRITES = "/workspace/public/sprites"

FONT = {
    "D": ["#####", "#   #", "#   #", "#   #", "#   #", "#   #", "#####"],
    "I": ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
    "N": ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
    "O": ["#####", "#   #", "#   #", "#   #", "#   #", "#   #", "#####"],
    "L": ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
    "E": ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
    "G": ["#####", "#    ", "#    ", "# ###", "#   #", "#   #", "#####"],
}


def text_width(text, scale, tracking=1):
    return (5 * len(text) + tracking * (len(text) - 1)) * scale


def draw_text(img, text, x, y, scale, color, tracking=1):
    cx = x
    for ch in text:
        glyph = FONT[ch]
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "#":
                    img.paste(
                        color,
                        (
                            cx + gx * scale,
                            y + gy * scale,
                            cx + (gx + 1) * scale,
                            y + (gy + 1) * scale,
                        ),
                    )
        cx += (5 + tracking) * scale


def ink_sprite(path, box, scale, flip=False):
    im = Image.open(path).convert("RGBA")
    if box:
        im = im.crop(box)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = im.size
    big = im.resize((w * scale, h * scale), Image.NEAREST)
    src = big.load()
    out = Image.new("RGBA", big.size, (0, 0, 0, 0))
    dst = out.load()
    for y in range(big.size[1]):
        for x in range(big.size[0]):
            r, g, b, a = src[x, y]
            if a > 128 and r < 180:
                dst[x, y] = (*INK, 255)
    return out


def paste(canvas, sprite, xy):
    canvas.paste(sprite, xy, sprite)


def blocks(img, origin, cells, scale, color):
    ox, oy = origin
    for cx, cy in cells:
        x = ox + cx * scale
        y = oy + cy * scale
        img.paste(color, (x, y, x + scale, y + scale))


def snout(sprite_img, scale, origin, flip=False):
    """Rightmost (or leftmost if flipped) ink in the head, at the snout's mid height."""
    im = Image.open(sprite_img).convert("RGBA") if isinstance(sprite_img, str) else sprite_img
    # caller passes already-cropped? we'll pass path+box separately
    return None


def snout_tip(path, box, scale, origin, flip=False):
    im = Image.open(path).convert("RGBA").crop(box)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = im.size
    # Head band: upper 36% of the sheet (snout lives here).
    band = range(0, int(h * 0.38))
    cols = []
    for x in range(w):
        ys = []
        for y in band:
            r, g, b, a = im.getpixel((x, y))
            if a > 128 and r < 180:
                ys.append(y)
        if ys:
            cols.append((x, ys))
    if not cols:
        return origin
    # snout is the extreme column
    x, ys = (cols[0] if flip else cols[-1])
    y = ys[len(ys) // 2]
    # place just outside the snout
    px = origin[0] + x * scale + (0 if flip else scale)
    py = origin[1] + y * scale
    return px, py


def fire_plume(img, tip, scale, direction=1):
    """Chunky flame leaving the mouth. direction 1 = right, -1 = left."""
    # Local cells, +x is away from the mouth.
    cells = [
        (0, 0), (1, 0), (2, 0),
        (0, -1), (1, -1), (2, -1), (3, -1),
        (1, -2), (2, -2), (3, -2), (4, -2),
        (2, -3), (3, -3), (4, -3), (5, -3),
        (4, -4), (5, -4), (6, -4),
        (5, -5), (6, -5),
        (6, -2), (7, -3),
        (3, 0), (4, 0),
        (1, 1), (2, 1),
    ]
    ox, oy = tip
    # nudge so the flame starts just outside the teeth
    ox += direction * scale
    oy += scale  # sit on the mouth line, plume rises
    blocks(
        img,
        (ox, oy),
        [(direction * cx, cy) for cx, cy in cells],
        scale,
        FIRE,
    )


def meteor(img, x, y, scale):
    rock = [
        (1, 0), (2, 0),
        (0, 1), (1, 1), (2, 1), (3, 1),
        (0, 2), (1, 2), (2, 2), (3, 2),
        (1, 3), (2, 3),
    ]
    tail = [(-1, -1), (-2, -1), (-2, -2), (-3, -2), (-4, -3), (-3, -3)]
    blocks(img, (x, y), rock, scale, FIRE)
    blocks(img, (x, y), tail, scale, FIRE)


def spikes(img, path, box, scale, origin, flip=False):
    """Three ink horns on the boss skull, plus an orange eye glint."""
    im = Image.open(path).convert("RGBA").crop(box)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = im.size
    # highest ink per column in the head
    top = {}
    for x in range(w):
        for y in range(int(h * 0.4)):
            r, g, b, a = im.getpixel((x, y))
            if a > 128 and r < 180:
                top[x] = y
                break
    if not top:
        return
    xs = sorted(top)
    # horns near the skull, not the snout tip
    # snout is the low-x side when flipped (facing left)
    picks = [xs[len(xs) // 5], xs[len(xs) // 2], xs[2 * len(xs) // 3]]
    horn = [(0, -1), (0, -2), (0, -3), (-1, -1), (1, -1), (0, -4)]
    for i, x in enumerate(picks):
        base = (origin[0] + x * scale, origin[1] + top[x] * scale)
        extra = horn if i == 1 else horn[:-1]
        blocks(img, base, extra, scale, INK)
    # orange eye: a 2-block glint just behind the snout, in the head band
    eye_x = xs[len(xs) // 4]
    eye_y = top[eye_x] + 4
    blocks(img, (origin[0] + eye_x * scale, origin[1] + eye_y * scale), [(0, 0), (1, 0), (0, 1), (1, 1)], max(scale // 2, 2), FIRE)


def build_og():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), PAPER)
    scale_h = 3
    scale_b = 4
    ground_y = 568

    # ground
    horizon = ink_sprite(f"{SPRITES}/2x-horizon.png", (0, 0, 1200, 24), scale_h)
    # tile enough width
    h2 = ink_sprite(f"{SPRITES}/2x-horizon.png", (200, 0, 1400, 24), scale_h)
    paste(img, horizon, (0, ground_y - 8 * scale_h))
    paste(img, h2, (horizon.size[0] - 20, ground_y - 8 * scale_h))

    # clouds in the open paper, clear of the title block
    cloud = ink_sprite(f"{SPRITES}/2x-cloud.png", None, 3)
    paste(img, cloud, (48, 168))
    cloud_s = ink_sprite(f"{SPRITES}/2x-cloud.png", None, 2)
    paste(img, cloud_s, (980, 96))

    # meteors in the side paper, above the title's vertical band edges
    meteor(img, 70, 56, 8)
    meteor(img, 1124, 52, 6)

    # cacti
    cactus = ink_sprite(f"{SPRITES}/2x-obstacle-small.png", (2, 0, 34, 70), 3)
    # feet: cactus sheet height 70, bottom ink roughly last rows
    paste(img, cactus, (48, ground_y - 68 * 3))
    cactus2 = ink_sprite(f"{SPRITES}/2x-obstacle-small.png", (70, 0, 102, 70), 3)
    paste(img, cactus2, (700, ground_y - 66 * 3))

    # hero, facing right
    hero_origin = (200, ground_y - 90 * scale_h)
    hero = ink_sprite(f"{SPRITES}/2x-trex.png", (0, 0, 88, 94), scale_h)
    paste(img, hero, hero_origin)
    tip = snout_tip(f"{SPRITES}/2x-trex.png", (0, 0, 88, 94), scale_h, hero_origin, flip=False)
    fire_plume(img, tip, 6, direction=1)

    # boss, larger, facing the hero
    boss_origin = (832, ground_y - 90 * scale_b)
    boss = ink_sprite(f"{SPRITES}/2x-trex.png", (88, 0, 176, 94), scale_b, flip=True)
    paste(img, boss, boss_origin)
    spikes(img, f"{SPRITES}/2x-trex.png", (88, 0, 176, 94), scale_b, boss_origin, flip=True)

    # title lockup — centered, clear of both skulls
    scale = 15
    lines = ["DINO", "LEGEND"]
    gap_y = 16
    widths = [text_width(t, scale) for t in lines]
    block_w = max(widths)
    block_h = 7 * scale * 2 + gap_y
    x0 = (W - block_w) // 2
    y0 = 46
    for i, line in enumerate(lines):
        tw = widths[i]
        draw_text(
            img,
            line,
            x0 + (block_w - tw) // 2,
            y0 + i * (7 * scale + gap_y),
            scale,
            INK,
        )
    # short fire underline, centered, not a second sentence
    underline_w = 9 * 12
    ux = (W - underline_w) // 2
    uy = y0 + block_h + 14
    for i in range(9):
        img.paste(FIRE, (ux + i * 12, uy, ux + i * 12 + 8, uy + 8))

    return img, {
        "title_box": (x0, y0, x0 + block_w, y0 + block_h),
        "hero": hero_origin,
        "boss": boss_origin,
        "snout": tip,
    }


def build_banner():
    W, H = 1200, 264
    img = Image.new("RGB", (W, H), PAPER)
    ground_y = 230
    scale_g = 2

    horizon = ink_sprite(f"{SPRITES}/2x-horizon.png", (0, 0, 1600, 24), scale_g)
    paste(img, horizon, (0, ground_y - 8 * scale_g))

    cloud = ink_sprite(f"{SPRITES}/2x-cloud.png", None, 2)
    paste(img, cloud, (430, 28))

    meteor(img, 868, 36, 5)
    meteor(img, 1148, 40, 3)

    cactus = ink_sprite(f"{SPRITES}/2x-obstacle-small.png", (104, 0, 136, 70), 2)
    paste(img, cactus, (500, ground_y - 66 * 2))

    # hero running in from the right half, fire toward the boss
    hero_s = 2
    hero_origin = (620, ground_y - 90 * hero_s)
    hero = ink_sprite(f"{SPRITES}/2x-trex.png", (0, 0, 88, 94), hero_s)
    paste(img, hero, hero_origin)
    tip = snout_tip(f"{SPRITES}/2x-trex.png", (0, 0, 88, 94), hero_s, hero_origin, False)
    fire_plume(img, tip, 4, direction=1)

    boss_s = 2
    boss_origin = (960, ground_y - 90 * boss_s)
    boss = ink_sprite(f"{SPRITES}/2x-trex.png", (176, 0, 264, 94), boss_s, flip=True)
    paste(img, boss, boss_origin)
    spikes(img, f"{SPRITES}/2x-trex.png", (176, 0, 264, 94), boss_s, boss_origin, flip=True)

    # lockup: left half, raised above the midline, clear of the bottom fifth
    scale = 9
    lines = ["DINO", "LEGEND"]
    gap_y = 8
    widths = [text_width(t, scale) for t in lines]
    block_w = max(widths)
    x0 = 40
    y0 = 28
    for i, line in enumerate(lines):
        tw = widths[i]
        draw_text(
            img,
            line,
            x0 + (block_w - tw) // 2,
            y0 + i * (7 * scale + gap_y),
            scale,
            INK,
        )
    block_h = 7 * scale * 2 + gap_y
    underline_w = 7 * 8
    ux = x0
    uy = y0 + block_h + 8
    for i in range(7):
        img.paste(FIRE, (ux + i * 8, uy, ux + i * 8 + 6, uy + 6))

    return img, {
        "title_box": (x0, y0, x0 + block_w, y0 + block_h + 16),
        "hero": hero_origin,
        "boss": boss_origin,
        "snout": tip,
    }


def main():
    og, og_meta = build_og()
    ban, ban_meta = build_banner()
    og.save("/workspace/.grok/og-raw.png")
    ban.save("/workspace/.grok/banner-raw.png")
    print("og", og.size, og_meta)
    print("banner", ban.size, ban_meta)


if __name__ == "__main__":
    main()
