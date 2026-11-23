// Hybrid Database Layer: Native MySQL (XAMPP / Cloud) with graceful JSON fallback
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const SUPER_ADMIN_EMAILS = new Set([
  'parvpathak12@gmail.com',
  'rohitnarwariya555@gmail.com'
]);

function isSuperAdminEmail(email) {
  return Boolean(email && SUPER_ADMIN_EMAILS.has(String(email).trim().toLowerCase()));
}

let pool = null;
let isMySqlActive = false;

// 1. Initialize MySQL Pool if available
export async function getDb() {
  if (pool) return { pool, isMySqlActive };

  const dbHost = process.env.MYSQL_HOST || 'localhost';
  const dbUser = process.env.MYSQL_USER || 'root';
  const dbPassword = process.env.MYSQL_PASSWORD || '';
  const dbName = process.env.MYSQL_DATABASE || 'lead_job_agent';
  const dbPort = Number(process.env.MYSQL_PORT || 3306);
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

  try {
    const mysql = await import('mysql2/promise');
    const useSsl = Boolean(databaseUrl || process.env.MYSQL_SSL === 'true');
    const config = databaseUrl
      ? {
          uri: databaseUrl,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 8000,
          ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false } } : {})
        }
      : {
          host: dbHost,
          port: dbPort,
          user: dbUser,
          password: dbPassword,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 4000,
          ...(process.env.MYSQL_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false } } : {})
        };

    pool = mysql.createPool(config);

    // Test ping
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();

    isMySqlActive = true;
    console.log(`[DB] Connected to MySQL database (${databaseUrl ? 'Remote URL' : `${dbHost}:${dbPort}/${dbName}`})`);

    // Ensure tables exist
    await initTables(pool);
  } catch (err) {
    console.warn(`[DB] MySQL connection skipped/unavailable (${err.message}). Using local storage fallback.`);
    isMySqlActive = false;
    pool = null;
  }

  return { pool, isMySqlActive };
}

async function initTables(p) {
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(64) DEFAULT '',
        role VARCHAR(32) DEFAULT 'user',
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        profile LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure role column exists if table was created previously
    try {
      await p.query(`ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'user'`);
    } catch {
      // Column already exists
    }
    try {
      await p.query(`ALTER TABLE users ADD COLUMN plan VARCHAR(32) DEFAULT 'free'`);
    } catch {}
    try {
      await p.query(`ALTER TABLE users ADD COLUMN leads_used_today INT DEFAULT 0`);
    } catch {}
    try {
      await p.query(`ALTER TABLE users ADD COLUMN last_active_date VARCHAR(10) DEFAULT ''`);
    } catch {}
    try {
      await p.query(`ALTER TABLE users ADD COLUMN plan_expires_at DATETIME NULL`);
    } catch {}

    // Auto-promote default owners to superadmin and agency tier
    try {
      await p.query(`UPDATE users SET role = 'superadmin', plan = 'agency' WHERE LOWER(email) IN ('parvpathak12@gmail.com', 'rohitnarwariya555@gmail.com')`);
    } catch {}

    // Initial sync of JSON users into MySQL if MySQL users table is empty
    try {
      const [cntRows] = await p.query('SELECT COUNT(*) AS cnt FROM users');
      if (cntRows[0]?.cnt === 0) {
        const jsonUsers = await readJsonUsers();
        for (const u of jsonUsers) {
          const role = isSuperAdminEmail(u.email) ? 'superadmin' : (u.role || 'user');
          await p.query(
            `INSERT INTO users (id, name, email, phone, role, password_hash, salt, profile, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role)`,
            [
              u.id,
              u.name,
              u.email,
              u.phone || '',
              role,
              u.passwordHash,
              u.salt,
              JSON.stringify(u.profile || {}),
              u.createdAt ? new Date(u.createdAt) : new Date()
            ]
          );
          if (Array.isArray(u.applications)) {
            for (const app of u.applications) {
              await dbUpsertUserApplication(u.id, app);
            }
          }
        }
        if (jsonUsers.length > 0) {
          console.log(`[DB] Synced ${jsonUsers.length} users and their applications from JSON fallback into MySQL.`);
        }
      }
    } catch (e) {
      console.warn('[DB] User migration check skipped:', e.message);
    }

    await p.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        url VARCHAR(500) NOT NULL,
        kind VARCHAR(32) DEFAULT 'lead',
        title VARCHAR(255) DEFAULT '',
        company VARCHAR(255) DEFAULT '',
        location VARCHAR(255) DEFAULT '',
        status VARCHAR(64) DEFAULT 'Pitched',
        deal VARCHAR(128) DEFAULT '',
        notes TEXT NULL,
        contact_email VARCHAR(255) DEFAULT '',
        contact_phone VARCHAR(64) DEFAULT '',
        raw_data LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_url (user_id, url(250)),
        INDEX idx_app_user (user_id),
        INDEX idx_app_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        url VARCHAR(500) NOT NULL,
        name VARCHAR(255) DEFAULT '',
        category VARCHAR(64) DEFAULT '',
        location VARCHAR(255) DEFAULT '',
        phone VARCHAR(64) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        tech_stack VARCHAR(255) DEFAULT '',
        cms VARCHAR(64) DEFAULT '',
        raw_data LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_lead_url (url(250)),
        INDEX idx_lead_cat (category),
        INDEX idx_lead_loc (location)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        action VARCHAR(64) NOT NULL,
        details TEXT NULL,
        ip_address VARCHAR(64) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_log_user (user_id),
        INDEX idx_log_action (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err) {
    console.error('[DB] Error verifying tables:', err.message);
  }
}

// Fallback JSON operations
async function readJsonUsers() {
  try {
    return JSON.parse(await readFile(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function writeJsonUsers(users) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// ----------------- USER OPERATIONS -----------------

export async function dbFindUserByEmail(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const [rows] = await p.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
    if (!rows.length) return null;
    const r = rows[0];
    const isSuper = isSuperAdminEmail(cleanEmail) || r.role === 'superadmin';
    const role = r.role || (isSuper ? 'superadmin' : 'user');
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      role,
      isSuperAdmin: isSuper,
      plan: isSuper ? 'agency' : (r.plan || 'free'),
      leadsUsedToday: Number(r.leads_used_today || 0),
      lastActiveDate: r.last_active_date || '',
      planExpiresAt: r.plan_expires_at || null,
      passwordHash: r.password_hash,
      salt: r.salt,
      profile: r.profile ? (typeof r.profile === 'string' ? JSON.parse(r.profile) : r.profile) : null,
      createdAt: r.created_at
    };
  }

  const users = await readJsonUsers();
  const u = users.find((x) => x.email.toLowerCase() === cleanEmail) || null;
  if (!u) return null;
  const isSuper = isSuperAdminEmail(cleanEmail) || u.role === 'superadmin';
  const role = u.role || (isSuper ? 'superadmin' : 'user');
  return {
    ...u,
    role,
    isSuperAdmin: isSuper,
    plan: isSuper ? 'agency' : (u.plan || 'free'),
    leadsUsedToday: Number(u.leadsUsedToday || 0),
    lastActiveDate: u.lastActiveDate || '',
    planExpiresAt: u.planExpiresAt || null
  };
}

export async function dbFindUserById(userId) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) return null;
    const r = rows[0];
    const isSuper = r.role === 'superadmin' || isSuperAdminEmail(r.email);
    const role = r.role || (isSuper ? 'superadmin' : 'user');
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      role,
      isSuperAdmin: isSuper,
      plan: isSuper ? 'agency' : (r.plan || 'free'),
      leadsUsedToday: Number(r.leads_used_today || 0),
      lastActiveDate: r.last_active_date || '',
      planExpiresAt: r.plan_expires_at || null,
      passwordHash: r.password_hash,
      salt: r.salt,
      profile: r.profile ? (typeof r.profile === 'string' ? JSON.parse(r.profile) : r.profile) : null,
      createdAt: r.created_at
    };
  }

  const users = await readJsonUsers();
  const u = users.find((x) => x.id === userId) || null;
  if (!u) return null;
  const isSuper = u.role === 'superadmin' || isSuperAdminEmail(u.email);
  const role = u.role || (isSuper ? 'superadmin' : 'user');
  return {
    ...u,
    role,
    isSuperAdmin: isSuper,
    plan: isSuper ? 'agency' : (u.plan || 'free'),
    leadsUsedToday: Number(u.leadsUsedToday || 0),
    lastActiveDate: u.lastActiveDate || '',
    planExpiresAt: u.planExpiresAt || null
  };
}

export async function dbCreateUser(user) {
  const { pool: p, isMySqlActive: active } = await getDb();
  const isSuper = isSuperAdminEmail(user.email) || user.role === 'superadmin';
  const role = isSuper ? 'superadmin' : (user.role || 'user');
  const plan = isSuper ? 'agency' : (user.plan || 'free');
  const userWithRole = {
    ...user,
    role,
    isSuperAdmin: isSuper,
    plan,
    leadsUsedToday: 0,
    lastActiveDate: ''
  };

  if (active && p) {
    await p.query(
      `INSERT INTO users (id, name, email, phone, role, plan, leads_used_today, last_active_date, password_hash, salt, profile)
       VALUES (?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.phone || '',
        role,
        plan,
        user.passwordHash,
        user.salt,
        JSON.stringify(user.profile || {})
      ]
    );
    return userWithRole;
  }

  const users = await readJsonUsers();
  users.push(userWithRole);
  await writeJsonUsers(users);
  return userWithRole;
}

export async function dbSaveUserProfile(userId, profile) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    await p.query(
      `UPDATE users SET profile = ?, name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?`,
      [JSON.stringify(profile), profile.name || null, profile.phone || null, userId]
    );
    return profile;
  }

  const users = await readJsonUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i < 0) return null;
  users[i].profile = profile;
  if (profile.name) users[i].name = profile.name;
  if (profile.phone) users[i].phone = profile.phone;
  await writeJsonUsers(users);
  return profile;
}

// ----------------- SUBSCRIPTION & QUOTA OPERATIONS -----------------

export const PLAN_LIMITS = {
  free: 10,
  pro: 150,
  agency: 100000
};

export async function dbGetUserQuota(userId) {
  if (!userId) {
    return { plan: 'free', limit: 10, usedToday: 0, remaining: 10, isUnlimited: false, canSearch: true };
  }
  const user = await dbFindUserById(userId);
  if (!user) {
    return { plan: 'free', limit: 10, usedToday: 0, remaining: 10, isUnlimited: false, canSearch: true };
  }
  const isSuper = Boolean(user.isSuperAdmin || user.role === 'superadmin' || isSuperAdminEmail(user.email));
  const plan = isSuper ? 'agency' : (user.plan || 'free');
  const limit = PLAN_LIMITS[plan] || 10;
  const isUnlimited = plan === 'agency' || isSuper;

  const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  let usedToday = Number(user.leadsUsedToday || 0);

  // Auto reset if date changed
  if (user.lastActiveDate !== todayStr) {
    usedToday = 0;
    await dbResetUserDailyQuota(userId, todayStr);
  }

  const remaining = isUnlimited ? 999999 : Math.max(0, limit - usedToday);
  return {
    userId,
    plan,
    limit,
    usedToday,
    remaining,
    isUnlimited,
    canSearch: isUnlimited || remaining > 0
  };
}

export async function dbResetUserDailyQuota(userId, todayStr) {
  const { pool: p, isMySqlActive: active } = await getDb();
  if (active && p) {
    await p.query('UPDATE users SET leads_used_today = 0, last_active_date = ? WHERE id = ?', [todayStr, userId]);
    return;
  }
  const users = await readJsonUsers();
  const u = users.find((x) => x.id === userId);
  if (u) {
    u.leadsUsedToday = 0;
    u.lastActiveDate = todayStr;
    await writeJsonUsers(users);
  }
}

export async function dbIncrementLeadsUsed(userId, count = 1) {
  if (!userId || count <= 0) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  const { pool: p, isMySqlActive: active } = await getDb();
  if (active && p) {
    await p.query(
      `UPDATE users 
       SET leads_used_today = CASE WHEN last_active_date = ? THEN leads_used_today + ? ELSE ? END,
           last_active_date = ?
       WHERE id = ?`,
      [todayStr, count, count, todayStr, userId]
    );
    return;
  }
  const users = await readJsonUsers();
  const u = users.find((x) => x.id === userId);
  if (u) {
    if (u.lastActiveDate === todayStr) {
      u.leadsUsedToday = (u.leadsUsedToday || 0) + count;
    } else {
      u.leadsUsedToday = count;
      u.lastActiveDate = todayStr;
    }
    await writeJsonUsers(users);
  }
}

export async function dbUpdateUserPlan(userId, plan) {
  const validPlans = ['free', 'pro', 'agency'];
  const cleanPlan = validPlans.includes(plan) ? plan : 'pro';
  const { pool: p, isMySqlActive: active } = await getDb();
  if (active && p) {
    await p.query('UPDATE users SET plan = ? WHERE id = ?', [cleanPlan, userId]);
    return { success: true, plan: cleanPlan };
  }
  const users = await readJsonUsers();
  const u = users.find((x) => x.id === userId);
  if (u) {
    u.plan = cleanPlan;
    await writeJsonUsers(users);
  }
  return { success: true, plan: cleanPlan };
}

// ----------------- APPLICATIONS & PITCHES -----------------

export async function dbGetUserApplications(userId) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const [rows] = await p.query(
      `SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC`,
      [userId]
    );
    return rows.map((r) => {
      let raw = {};
      try { raw = r.raw_data ? JSON.parse(r.raw_data) : {}; } catch {}
      return {
        ...raw,
        userId: r.user_id,
        url: r.url,
        kind: r.kind,
        title: r.title,
        company: r.company,
        location: r.location,
        status: r.status,
        deal: r.deal,
        notes: r.notes,
        contactEmail: r.contact_email,
        contactPhone: r.contact_phone,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
  }

  const users = await readJsonUsers();
  const u = users.find((x) => x.id === userId);
  return u ? (u.applications || []) : [];
}

export async function dbUpsertUserApplication(userId, app) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const rawData = JSON.stringify(app);
    await p.query(
      `INSERT INTO applications (user_id, url, kind, title, company, location, status, deal, notes, contact_email, contact_phone, raw_data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         kind = VALUES(kind),
         title = VALUES(title),
         company = VALUES(company),
         location = VALUES(location),
         status = VALUES(status),
         deal = VALUES(deal),
         notes = VALUES(notes),
         contact_email = VALUES(contact_email),
         contact_phone = VALUES(contact_phone),
         raw_data = VALUES(raw_data),
         updated_at = NOW()`,
      [
        userId,
        app.url,
        app.kind || 'lead',
        app.title || '',
        app.company || '',
        app.location || '',
        app.status || 'Pitched',
        app.deal || '',
        app.notes || '',
        app.contactEmail || app.email || '',
        app.contactPhone || app.phone || '',
        rawData
      ]
    );
    return { ...app, userId, updatedAt: new Date().toISOString() };
  }

  const users = await readJsonUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i < 0) return app;
  const apps = users[i].applications || [];
  const idx = apps.findIndex((a) => a.url === app.url);
  const rec = {
    ...(idx >= 0 ? apps[idx] : { createdAt: new Date().toISOString() }),
    ...app,
    updatedAt: new Date().toISOString(),
    userId
  };
  if (idx >= 0) apps[idx] = rec;
  else apps.unshift(rec);
  users[i].applications = apps;
  await writeJsonUsers(users);
  return rec;
}

export async function dbDeleteUserApplication(userId, url) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    await p.query('DELETE FROM applications WHERE user_id = ? AND url = ?', [userId, url]);
    return;
  }

  const users = await readJsonUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i >= 0 && users[i].applications) {
    users[i].applications = users[i].applications.filter((a) => a.url !== url);
    await writeJsonUsers(users);
  }
}

export async function dbUpsertApplicationsBulk(userId, list) {
  const results = [];
  for (const item of list) {
    if (item && item.url) {
      results.push(await dbUpsertUserApplication(userId, item));
    }
  }
  return results;
}

// ----------------- LEADS STORAGE -----------------

export async function dbSaveLead(lead) {
  try {
    const { pool: p, isMySqlActive: active } = await getDb();
    if (active && p && lead && (lead.website || lead.url)) {
      const u = lead.website || lead.url;
      await p.query(
        `INSERT INTO leads (url, name, category, location, phone, email, tech_stack, cms, source, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = COALESCE(VALUES(name), name),
           phone = COALESCE(VALUES(phone), phone),
           email = COALESCE(VALUES(email), email),
           tech_stack = COALESCE(VALUES(tech_stack), tech_stack),
           cms = COALESCE(VALUES(cms), cms),
           source = COALESCE(VALUES(source), source),
           raw_data = VALUES(raw_data)`,
        [
          u,
          lead.name || '',
          lead.category || '',
          lead.address || lead.location || '',
          lead.phone || '',
          lead.email || '',
          Array.isArray(lead.technologies) ? lead.technologies.join(', ') : (lead.tech_stack || ''),
          lead.cms || lead.platform || '',
          lead.source || 'Web Discovery',
          JSON.stringify(lead)
        ]
      );
    }
  } catch (err) {
    // Ignore non-critical lead save errors
  }
}

// ----------------- ACTIVITY LOGGING -----------------

export async function dbLogActivity(userId, action, details, ip = '') {
  try {
    const { pool: p, isMySqlActive: active } = await getDb();
    if (active && p) {
      await p.query(
        `INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
        [userId || null, action, typeof details === 'object' ? JSON.stringify(details) : String(details), ip]
      );
    }
  } catch (err) {
    console.warn('[DB] Log activity error:', err.message);
  }
}

// ----------------- SUPER ADMIN & TEAM METRICS -----------------

export function detectPitchChannel(notes = '', kind = 'Lead') {
  const n = String(notes || '').toLowerCase();
  const k = String(kind || '').toLowerCase();
  if (k === 'job' || n.includes('job apply') || n.includes('match ')) return 'Job Apply';
  if (n.includes('whatsapp')) return 'WhatsApp';
  if (n.includes('insta') || n.includes('dm')) return 'Instagram';
  if (n.includes('gmail') || n.includes('email') || n.includes('mail')) return 'Email';
  if (n.includes('phone') || n.includes('call')) return 'Phone Call';
  return 'Direct Pitch';
}

export async function dbGetAllUsersWithStats() {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const [users] = await p.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone, 
        u.role, 
        u.plan,
        u.created_at AS createdAt,
        (SELECT MAX(created_at) FROM activity_logs WHERE user_id = u.id AND action = 'LOGIN_SUCCESS') AS lastLoginAt,
        (SELECT ip_address FROM activity_logs WHERE user_id = u.id AND action = 'LOGIN_SUCCESS' ORDER BY created_at DESC LIMIT 1) AS lastLoginIp,
        COUNT(a.id) AS totalOutreach,
        SUM(CASE WHEN a.kind != 'Job' OR a.kind IS NULL THEN 1 ELSE 0 END) AS totalPitches,
        SUM(CASE WHEN a.kind = 'Job' THEN 1 ELSE 0 END) AS totalJobs,
        SUM(CASE WHEN LOWER(a.notes) LIKE '%whatsapp%' THEN 1 ELSE 0 END) AS whatsappPitches,
        SUM(CASE WHEN LOWER(a.notes) LIKE '%insta%' THEN 1 ELSE 0 END) AS instaPitches,
        SUM(CASE WHEN (LOWER(a.notes) LIKE '%email%' OR LOWER(a.notes) LIKE '%gmail%') THEN 1 ELSE 0 END) AS emailPitches,
        SUM(CASE WHEN a.status = 'Won' THEN 1 ELSE 0 END) AS totalWon,
        SUM(CASE WHEN a.deal > 0 THEN a.deal ELSE 0 END) AS totalPipelineValue
      FROM users u
      LEFT JOIN applications a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    return users.map((u) => {
      const isSuper = u.role === 'superadmin' || isSuperAdminEmail(u.email);
      return {
        ...u,
        role: u.role || (isSuper ? 'superadmin' : 'user'),
        plan: isSuper ? 'agency' : (u.plan || 'free'),
        isSuperAdmin: isSuper,
        totalOutreach: Number(u.totalOutreach || 0),
        totalPitches: Number(u.totalPitches || 0),
        totalJobs: Number(u.totalJobs || 0),
        whatsappPitches: Number(u.whatsappPitches || 0),
        instaPitches: Number(u.instaPitches || 0),
        emailPitches: Number(u.emailPitches || 0),
        totalWon: Number(u.totalWon || 0),
        totalPipelineValue: Number(u.totalPipelineValue || 0)
      };
    });
  }

  // JSON fallback
  const users = await readJsonUsers();
  return users.map((u) => {
    const apps = Array.isArray(u.applications) ? u.applications : [];
    let whatsappPitches = 0, instaPitches = 0, emailPitches = 0, totalPitches = 0, totalJobs = 0, totalWon = 0, totalPipelineValue = 0;
    for (const a of apps) {
      const ch = detectPitchChannel(a.notes, a.kind);
      if (a.kind === 'Job') totalJobs++;
      else totalPitches++;
      if (ch === 'WhatsApp') whatsappPitches++;
      else if (ch === 'Instagram') instaPitches++;
      else if (ch === 'Email') emailPitches++;
      if (a.status === 'Won') totalWon++;
      if (Number(a.deal) > 0) totalPipelineValue += Number(a.deal);
    }
    const isSuperAdmin = isSuperAdminEmail(u.email) || u.role === 'superadmin';
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role || (isSuperAdmin ? 'superadmin' : 'user'),
      plan: isSuperAdmin ? 'agency' : (u.plan || 'free'),
      isSuperAdmin,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || u.createdAt,
      lastLoginIp: u.lastLoginIp || 'Local',
      totalOutreach: apps.length,
      totalPitches,
      totalJobs,
      whatsappPitches,
      instaPitches,
      emailPitches,
      totalWon,
      totalPipelineValue
    };
  });
}

export async function dbGetAllPitches({ userId = '', channel = '', limit = 500, search = '' } = {}) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    let sql = `
      SELECT 
        a.*,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM applications a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      sql += ` AND a.user_id = ?`;
      params.push(userId);
    }
    if (search) {
      sql += ` AND (a.title LIKE ? OR a.company LIKE ? OR a.url LIKE ? OR a.notes LIKE ? OR a.location LIKE ? OR u.name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }
    sql += ` ORDER BY a.updated_at DESC LIMIT ?`;
    params.push(Number(limit) || 500);

    const [rows] = await p.query(sql, params);
    const list = rows.map((r) => {
      let raw = {};
      try { raw = r.raw_data ? JSON.parse(r.raw_data) : {}; } catch {}
      const ch = detectPitchChannel(r.notes, r.kind);
      return {
        ...raw,
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || raw.userName || 'Unknown Agent',
        userEmail: r.user_email || raw.userEmail || '',
        userPhone: r.user_phone || '',
        url: r.url,
        kind: r.kind || 'Lead',
        title: r.title,
        company: r.company,
        location: r.location,
        status: r.status,
        deal: Number(r.deal) || 0,
        notes: r.notes || '',
        contactEmail: r.contact_email || raw.email || '',
        contactPhone: r.contact_phone || raw.phone || '',
        channel: ch,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });

    if (channel && channel !== 'all') {
      return list.filter((x) => x.channel.toLowerCase() === channel.toLowerCase());
    }
    return list;
  }

  // JSON fallback
  const users = await readJsonUsers();
  const all = [];
  for (const u of users) {
    if (userId && u.id !== userId) continue;
    const apps = Array.isArray(u.applications) ? u.applications : [];
    for (const a of apps) {
      const ch = detectPitchChannel(a.notes, a.kind);
      all.push({
        ...a,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        userPhone: u.phone || '',
        channel: ch
      });
    }
  }

  let filtered = all;
  if (channel && channel !== 'all') {
    filtered = filtered.filter((x) => x.channel.toLowerCase() === channel.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((x) => 
      (x.title || '').toLowerCase().includes(s) ||
      (x.company || '').toLowerCase().includes(s) ||
      (x.url || '').toLowerCase().includes(s) ||
      (x.notes || '').toLowerCase().includes(s) ||
      (x.userName || '').toLowerCase().includes(s)
    );
  }
  filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return filtered.slice(0, Number(limit) || 500);
}

export async function dbGetAdminStats() {
  const users = await dbGetAllUsersWithStats();
  const allPitches = await dbGetAllPitches({ limit: 1000 });

  let totalPitches = 0;
  let totalJobs = 0;
  let whatsappPitches = 0;
  let instaPitches = 0;
  let emailPitches = 0;
  let totalWon = 0;
  let totalPipelineValue = 0;

  for (const p of allPitches) {
    if (p.kind === 'Job') totalJobs++;
    else totalPitches++;

    if (p.channel === 'WhatsApp') whatsappPitches++;
    else if (p.channel === 'Instagram') instaPitches++;
    else if (p.channel === 'Email') emailPitches++;

    if (p.status === 'Won') totalWon++;
    if (Number(p.deal) > 0) totalPipelineValue += Number(p.deal);
  }

  return {
    totalUsers: users.length,
    activeUsersCount: users.filter((u) => {
      const d = new Date(u.lastLoginAt || u.createdAt).getTime();
      return (Date.now() - d) < 7 * 86400 * 1000;
    }).length,
    totalPitches,
    totalJobs,
    whatsappPitches,
    instaPitches,
    emailPitches,
    totalWon,
    totalPipelineValue,
    recentPitches: allPitches.slice(0, 8)
  };
}

export async function dbGetActivityLogs({ limit = 50 } = {}) {
  const { pool: p, isMySqlActive: active } = await getDb();
  if (active && p) {
    const [rows] = await p.query(`
      SELECT 
        l.*,
        u.name AS user_name,
        u.email AS user_email
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT ?
    `, [Number(limit) || 50]);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name || 'System / Visitor',
      userEmail: r.user_email || '',
      action: r.action,
      details: r.details,
      ipAddress: r.ip_address,
      createdAt: r.created_at
    }));
  }
  return [];
}

export async function dbUpdateUserAccess(userId, { role, plan } = {}) {
  const cleanRole = role === 'superadmin' ? 'superadmin' : (role === 'user' ? 'user' : null);
  const cleanPlan = ['free', 'pro', 'agency'].includes(String(plan || '').toLowerCase()) ? String(plan).toLowerCase() : null;
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const updates = [];
    const params = [];
    if (cleanRole) {
      updates.push('role = ?');
      params.push(cleanRole);
      if (cleanRole === 'superadmin' && !cleanPlan) {
        updates.push("plan = 'agency'");
      }
    }
    if (cleanPlan) {
      updates.push('plan = ?');
      params.push(cleanPlan);
    }
    if (updates.length) {
      params.push(userId);
      await p.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    return await dbFindUserById(userId);
  }

  const users = await readJsonUsers();
  const idx = users.findIndex((x) => x.id === userId);
  if (idx === -1) return null;
  if (cleanRole) {
    users[idx].role = cleanRole;
    if (cleanRole === 'superadmin' && !cleanPlan) users[idx].plan = 'agency';
  }
  if (cleanPlan) users[idx].plan = cleanPlan;
  await writeJsonUsers(users);
  return await dbFindUserById(userId);
}

