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
  return {
    id, name, img,
    hp: 100, // same HP for everyone
    x: 0, y: 0, r: 26,
    alive: true,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    maxSpeed: 80, // same speed for everyone
    hurtTimer: 0,
    ghostTimer: 0,
    scale: 1, // same size for everyone
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
  const packing = 0.45; // lower packing => smaller base radius (more empty space)
  const areaPer = (area * packing) / N;
  const targetR = Math.sqrt(areaPer / Math.PI);
  // Keep visuals within reasonable range
  const base = Math.max(14, Math.min(48, targetR));

  // Everyone gets exactly the same base radius
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
    const r = Math.max(6, rBaseMax * scale);
    const cell = 2 * r + 6; // padding between circles
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
  const globalShrink = 0.85; // global size reduction
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    p.r = Math.max(6, (p.baseR || base) * rScale * globalShrink);
  // Make the fitted radius the new base for later dynamic scaling
  p.baseR = p.r;
  }

  const positions = built.positions.slice(0); // copy
  // No shuffling - keep deterministic order based on input order
  // for (let i = positions.length - 1; i > 0; i--) {
  //   const j = Math.floor(rand() * (i + 1));
  //   const tmp = positions[i]; positions[i] = positions[j]; positions[j] = tmp;
  // }

  // Assign first N positions to people (no modulo, avoid duplicates)
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const pos = positions[i];
    if (pos) { p.x = pos.x; p.y = pos.y; }
    else {
      // Absolute fallback: clamp to center if somehow missing
      p.x = Math.max(margin, Math.min(W - margin, W / 2));
      p.y = Math.max(margin, Math.min(H - margin, H / 2));
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
  const ratio = initial / aliveN;
  const sizeScale = Math.min(3.0, 1.0 + 0.4 * Math.sqrt(ratio - 1)); // Cap at 2x max size
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
  p.r = Math.max(12, b * sizeScale);
  }
  // Handle collisions pairwise with equal-mass reflection and damage
  // Collect all potential deaths first, then process them fairly
  const potentialDeaths = [];
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
        // Equal damage for everyone with minimal randomness for variety
        const relvx = p.vx - q.vx, relvy = p.vy - q.vy; const relAlongN = Math.abs(relvx*nx + relvy*ny);
        const impact = Math.min(80, relAlongN);
        const baseDmg = 10 + impact * 0.1; // Higher base damage, lower impact variance
        // Very small randomness (±10%) for minimal variety
        const rand = state.rand || Math.random;
        const pDmg = baseDmg * (0.9 + 0.2 * rand());
        const qDmg = baseDmg * (0.9 + 0.2 * rand());
        if (p.hitCD === 0) {
          // Very low critical hit chance (2%) for minimal RNG impact
          const critChance = 0.02;
          const isCrit = rand() < critChance;
          const finalDmg = isCrit ? pDmg * 1.5 : pDmg; // Lower crit multiplier
          p.hp -= finalDmg; p.hurtTimer = 0.2; p.hitCD = 0.22; p.lastHitById = q.id; q.damageDealt += finalDmg;
          const color = isCrit ? '#ff4444' : '#f6c05c';
          state.sim.hits.push({ type:'collide', x:p.x, y:p.y, color });
          state.sim.log.push({ t: state.sim.ticks, type:'collision', name: p.name, by: q.name, dmg: Math.round(finalDmg), crit: isCrit });
          // Collect potential deaths instead of processing immediately
          if (p.hp <= 0 && p.alive) {
            potentialDeaths.push({ person: p, killer: people.find(r => r.id === p.lastHitById) });
          }
        }
        if (q.hitCD === 0) {
          // Very low critical hit chance (2%) for minimal RNG impact
          const critChance = 0.02;
          const isCrit = rand() < critChance;
          const finalDmg = isCrit ? qDmg * 1.5 : qDmg; // Lower crit multiplier
          q.hp -= finalDmg; q.hurtTimer = 0.2; q.hitCD = 0.22; q.lastHitById = p.id; p.damageDealt += finalDmg;
          const color = isCrit ? '#ff4444' : '#f6c05c';
          state.sim.hits.push({ type:'collide', x:q.x, y:q.y, color });
          state.sim.log.push({ t: state.sim.ticks, type:'collision', name: q.name, by: p.name, dmg: Math.round(finalDmg), crit: isCrit });
          // Collect potential deaths instead of processing immediately
          if (q.hp <= 0 && q.alive) {
            potentialDeaths.push({ person: q, killer: people.find(r => r.id === q.lastHitById) });
          }
        }
      }
    }
  }
  
  // Process all deaths fairly - allow multiple deaths per step
  for (const death of potentialDeaths) {
    if (death.person.alive) { // Check if still alive (might have been healed)
      death.person.alive = false;
      if (death.killer) death.killer.kills += 1;
      state.sim.deaths.push({ x: death.person.x, y: death.person.y });
      state.sim.log.push({ t: state.sim.ticks, type: 'eliminate', name: death.person.name, by: death.killer?.name });
    }
  }
  // Integrate and wall reflections; enforce constant speed magnitude
  for (let i=0;i<people.length;i++) {
    const p = people[i]; if (!p.alive) continue;
    // ensure non-zero velocity with deterministic direction
    let sp = Math.hypot(p.vx, p.vy);
    const target = p.maxSpeed * mv;
    if (sp < 1e-3) { 
      // Use deterministic angle based on ID instead of random
      const ang = (p.id * 2.4) % (Math.PI * 2); 
      p.vx = Math.cos(ang)*target; p.vy = Math.sin(ang)*target; sp = target; 
    }
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
