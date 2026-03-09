import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { C } from './App';

export default function Scoreboard({ user }) {
  const [weeks, setWeeks]       = useState([]);
  const [selectedWeek, setSel]  = useState(null);
  const [showAddWeek, setAddWk] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newInfo, setNewInfo]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null); // entry id being saved

  const isCoach = user && ['admin', 'coach'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.scoreboard();
      setWeeks(data);
      if (data.length && !selectedWeek) setSel(data[0]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addWeek = async () => {
    if (!newLabel.trim()) return;
    try {
      const week = await api.addWeek({ week_label: newLabel.trim(), game_info: newInfo.trim() || null });
      setWeeks(prev => [week, ...prev]);
      setSel(week);
      setNewLabel(''); setNewInfo(''); setAddWk(false);
    } catch (e) { alert(e.message); }
  };

  const updateEntry = async (entry, field, value) => {
    setSaving(entry.id);
    try {
      const updated = await api.updateEntry(entry.id, {
        actual_val: field === 'actual_val' ? parseFloat(value) || null : entry.actual_val,
        met: field === 'met' ? value : !!entry.met,
      });
      setWeeks(prev => prev.map(w => ({
        ...w,
        metrics: w.metrics.map(m => m.id === updated.id ? updated : m),
      })));
      if (selectedWeek?.id === updated.week_id) {
        setSel(prev => ({ ...prev, metrics: prev.metrics.map(m => m.id === updated.id ? updated : m) }));
      }
    } catch {}
    setSaving(null);
  };

  const inp = { background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: C.mono, width: 90, textAlign: 'center' };

  if (loading) return <div style={{ textAlign: 'center', color: C.grey, padding: 60, fontFamily: C.mono, letterSpacing: 2 }}>LOADING...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: C.heading, fontSize: 22, letterSpacing: 3, color: C.white }}>WEEKLY SCOREBOARD</div>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey, marginTop: 4, letterSpacing: 1 }}>5 KEY GAME METRICS — WIN 3 OF 5, YOU USUALLY WIN</div>
        </div>
        {isCoach && (
          <button onClick={() => setAddWk(v => !v)} style={{ background: C.maroon, color: C.white, border: 'none', borderRadius: 8, padding: '10px 20px', fontFamily: C.heading, fontSize: 12, letterSpacing: 2, cursor: 'pointer' }}>
            + ADD WEEK
          </button>
        )}
      </div>

      {/* Add week form */}
      {showAddWeek && (
        <div style={{ background: C.card, border: `1px solid ${C.maroon}`, borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey, letterSpacing: 1, marginBottom: 6 }}>WEEK LABEL</div>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Week 2" style={{ ...inp, width: 120, textAlign: 'left' }} />
          </div>
          <div>
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey, letterSpacing: 1, marginBottom: 6 }}>GAME INFO (optional)</div>
            <input value={newInfo} onChange={e => setNewInfo(e.target.value)} placeholder="vs. Valley HS" style={{ ...inp, width: 200, textAlign: 'left' }} />
          </div>
          <button onClick={addWeek} style={{ background: C.green, color: C.white, border: 'none', borderRadius: 8, padding: '9px 20px', fontFamily: C.heading, fontSize: 12, letterSpacing: 2, cursor: 'pointer' }}>
            CREATE
          </button>
          <button onClick={() => setAddWk(false)} style={{ background: 'transparent', color: C.grey, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Week selector sidebar */}
        {weeks.length > 1 && (
          <div style={{ minWidth: 140 }}>
            {weeks.map(w => (
              <div key={w.id} onClick={() => setSel(w)}
                style={{
                  padding: '10px 16px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                  background: selectedWeek?.id === w.id ? C.maroon : C.card,
                  border: `1px solid ${selectedWeek?.id === w.id ? C.maroonLight : C.border}`,
                  fontFamily: C.mono, fontSize: 12, color: selectedWeek?.id === w.id ? C.white : C.grey,
                  letterSpacing: 1, transition: 'all 0.15s',
                }}>
                <div style={{ fontWeight: 600 }}>{w.week_label}</div>
                {w.game_info && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{w.game_info}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Scoreboard table */}
        {selectedWeek && (
          <div style={{ flex: 1, minWidth: 320 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Week header */}
              <div style={{ background: C.maroon, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: C.heading, fontSize: 18, letterSpacing: 3, color: C.white }}>{selectedWeek.week_label}</div>
                {selectedWeek.game_info && <div style={{ fontFamily: C.mono, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{selectedWeek.game_info}</div>}
              </div>

              {/* Summary pill row */}
              {(() => {
                const metCount = selectedWeek.metrics?.filter(m => m.met).length || 0;
                const total = selectedWeek.metrics?.length || 5;
                return (
                  <div style={{ background: '#0f0f0f', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: C.mono, fontSize: 11, color: C.grey, letterSpacing: 1 }}>STANDARDS MET:</div>
                    {[...Array(total)].map((_, i) => (
                      <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: i < metCount ? C.green : C.border, border: `2px solid ${i < metCount ? C.green : C.greyDeep}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                        {i < metCount ? '✓' : ''}
                      </div>
                    ))}
                    <div style={{ fontFamily: C.heading, fontSize: 18, color: metCount >= 3 ? C.green : metCount >= 2 ? C.yellow : C.maroonBright, marginLeft: 8 }}>
                      {metCount}/{total} {metCount >= 3 ? '— WIN' : metCount >= 2 ? '— CLOSE' : '— FOCUS'}
                    </div>
                  </div>
                );
              })()}

              {/* Metrics */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['METRIC', 'TARGET', 'ACTUAL', 'MET'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: h === 'MET' ? 'center' : 'left', fontFamily: C.mono, fontSize: 9, letterSpacing: 2, color: C.grey }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selectedWeek.metrics || []).map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: i < selectedWeek.metrics.length - 1 ? `1px solid ${C.border}` : 'none', background: m.met ? 'rgba(22,163,74,0.05)' : 'transparent' }}>
                      <td style={{ padding: '14px 20px', fontFamily: C.mono, fontSize: 13, color: C.white, fontWeight: 600 }}>{m.label}</td>
                      <td style={{ padding: '14px 20px', fontFamily: C.mono, fontSize: 13 }}>
                        <span style={{ background: C.maroonGlow, color: C.maroonBright, border: `1px solid rgba(123,28,37,0.3)`, borderRadius: 4, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{m.target_desc}</span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {isCoach ? (
                          <input
                            defaultValue={m.actual_val ?? ''}
                            onBlur={e => { if (e.target.value !== String(m.actual_val ?? '')) updateEntry(m, 'actual_val', e.target.value); }}
                            placeholder="—"
                            style={{ ...inp, opacity: saving === m.id ? 0.5 : 1 }}
                          />
                        ) : (
                          <span style={{ fontFamily: C.mono, fontSize: 14, color: C.white }}>{m.actual_val ?? '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        {isCoach ? (
                          <button onClick={() => updateEntry(m, 'met', !m.met)} style={{
                            width: 32, height: 32, borderRadius: '50%', border: `2px solid ${m.met ? C.green : C.border}`,
                            background: m.met ? C.green : 'transparent', color: C.white,
                            cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                          }}>
                            {m.met ? '✓' : ''}
                          </button>
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.met ? C.green : C.border, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                            {m.met ? '✓' : ''}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {weeks.length === 0 && (
          <div style={{ flex: 1, textAlign: 'center', color: C.grey, fontFamily: C.mono, padding: 60, letterSpacing: 2 }}>
            {isCoach ? 'No weeks yet — click + ADD WEEK to create the first entry.' : 'No scoreboard data yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
