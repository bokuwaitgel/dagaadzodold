'use client';
import { useEffect, useRef } from 'react';
import { createState, createPerson, makeRngFromSeed, layoutPeople, aliveCount, stepBattle, updateMotion } from '@/lib/state.js';
import { createRenderer } from '@/lib/renderer.js';

export default function ArenaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // auth gate
    try {
      const auth = JSON.parse(localStorage.getItem('fbr.auth') || 'null');
      if (!auth || !auth.username) { window.location.href = '/login'; return; }
    } catch {}

  const canvas = canvasRef.current!;
  const renderer = createRenderer(canvas);
  let rand: any = Math.random;
  let state: any = createState(rand);
    let savedThisWinner = false;

  const aliveBadge = document.getElementById('aliveBadge');
  const aliveSideBadge = document.getElementById('aliveSideBadge');
    const startBtn = document.getElementById('startBtn')!;
    const pauseBtn = document.getElementById('pauseBtn')!;
    const resetBtn = document.getElementById('resetBtn')!;
    const speedRange = document.getElementById('speedRange') as HTMLInputElement;
    const speedLabel = document.getElementById('speedLabel')!;
    const moveRange = document.getElementById('moveRange') as HTMLInputElement;
    const moveLabel = document.getElementById('moveLabel')!;
    const rampRange = document.getElementById('rampRange') as HTMLInputElement;
    const rampLabel = document.getElementById('rampLabel')!;
    const seedInput = document.getElementById('seedInput') as HTMLInputElement;
    const dataFile = document.getElementById('dataFile') as HTMLInputElement;
    const sampleBtn = document.getElementById('sampleBtn')!;
    const downloadLogBtn = document.getElementById('downloadLogBtn')!;
  const winnerModal = document.getElementById('winnerModal')!;
    const winnerTitle = document.getElementById('winnerTitle')!;
    const winnerAvatar = document.getElementById('winnerAvatar')! as HTMLDivElement;
  const winnerUser = document.getElementById('winnerUser')! as HTMLDivElement;
  const replayBtn = document.getElementById('replayBtn')!;
  const approveBtn = document.getElementById('approveBtn')!;
    const closeWinnerBtn = document.getElementById('closeWinnerBtn')!;

    function getAuth() {
      try { return JSON.parse(localStorage.getItem('fbr.auth') || 'null'); } catch { return null; }
    }
    async function saveFightResult() {
      try {
        // Build placement from elimination order + winner
        const N = (state.people as any[]).length;
        const elim = (state.sim.log || []).filter((e: any) => e?.type === 'eliminate');
        elim.sort((a: any, b: any) => (a.t ?? 0) - (b.t ?? 0));
        const placementMap: Record<string, number> = {};
        elim.forEach((e: any, idx: number) => {
          const name = e?.name; if (!name) return;
          // First eliminated gets Nth place, last eliminated gets 2nd place
          placementMap[name] = Math.max(2, N - idx);
        });
        const winName = (state.sim.winner as any)?.name;
        if (winName) placementMap[winName] = 1;

        const ranked = [...(state.people as any[])]
          .map((p: any) => ({
            name: p.name,
            imageSrc: p.img?.src || '',
            url: (p as any).profileUrl || '',
            username: (p as any).username || '',
            kills: p.kills|0,
            damageDealt: Math.round(p.damageDealt || 0),
            alive: !!p.alive,
            placement: placementMap[p.name] ?? null,
          }))
          .sort((a,b) => {
            const pa = a.placement ?? 9999, pb = b.placement ?? 9999;
            if (pa !== pb) return pa - pb;
            return (b.kills - a.kills) || (b.damageDealt - a.damageDealt) || (a.name||'').localeCompare(b.name||'');
          });
        const payload = {
          seed: (seedInput?.value || '').trim() || null,
          ticks: state.sim.ticks,
          winner: (state.sim.winner as any)?.name || null,
          count: state.people.length,
          user: getAuth()?.username || null,
          leaderboard: ranked,
        };
        // POST to API (database)
        const res = await fetch('/api/fights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Failed to save fight');
        // Also keep a short local cache as a fallback for offline
        try {
          const key = 'fbr.fights';
          const fight = { id: `${Date.now()}-local`, createdAt: new Date().toISOString(), ...payload } as any;
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.unshift(fight);
          if (arr.length > 50) arr.length = 50;
          localStorage.setItem(key, JSON.stringify(arr));
        } catch {}
      } catch (e) { console.error(e); }
    }

  function updateHUD() {
    const txt = `Alive: ${aliveCount(state.people)}`;
    if (aliveBadge) aliveBadge.textContent = txt;
    if (aliveSideBadge) aliveSideBadge.textContent = txt;
  }

  function loadImage(url: string) {
    return new Promise<HTMLImageElement>(async (resolve) => {
      // A tiny transparent fallback so p.img is never null
      const transparentData = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

      const loadOne = (src: string, timeoutMs = 8000) => new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        try { (img as any).referrerPolicy = 'no-referrer'; } catch {}
        let timer: any = setTimeout(() => { cleanup(); rej(new Error('timeout')); }, timeoutMs);
        function cleanup() { clearTimeout(timer); img.onload = null!; (img as any).onerror = null; }
        img.onload = async () => { try { if ((img as any).decode) await (img as any).decode(); } catch {} cleanup(); res(img); };
        (img as any).onerror = () => { cleanup(); rej(new Error('load error')); };
        img.src = src;
      });

  // Keep original URL; altering IG stp can cause 403s
  const upgradeIgUrl = (u: string) => u;

      const upgraded = upgradeIgUrl(url);
      const candidates: string[] = [];
      try {
        const u = new URL(upgraded);
        if (/^https?:/i.test(u.protocol)) {
          candidates.push(`/api/proxy/image?url=${encodeURIComponent(u.toString())}`);
          candidates.push(u.toString());
        } else {
          candidates.push(upgraded);
        }
      } catch {
        candidates.push(upgraded);
      }

      for (const src of candidates) {
        try { const im = await loadOne(src); return resolve(im); } catch {}
      }
      // Final fallback: transparent pixel
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.src = transparentData;
      resolve(im);
    });
  }
    function parseCSV(text: string) {
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return [] as any[];
      const header = lines[0].split(',').map(s => s.trim().toLowerCase());
      const idx = (key: string) => header.indexOf(key);
      const nameIdx = idx('name');
      const imageIdx = idx('image');
      const sizeIdx = idx('size');
      const followersIdx = idx('followers') !== -1 ? idx('followers') : idx('count');
      const out: any[] = [];
      for (let i=1;i<lines.length;i++) {
        const cols = lines[i].split(',');
        const rec: any = { name: cols[nameIdx]?.trim() || `Follower ${i}`, image: cols[imageIdx]?.trim() || '' };
        const sizeVal = sizeIdx !== -1 ? Number(cols[sizeIdx]) : NaN;
        const folVal = followersIdx !== -1 ? Number(cols[followersIdx]) : NaN;
        if (!Number.isNaN(sizeVal)) rec.size = sizeVal;
        if (!Number.isNaN(folVal)) rec.followers = folVal;
        out.push(rec);
      }
      return out;
    }
    async function buildPeopleFromRecords(records: any[]) {
      const imgs = await Promise.all(records.map(async (r) => { try { if (r.image) return await loadImage(r.image); } catch {} return null; }));
      const values = records.map(r => typeof r.size === 'number' ? r.size : (typeof r.followers === 'number' ? r.followers : null));
      const nums = values.filter((v: any) => v !== null);
      let minV: number | null = null, maxV: number | null = null;
      if (nums.length) { minV = Math.min(...nums); maxV = Math.max(...nums); }
    state.people = records.map((r, i) => {
        const p = createPerson(rand, i, r.name || `Follower ${i+1}`, imgs[i]);
          // Attach Instagram profile URL if username provided
          if (r.username) {
      (p as any).profileUrl = `https://www.instagram.com/${r.username}/`;
      (p as any).username = r.username;
          }
        // All followers have exactly the same scale (no follower count advantage)
        p.scale = 1;
        return p;
      });
      renderer.resize();
      layoutPeople(rand, state.people, canvas.width, canvas.height);
      state.sim.initialCount = state.people.length;
      updateHUD();
      state.sim.winner = null;
    }

    function showWinner(p: any) {
      if (!p) return;
      state.sim.running = false;
      winnerTitle.textContent = p.name || 'Winner';
      if ((p as any).img) { (winnerAvatar as any).style.backgroundImage = `url(${p.img.src})`; }
      else { (winnerAvatar as any).style.backgroundImage = 'none'; (winnerAvatar as any).style.background = 'linear-gradient(135deg,#242424,#3a3a3a)'; }
      // Set username link if available
      if (winnerUser) {
        winnerUser.textContent = '';
        const uname = (p as any).username;
        if (uname) {
          const a = document.createElement('a');
          a.href = `https://www.instagram.com/${uname}/`;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = `@${uname}`;
          a.style.color = 'inherit';
          a.style.opacity = '0.85';
          a.style.fontSize = '12px';
          winnerUser.appendChild(a);
        }
      }
  winnerModal.classList.remove('hidden');
  winnerModal.setAttribute('aria-hidden','false');
  // manual approval required to save
  if (approveBtn) { approveBtn.removeAttribute('disabled'); approveBtn.textContent = 'Approve & Save'; }
    }
    function hideWinner() { winnerModal.classList.add('hidden'); winnerModal.setAttribute('aria-hidden','true'); }

    startBtn.addEventListener('click', () => { state.sim.running = true; });
    pauseBtn.addEventListener('click', () => { state.sim.running = false; });
    function resetAll() {
  state.people.forEach((p: any) => { p.hp=100; p.alive=true; p.kills=0; p.damageDealt=0; });
      state.sim.ticks = 0; state.sim.winner=null; state.sim.initialCount = state.people.length; state.sim.timeSec = 0; savedThisWinner = false; updateHUD();
    }
    resetBtn.addEventListener('click', resetAll);

    speedRange.addEventListener('input', () => { state.sim.speed = parseFloat(speedRange.value); speedLabel.textContent = `${state.sim.speed.toFixed(1)}x`; });
    moveRange.addEventListener('input', () => { state.sim.moveSpeed = parseFloat(moveRange.value); moveLabel.textContent = `${state.sim.moveSpeed.toFixed(1)}x`; });
  rampRange.addEventListener('input', () => { state.sim.growRate = parseFloat(rampRange.value); rampLabel.textContent = `+${(state.sim.growRate*100).toFixed(1)}%/s`; });
    seedInput.addEventListener('change', () => { rand = makeRngFromSeed(seedInput.value.trim()); (state as any).rand = rand; layoutPeople(rand, state.people, canvas.width, canvas.height); });

    sampleBtn.addEventListener('click', async () => {
      const N = 60;
      const recs = Array.from({length: N}, (_, i) => ({ name: `Follower ${i+1}`, image: `https://picsum.photos/seed/fbr-${i}/128` }));
      await buildPeopleFromRecords(recs);
    });

    dataFile.addEventListener('change', async () => {
      const file = (dataFile.files?.[0]); if (!file) return; const text = await file.text();
      let recs: any[] = [];
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            recs = json.map((r: any, i: number) => {
              const name = r.name || r.full_name || r.username || String(r.pk || r.id || `Follower ${i+1}`);
              const image = r.image || r.profile_pic_url || '';
              const username = r.username || undefined;
              const followersVal = typeof r.follower_count === 'number' ? r.follower_count
                : (typeof r.followers_count === 'number' ? r.followers_count
                : (typeof r.followers === 'number' ? r.followers
                : (typeof r.count === 'number' ? r.count : undefined)));
              const sizeVal = typeof r.size === 'number' ? r.size : undefined;
              return { name, image, username, size: sizeVal, followers: followersVal };
            });
          }
        } else { recs = parseCSV(text); }
      } catch (e: any) { alert('Failed to parse file: ' + e.message); return; }
      await buildPeopleFromRecords(recs);
    });

    replayBtn?.addEventListener('click', () => { hideWinner(); resetAll(); state.sim.running = true; updateHUD(); });
    approveBtn?.addEventListener('click', async () => {
      if (savedThisWinner) return;
      try {
        savedThisWinner = true;
        if (approveBtn) { approveBtn.textContent = 'Saving...'; (approveBtn as any).disabled = true; }
        await saveFightResult();
        if (approveBtn) { approveBtn.textContent = 'Saved'; }
      } catch (e) {
        console.error(e);
        savedThisWinner = false;
        if (approveBtn) { approveBtn.textContent = 'Approve & Save'; (approveBtn as any).disabled = false; }
      }
    });
    closeWinnerBtn?.addEventListener('click', () => hideWinner());
    downloadLogBtn?.addEventListener('click', () => {
      const payload = { generatedAt: new Date().toISOString(), ticks: state.sim.ticks, winner: state.sim.winner?.name || null, events: state.sim.log };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `battle-log-${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    // Drag & drop JSON/CSV
    const overlay = document.createElement('div'); overlay.id = 'dropOverlay'; overlay.textContent = 'Drop JSON/CSV here'; document.body.appendChild(overlay);
    ;['dragenter','dragover'].forEach(ev => document.addEventListener(ev, (e) => { e.preventDefault(); overlay.classList.add('show'); }));
    ;['dragleave','drop'].forEach(ev => document.addEventListener(ev, (e) => { if (ev!== 'drop') e.preventDefault(); overlay.classList.remove('show'); }));
    document.addEventListener('drop', async (e) => {
      e.preventDefault(); const items = Array.from((e as DragEvent).dataTransfer?.files || []); if (!items.length) return;
      const jsonCsv = items.find(f => /\.(json|csv)$/i.test(f.name)); if (!jsonCsv) return;
      const text = await (jsonCsv as File).text(); let recs: any[] = [];
      try {
        if (jsonCsv.name.toLowerCase().endsWith('.json')) {
          const arr = JSON.parse(text);
          if (Array.isArray(arr)) {
            recs = arr.map((r: any, i: number) => {
              const name = r.name || r.full_name || r.username || String(r.pk || r.id || `Follower ${i+1}`);
              const image = r.image || r.profile_pic_url || '';
              const username = r.username || undefined;
              const followersVal = typeof r.follower_count === 'number' ? r.follower_count
                : (typeof r.followers_count === 'number' ? r.followers_count
                : (typeof r.followers === 'number' ? r.followers
                : (typeof r.count === 'number' ? r.count : undefined)));
              const sizeVal = typeof r.size === 'number' ? r.size : undefined;
              return { name, image, username, size: sizeVal, followers: followersVal };
            });
          }
        } else { recs = parseCSV(text); }
      }
      catch(e: any) { alert('Failed to parse: ' + e.message); return; }
      await buildPeopleFromRecords(recs);
    });

    // Loop
    renderer.resize();
  window.addEventListener('resize', () => { renderer.resize(); layoutPeople(rand, state.people, canvas.width, canvas.height); });
    const N = 59;
    (async () => {
      const recs = Array.from({length:N}, (_,i)=>({ name:`Follower ${i+1}`, image:`https://picsum.photos/seed/fbr0-${i}/128` }));
      await buildPeopleFromRecords(recs);
      let last = performance.now();
      function loop(now: number) {
        const dt = Math.min(0.05, (now - last)/1000); last = now;
        if (state.sim.running) {
          state.sim.timeSec = (state.sim.timeSec || 0) + dt;
          stepBattle(state, dt);
          updateMotion(state, dt, canvas.width, canvas.height);
          if (state.sim.winner) { showWinner(state.sim.winner); }
        }
        renderer.pushEffectsFromSim(state.sim);
        renderer.draw(state);
        updateHUD();
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    })();

    return () => {
      // cleanup overlay
      overlay.remove();
    };
  }, []);

  return (
    <>
      <div id="ui">
        <div className="hud">
          <div className="controls">
            <button id="startBtn">Start</button>
            <button id="pauseBtn">Pause</button>
            <button id="resetBtn">Reset</button>
            <button id="approveBtn">Approve &amp; Save</button>
            <label className="group">
              Speed
              <input id="speedRange" type="range" min={0.2} max={10} step={0.1} defaultValue={2 as any} />
              <span id="speedLabel">2x</span>
            </label>
            <label className="group">
              Move
              <input id="moveRange" type="range" min={0.2} max={2} step={0.1} defaultValue={1 as any} />
              <span id="moveLabel">1x</span>
            </label>
            <label className="group">
              Ramp
              <input id="rampRange" type="range" min={0} max={0.1} step={0.005} defaultValue={0.05 as any} />
              <span id="rampLabel">+5.0%/s</span>
            </label>
            <label className="group">
              Seed
              <input id="seedInput" type="text" placeholder="random" />
            </label>
            <label className="group file">
              Load JSON/CSV
              <input id="dataFile" type="file" accept=".json,.csv" />
            </label>
            <button id="sampleBtn" title="Generate 60 sample avatars">Sample 60</button>
            <button id="downloadLogBtn" title="Save the current battle log">Download Log</button>
            <a href="/" title="View saved fights" style={{ textDecoration:'none' }}><button>View Leaderboards</button></a>
          </div>
        </div>
      </div>

      <div id="stageContainer">
        <div className="stage-inner">
          <canvas id="stage" ref={canvasRef} />
          <div id="aliveSideBadge" className="alive-side" aria-live="polite">Alive: 0</div>
        </div>
      </div>

  {/* Arena leaderboard removed */}

      <div id="winnerModal" className="modal hidden" aria-hidden="true" role="dialog">
        <div className="modal-content">
          <div className="win-avatar" id="winnerAvatar" aria-hidden="true" />
          <h2 id="winnerTitle">Winner</h2>
          <div id="winnerUser" style={{ marginTop: 4 }} />
          <div className="modal-actions">
            <button id="replayBtn">Replay</button>
            <button id="closeWinnerBtn">Close</button>
          </div>
        </div>
      </div>
    </>
  );
}
