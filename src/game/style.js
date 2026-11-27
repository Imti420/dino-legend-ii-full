/** Style meter — ranks D/C/B/A/S with score multiplier */
const RANKS = [
  { name: "D", min: 0, mult: 1 },
  { name: "C", min: 40, mult: 1.1 },
  { name: "B", min: 100, mult: 1.25 },
  { name: "A", min: 200, mult: 1.5 },
  { name: "S", min: 350, mult: 2 },
];

export function createStyle() {
  let v = 0;
  let idle = 0;
  let rank = "D";
  let best = "D";
  let stats = { grazes: 0, stomps: 0, parries: 0, chains: 0 };
  let lastPop = "";
  let lastPopT = 0;

  function rankOf(val) {
    let r = RANKS[0];
    for (const x of RANKS) if (val >= x.min) r = x;
    return r;
  }

  return {
    reset() {
      v = 0;
      idle = 0;
      rank = "D";
      best = "D";
      stats = { grazes: 0, stomps: 0, parries: 0, chains: 0 };
      lastPop = "";
      lastPopT = 0;
    },
    add(n, label) {
      v = Math.min(500, v + n);
      idle = 0;
      const r = rankOf(v);
      if (r.name !== rank) {
        rank = r.name;
        if (RANKS.findIndex((x) => x.name === rank) > RANKS.findIndex((x) => x.name === best)) best = rank;
      }
      if (label) {
        lastPop = label;
        lastPopT = 0.9;
      }
    },
    hit() {
      v = 0;
      idle = 0;
      rank = "D";
    },
    update(dt) {
      idle += dt;
      if (idle > 2) v = Math.max(0, v - 6 * dt);
      const r = rankOf(v);
      rank = r.name;
      lastPopT = Math.max(0, lastPopT - dt);
    },
    mult() {
      return rankOf(v).mult;
    },
    snapshot() {
      return { v, rank, best, mult: rankOf(v).mult, stats: { ...stats }, lastPop, lastPopT };
    },
    note(kind) {
      if (kind === "graze") stats.grazes++;
      if (kind === "stomp") stats.stomps++;
      if (kind === "parry") stats.parries++;
      if (kind === "chain") stats.chains++;
    },
  };
}
