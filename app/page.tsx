'use client';
import { useEffect, useRef, useState } from 'react';

type Fight = {
  id: string;
  createdAt: string;
  seed: string | null;
  ticks: number;
  winner: string | null;
  count: number;
  user?: string | null;
  leaderboard: Array<{ name: string; imageSrc?: string; url?: string; username?: string; kills: number; damageDealt: number; alive?: boolean }>;
};

export default function HomePage() {
  const [fights, setFights] = useState<Fight[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [playerQuery, setPlayerQuery] = useState<string>('');
  const [topN, setTopN] = useState<string>('all'); // 'all' | '5' | '10'
  const [sortState, setSortState] = useState<Record<string, { key: 'kills' | 'damage' | 'name'; dir: 'asc' | 'desc' }>>({});
  const authLinkRef = useRef<HTMLAnchorElement>(null);

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
      if (!res.ok) throw new Error('Failed');
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
  leaderboard: (it.leaderboard || []).map((p: any) => ({ name: p.name, imageSrc: p.imageSrc, url: p.url, username: p.username, kills: p.kills, damageDealt: p.damageDealt, alive: p.alive })),
      })) as Fight[];
    } catch {
      try { return JSON.parse(localStorage.getItem('fbr.fights') || '[]'); } catch { return []; }
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
                  <img src="/logo.jpg" alt="Logo" className="logo rounded" width={24} height={24} />
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
            {/* <a href="/arena" style={{ textDecoration: 'none' }}><button>Back to Arena</button></a>
            <a ref={authLinkRef} href="/login" style={{ textDecoration: 'none' }}><button>Login</button></a> */}
          </div>
        </div>
      </header>
      <main className="page">
        <section className="fights">
          {!fights.length && (<div style={{ opacity: .7, padding: 16 }}>No saved fights yet. Finish a fight to save it automatically.</div>)}
          {fights.map((f) => (
            <article className="fight-card" key={f.id} data-id={f.id}>
              <div className="fight-head">
                <div>
                  <span className="winner">{f.winner || '—'}</span>
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
                      <th>#</th>
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
                      const rows = (f.leaderboard || [])
                        .filter(p => !q || (p.name || '').toLowerCase().includes(q));
                      const sort = sortState[f.id] || { key: 'kills' as const, dir: 'desc' as const };
                      rows.sort((a,b) => {
                        if (sort.key === 'name') return sort.dir==='asc' ? (a.name||'').localeCompare(b.name||'') : (b.name||'').localeCompare(a.name||'');
                        if (sort.key === 'kills') return sort.dir==='asc' ? (a.kills - b.kills) : (b.kills - a.kills);
                        // damage
                        return sort.dir==='asc' ? (a.damageDealt - b.damageDealt) : (b.damageDealt - a.damageDealt);
                      });
                      const limit = topN === 'all' ? rows.length : Math.min(rows.length, parseInt(topN, 10));
                      return rows.slice(0, limit).map((p, i) => (
                        <tr key={p.name + i} className={p.alive ? '' : 'row-dead'}>
                          <td>{i+1}</td>
                          <td>
                            <span
                              className="avatar"
                              style={{
                                backgroundImage: (() => {
                                  const src = p.imageSrc || '';
                                  if (!src) return '';
                                  // If already proxied, do not wrap again
                                  if (src.startsWith('/api/proxy/image') || src.includes('/api/proxy/image')) return `url("${src}")`;
                                  try {
                                    const u = new URL(src);
                                    const stp = u.searchParams.get('stp');
                                    if (stp && /_s\d+x\d+/.test(stp)) u.searchParams.set('stp', stp.replace(/_s\d+x\d+/, '_s320x320'));
                                    const proxied = `/api/proxy/image?url=${encodeURIComponent(u.toString())}`;
                                    return `url("${proxied}")`;
                                  } catch {
                                    // Relative or invalid -> just use as-is (no proxy)
                                    return `url("${src}")`;
                                  }
                                })() as any,
                              }}
                            />
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
