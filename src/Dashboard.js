import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { C, calcProgress, progressColor, progressBg } from './App';
import Scoreboard from './Scoreboard';

export default function Dashboard({ user, onOpenGroup, onLogout, onCoachLogin }) {
  const [groups, setGroups]   = useState([]);
  const [allGoals, setAllGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('overview'); // 'overview' | 'scoreboard' | 'export'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, gs] = await Promise.all([api.groups(), api.goals()]);
      setGroups(g); setAllGoals(gs);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute per-group stats from allGoals
  const groupStats = (gid) => {
    const gGoals = allGoals.filter(g => g.group_id === gid);
    if (!gGoals.length) return { pct: 0, met: 0, total: 0 };
    const met = gGoals.filter(g => calcProgress(g) >= 80).length;
    const avg = Math.round(gGoals.reduce((a, g) => a + calcProgress(g), 0) / gGoals.length);
    return { pct: avg, met, total: gGoals.length };
  };

  // Overall program progress
  const overallPct = allGoals.length
    ? Math.round(allGoals.reduce((a, g) => a + calcProgress(g), 0) / allGoals.length)
    : 0;

  const isCoach = user && ['admin', 'coach'].includes(user.role);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.white }}>
      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 36, height: 36, background: C.maroon, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏆</div>
            <div>
              <div style={{ fontFamily: C.heading, fontSize: 18, letterSpacing: 3, color: C.white }}>FOHI STEELERS</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.maroonBright, letterSpacing: 3 }}>TEAM GOALS TRACKER</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Program progress pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey, letterSpacing: 1 }}>PROGRAM</div>
              <div style={{ background: progressBg(overallPct), border: `1px solid ${progressColor(overallPct)}`, borderRadius: 20, padding: '3px 12px', fontFamily: C.heading, fontSize: 16, color: progressColor(overallPct), letterSpacing: 1 }}>
                {overallPct}%
              </div>
            </div>
            {user ? (
              <>
                <div style={{ fontFamily: C.mono, fontSize: 11, color: C.grey }}>
                  {user.displayName}
                  {isCoach && <span style={{ color: C.maroonBright, marginLeft: 8, fontSize: 9, letterSpacing: 1 }}>COACH</span>}
                </div>
                <button onClick={onLogout} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: C.mono, letterSpacing: 1 }}>
                  SIGN OUT
                </button>
              </>
            ) : (
              <button onClick={onCoachLogin} style={{ background: C.maroon, color: C.white, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontFamily: C.mono, letterSpacing: 1 }}>
                COACH LOGIN
              </button>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 0, borderTop: `1px solid ${C.border}` }}>
          {[['overview', 'OVERVIEW'], ['scoreboard', 'SCOREBOARD'], ...(isCoach ? [['export', 'EXPORT / IMPORT']] : [])].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: 'transparent', border: 'none', borderBottom: tab === key ? `2px solid ${C.maroon}` : '2px solid transparent',
              color: tab === key ? C.white : C.grey, padding: '10px 20px', cursor: 'pointer',
              fontFamily: C.mono, fontSize: 11, letterSpacing: 2, fontWeight: tab === key ? 600 : 400,
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>
        {tab === 'overview' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', color: C.grey, padding: 60, fontFamily: C.mono, letterSpacing: 2 }}>LOADING...</div>
            ) : (
              <>
                {/* Season headline banner */}
                <div style={{ background: `linear-gradient(135deg, ${C.maroon} 0%, #4a0d14 100%)`, border: `1px solid ${C.maroonLight}`, borderRadius: 12, padding: '24px 32px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
                  <div>
                    <div style={{ fontFamily: C.heading, fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>SEASON PROGRESS</div>
                    <div style={{ fontFamily: C.heading, fontSize: 36, letterSpacing: 2, color: C.white }}>
                      {overallPct}% <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>GOALS ON TRACK</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                    {[
                      ['TOTAL GOALS', allGoals.length],
                      ['ON TRACK', allGoals.filter(g => calcProgress(g) >= 80).length],
                      ['CLOSE', allGoals.filter(g => { const p = calcProgress(g); return p >= 50 && p < 80; }).length],
                      ['BEHIND', allGoals.filter(g => calcProgress(g) < 50).length],
                    ].map(([label, val]) => (
                      <div key={label} style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 700, color: C.white }}>{val}</div>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group cards grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {groups.map(group => {
                    const { pct, met, total } = groupStats(group.id);
                    return (
                      <div key={group.id} onClick={() => onOpenGroup(group.id)}
                        style={{
                          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20,
                          cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.maroon; e.currentTarget.style.boxShadow = `0 4px 24px ${C.maroonGlow}`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 22 }}>{group.icon}</span>
                            <div>
                              <div style={{ fontFamily: C.heading, fontSize: 14, letterSpacing: 2, color: C.white }}>{group.display_name.toUpperCase()}</div>
                              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.grey, letterSpacing: 1 }}>{total} GOALS</div>
                            </div>
                          </div>
                          <div style={{ fontFamily: C.heading, fontSize: 24, color: progressColor(pct), letterSpacing: 1 }}>{pct}%</div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: progressColor(pct), borderRadius: 3, transition: 'width 0.8s ease' }} />
                        </div>

                        {/* Met / total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey }}>
                            <span style={{ color: progressColor(pct), fontWeight: 600 }}>{met}</span> / {total} on track
                          </div>
                          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.maroonBright, letterSpacing: 1 }}>VIEW →</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'scoreboard' && <Scoreboard user={user} />}
        {tab === 'export' && isCoach && <ExportImport />}
      </div>
    </div>
  );
}

// ── Export / Import panel ─────────────────────────────────────────────────────
function ExportImport() {
  const [msg, setMsg]       = useState('');
  const [importing, setImp] = useState(false);
  const [fileData, setFile] = useState(null);

  const doExport = async () => {
    try {
      const blob = await api.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `goals-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
      setMsg('Export complete.');
    } catch (e) { setMsg('Export failed: ' + e.message); }
  };

  const doImport = async () => {
    if (!fileData) return setMsg('Select a backup file first.');
    setImp(true); setMsg('');
    try {
      const result = await api.import(fileData);
      setMsg(`Import complete — ${result.updated} goals updated.`);
    } catch (e) { setMsg('Import failed: ' + e.message); }
    setImp(false);
  };

  const readFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { try { setFile(JSON.parse(ev.target.result)); setMsg('File loaded. Click Import to apply.'); } catch { setMsg('Invalid JSON file.'); } };
    reader.readAsText(f);
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 20 };
  const btn  = (color) => ({ background: color, color: C.white, border: 'none', borderRadius: 8, padding: '12px 24px', fontFamily: C.heading, fontSize: 14, letterSpacing: 2, cursor: 'pointer', fontWeight: 600 });

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontFamily: C.heading, fontSize: 20, letterSpacing: 3, color: C.white, marginBottom: 24 }}>EXPORT / IMPORT DATA</div>
      {msg && <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, color: '#86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, fontFamily: C.mono }}>{msg}</div>}

      <div style={card}>
        <div style={{ fontFamily: C.heading, fontSize: 14, letterSpacing: 2, marginBottom: 8, color: C.white }}>EXPORT BACKUP</div>
        <p style={{ fontSize: 13, color: C.grey, marginBottom: 18, lineHeight: 1.6 }}>Downloads a full JSON backup of all goals, progress history, and scoreboard data.</p>
        <button onClick={doExport} style={btn(C.maroon)}>DOWNLOAD BACKUP</button>
      </div>

      <div style={card}>
        <div style={{ fontFamily: C.heading, fontSize: 14, letterSpacing: 2, marginBottom: 8, color: C.white }}>IMPORT DATA</div>
        <p style={{ fontSize: 13, color: C.grey, marginBottom: 18, lineHeight: 1.6 }}>Restore progress values from a previously exported backup. Goal structure stays intact — only current values and history are updated.</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 20px', fontFamily: C.mono, fontSize: 12, color: C.grey, cursor: 'pointer', letterSpacing: 1 }}>
            SELECT FILE
            <input type="file" accept=".json" onChange={readFile} style={{ display: 'none' }} />
          </label>
          <button onClick={doImport} disabled={!fileData || importing} style={{ ...btn(fileData ? C.green : C.greyDeep), opacity: (!fileData || importing) ? 0.6 : 1, cursor: (!fileData || importing) ? 'not-allowed' : 'pointer' }}>
            {importing ? 'IMPORTING...' : 'IMPORT'}
          </button>
        </div>
      </div>
    </div>
  );
}
