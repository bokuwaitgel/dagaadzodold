// state.js - simulation state & logic (no DOM)

// Utilities
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
export function makeRngFromSeed(str) {
  if (!str) return Math.random;
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return mulberry32(h >>> 0);
}
export function randRange(rand, min, max) { return min + (max-min) * rand(); }

export function createPerson(rand, id, name, img) {
  return {
    id, name, img,
    hp: 100,
    x: 0, y: 0, r: 26,
    alive: true,
    vx: (rand()-0.5) * 40,
    vy: (rand()-0.5) * 40,
    maxSpeed: 60 + rand()*60,
    hurtTimer: 0,
    ghostTimer: 0,
    scale: 1,
    hitCD: 0,
    wallCD: 0,
    lastHitById: null,
    // stats
    kills: 0,
    damageDealt: 0,
  };
}

export function layoutPeople(rand, people, W, H) {
  if (!people.length) return;
  // Estimate a reasonable base radius similar to the previous grid-based layout
  const cols = Math.ceil(Math.sqrt(people.length));
  const rows = Math.ceil(people.length / Math.max(1, cols));
  const cellW = W / (cols + 1);
  const cellH = H / (rows + 1);
  const base = Math.max(16, Math.min(38, Math.min(cellW, cellH) * 0.28));

  // Set each person's base radius (respects any sizeFactor set elsewhere)
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const factor = p.sizeFactor || 1;
    p.baseR = base * factor;
    p.r = p.baseR; // start with base; may grow/shrink during sim
  }

  // Random scatter with simple rejection to reduce initial overlaps
  const margin = Math.max(20, base + 8);
  const placed = [];
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    let placedOk = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      const x = margin + rand() * Math.max(1, (W - 2 * margin));
      const y = margin + rand() * Math.max(1, (H - 2 * margin));
      let ok = true;
      for (let j = 0; j < placed.length; j++) {
        const q = placed[j];
        const dx = x - q.x, dy = y - q.y;
        const minD = (p.r + q.r + 6);
        if ((dx * dx + dy * dy) < (minD * minD)) { ok = false; break; }
      }
      if (ok) { p.x = x; p.y = y; placed.push(p); placedOk = true; break; }
    }
    if (!placedOk) {
      // Fallback: place without strict separation to avoid infinite loops on dense crowds
      p.x = margin + rand() * Math.max(1, (W - 2 * margin));
      p.y = margin + rand() * Math.max(1, (H - 2 * margin));
      placed.push(p);
    }
  }
}

export function aliveCount(people) { return people.filter(p => p.alive).length; }

export function stepBattle(state, dt) {
  const { people, sim } = state;
  sim.acc += sim.speed * dt * 60;
  while (sim.acc >= 1) {
    sim.acc -= 1;
    sim.ticks += 1;
    // Winner check only; no attack damage
    const alive = people.filter(p => p.alive);
    if (alive.length <= 1 && !sim.winner) {
      sim.running = false; sim.winner = alive[0] || null;
      if (sim.winner) sim.log.push({ t: sim.ticks, type:'winner', name: sim.winner.name });
      break;
    }
  }
}

export function updateMotion(state, dt, W, H) {
  const { people } = state;
  // dynamic size scaling as followers decrease
  const initial = state.sim.initialCount || people.length || 1;
  const aliveN = people.reduce((n,p)=> n + (p.alive?1:0), 0);
  // Step scaling: each halving of alive count adds +25%, capped at +50%
  const ratio = initial / Math.max(1, aliveN);
  const halvings = Math.max(0, Math.floor(Math.log2(Math.max(1, ratio))));
  const sizeScale = 1 + Math.min(0.5, 0.25 * halvings);
  const baseMv = state.sim.moveSpeed ?? 1;
  const t = state.sim.timeSec || 0;
  const grow = state.sim.growRate ?? 0.05; // UI default ~+5% per second
  const mv = Math.min(10, baseMv * (1 + grow * t));
  for (let i=0;i<people.length;i++) {
    const p = people[i];
    if (!p.alive) continue;
    if (p.hitCD > 0) p.hitCD = Math.max(0, p.hitCD - dt);
    if (p.wallCD > 0) p.wallCD = Math.max(0, p.wallCD - dt);
    // apply dynamic radius (affects collisions and visuals)
    const b = p.baseR || p.r;
    p.r = Math.max(12, b * sizeScale);
  }
  // Handle collisions pairwise with equal-mass reflection and damage
  let deathsThisStep = 0;
  for (let i=0;i<people.length;i++) {
    const p = people[i]; if (!p.alive) continue;
    for (let j=i+1;j<people.length;j++) {
      const q = people[j]; if (!q.alive) continue;
      const dx = p.x - q.x, dy = p.y - q.y; const d2 = dx*dx + dy*dy; if (d2 < 1) continue; const d = Math.sqrt(d2);
      const minDist = p.r + q.r;
      if (d < minDist) {
        const nx = dx/d, ny = dy/d;
        // separate
        const pen = (minDist - d) * 0.5; p.x += nx*pen; p.y += ny*pen; q.x -= nx*pen; q.y -= ny*pen;
        // velocities: swap normal components (equal mass elastic)
        const vp_n = p.vx*nx + p.vy*ny; const vq_n = q.vx*nx + q.vy*ny;
        const dvp_n = vq_n - vp_n; const dvq_n = vp_n - vq_n;
        p.vx += nx * dvp_n; p.vy += ny * dvp_n;
        q.vx += nx * dvq_n; q.vy += ny * dvq_n;
        // collision damage
        const relvx = p.vx - q.vx, relvy = p.vy - q.vy; const relAlongN = Math.abs(relvx*nx + relvy*ny);
        const impact = Math.min(80, relAlongN);
        const dmg = 2 + impact * 0.25;
        if (p.hitCD === 0) {
          p.hp -= dmg; p.hurtTimer = 0.2; p.hitCD = 0.22; p.lastHitById = q.id; q.damageDealt += dmg;
          state.sim.hits.push({ type:'collide', x:p.x, y:p.y, color:'#f6c05c' });
          state.sim.log.push({ t: state.sim.ticks, type:'collision', name: p.name, by: q.name, dmg });
          if (p.hp <= 0 && p.alive) {
            if (deathsThisStep >= 1) { p.hp = 1; }
            else { p.alive = false; const killer = people.find(r => r.id === p.lastHitById); if (killer) killer.kills += 1; state.sim.deaths.push({ x:p.x, y:p.y }); state.sim.log.push({ t: state.sim.ticks, type:'eliminate', name:p.name, by: killer?.name }); deathsThisStep += 1; }
          }
        }
        if (q.hitCD === 0) {
          q.hp -= dmg; q.hurtTimer = 0.2; q.hitCD = 0.22; q.lastHitById = p.id; p.damageDealt += dmg;
          state.sim.hits.push({ type:'collide', x:q.x, y:q.y, color:'#f6c05c' });
          state.sim.log.push({ t: state.sim.ticks, type:'collision', name: q.name, by: p.name, dmg });
          if (q.hp <= 0 && q.alive) {
            if (deathsThisStep >= 1) { q.hp = 1; }
            else { q.alive = false; const killer = people.find(r => r.id === q.lastHitById); if (killer) killer.kills += 1; state.sim.deaths.push({ x:q.x, y:q.y }); state.sim.log.push({ t: state.sim.ticks, type:'eliminate', name:q.name, by: killer?.name }); deathsThisStep += 1; }
          }
        }
      }
    }
  }
  // Integrate and wall reflections; enforce constant speed magnitude
  for (let i=0;i<people.length;i++) {
    const p = people[i]; if (!p.alive) continue;
    // ensure non-zero velocity
    let sp = Math.hypot(p.vx, p.vy);
    const target = p.maxSpeed * mv;
    if (sp < 1e-3) { const ang = Math.random()*Math.PI*2; p.vx = Math.cos(ang)*target; p.vy = Math.sin(ang)*target; sp = target; }
    // normalize to target speed
    p.vx = p.vx / sp * target; p.vy = p.vy / sp * target;
    // move
    p.x += p.vx * dt; p.y += p.vy * dt;
    // walls reflect
    const margin = p.r + 6;
    if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx); }
    if (p.x > W - margin) { p.x = W - margin; p.vx = -Math.abs(p.vx); }
    if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy); }
    if (p.y > H - margin) { p.y = H - margin; p.vy = -Math.abs(p.vy); }
  }
  // Post-motion winner check in case last eliminations occurred here
  const alive = people.filter(p => p.alive);
  if (alive.length <= 1 && !state.sim.winner) {
    state.sim.running = false; state.sim.winner = alive[0] || null;
    if (state.sim.winner) state.sim.log.push({ t: state.sim.ticks, type:'winner', name: state.sim.winner.name });
  }
}

export function createState(rand) {
  return {
    people: [],
    rand,
  sim: { running:false, speed:2, moveSpeed:1, acc:0, ticks:0, timeSec:0, growRate:0.05, winner:null, hits:[], deaths:[], shake:0, log:[] },
  };
}
