// renderer.js - all canvas/UI rendering & effects (no simulation rules)
import { randRange } from './state.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = canvas.width, H = canvas.height;
  let particles = []; // {x,y,vx,vy,color,ttl}
  let effects = [];   // {type:'line',x1,y1,x2,y2,ttl}
  let shake = 0;
  let time = 0; // frames

  function resize() {
    // Match the CSS-sized canvas inside its centered container
    const cw = Math.max(300, Math.floor(canvas.clientWidth));
    const ch = Math.max(200, Math.floor(canvas.clientHeight));
    canvas.width = cw;
    canvas.height = ch;
    W = canvas.width; H = canvas.height;
  }

  // Hit, death, and attack effects removed
  function addHitBurst() {}
  function addDeathBurst() {}
  function addAttackLine() {}

  function hexWithAlpha(hex, a) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if (!m) return `rgba(255,255,255,${a})`;
    const r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawBackground() {
  // solid clear (no trails/motion blur)
  const ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'));
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0,0,W,H);
    // vignette
    const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);
    g.addColorStop(0, 'rgba(30,30,30,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
  }

  function drawEffects() { /* effects disabled */ }

  function draw(state) {
    time += 1;
    drawBackground();
    const ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'));
    const sx = (Math.random()-0.5) * shake;
    const sy = (Math.random()-0.5) * shake;
    shake *= 0.9;
    ctx.save(); ctx.translate(sx, sy);

    // avatars
    state.people.forEach(p => {
      if (!p.alive) return;
      const r = p.r, scale = p.scale || 1;
      const alpha = 1;
      // gentle floating offsets (visual only)
      const tt = time * 0.05; // ~waves
      const amp = Math.max(3, r * 0.12);
      const fx = p.x + Math.cos(tt + p.id * 0.83) * amp * 0.6;
      const fy = p.y + Math.sin(tt * 1.18 + p.id * 1.11) * amp * 0.5;

      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(fx, fy); ctx.scale(scale, scale);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.closePath(); ctx.clip();
      if (p.img) {
        const size = Math.max(p.img.width, p.img.height);
        const sx = (p.img.width - size) * 0.5; const sy = (p.img.height - size) * 0.5;
        ctx.drawImage(p.img, sx, sy, size, size, -r, -r, 2*r, 2*r);
      } else {
        const g = ctx.createLinearGradient(-r, -r, r, r);
        g.addColorStop(0, '#242424'); g.addColorStop(1, '#3a3a3a');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, 2*r, 2*r);
      }
      ctx.restore();

      ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath();
      ctx.arc(fx, fy, r*scale + 1.5, 0, Math.PI*2);
      if (p.searchMatch) {
        ctx.strokeStyle = '#24d5ff';
        ctx.lineWidth = 3;
      } else {
        // Removed light flash (#a0a0a0) on hurt to avoid white animation effect
        ctx.strokeStyle = '#1b1b1b';
        ctx.lineWidth = 2;
      }
      ctx.stroke(); ctx.restore();

      if (p.searchMatch) {
        ctx.save();
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
  const label = (p.name || p.username || p.nickname || '').slice(0,24);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const tx = fx;
        const ty = fy - r*scale - 14;
        ctx.fillRect(tx - ctx.measureText(label).width/2 - 4, ty - 14, ctx.measureText(label).width + 8, 14);
        ctx.fillStyle = '#cfefff';
        ctx.fillText(label, tx, ty - 2);
        ctx.restore();
      }

      const bw = r * 1.6 * scale, bh = 4; const bxx = fx - bw/2, byy = fy - r*scale - 10;
      ctx.fillStyle = 'rgba(20,20,20,0.9)'; ctx.fillRect(bxx, byy, bw, bh);
  const denom = (p.maxHp || 100);
  const hpFrac = Math.max(0, Math.min(1, p.hp/denom));
      ctx.fillStyle = hpFrac > 0.5 ? '#8bd450' : hpFrac > 0.25 ? '#f6c05c' : '#f25f5c';
      ctx.fillRect(bxx, byy, bw*hpFrac, bh);

      if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - 1/60);
    });

    drawEffects();
    ctx.restore();
  }

  function pushEffectsFromSim(sim) {
    // transfer hits/deaths to renderer queues + shake
  // Clear queues without rendering effects
  while (sim.hits.length) { sim.hits.shift(); }
  while (sim.deaths.length) { sim.deaths.shift(); }
  }

  return { ctx, draw, resize, pushEffectsFromSim };
}
