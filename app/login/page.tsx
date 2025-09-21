'use client';
import { useRef } from 'react';

const username = 'dagaadzodold'
const password = 'dagaadzodold123#'

export default function LoginPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  function setAuth(user: any){ if (user) localStorage.setItem('fbr.auth', JSON.stringify(user)); else localStorage.removeItem('fbr.auth'); }
  function onLogin() {
    const u = (inputRef.current?.value||'').trim();
    const p = (passRef.current?.value||'').trim();
    if (!u || !p) return;

    if (u !== username || p !== password) return;

    // Demo-only: we don't validate password against a server; password is not stored
    setAuth({ username: u });
    window.location.href = '/arena';
  }
  return (
    <div style={{ display:'grid', placeItems:'center', minHeight:'100vh', background:'#0b0b0b', color:'#eaeaea' }}>
      <div style={{ background:'#121212', border:'1px solid #2a2a2a', borderRadius:12, padding:'20px 22px', width:'min(92vw,380px)' }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>Login</div>
        <div style={{ display:'grid', gap:8 }}>
          <input ref={inputRef} placeholder="username" autoComplete="username" style={{ background:'#1a1a1a', border:'1px solid #333', color:'#eee', borderRadius:8, padding:'10px 12px' }} onKeyDown={(e)=>{ if (e.key==='Enter') onLogin(); }} />
          <input ref={passRef} type="password" placeholder="password" autoComplete="current-password" style={{ background:'#1a1a1a', border:'1px solid #333', color:'#eee', borderRadius:8, padding:'10px 12px' }} onKeyDown={(e)=>{ if (e.key==='Enter') onLogin(); }} />
          <button onClick={onLogin} style={{ background:'#1e1e1e', color:'#eee', border:'1px solid #333', borderRadius:8, padding:'10px 12px', cursor:'pointer' }}>Login</button>
        </div>
        {/* <div style={{ opacity:.7 as any, fontSize:12, marginTop:8 }}>login only: password is required but not stored or validated against a server.</div> */}
      </div>
    </div>
  );
}
