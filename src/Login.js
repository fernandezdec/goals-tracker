import React, { useState } from 'react';
import { api } from './api';
import { C } from './App';

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [err, setErr]               = useState('');
  const [loading, setLoading]       = useState(false);

  const submit = async () => {
    if (!identifier || !password) return setErr('Username/email and password required');
    setLoading(true); setErr('');
    try {
      const d = await api.login({ username: identifier, password });
      onLogin(d.user, d.token);
    } catch (e) {
      setErr(e.message || 'Login failed');
    }
    setLoading(false);
  };

  const inp = {
    width: '100%', padding: '11px 14px', background: '#1a1a1a',
    border: `1px solid ${C.border}`, borderRadius: 6, color: C.white,
    fontSize: 14, outline: 'none', fontFamily: C.body,
    transition: 'border-color 0.2s',
  };
  const lbl = { fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: C.grey, display: 'block', marginBottom: 6, fontFamily: C.mono };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: C.body }}>
      {/* Background accent */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${C.maroon}, ${C.maroonBright}, ${C.maroon})` }} />

      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>
        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            background: C.maroon, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, boxShadow: `0 0 30px ${C.maroonGlow}`,
          }}>🏆</div>
          <div style={{ fontFamily: C.heading, fontSize: 28, fontWeight: 700, letterSpacing: 5, color: C.white, textTransform: 'uppercase' }}>
            Fontana Steelers
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.maroonBright, letterSpacing: 4, marginTop: 6, textTransform: 'uppercase' }}>
            Team Goals Tracker
          </div>
        </div>

        {/* Card */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
          {/* Header stripe */}
          <div style={{ background: C.maroon, padding: '14px 24px' }}>
            <div style={{ fontFamily: C.heading, fontSize: 14, letterSpacing: 3, color: C.white }}>SIGN IN</div>
          </div>

          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {err && (
              <div style={{ background: C.redDim, border: `1px solid ${C.maroonBright}`, color: '#fca5a5', padding: '10px 14px', borderRadius: 6, fontSize: 13 }}>
                {err}
              </div>
            )}
            <div>
              <label style={lbl}>Username or Email</label>
              <input value={identifier} onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Enter your username or email"
                autoComplete="username" style={inp} />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="••••••••" autoComplete="current-password" style={inp} />
            </div>
            <button onClick={submit} disabled={loading} style={{
              background: loading ? C.maroon : `linear-gradient(135deg, ${C.maroon}, ${C.maroonLight})`,
              color: C.white, border: 'none', borderRadius: 6, padding: '13px',
              fontFamily: C.heading, fontSize: 15, fontWeight: 600, letterSpacing: 3,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              textTransform: 'uppercase', marginTop: 4,
              boxShadow: loading ? 'none' : `0 4px 16px ${C.maroonGlow}`,
            }}>
              {loading ? 'SIGNING IN...' : 'SIGN IN →'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: C.mono, fontSize: 10, color: C.greyDark, letterSpacing: 2 }}>
          FOHI STEELERS · TEAM GOALS · RESTRICTED ACCESS
        </div>
      </div>
    </div>
  );
}
