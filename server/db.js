'use strict';
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/goals.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    UNIQUE NOT NULL,
      email        TEXT    UNIQUE,
      display_name TEXT    NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'player',
      password_hash TEXT,
      active       INTEGER NOT NULL DEFAULT 1,
      must_change_pw INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS position_groups (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      display_name TEXT    NOT NULL,
      icon         TEXT    NOT NULL DEFAULT '🏈',
      sort_order   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS goals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id         INTEGER NOT NULL REFERENCES position_groups(id) ON DELETE CASCADE,
      title            TEXT    NOT NULL,
      description      TEXT,
      goal_type        TEXT    NOT NULL DEFAULT 'season',
      target_value     REAL    NOT NULL DEFAULT 0,
      current_value    REAL    NOT NULL DEFAULT 0,
      unit             TEXT    NOT NULL DEFAULT '',
      higher_is_better INTEGER NOT NULL DEFAULT 1,
      active           INTEGER NOT NULL DEFAULT 1,
      sort_order       INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT    DEFAULT (datetime('now')),
      updated_at       TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS progress_updates (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id        INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      previous_value REAL,
      new_value      REAL    NOT NULL,
      note           TEXT,
      updated_by     TEXT,
      week_label     TEXT,
      created_at     TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scoreboard_weeks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      week_label TEXT    NOT NULL UNIQUE,
      game_info  TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scoreboard_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      week_id     INTEGER NOT NULL REFERENCES scoreboard_weeks(id) ON DELETE CASCADE,
      metric_key  TEXT    NOT NULL,
      label       TEXT    NOT NULL,
      target_desc TEXT    NOT NULL,
      actual_val  REAL,
      met         INTEGER NOT NULL DEFAULT 0,
      updated_by  TEXT,
      updated_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(week_id, metric_key)
    );
  `);
}

// ── Seed position groups ──────────────────────────────────────────────────────
function seedGroups() {
  const groups = [
    [1, 'team',          'Team Goals',        '🏆', 0],
    [2, 'qb',            'Quarterbacks',      '🎯', 1],
    [3, 'rb',            'Running Backs',     '💨', 2],
    [4, 'wr_te',         'WR / Tight Ends',   '🙌', 3],
    [5, 'ol',            'Offensive Line',    '🪨', 4],
    [6, 'dl',            'Defensive Line',    '⚡', 5],
    [7, 'lb',            'Linebackers',       '🦾', 6],
    [8, 'db',            'Defensive Backs',   '🛡️', 7],
    [9, 'special_teams', 'Special Teams',     '📌', 8],
    [10,'culture',       'Culture Goals',     '❤️', 9],
    [11,'offense',       'Offensive Goals',   '⚔️', 10],
    [12,'defense_goals', 'Defensive Goals',   '🛡️', 11],
  ];
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO position_groups (id, name, display_name, icon, sort_order) VALUES (?,?,?,?,?)`
  );
  for (const g of groups) stmt.run(...g);
}

// ── Seed goals from the team document ────────────────────────────────────────
function seedGoals() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM goals').get();
  if (existing.c > 0) return; // already seeded

  const insert = db.prepare(`
    INSERT INTO goals (group_id, title, description, goal_type, target_value, current_value, unit, higher_is_better, sort_order)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  const goals = [
    // ── TEAM (id=1) ──────────────────────────────────────────────────────────
    [1, 'Win 6+ Games',               'Season win target',                             'season', 6,   'wins',           1, 0],
    [1, 'Turnover Margin +10',        '+10 turnover margin for the season',            'season', 10,  'margin',         1, 1],
    [1, 'Penalties < 6 Per Game',     'Less than 6 penalties per game',               'season', 6,   'per game',       0, 2],
    [1, 'No Special Teams TDs Allowed','Zero special teams touchdowns allowed',        'season', 0,   'TDs allowed',    0, 3],
    [1, 'Red Zone TD Rate 50%+',      'Score touchdowns on 50%+ of red zone trips',   'season', 50,  '%',              1, 4],
    [1, '90% Alignment/Assignment Grade','90% alignment and assignment grade on film', 'game',   90,  '%',              1, 5],
    [1, '100% Effort Grade',          '100% effort grade on film every game',         'game',   100, '%',              1, 6],
    [1, 'Win 2 of 3 Phases',          'Win offense, defense, or special teams 2 of 3','game',   2,   'phases',         1, 7],

    // ── QUARTERBACKS (id=2) ──────────────────────────────────────────────────
    [2, 'Completion % 60%+',          '60% completion percentage',                    'season', 60,  '%',              1, 0],
    [2, 'TD:INT Ratio 2:1',           '2-to-1 TD to interception ratio',              'season', 2,   'ratio',          1, 1],
    [2, '0 Delay-of-Game Penalties',  'Zero delay-of-game penalties all season',      'season', 0,   'penalties',      0, 2],
    [2, '≤1 Turnover Per Game',       'One or fewer turnovers per game',              'season', 1,   'per game',       0, 3],
    [2, '90% Correct Pre-Snap Reads', 'Correct pre-snap read on 90% of plays',        'game',   90,  '%',              1, 4],
    [2, '5+ Passes of 15+ Yards',     'Complete 5 or more passes of 15+ yards',       'game',   5,   'passes',         1, 5],
    [2, '40%+ 3rd Down Conversion',   'Convert 40% or more of third downs',           'game',   40,  '%',              1, 6],

    // ── RUNNING BACKS (id=3) ─────────────────────────────────────────────────
    [3, '4.5+ Yards Per Carry',       '4.5 or more yards per carry average',          'season', 4.5, 'YPC',            1, 0],
    [3, '0 Fumbles Lost',             'Zero fumbles lost all season',                 'season', 0,   'fumbles',        0, 1],
    [3, '10+ Rushing TDs (Group)',     'Combined 10 or more rushing touchdowns',       'season', 10,  'TDs',            1, 2],
    [3, '120+ Team Rushing Yards',    '120 or more team rushing yards per game',      'game',   120, 'yards',          1, 3],
    [3, 'Break 3+ Tackles Per Game',  'Break at least 3 tackles per game',            'game',   3,   'tackles broken', 1, 4],
    [3, '0 Missed Blitz Pickups',     'Zero missed blitz pickup assignments',         'game',   0,   'missed',         0, 5],
    [3, '100% Ball Security Grade',   'Ball security grade 100% every week on film',  'game',   100, '%',              1, 6],

    // ── WR / TE (id=4) ───────────────────────────────────────────────────────
    [4, '0 Dropped Touchdowns',       'Zero dropped touchdowns all season',           'season', 0,   'drops',          0, 0],
    [4, 'Catch Rate 65%+',            'Catch rate above 65% for the season',          'season', 65,  '%',              1, 1],
    [4, '15+ Explosive Plays',        '15 or more explosive plays (20+ yards)',       'season', 15,  'plays',          1, 2],
    [4, '3+ Explosive Pass Plays',    '3 or more explosive pass plays per game',      'game',   3,   'plays',          1, 3],
    [4, '80% Blocking Grade',         '80% blocking grade per game on film',          'game',   80,  '%',              1, 4],
    [4, '0 Missed Route Depths',      'Zero missed route depth assignments',          'game',   0,   'missed',         0, 5],

    // ── OFFENSIVE LINE (id=5) ────────────────────────────────────────────────
    [5, '< 2 Sacks Allowed Per Game', 'Allow fewer than 2 sacks per game',            'season', 2,   'per game',       0, 0],
    [5, '< 5 Penalties All Season',   'Fewer than 5 OL penalties all season',         'season', 5,   'total',          0, 1],
    [5, '4.5 YPC Average',            'Support a 4.5 yards per carry average',        'season', 4.5, 'YPC',            1, 2],
    [5, '85% Assignment Grade',       '85% assignment grade per game on film',        'game',   85,  '%',              1, 3],
    [5, 'Win 60% of Run Blocks',      'Win 60% or more of run block assignments',     'game',   60,  '%',              1, 4],
    [5, '0 Free Rushers to QB',       'Zero free rushers reaching the QB',            'game',   0,   'allowed',        0, 5],

    // ── DEFENSIVE LINE (id=6) ────────────────────────────────────────────────
    [6, '20+ Team Sacks',             '20 or more team sacks for the season',         'season', 20,  'sacks',          1, 0],
    [6, '40+ Tackles for Loss',       '40 or more tackles for loss',                  'season', 40,  'TFLs',           1, 1],
    [6, 'Force 10 Holding Penalties', 'Draw 10 holding penalties through effort',     'season', 10,  'penalties',      1, 2],
    [6, '5 Tackles for Loss Per Game','5 tackles for loss per game',                  'game',   5,   'TFLs',           1, 3],
    [6, '2 QB Pressures Per Quarter', '2 quarterback pressures per quarter',          'game',   2,   'per quarter',    1, 4],
    [6, 'Control A/B Gaps 90%',       'Control A and B gaps on 90% of snaps',        'game',   90,  '%',              1, 5],

    // ── LINEBACKERS (id=7) ───────────────────────────────────────────────────
    [7, '150+ Combined Tackles',      '150 or more combined tackles for the season',  'season', 150, 'tackles',        1, 0],
    [7, '15 Tackles for Loss',        '15 tackles for loss for the season',           'season', 15,  'TFLs',           1, 1],
    [7, '5 Forced Turnovers',         '5 forced turnovers for the season',            'season', 5,   'turnovers',      1, 2],
    [7, '10 Tackles Per Game',        '10 tackles per game combined',                 'game',   10,  'tackles',        1, 3],
    [7, '0 Missed Fits',              'Zero missed run fit assignments',              'game',   0,   'missed',         0, 4],
    [7, '0 Explosive Runs Allowed',   'No explosive run plays allowed',              'game',   0,   'allowed',        0, 5],

    // ── DEFENSIVE BACKS (id=8) ───────────────────────────────────────────────
    [8, '15+ Interceptions',          '15 or more interceptions for the season',      'season', 15,  'INTs',           1, 0],
    [8, '30 Pass Breakups',           '30 pass breakups for the season',              'season', 30,  'PBUs',           1, 1],
    [8, '< 5 Explosive Passes Allowed','Fewer than 5 explosive pass plays allowed',  'season', 5,   'allowed',        0, 2],
    [8, '2 Takeaways Per Game',       '2 takeaways per game',                         'game',   2,   'takeaways',      1, 3],
    [8, '0 Blown Coverages',          'Zero blown coverage assignments per game',    'game',   0,   'blown',          0, 4],
    [8, '80% Open-Field Tackle Rate', '80% open-field tackle success rate',           'game',   80,  '%',              1, 5],

    // ── SPECIAL TEAMS (id=9) ─────────────────────────────────────────────────
    [9, 'KO: Start Inside Opponent 25','Start opponent inside the 25 on kickoffs',   'season', 0,   'past midfield',  0, 0],
    [9, 'KO Return: Avg Past 30',     'Average kickoff return start past the 30',    'season', 30,  'yard line avg',  1, 1],
    [9, '1 Return TD This Season',    'At least 1 kickoff return touchdown',         'season', 1,   'TDs',            1, 2],
    [9, '0 Punts Blocked',            'Zero blocked punts all season',               'season', 0,   'blocked',        0, 3],
    [9, '40+ Yard Punt Average',      '40 or more yard punt average (field flip)',   'season', 40,  'yards avg',      1, 4],
    [9, '95% PAT Success Rate',       '95% point after touchdown success rate',      'season', 95,  '%',              1, 5],
    [9, '0 Bad Snaps',                'Zero bad snaps all season',                  'season', 0,   'bad snaps',      0, 6],

    // ── CULTURE (id=10) ──────────────────────────────────────────────────────
    [10,'No Loafs on Film',           'Zero loaf plays on film — every play full effort','culture', 0, 'loafs',        0, 0],
    [10,'Finish Every Tackle/Block',  'Physicality — finish every tackle and block',  'culture', 100, '%',             1, 1],
    [10,'Players Grade Themselves',   'Accountability — players self-grade after games','culture', 100,'%',            1, 2],
    [10,'Defense Always Talking',     'Communication — defense communicating pre-snap every play','culture', 100,'%',  1, 3],
  ];

  const seeder = db.transaction(() => {
    for (const [grp, title, desc, type, target, unit, hib, sort] of goals) {
      insert.run(grp, title, desc, type, target, unit, hib, sort);
    }
  });
  seeder();
}

// ── Seed weekly scoreboard metrics template ───────────────────────────────────
function seedScoreboard() {
  const wk = db.prepare(`INSERT OR IGNORE INTO scoreboard_weeks (week_label, game_info) VALUES (?, ?)`);
  const entry = db.prepare(`INSERT OR IGNORE INTO scoreboard_entries (week_id, metric_key, label, target_desc) VALUES (?,?,?,?)`);

  const METRICS = [
    ['turnovers',         'Turnover Margin',      '+2'],
    ['penalties',         'Penalties',            '< 6'],
    ['explosive_plays',   'Explosive Plays (Off)','5+'],
    ['explosive_allowed', 'Explosive Plays (Def)','< 3'],
    ['red_zone_td',       'Red Zone TD%',         '60%'],
  ];

  const result = wk.run('Week 1', 'Season Opener');
  const weekId = result.lastInsertRowid ||
    db.prepare(`SELECT id FROM scoreboard_weeks WHERE week_label=?`).get('Week 1')?.id;
  if (weekId) {
    for (const [key, label, target] of METRICS) {
      entry.run(weekId, key, label, target);
    }
  }
}

// ── Bootstrap admin ───────────────────────────────────────────────────────────
function seedAdmin() {
  const exists = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role IN ('admin','coach')`).get();
  if (exists.c > 0) return;
  const pw = process.env.ADMIN_PASSWORD || 'Steelers1!';
  const hash = bcrypt.hashSync(pw, 12);
  db.prepare(`INSERT OR IGNORE INTO users (username, display_name, role, password_hash) VALUES (?,?,?,?)`)
    .run(process.env.ADMIN_USERNAME || 'admin', 'Admin', 'admin', hash);
  console.log(`[DB] Bootstrap admin created — change the password immediately!`);
}

function init() {
  initSchema();
  seedGroups();
  seedGoals();
  seedScoreboard();
  seedAdmin();
  console.log('[DB] Goals Tracker database ready');
}

module.exports = { db, init };
