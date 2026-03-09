import React, { useState, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from './api';
import Login from './Login';
import Dashboard from './Dashboard';
import GroupView from './GroupView';

// ── School color palette ──────────────────────────────────────────────────────
export const C = {
  bg:           '#0a0a0a',
  surface:      '#131313',
  card:         '#181818',
  border:       '#252525',
  borderHover:  '#3a3a3a',
  maroon:       '#7B1C25',
  maroonLight:  '#9B2335',
  maroonBright: '#C41E3A',
  maroonGlow:   'rgba(123,28,37,0.15)',
  white:        '#F5F5F5',
  offWhite:     '#E8E8E8',
  grey:         '#9CA3AF',
  greyDark:     '#6B7280',
  greyDeep:     '#374151',
  green:        '#16a34a',
  greenDim:     '#14532d',
  yellow:       '#ca8a04',
  yellowDim:    '#713f12',
  red:          '#dc2626',
  redDim:       '#7f1d1d',
  mono:         "'JetBrains Mono', monospace",
  heading:      "'Oswald', sans-serif",
  body:         "'Inter', sans-serif",
};

// ── Progress calculation ──────────────────────────────────────────────────────
export function calcProgress(goal) {
  const { current_value: cur, target_value: tgt, higher_is_better: hib } = goal;
  if (tgt === 0 && hib === 0) return cur === 0 ? 100 : Math.max(0, 100 - cur * 20);
  if (tgt === 0) return 0;
  if (hib) return Math.min(100, Math.round((cur / tgt) * 100));
  return cur <= tgt ? 100 : Math.min(100, Math.round((tgt / cur) * 100));
}

export function progressColor(pct) {
  if (pct >= 80) return C.green;
  if (pct >= 50) return C.yellow;
  return C.maroonBright;
}

export function progressBg(pct) {
  if (pct >= 80) return C.greenDim;
  if (pct >= 50) return C.yellowDim;
  return 'rgba(123,28,37,0.25)';
}

export default function App() {
  const [user, setUser]     = useState(null);
  const [view, setView]     = useState('dashboard'); // 'dashboard' | 'group'
  const [groupId, setGroupId] = useState(null);
  const [ready, setReady]   = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso_token');

    if (ssoToken) {
      window.history.replaceState({}, '', window.location.pathname);
      api.sso(ssoToken)
        .then(d => { setToken(d.token); setUser(d.user); })
        .catch(() => {})
        .finally(() => setReady(true));
      return;
    }

    if (getToken()) {
      api.me()
        .then(d => setUser(d.user))
        .catch(() => clearToken())
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: C.heading, fontSize: 32, color: C.maroon, letterSpacing: 4 }}>FOHI</div>
        <div style={{ color: C.grey, fontSize: 12, letterSpacing: 2, marginTop: 8 }}>LOADING...</div>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={(u, t) => { setToken(t); setUser(u); }} />;

  if (user.mustChangePw) return <ForceChangePassword user={user} onChanged={() => setUser({ ...user, mustChangePw: false })} onLogout={() => { clearToken(); setUser(null); }} />;

  const openGroup = (id) => { setGroupId(id); setView('group'); };
  const goBack    = ()   => { setView('dashboard'); setGroupId(null); };
  const logout    = ()   => { clearToken(); setUser(null); };

  if (view === 'group') return <GroupView groupId={groupId} user={user} onBack={goBack} onLogout={logout} />;
  return <Dashboard user={user} onOpenGroup={openGroup} onLogout={logout} />;
}

function ForceChangePassword({ user, onChanged, onLogout }) {
  const [cur, setCur]   = useState('');
  const [np, setNp]     = useState('');
  const [np2, setNp2]   = useState('');
  const [err, setErr]   = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErr('');
    if (np.length < 6) return setErr('Min 6 characters');
    if (np !== np2) return setErr("Passwords don't match");
    setSaving(true);
    try { await api.changePassword({ currentPassword: cur, newPassword: np }); onChanged(); }
    catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const inp = { width: '100%', padding: '10px 14px', background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, fontSize: 14, outline: 'none', fontFamily: C.body };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: C.body }}>
      <div style={{ background: C.card, border: `1px solid ${C.maroon}`, borderRadius: 12, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: C.heading, fontSize: 22, color: C.maroonBright, letterSpacing: 3 }}>SET YOUR PASSWORD</div>
          <p style={{ fontSize: 12, color: C.grey, marginTop: 8 }}>Welcome, {user.displayName}! Set a new password to continue.</p>
        </div>
        {err && <div style={{ background: C.redDim, border: '1px solid #dc2626', color: '#fca5a5', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{err}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="password" placeholder="Current password" value={cur} onChange={e => setCur(e.target.value)} style={inp} />
          <input type="password" placeholder="New password (min 6)" value={np} onChange={e => setNp(e.target.value)} style={inp} />
          <input type="password" placeholder="Confirm new password" value={np2} onChange={e => setNp2(e.target.value)} style={inp} />
          <button onClick={save} disabled={saving} style={{ background: C.maroon, color: C.white, border: 'none', borderRadius: 6, padding: '12px', fontFamily: C.heading, fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'SAVING...' : 'SET PASSWORD'}
          </button>
          <button onClick={onLogout} style={{ background: 'transparent', color: C.grey, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
