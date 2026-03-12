'use strict';
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const { db, init } = require('./db');
const { authMiddleware, requireCoach, signLocal, verifySsoToken } = require('./auth');

const app  = express();
const PORT = process.env.PORT || 3031;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'goals-tracker' }));

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, email, password } = req.body;
  const identifier = (username || email || '').toLowerCase().trim();
  if (!identifier || !password) return res.status(400).json({ error: 'Username/email and password required' });

  const user = db.prepare(`SELECT * FROM users WHERE (username=? OR email=?) AND active=1`).get(identifier, identifier);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signLocal(user);
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, mustChangePw: !!user.must_change_pw } });
});

// SSO — accepts app-specific token from login.coachfern.net
app.post('/api/auth/sso', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const decoded = verifySsoToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired SSO token' });

  // Auto-create user if they don't exist yet
  let user = db.prepare(`SELECT * FROM users WHERE username=? AND active=1`).get((decoded.username || '').toLowerCase());
  if (!user) {
    const result = db.prepare(
      `INSERT OR IGNORE INTO users (username, email, display_name, role, password_hash, must_change_pw)
       VALUES (?, ?, ?, ?, '', 0)`
    ).run(
      (decoded.username || decoded.email?.split('@')[0] || 'user').toLowerCase(),
      decoded.email || null,
      decoded.fullName || decoded.displayName || decoded.username || 'User',
      decoded.role || 'player'
    );
    user = result.lastInsertRowid
      ? db.prepare(`SELECT * FROM users WHERE id=?`).get(result.lastInsertRowid)
      : db.prepare(`SELECT * FROM users WHERE username=?`).get((decoded.username || '').toLowerCase());
  }
  if (!user) return res.status(500).json({ error: 'Could not create session' });

  const localToken = signLocal(user);
  res.json({ token: localToken, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, mustChangePw: 0 } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id=? AND active=1`).get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, mustChangePw: !!user.must_change_pw } });
});

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Min 6 characters' });
  const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error: 'Current password incorrect' });
  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare(`UPDATE users SET password_hash=?, must_change_pw=0 WHERE id=?`).run(hash, req.user.id);
  res.json({ success: true });
});

// ── Position Groups ───────────────────────────────────────────────────────────

app.get('/api/groups', (req, res) => {
  const groups = db.prepare(`SELECT * FROM position_groups ORDER BY sort_order`).all();
  // For each group add summary stats
  const stmt = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) as active_count
    FROM goals WHERE group_id=?
  `);
  res.json(groups.map(g => ({ ...g, ...stmt.get(g.id) })));
});

// ── Goals ─────────────────────────────────────────────────────────────────────

app.get('/api/goals', (req, res) => {
  const { group_id, type } = req.query;
  let sql = `SELECT * FROM goals WHERE active=1`;
  const params = [];
  if (group_id) { sql += ` AND group_id=?`; params.push(group_id); }
  if (type)     { sql += ` AND goal_type=?`; params.push(type); }
  sql += ` ORDER BY sort_order, id`;
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/goals/:id', (req, res) => {
  const goal = db.prepare(`SELECT * FROM goals WHERE id=?`).get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json(goal);
});

app.post('/api/goals', authMiddleware, requireCoach, (req, res) => {
  const { group_id, title, description, goal_type, target_value, unit, higher_is_better, sort_order } = req.body;
  if (!group_id || !title || !goal_type) return res.status(400).json({ error: 'group_id, title, and goal_type required' });
  const result = db.prepare(`
    INSERT INTO goals (group_id, title, description, goal_type, target_value, unit, higher_is_better, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(group_id, title, description || '', goal_type, target_value || 0, unit || '', higher_is_better ?? 1, sort_order || 0);
  res.status(201).json(db.prepare(`SELECT * FROM goals WHERE id=?`).get(result.lastInsertRowid));
});

app.put('/api/goals/:id', authMiddleware, requireCoach, (req, res) => {
  const goal = db.prepare(`SELECT * FROM goals WHERE id=?`).get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const { title, description, goal_type, target_value, unit, higher_is_better, sort_order, active } = req.body;
  db.prepare(`
    UPDATE goals SET
      title=COALESCE(?,title), description=COALESCE(?,description), goal_type=COALESCE(?,goal_type),
      target_value=COALESCE(?,target_value), unit=COALESCE(?,unit),
      higher_is_better=COALESCE(?,higher_is_better), sort_order=COALESCE(?,sort_order),
      active=COALESCE(?,active), updated_at=datetime('now')
    WHERE id=?
  `).run(title??null, description??null, goal_type??null, target_value??null, unit??null, higher_is_better??null, sort_order??null, active??null, req.params.id);
  res.json(db.prepare(`SELECT * FROM goals WHERE id=?`).get(req.params.id));
});

app.delete('/api/goals/:id', authMiddleware, requireCoach, (req, res) => {
  const r = db.prepare(`UPDATE goals SET active=0 WHERE id=?`).run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Goal not found' });
  res.json({ success: true });
});

// ── Progress Updates ──────────────────────────────────────────────────────────

app.get('/api/goals/:id/progress', (req, res) => {
  const history = db.prepare(`SELECT * FROM progress_updates WHERE goal_id=? ORDER BY created_at DESC`).all(req.params.id);
  res.json(history);
});

app.post('/api/goals/:id/progress', authMiddleware, requireCoach, (req, res) => {
  const goal = db.prepare(`SELECT * FROM goals WHERE id=?`).get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const { new_value, note, week_label } = req.body;
  if (new_value === undefined || new_value === null) return res.status(400).json({ error: 'new_value required' });

  db.prepare(`
    INSERT INTO progress_updates (goal_id, previous_value, new_value, note, updated_by, week_label)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(goal.id, goal.current_value, new_value, note || null, req.user.username, week_label || null);

  db.prepare(`UPDATE goals SET current_value=?, updated_at=datetime('now') WHERE id=?`).run(new_value, goal.id);
  res.json(db.prepare(`SELECT * FROM goals WHERE id=?`).get(goal.id));
});

// ── Edit / Delete Progress Entry ──────────────────────────────────────────

app.put('/api/progress/:id', authMiddleware, requireCoach, (req, res) => {
  const entry = db.prepare(`SELECT * FROM progress_updates WHERE id=?`).get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Progress entry not found' });
  const { new_value, note, week_label } = req.body;
  if (new_value === undefined || new_value === null) return res.status(400).json({ error: 'new_value required' });

  db.prepare(`UPDATE progress_updates SET new_value=?, note=?, week_label=?, updated_by=? WHERE id=?`)
    .run(new_value, note ?? entry.note, week_label ?? entry.week_label, req.user.username, entry.id);

  // Recalculate the goal's current_value from the latest progress entry
  const latest = db.prepare(`SELECT new_value FROM progress_updates WHERE goal_id=? ORDER BY created_at DESC, id DESC LIMIT 1`).get(entry.goal_id);
  if (latest) {
    db.prepare(`UPDATE goals SET current_value=?, updated_at=datetime('now') WHERE id=?`).run(latest.new_value, entry.goal_id);
  }

  const goal = db.prepare(`SELECT * FROM goals WHERE id=?`).get(entry.goal_id);
  const updatedEntry = db.prepare(`SELECT * FROM progress_updates WHERE id=?`).get(req.params.id);
  res.json({ entry: updatedEntry, goal });
});

app.delete('/api/progress/:id', authMiddleware, requireCoach, (req, res) => {
  const entry = db.prepare(`SELECT * FROM progress_updates WHERE id=?`).get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Progress entry not found' });

  db.prepare(`DELETE FROM progress_updates WHERE id=?`).run(req.params.id);

  // Recalculate the goal's current_value from the latest remaining progress entry
  const latest = db.prepare(`SELECT new_value FROM progress_updates WHERE goal_id=? ORDER BY created_at DESC, id DESC LIMIT 1`).get(entry.goal_id);
  const newCurrent = latest ? latest.new_value : 0;
  db.prepare(`UPDATE goals SET current_value=?, updated_at=datetime('now') WHERE id=?`).run(newCurrent, entry.goal_id);

  const goal = db.prepare(`SELECT * FROM goals WHERE id=?`).get(entry.goal_id);
  res.json({ success: true, goal });
});

// ── Scoreboard ────────────────────────────────────────────────────────────────

app.get('/api/scoreboard', (req, res) => {
  const weeks = db.prepare(`SELECT * FROM scoreboard_weeks ORDER BY id DESC`).all();
  const entriesStmt = db.prepare(`SELECT * FROM scoreboard_entries WHERE week_id=? ORDER BY rowid`);
  res.json(weeks.map(w => ({ ...w, metrics: entriesStmt.all(w.id) })));
});

app.post('/api/scoreboard/weeks', authMiddleware, requireCoach, (req, res) => {
  const { week_label, game_info } = req.body;
  if (!week_label) return res.status(400).json({ error: 'week_label required' });

  const METRICS = [
    ['turnovers',         'Turnover Margin',       '+2'],
    ['penalties',         'Penalties',             '< 6'],
    ['explosive_plays',   'Explosive Plays (Off)',  '5+'],
    ['explosive_allowed', 'Explosive Plays (Def)',  '< 3'],
    ['red_zone_td',       'Red Zone TD%',           '60%'],
  ];

  try {
    const result = db.prepare(`INSERT INTO scoreboard_weeks (week_label, game_info) VALUES (?,?)`).run(week_label, game_info || null);
    const weekId = result.lastInsertRowid;
    const entry = db.prepare(`INSERT INTO scoreboard_entries (week_id, metric_key, label, target_desc) VALUES (?,?,?,?)`);
    for (const [key, label, target] of METRICS) entry.run(weekId, key, label, target);
    const week = db.prepare(`SELECT * FROM scoreboard_weeks WHERE id=?`).get(weekId);
    res.status(201).json({ ...week, metrics: db.prepare(`SELECT * FROM scoreboard_entries WHERE week_id=?`).all(weekId) });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: `Week '${week_label}' already exists` });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/scoreboard/entries/:id', authMiddleware, requireCoach, (req, res) => {
  const { actual_val, met } = req.body;
  db.prepare(`UPDATE scoreboard_entries SET actual_val=?, met=?, updated_by=?, updated_at=datetime('now') WHERE id=?`)
    .run(actual_val ?? null, met ? 1 : 0, req.user.username, req.params.id);
  res.json(db.prepare(`SELECT * FROM scoreboard_entries WHERE id=?`).get(req.params.id));
});

// ── Export / Import ───────────────────────────────────────────────────────────

app.get('/api/export', authMiddleware, requireCoach, (req, res) => {
  const payload = {
    exported_at: new Date().toISOString(),
    version: '1.0',
    groups: db.prepare(`SELECT * FROM position_groups ORDER BY sort_order`).all(),
    goals:  db.prepare(`SELECT * FROM goals ORDER BY group_id, sort_order`).all(),
    progress_updates: db.prepare(`SELECT * FROM progress_updates ORDER BY created_at`).all(),
    scoreboard_weeks: db.prepare(`SELECT * FROM scoreboard_weeks ORDER BY id`).all(),
    scoreboard_entries: db.prepare(`SELECT * FROM scoreboard_entries ORDER BY week_id, rowid`).all(),
  };
  res.setHeader('Content-Disposition', `attachment; filename="goals-backup-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(payload);
});

app.post('/api/import', authMiddleware, requireCoach, (req, res) => {
  const { goals, progress_updates } = req.body;
  if (!goals || !Array.isArray(goals)) return res.status(400).json({ error: 'goals array required' });

  const importTx = db.transaction(() => {
    let updated = 0, created = 0;
    for (const g of goals) {
      const existing = g.id ? db.prepare(`SELECT id FROM goals WHERE id=?`).get(g.id) : null;
      if (existing) {
        db.prepare(`UPDATE goals SET current_value=?, updated_at=datetime('now') WHERE id=?`).run(g.current_value, g.id);
        updated++;
      }
    }
    if (progress_updates) {
      for (const p of progress_updates) {
        db.prepare(`INSERT OR IGNORE INTO progress_updates (goal_id,previous_value,new_value,note,updated_by,week_label,created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(p.goal_id, p.previous_value, p.new_value, p.note, p.updated_by, p.week_label, p.created_at);
      }
    }
    return { updated, created };
  });

  try {
    const result = importTx();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
app.listen(PORT, () => console.log(`[GOALS] Goals Tracker API running on port ${PORT}`));
