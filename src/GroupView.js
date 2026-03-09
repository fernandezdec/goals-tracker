import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { C, calcProgress, progressColor, progressBg } from './App';

const GOAL_TYPES = ['season', 'game', 'leadership', 'culture'];
const TYPE_LABELS = { season: 'Season Target', game: 'Game Goal', leadership: 'Leadership', culture: 'Culture' };
const TYPE_COLORS = { season: C.maroonBright, game: '#3b82f6', leadership: '#a855f7', culture: '#f59e0b' };

export default function GroupView({ groupId, user, onBack, onLogout }) {
  const [group, setGroup]       = useState(null);
  const [goals, setGoals]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all'); // 'all' | goal_type
  const [showModal, setModal]   = useState(false); // false | 'add' | goal (edit)
  const [showProg, setShowProg] = useState(null);  // goal for progress panel
  const [history, setHistory]   = useState([]);

  const isCoach = ['admin', 'coach'].includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [grps, gs] = await Promise.all([api.groups(), api.goals({ group_id: groupId })]);
      setGroup(grps.find(g => g.id === groupId));
      setGoals(gs);
    } catch {}
    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const openProgress = async (goal) => {
    setShowProg(goal);
    try { setHistory(await api.progress(goal.id)); } catch { setHistory([]); }
  };

  const filtered = filter === 'all' ? goals : goals.filter(g => g.goal_type === filter);

  // Group by type for display
  const byType = {};
  for (const g of filtered) {
    if (!byType[g.goal_type]) byType[g.goal_type] = [];
    byType[g.goal_type].push(g);
  }

  const groupProgress = goals.length ? Math.round(goals.reduce((a, g) => a + calcProgress(g), 0) / goals.length) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.white }}>
      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: C.mono, fontSize: 11, letterSpacing: 1 }}>
              ← BACK
            </button>
            {group && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{group.icon}</span>
                <div>
                  <div style={{ fontFamily: C.heading, fontSize: 16, letterSpacing: 3, color: C.white }}>{group.display_name.toUpperCase()}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.grey, letterSpacing: 1 }}>{goals.length} GOALS · {groupProgress}% ON TRACK</div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isCoach && (
              <button onClick={() => setModal('add')} style={{ background: C.maroon, color: C.white, border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: C.heading, fontSize: 12, letterSpacing: 2, cursor: 'pointer' }}>
                + ADD GOAL
              </button>
            )}
            <button onClick={onLogout} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: C.mono, letterSpacing: 1 }}>
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 0, borderTop: `1px solid ${C.border}` }}>
          {['all', ...GOAL_TYPES].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              background: 'transparent', border: 'none', borderBottom: filter === t ? `2px solid ${C.maroon}` : '2px solid transparent',
              color: filter === t ? C.white : C.grey, padding: '10px 18px', cursor: 'pointer',
              fontFamily: C.mono, fontSize: 10, letterSpacing: 2, fontWeight: filter === t ? 600 : 400, textTransform: 'uppercase',
            }}>
              {t === 'all' ? 'ALL' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.grey, padding: 60, fontFamily: C.mono, letterSpacing: 2 }}>LOADING...</div>
        ) : (
          <>
            {/* Group progress bar */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey, letterSpacing: 2 }}>GROUP PROGRESS</div>
                  <div style={{ fontFamily: C.heading, fontSize: 18, color: progressColor(groupProgress) }}>{groupProgress}%</div>
                </div>
                <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${groupProgress}%`, background: `linear-gradient(90deg, ${C.maroon}, ${progressColor(groupProgress)})`, borderRadius: 4, transition: 'width 1s ease' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
                {[['ON TRACK', C.green, goals.filter(g => calcProgress(g) >= 80).length], ['CLOSE', C.yellow, goals.filter(g => { const p = calcProgress(g); return p >= 50 && p < 80; }).length], ['BEHIND', C.maroonBright, goals.filter(g => calcProgress(g) < 50).length]].map(([lbl, clr, val]) => (
                  <div key={lbl} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: C.mono, fontSize: 20, color: clr, fontWeight: 700 }}>{val}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 8, color: C.grey, letterSpacing: 1 }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goals by type */}
            {Object.keys(byType).length === 0 && (
              <div style={{ textAlign: 'center', color: C.grey, fontFamily: C.mono, padding: 60, letterSpacing: 2 }}>
                {isCoach ? 'No goals yet. Click + ADD GOAL to create one.' : 'No goals in this category.'}
              </div>
            )}

            {GOAL_TYPES.filter(t => byType[t]).map(type => (
              <div key={type} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 20, background: TYPE_COLORS[type], borderRadius: 2 }} />
                  <div style={{ fontFamily: C.heading, fontSize: 13, letterSpacing: 3, color: TYPE_COLORS[type] }}>{TYPE_LABELS[type].toUpperCase()}</div>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <div style={{ fontFamily: C.mono, fontSize: 10, color: C.grey }}>{byType[type].length} GOALS</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {byType[type].map(goal => (
                    <GoalCard key={goal.id} goal={goal} isCoach={isCoach} user={user}
                      onEdit={() => setModal(goal)}
                      onUpdateProgress={() => openProgress(goal)}
                      onDeleted={() => setGoals(prev => prev.filter(g => g.id !== goal.id))}
                      onUpdated={(updated) => setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Progress history panel */}
      {showProg && (
        <ProgressPanel
          goal={showProg} history={history} isCoach={isCoach}
          onClose={() => { setShowProg(null); setHistory([]); }}
          onUpdated={(updated) => {
            setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
            setShowProg(updated);
          }}
          onHistoryUpdated={setHistory}
        />
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <GoalModal
          goal={showModal === 'add' ? null : showModal}
          groupId={groupId}
          onClose={() => setModal(false)}
          onSaved={(saved) => {
            if (showModal === 'add') setGoals(prev => [...prev, saved]);
            else setGoals(prev => prev.map(g => g.id === saved.id ? saved : g));
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, isCoach, onEdit, onUpdateProgress, onDeleted, onUpdated }) {
  const pct = calcProgress(goal);
  const [deleting, setDel] = useState(false);

  const doDelete = async () => {
    if (!window.confirm(`Delete "${goal.title}"?`)) return;
    setDel(true);
    try { await api.deleteGoal(goal.id); onDeleted(); }
    catch (e) { alert(e.message); setDel(false); }
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, marginRight: 10 }}>
          <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.white, lineHeight: 1.4 }}>{goal.title}</div>
          {goal.description && <div style={{ fontFamily: C.body, fontSize: 11, color: C.greyDark, marginTop: 4, lineHeight: 1.5 }}>{goal.description}</div>}
        </div>
        <div style={{ background: progressBg(pct), border: `1px solid ${progressColor(pct)}`, borderRadius: 6, padding: '3px 10px', fontFamily: C.heading, fontSize: 16, color: progressColor(pct), flexShrink: 0 }}>
          {pct}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.maroon}, ${progressColor(pct)})`, borderRadius: 3, transition: 'width 0.8s ease' }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCoach ? 12 : 0 }}>
        <div style={{ fontFamily: C.mono, fontSize: 11 }}>
          <span style={{ color: progressColor(pct), fontWeight: 700 }}>{goal.current_value}</span>
          <span style={{ color: C.grey }}> / {goal.target_value} {goal.unit}</span>
          {!goal.higher_is_better && <span style={{ color: C.grey, fontSize: 9 }}> (lower=better)</span>}
        </div>
        <button onClick={onUpdateProgress} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: C.mono, letterSpacing: 1 }}>
          HISTORY
        </button>
      </div>

      {/* Coach buttons */}
      {isCoach && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <button onClick={onUpdateProgress} style={{ flex: 1, background: C.maroon, color: C.white, border: 'none', borderRadius: 6, padding: '8px', fontFamily: C.heading, fontSize: 11, letterSpacing: 2, cursor: 'pointer' }}>
            UPDATE STAT
          </button>
          <button onClick={onEdit} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: '8px 12px', fontSize: 11, cursor: 'pointer', fontFamily: C.mono }}>
            ✏️
          </button>
          <button onClick={doDelete} disabled={deleting} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.greyDark, borderRadius: 6, padding: '8px 12px', fontSize: 11, cursor: 'pointer', fontFamily: C.mono, opacity: deleting ? 0.5 : 1 }}>
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress panel (slide-in from right) ──────────────────────────────────────
function ProgressPanel({ goal, history, isCoach, onClose, onUpdated, onHistoryUpdated }) {
  const [newVal, setNewVal] = useState('');
  const [note, setNote]     = useState('');
  const [week, setWeek]     = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const save = async () => {
    if (newVal === '') return setErr('Enter a value');
    setSaving(true); setErr('');
    try {
      const updated = await api.updateProgress(goal.id, { new_value: parseFloat(newVal), note, week_label: week });
      onUpdated(updated);
      const h = await api.progress(goal.id);
      onHistoryUpdated(h);
      setNewVal(''); setNote(''); setWeek('');
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const pct = calcProgress(goal);
  const inp = { width: '100%', padding: '10px 12px', background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, fontSize: 13, outline: 'none', fontFamily: C.mono };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      {/* Panel */}
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, background: C.surface, borderLeft: `1px solid ${C.border}`, zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: C.maroon, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: C.heading, fontSize: 14, letterSpacing: 3, color: C.white }}>GOAL PROGRESS</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          {/* Goal info */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 600, color: C.white, marginBottom: 10 }}>{goal.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: C.mono, fontSize: 12, color: C.grey }}>
                <span style={{ color: progressColor(pct), fontWeight: 700, fontSize: 16 }}>{goal.current_value}</span>
                {' '}/ {goal.target_value} {goal.unit}
              </div>
              <div style={{ fontFamily: C.heading, fontSize: 20, color: progressColor(pct) }}>{pct}%</div>
            </div>
            <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.maroon}, ${progressColor(pct)})`, borderRadius: 4 }} />
            </div>
          </div>

          {/* Update form */}
          {isCoach && (
            <div style={{ background: C.card, border: `1px solid ${C.maroon}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
              <div style={{ fontFamily: C.heading, fontSize: 12, letterSpacing: 2, color: C.maroonBright, marginBottom: 14 }}>UPDATE STAT</div>
              {err && <div style={{ background: C.redDim, color: '#fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 12, fontFamily: C.mono }}>{err}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.grey, letterSpacing: 1, marginBottom: 4 }}>NEW VALUE ({goal.unit || 'value'})</div>
                  <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder={String(goal.current_value)} type="number" step="any" style={inp} />
                </div>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.grey, letterSpacing: 1, marginBottom: 4 }}>WEEK (optional)</div>
                  <input value={week} onChange={e => setWeek(e.target.value)} placeholder="Week 3" style={inp} />
                </div>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.grey, letterSpacing: 1, marginBottom: 4 }}>NOTE (optional)</div>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Added 2 sacks vs Valley" style={inp} />
                </div>
                <button onClick={save} disabled={saving} style={{ background: saving ? C.greyDeep : C.maroon, color: C.white, border: 'none', borderRadius: 6, padding: '11px', fontFamily: C.heading, fontSize: 13, letterSpacing: 2, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'SAVING...' : 'SAVE UPDATE'}
                </button>
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <div style={{ fontFamily: C.heading, fontSize: 12, letterSpacing: 2, color: C.grey, marginBottom: 12 }}>PROGRESS HISTORY</div>
            {history.length === 0 ? (
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.greyDark, textAlign: 'center', padding: 20 }}>No updates yet</div>
            ) : (
              history.map((h, i) => (
                <div key={h.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontFamily: C.mono, fontSize: 13, color: C.white, fontWeight: 600 }}>
                      <span style={{ color: C.grey, fontWeight: 400 }}>{h.previous_value} → </span>
                      <span style={{ color: progressColor(Math.min(100, (h.new_value / goal.target_value) * 100)) }}>{h.new_value}</span>
                      <span style={{ color: C.grey, fontWeight: 400 }}> {goal.unit}</span>
                    </div>
                    {h.week_label && <span style={{ fontFamily: C.mono, fontSize: 9, color: C.maroonBright, border: `1px solid rgba(123,28,37,0.3)`, borderRadius: 4, padding: '2px 8px' }}>{h.week_label}</span>}
                  </div>
                  {h.note && <div style={{ fontFamily: C.body, fontSize: 11, color: C.greyDark, marginBottom: 4 }}>{h.note}</div>}
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.greyDark }}>by {h.updated_by} · {new Date(h.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Add / Edit Goal Modal ──────────────────────────────────────────────────────
function GoalModal({ goal, groupId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    goal_type: goal?.goal_type || 'season',
    target_value: goal?.target_value ?? '',
    unit: goal?.unit || '',
    higher_is_better: goal?.higher_is_better ?? 1,
    sort_order: goal?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return setErr('Title required');
    if (form.target_value === '') return setErr('Target value required');
    setSaving(true); setErr('');
    try {
      const body = { ...form, target_value: parseFloat(form.target_value), group_id: groupId };
      const saved = goal ? await api.updateGoal(goal.id, body) : await api.createGoal(body);
      onSaved(saved);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const inp  = { width: '100%', padding: '10px 12px', background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, fontSize: 13, outline: 'none', fontFamily: C.mono };
  const lbl  = { fontFamily: C.mono, fontSize: 9, color: C.grey, letterSpacing: 1, display: 'block', marginBottom: 5, textTransform: 'uppercase' };
  const sel  = { ...inp, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 500, background: C.surface, border: `1px solid ${C.maroon}`, borderRadius: 12, zIndex: 50, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: C.maroon, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: C.heading, fontSize: 15, letterSpacing: 3, color: C.white }}>{goal ? 'EDIT GOAL' : 'ADD GOAL'}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && <div style={{ background: C.redDim, color: '#fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: C.mono }}>{err}</div>}

          <div>
            <label style={lbl}>Goal Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. 60% Completion Rate" style={inp} />
          </div>

          <div>
            <label style={lbl}>Description</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief explanation" style={inp} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Goal Type *</label>
              <select value={form.goal_type} onChange={e => set('goal_type', e.target.value)} style={sel}>
                {GOAL_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Target Value *</label>
              <input value={form.target_value} onChange={e => set('target_value', e.target.value)} type="number" step="any" placeholder="60" style={inp} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Unit</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="%, yards, TDs..." style={inp} />
            </div>
            <div>
              <label style={lbl}>Direction</label>
              <select value={form.higher_is_better} onChange={e => set('higher_is_better', parseInt(e.target.value))} style={sel}>
                <option value={1}>Higher = Better</option>
                <option value={0}>Lower = Better</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: saving ? C.greyDeep : C.maroon, color: C.white, border: 'none', borderRadius: 8, padding: '13px', fontFamily: C.heading, fontSize: 14, letterSpacing: 2, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {saving ? 'SAVING...' : goal ? 'SAVE CHANGES' : 'CREATE GOAL'}
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.grey, borderRadius: 8, padding: '13px 20px', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
