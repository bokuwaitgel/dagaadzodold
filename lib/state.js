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
  // Calculate deterministic initial velocity based on ID for consistency
  const angle = (id * 2.4) % (Math.PI * 2); // Spread angles evenly
  const speed = 40;
  const maxHp = 100;
  return {
    id, name, img,
    hp: maxHp,
    maxHp,
    x: 0, y: 0, r: 8,
    alive: true,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    maxSpeed: 80, // same speed for everyone
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
  // Compute a base radius from available area and count to fit everyone.
  const N = people.length;
  const area = Math.max(1, W * H);
  // Adaptive packing: more followers -> lower packing -> smaller circles
  let packing = 0.45;
  if (N > 400) packing = 0.32;
  if (N > 800) packing = 0.26;
  if (N > 1200) packing = 0.22;
  if (N > 1600) packing = 0.20;
  if (N > 2200) packing = 0.18;
  if (N > 3000) packing = 0.16;
  if (N > 4000) packing = 0.14;
  if (N > 6000) packing = 0.12;
  if (N > 8000) packing = 0.10;
  if (N > 12000) packing = 0.08;
  const areaPer = (area * packing) / N;
  const targetR = Math.sqrt(areaPer / Math.PI);
  // Keep visuals within reasonable range
  // Lower upper bound to keep things compact at scale
  const base = Math.max(10, Math.min(34, targetR));

  // Everyone gets exactly the same base   // Map to [1, 2.5] final scale (2.5x at end for stronger effect)

  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    p.baseR = base;
    p.r = p.baseR;
  }

  // Determine a uniform cell size using the max radius so we can place everyone on a hex grid
  const margin = 10; // small visual margin to walls
  let rBaseMax = people.reduce((m, p) => Math.max(m, p.r || base), 0);
  let rScale = 1.0;

  function buildPositions(scale) {
    const r = rBaseMax * scale;
    const cell = 2 * r + 1; // padding between circles
    const dx = cell; // horizontal spacing
    const dy = cell * Math.sin(Math.PI / 3); // hex vertical spacing (~0.866 * cell)
    const positions = [];
    // Fill within bounds (not centered yet)
    for (let row = 0, y = margin; y <= H - margin + 1e-6; row++, y += dy) {
      const offset = (row % 2) ? dx / 2 : 0;
      for (let x = margin + offset; x <= W - margin + 1e-6; x += dx) {
        positions.push({ x, y });
      }
    }
    // Center produced positions within stage by shifting bbox
    if (positions.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of positions) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
      const gridW = maxX - minX, gridH = maxY - minY;
      const shiftX = (W - gridW) / 2 - minX;
      const shiftY = (H - gridH) / 2 - minY;
      for (const p of positions) { p.x = Math.max(margin, Math.min(W - margin, p.x + shiftX)); p.y = Math.max(margin, Math.min(H - margin, p.y + shiftY)); }
    }
    return { positions, rMaxScaled: r };
  }

  // Shrink uniformly until we have at least N unique positions
  let built = buildPositions(rScale);
  let guard = 0;
  while (built.positions.length < N && guard++ < 40) {
    rScale *= 0.90;
    built = buildPositions(rScale);
  }

  // Apply final radius scale uniformly (based on each baseR)
  // Adaptive global shrink for large crowds
  let globalShrink = 0.85;
  if (N > 400) globalShrink = 0.78;
  if (N > 800) globalShrink = 0.72;
  if (N > 1200) globalShrink = 0.68;
  if (N > 1600) globalShrink = 0.64;
  if (N > 2200) globalShrink = 0.60;
  if (N > 3000) globalShrink = 0.58;
  if (N > 4000) globalShrink = 0.52;
  if (N > 6000) globalShrink = 0.48;
  if (N > 8000) globalShrink = 0.40;
  if (N > 12000) globalShrink = 0.32;
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    p.r = Math.max(1, (p.baseR || base) * rScale * globalShrink);
  // Make the fitted radius the new base for later dynamic scaling
  p.baseR = p.r;
  }

  const positions = built.positions.slice(0); // copy
  // Shuffle positions for randomized starting locations
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = positions[i]; positions[i] = positions[j]; positions[j] = tmp;
  }

  // Assign first N positions to people with duplicate prevention
  const usedPositions = new Set();
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const pos = positions[i];
    if (pos) {
      const posKey = `${Math.round(pos.x)},${Math.round(pos.y)}`;
      if (!usedPositions.has(posKey)) {
        p.x = pos.x; 
        p.y = pos.y;
        usedPositions.add(posKey);
      } else {
        // If position is somehow duplicated, find nearby empty spot
        let found = false;
        for (let offset = 10; offset <= 50 && !found; offset += 10) {
          for (let angle = 0; angle < Math.PI * 2 && !found; angle += Math.PI / 4) {
            const newX = pos.x + Math.cos(angle) * offset;
            const newY = pos.y + Math.sin(angle) * offset;
            const newKey = `${Math.round(newX)},${Math.round(newY)}`;
            if (newX >= margin && newX <= W - margin && 
                newY >= margin && newY <= H - margin && 
                !usedPositions.has(newKey)) {
              p.x = newX;
              p.y = newY;
              usedPositions.add(newKey);
              found = true;
            }
          }
        }
        if (!found) {
          // Final fallback: random position with collision check
          let attempts = 0;
          do {
            p.x = margin + rand() * (W - 2 * margin);
            p.y = margin + rand() * (H - 2 * margin);
            const fallbackKey = `${Math.round(p.x)},${Math.round(p.y)}`;
            if (!usedPositions.has(fallbackKey)) {
              usedPositions.add(fallbackKey);
              break;
            }
          } while (++attempts < 20);
        }
      }
    } else {
      // No position available, use random placement
      let attempts = 0;
      do {
        p.x = margin + rand() * (W - 2 * margin);
        p.y = margin + rand() * (H - 2 * margin);
        const fallbackKey = `${Math.round(p.x)},${Math.round(p.y)}`;
        if (!usedPositions.has(fallbackKey)) {
          usedPositions.add(fallbackKey);
          break;
        }
      } while (++attempts < 20);
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
  // Dynamic size scaling as followers are eliminated
  const initial = state.sim.initialCount || people.length || 1;
  const aliveN = people.reduce((n,p)=> n + (p.alive?1:0), 0) || 1;
  // Elimination fraction based scaling for better early visibility with huge crowds
  const eliminatedFrac = Math.min(1, Math.max(0, (initial - aliveN) / Math.max(1, initial - 1)));
  // Ease curve: sharper early growth when initial is large, but still capped.
  // Blend two powers so early part grows enough: f = 0.55*F^0.85 + 0.45*F
  const f = 0.55 * Math.pow(eliminatedFrac, 0.85) + 0.45 * eliminatedFrac;
  // Base mapping (current f already shaped). Keep prior large multiplier if retained manually.
  let sizeScale = 1 + f * 5.5; // f in [0,1]
  // Top-100 overhaul: enforce strong presence. Guarantee at least 5x, then add smooth extra up to +1.5.

  // Global hard cap safeguard (raised so last phase is visible)
  if (sizeScale > 15) sizeScale = 15;
  const baseMv = state.sim.moveSpeed ?? 1;
  const t = state.sim.timeSec || 0;
  const grow = state.sim.growRate ?? 0.1; // UI default ~+10% per second
  const mv = Math.min(10, baseMv * (1 + grow * t));
  for (let i=0;i<people.length;i++) {
    const p = people[i];
    if (!p.alive) continue;
    if (p.hitCD > 0) p.hitCD = Math.max(0, p.hitCD - dt);
    if (p.wallCD > 0) p.wallCD = Math.max(0, p.wallCD - dt);
    // apply dynamic radius (affects collisions and visuals)
  const b = p.baseR || p.r;
  // Шууд өсөлтийг ашиглана. Хэт жижигрүүлэхгүй.
    // Desired target radius (hard max 2.0x original base)
  // Allow larger cap late-game but still bounded.
  const targetR = b * Math.min(15, sizeScale);
    if (p.visualR == null) p.visualR = b;
    // Adaptive smoothing: always active now (removed >1000 guard)
    let lerpK = 0.18 + eliminatedFrac * 0.55; // slightly faster base
    if (eliminatedFrac > 0.55) lerpK = Math.max(lerpK, 0.85);
    if (aliveN <= 300) {
      // Smooth exponential curve for last 100: 5x at 100, 15x at 1
      const t = Math.max(0, Math.min(1, (300 - aliveN) / 99));
      const smoothScale = 5 + 10 * Math.pow(t, 0.85); // 5x to 15x
      const targetSmooth = b * Math.min(15, smoothScale);
      // Accelerate interpolation for last 100
      let boost = 0.8 + 2.2 * t; // 0.8 at 100, 3.0 at 1
      lerpK += boost;
      p.visualR += (targetSmooth - p.visualR) * Math.min(2.0, lerpK);
      // Snap for last 3
      p.r = p.visualR;
    } else {
      p.visualR += (targetR - p.visualR) * Math.min(2.0, lerpK);
      p.r = p.visualR;
    }
    if ( p.r  > 300) p.r = 300; // absolute max safeguard
  }
  // Handle collisions pairwise with equal-mass reflection and damage
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
        // Impact damage
        const relvx = p.vx - q.vx, relvy = p.vy - q.vy; const relAlongN = Math.abs(relvx*nx + relvy*ny);
        const impact = Math.min(100, relAlongN);
        const baseDmg = 10 + impact * 0.1;
        const rand = state.rand || Math.random;
        const critChance = 0.02;
        // Apply to p
        if (p.hitCD === 0) {
          const pVar = baseDmg * (0.9 + 0.2 * rand());
          const pCrit = rand() < critChance;
          const pFinal = pCrit ? pVar * 1.5 : pVar;
          p.hp -= pFinal; p.hurtTimer = 0.2; p.hitCD = 0.22; p.lastHitById = q.id; q.damageDealt += pFinal;
          state.sim.hits.push({ type:'collide', x:p.x, y:p.y, color: pCrit ? '#ff4444' : '#f6c05c' });
          state.sim.log.push({ t: state.sim.ticks, type:'collision', name: p.name, by: q.name, dmg: Math.round(pFinal), crit: pCrit });
        }
        // Apply to q
        if (q.hitCD === 0) {
          const qVar = baseDmg * (0.9 + 0.2 * rand());
          const qCrit = rand() < critChance;
          const qFinal = qCrit ? qVar * 1.5 : qVar;
          q.hp -= qFinal; q.hurtTimer = 0.2; q.hitCD = 0.22; q.lastHitById = p.id; p.damageDealt += qFinal;
          state.sim.hits.push({ type:'collide', x:q.x, y:q.y, color: qCrit ? '#ff4444' : '#f6c05c' });
          state.sim.log.push({ t: state.sim.ticks, type:'collision', name: q.name, by: p.name, dmg: Math.round(qFinal), crit: qCrit });
        }
        // Death resolution for THIS collision only: allow at most one death from this pair
        const pDead = p.alive && p.hp <= 0;
        const qDead = q.alive && q.hp <= 0;
        if (pDead && qDead) {
          // Choose victim deterministically: lower HP (after damage), then lower id
          const pick = (p.hp === q.hp) ? (p.id < q.id ? p : q) : (p.hp < q.hp ? p : q);
          const survivor = pick === p ? q : p;
          // Kill chosen
          pick.alive = false;
          const killer = (pick.lastHitById != null) ? people.find(r=>r.id===pick.lastHitById) : null;
          if (killer) killer.kills += 1;
          state.sim.deaths.push({ x: pick.x, y: pick.y });
          state.sim.log.push({ t: state.sim.ticks, type:'eliminate', name: pick.name, by: killer?.name });
          // Let the other survive at 1 HP minimum
          if (survivor.hp <= 0) survivor.hp = 1;
        } else if (pDead) {
          p.alive = false;
          const killer = (p.lastHitById != null) ? people.find(r=>r.id===p.lastHitById) : null;
          if (killer) killer.kills += 1;
          state.sim.deaths.push({ x: p.x, y: p.y });
          state.sim.log.push({ t: state.sim.ticks, type:'eliminate', name: p.name, by: killer?.name });
        } else if (qDead) {
          q.alive = false;
          const killer = (q.lastHitById != null) ? people.find(r=>r.id===q.lastHitById) : null;
          if (killer) killer.kills += 1;
          state.sim.deaths.push({ x: q.x, y: q.y });
          state.sim.log.push({ t: state.sim.ticks, type:'eliminate', name: q.name, by: killer?.name });
        }
      }
    }
  }
  // Integrate motion & walls + winner check (restored after simultaneous death handling)
  for (let i=0;i<people.length;i++) {
    const p = people[i]; if (!p.alive) continue;
    let sp = Math.hypot(p.vx, p.vy);
    const target = p.maxSpeed * mv;
    if (sp < 1e-3) {
      const ang = (p.id * 2.4) % (Math.PI * 2);
      p.vx = Math.cos(ang)*target; p.vy = Math.sin(ang)*target; sp = target;
    }
    p.vx = p.vx / sp * target; p.vy = p.vy / sp * target;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const margin = p.r + 6;
    if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx); }
    if (p.x > W - margin) { p.x = W - margin; p.vx = -Math.abs(p.vx); }
    if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy); }
    if (p.y > H - margin) { p.y = H - margin; p.vy = -Math.abs(p.vy); }
  }
  const alive = people.filter(p=>p.alive);
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
