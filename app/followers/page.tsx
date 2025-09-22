"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';

type IgFollower = {
  pk?: string; id?: string; username?: string; full_name?: string; profile_pic_url?: string;
  is_private?: boolean; is_verified?: boolean;
};

export default function FollowersPage() {
  const [items, setItems] = useState<IgFollower[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => { (async () => {
    try {
      const res = await fetch('/api/followers', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load');
      setItems(await res.json());
    } catch { setItems([]); }
  })(); }, []);

  const filtered = items.filter(it => {
    const s = q.trim().toLowerCase(); if (!s) return true;
    return (it.username||'').toLowerCase().includes(s) || (it.full_name||'').toLowerCase().includes(s);
  });

  return (
    <div style={{ padding: 16, color: '#eaeaea', background: '#0b0b0b', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 12 }}>Followers</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or @" style={{ background:'#1a1a1a', border:'1px solid #333', color:'#eee', borderRadius:8, padding:'8px 10px', width: 280 }} />
        <a href="/arena" style={{ textDecoration:'none' }}><button style={{ background:'#1e1e1e', color:'#eee', border:'1px solid #333', borderRadius:8, padding:'8px 10px', cursor:'pointer' }}>Arena</button></a>
      </div>
      <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
        {filtered.map(f => (
          <li key={(f.pk || f.id || f.username || Math.random()).toString()} style={{ background:'#121212', border:'1px solid #2a2a2a', borderRadius:10, padding:10, display:'flex', gap:10, alignItems:'center' }}>
            {(() => {
              const raw = f.profile_pic_url || '';
              if (!raw) return <span className="avatar" />;
              let src = raw;
              try {
                const u = new URL(raw);
                const host = u.hostname.toLowerCase();
                if (host.includes('instagram') || host.endsWith('fbcdn.net') || host.includes('cdninstagram.com')) {
                  src = `/api/proxy/image?url=${encodeURIComponent(u.toString())}`;
                }
              } catch {}
              if (src.startsWith('/api/proxy/image')) {
                return (
                  <img
                    src={src}
                    alt={f.full_name || f.username || String(f.pk || f.id) || 'avatar'}
                    width={50}
                    height={50}
                    className="avatar"
                    referrerPolicy="no-referrer"
                  />
                );
              }
              return (
                <Image
                  src={src}
                  alt={f.full_name || f.username || String(f.pk || f.id) || 'avatar'}
                  width={50}
                  height={50}
                  className="avatar"
                />
              );
            })()}
            <div style={{ display:'grid' }}>
              <strong style={{ lineHeight:1.2 }}>{f.full_name || f.username || f.pk}</strong>
              {f.username ? (
                <a href={`https://www.instagram.com/${f.username}/`} target="_blank" rel="noopener noreferrer" style={{ opacity:.85, color:'inherit', textDecoration:'none' }}>@{f.username}</a>
              ) : (
                <span style={{ opacity:.7 }}>@{f.username}</span>
              )}
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                {f.is_private ? <span style={{ fontSize:12, opacity:.8, border:'1px solid #333', padding:'2px 6px', borderRadius:6 }}>Private</span> : null}
                {f.is_verified ? <span style={{ fontSize:12, opacity:.8, border:'1px solid #333', padding:'2px 6px', borderRadius:6 }}>Verified</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {filtered.length===0 && (<div style={{ opacity:.7, marginTop:20 }}>No followers</div>)}
    </div>
  );
}
