'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type Fight = {
  id: string;
  createdAt: string;
  seed: string | null;
  ticks: number;
  winner: string | null;
  count: number;
  user?: string | null;
  leaderboard: Array<{ name: string; imageSrc?: string; url?: string; username?: string; kills: number; damageDealt: number; alive?: boolean; placement?: number; place?: number; idx?: number }>;
};

export default function HomePage() {
  const [fights, setFights] = useState<Fight[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [playerQuery, setPlayerQuery] = useState<string>('');
  const [topN, setTopN] = useState<string>('all'); // 'all' | '5' | '10'
  const [minKills, setMinKills] = useState<string>('');
  const [minDamage, setMinDamage] = useState<string>('');
  const [sortState, setSortState] = useState<Record<string, { key: 'kills' | 'damage' | 'name' | 'place'; dir: 'asc' | 'desc' }>>({});
  const authLinkRef = useRef<HTMLAnchorElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getAuth(): { username: string } | null {
    try { return JSON.parse(localStorage.getItem('fbr.auth') || 'null'); } catch { return null; }
  }
  async function fetchFights(): Promise<Fight[]> {
    try {
      const res = await fetch('/api/fights', { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${txt || 'Failed to load fights'}`);
      }
      const items = await res.json();
      // Map DB shape to UI type
      return items.map((it: any) => ({
        id: it.id,
        createdAt: it.createdAt,
        seed: it.seed,
        ticks: it.ticks,
        winner: it.winner,
        count: it.count,
        user: it.user,
        leaderboard: (it.leaderboard || []).map((p: any) => ({ name: p.name, imageSrc: p.imageSrc, url: p.url, username: p.username, kills: p.kills, damageDealt: p.damageDealt, alive: p.alive , placement: p.placement, place: p.place, idx: p.idx })),
      })) as Fight[];
    } catch (e: any) {
      const local: Fight[] = (() => { try { return JSON.parse(localStorage.getItem('fbr.fights') || '[]'); } catch { return []; } })();
      if (!local.length) setError(e?.message || 'Failed to load leaderboard.');
      return local;
    }
  }
  function saveFights(arr: Fight[]) { localStorage.setItem('fbr.fights', JSON.stringify(arr)); }

  function fmtTime(t: string) { try { return new Date(t).toLocaleDateString(); } catch { return t; } }

  async function render() {
  const all = await fetchFights();
  // Build date options from existing fights (YYYY-MM-DD), sorted desc
  const days = Array.from(new Set(all.map(f => new Date(f.createdAt).toISOString().slice(0,10)))).sort((a,b)=> b.localeCompare(a));
  setDateOptions(days);
    // Pick selected = latest if none/invalid, and filter to that exact day only
    const latest = days[0] || '';
    const sel = (selectedDate && days.includes(selectedDate)) ? selectedDate : latest;
    if (sel !== selectedDate) setSelectedDate(sel);
    const filtered = sel
      ? all.filter(f => new Date(f.createdAt).toISOString().slice(0,10) === sel)
      : [];
  setFights(filtered);

    const auth = getAuth();
    const link = authLinkRef.current;
    if (link) {
      if (auth && auth.username) {
        link.textContent = 'Logout';
        link.href = '#';
        link.onclick = (e) => { e.preventDefault(); localStorage.removeItem('fbr.auth'); render(); };
      } else {
        link.textContent = 'Login';
        link.href = '/login';
        link.onclick = null;
      }
    }
  }

  // Export/Delete removed

  return (
    <body className="saved">
      <header className="page-header">
        <div className="inner">
                <div className="brand" style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Image src="/logo.jpg" alt="Logo" className="logo rounded" width={24} height={24} />
            <strong>Fights Leaderboard</strong>
          </div>
          <div className="controls">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Date
              <select value={selectedDate} onChange={e=>{ setSelectedDate(e.target.value); render(); }}>
                {dateOptions.length === 0 ? (
                  <option value="" disabled>No dates</option>
                ) : (
                  dateOptions.map(d => (<option key={d} value={d}>{d}</option>))
                )}
              </select>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Search
              <input type="search" placeholder="Player name" value={playerQuery} onChange={e=>setPlayerQuery(e.target.value)} />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Top
              <select value={topN} onChange={e=>setTopN(e.target.value)}>
                <option value="all">All</option>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
              </select>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Kills ≥
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={minKills}
                onChange={e=>setMinKills(e.target.value)}
                style={{ width: 80 }}
              />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Damage ≥
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={minDamage}
                onChange={e=>setMinDamage(e.target.value)}
                style={{ width: 100 }}
              />
            </label>
            {/* <a href="/arena" style={{ textDecoration: 'none' }}><button>Back to Arena</button></a>
            <a ref={authLinkRef} href="/login" style={{ textDecoration: 'none' }}><button>Login</button></a> */}
          </div>
        </div>
      </header>
      <main className="page">
        {error ? (
          <div style={{ background:'#231f20', color:'#ffb3b3', border:'1px solid #3a2a2a', padding:'10px 12px', borderRadius:8, margin:'12px 0' }}>
            {error} – open Arena and finish a fight to save results locally, or configure DATABASE_URL for server storage.
          </div>
        ) : null}
        <section className="fights">
          {!fights.length && (<div style={{ opacity: .7, padding: 16 }}>No saved fights yet. Finish a fight to save it automatically.</div>)}
          {fights.map((f) => (
            <article className="fight-card" key={f.id} data-id={f.id}>
              <div className="fight-head">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {(() => {
                    const w = (f.leaderboard || []).find(p => p.name === f.winner);
                    const raw = w?.imageSrc || '';
                    if (!raw) return null;
                    let src = raw;
                    try {
                      const u = new URL(raw);
                      const host = u.hostname.toLowerCase();
                      if (host.includes('instagram') || host.endsWith('fbcdn.net') || host.includes('cdninstagram.com')) {
                        src = `/api/proxy/image?url=${encodeURIComponent(u.toString())}`;
                      }
                    } catch {}
                    return (
                      <img
                        src={src}
                        alt={f.winner || 'winner'}
                        width={28}
                        height={28}
                        className="avatar"
                        style={{ width: 28, height: 28, marginRight: 0 }}
                        referrerPolicy="no-referrer"
                      />
                    );
                  })()}
                  {(() => {
                    const w = (f.leaderboard || []).find(p => p.name === f.winner);
                    const link = w?.url || (w?.username ? `https://www.instagram.com/${w.username}/` : '');
                    if (link) {
                      return (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="winner" style={{ color:'inherit', textDecoration:'none' }}>
                          {f.winner || '—'}
                        </a>
                      );
                    }
                    return (<span className="winner">{f.winner || '—'}</span>);
                  })()}
                  <span className="meta">• {fmtTime(f.createdAt)} • {f.count} fighters{f.seed ? ` • seed: ${f.seed}` : ''}</span>
                </div>
                <div className="controls">
                  {f.user ? (<span style={{ opacity: .7, fontSize: 12 }}>by {f.user}</span>) : null}
                </div>
              </div>
              <div className="fight-body">
                <table className="lb-table">
                  <thead>
                    <tr>
                      <th style={{cursor:'pointer'}} onClick={()=>{
                        setSortState(s=>{ const cur = s[f.id]||{key:'kills',dir:'desc'}; const key:'place'='place'; const dir = cur.key===key && cur.dir==='asc' ? 'desc' : 'asc'; return {...s, [f.id]: {key, dir}}; });
                      }}>Place {sortState[f.id]?.key==='place' ? (sortState[f.id]?.dir==='asc'?'▲':'▼') : ''}</th>
                      {/* <th>Player</th>
                      <th>Kills</th>
                      <th>Damage</th> */}
                      <th style={{cursor:'pointer'}} onClick={()=>{
                        setSortState(s=>{ const cur = s[f.id]||{key:'kills',dir:'desc'}; const key:'name'='name'; const dir = cur.key===key && cur.dir==='desc' ? 'asc' : 'desc'; return {...s, [f.id]: {key, dir}}; });
                      }}>Player {sortState[f.id]?.key==='name' ? (sortState[f.id]?.dir==='asc'?'▲':'▼') : ''}</th>
                      <th style={{cursor:'pointer'}} onClick={()=>{
                        setSortState(s=>{ const cur = s[f.id]||{key:'kills',dir:'desc'}; const key:'kills'='kills'; const dir = cur.key===key && cur.dir==='desc' ? 'asc' : 'desc'; return {...s, [f.id]: {key, dir}}; });
                      }}>Kills {sortState[f.id]?.key==='kills' ? (sortState[f.id]?.dir==='asc'?'▲':'▼') : ''}</th>
                      <th style={{cursor:'pointer'}} onClick={()=>{
                        setSortState(s=>{ const cur = s[f.id]||{key:'kills',dir:'desc'}; const key:'damage'='damage'; const dir = cur.key===key && cur.dir==='desc' ? 'asc' : 'desc'; return {...s, [f.id]: {key, dir}}; });
                      }}>Damage {sortState[f.id]?.key==='damage' ? (sortState[f.id]?.dir==='asc'?'▲':'▼') : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // derive rows with search, sort, and optional Top N
                      const q = playerQuery.trim().toLowerCase();
                      const mk = Number.isFinite(Number(minKills)) && minKills !== '' ? Number(minKills) : null;
                      const md = Number.isFinite(Number(minDamage)) && minDamage !== '' ? Number(minDamage) : null;
                      const rows = (f.leaderboard || [])
                        .filter(p => !q || (p.name || '').toLowerCase().includes(q))
                        .filter(p => (mk === null ? true : (p.kills || 0) >= mk))
                        .filter(p => (md === null ? true : (p.damageDealt || 0) >= md));
                      const sort = sortState[f.id] || { key: 'kills' as const, dir: 'desc' as const };
                      rows.sort((a,b) => {
                        const dir = sort.dir === 'asc' ? 1 : -1;
                        const pa = (a as any).placement ?? (a as any).place ?? 9999; const pb = (b as any).placement ?? (b as any).place ?? 9999;
                        if (sort.key === 'kills') {
                          if ((a.kills||0) !== (b.kills||0)) return dir * ((a.kills||0) - (b.kills||0));
                        } else if (sort.key === 'damage') {
                          if ((a.damageDealt||0) !== (b.damageDealt||0)) return dir * ((a.damageDealt||0) - (b.damageDealt||0));
                        } else if (sort.key === 'name') {
                          const cmp = (a.name||'').localeCompare(b.name||'');
                          if (cmp) return dir * cmp;
                        } else if (sort.key === 'place') {
                          if (pa !== pb) return dir * (pa - pb);
                        }
                        // fallback by placement/place first (asc)
                        if (pa !== pb) return pa - pb;
                        // secondary tie-breakers: kills desc, then damage desc, then name asc
                        const k = (b.kills||0) - (a.kills||0); if (k) return k;
                        const d = (b.damageDealt||0) - (a.damageDealt||0); if (d) return d;
                        return (a.name||'').localeCompare(b.name||'');
                      });
                      const limit = topN === 'all' ? rows.length : Math.min(rows.length, parseInt(topN, 10));
                      return rows.slice(0, limit).map((p, i) => (
                        <tr key={p.name + i} className={p.alive ? '' : 'row-dead'}>
                          <td>{(p as any).place ?? (p as any).placement ?? (i+1)}</td>
                          <td>
                            {(() => {
                              const raw = p.imageSrc || '';
                              if (!raw) return <span className="avatar" />;
                              let src = raw;
                              try {
                                const u = new URL(raw);
                                const host = u.hostname.toLowerCase();
                                if (host.includes('instagram') || host.endsWith('fbcdn.net') || host.includes('cdninstagram.com')) {
                                  src = `/api/proxy/image?url=${encodeURIComponent(u.toString())}`;
                                }
                              } catch {}
                              if (src.startsWith('/api/proxy/image') || src.includes('/api/proxy/image')) {
                                return (
                                  <img
                                    src={src}
                                    alt={p.name}
                                    width={50}
                                    height={50}
                                    className="avatar"
                                    style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid #333', marginRight: 8 }}
                                    referrerPolicy="no-referrer"
                                  />
                                );
                              }
                              return (
                                <Image
                                  src={src}
                                  alt={p.name}
                                  width={50}
                                  height={50}
                                  className="avatar"
                                  style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid #333', marginRight: 8 }}
                                />
                              );
                            })()}
                            <div style={{ display:'grid' }}>
                              {p.url ? (
                                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{p.name}</a>
                              ) : (
                                p.name
                              )}
                              {p.username ? (
                                <a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noopener noreferrer" style={{ opacity:.8, color:'inherit', fontSize:12 }}>@{p.username}</a>
                              ) : null}
                            </div>
                          </td>
                          <td>{p.kills}</td>
                          <td>{p.damageDealt}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      </main>
    </body>
  );
}
