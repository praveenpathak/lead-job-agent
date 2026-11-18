// Hybrid Database Layer: Native MySQL (XAMPP / Cloud) with graceful JSON fallback
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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
    const config = databaseUrl
      ? { uri: databaseUrl, waitForConnections: true, connectionLimit: 10, queueLimit: 0 }
      : {
          host: dbHost,
          port: dbPort,
          user: dbUser,
          password: dbPassword,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 4000
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
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        profile LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      passwordHash: r.password_hash,
      salt: r.salt,
      profile: r.profile ? (typeof r.profile === 'string' ? JSON.parse(r.profile) : r.profile) : null,
      createdAt: r.created_at
    };
  }

  const users = await readJsonUsers();
  return users.find((u) => u.email.toLowerCase() === cleanEmail) || null;
}

export async function dbFindUserById(userId) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      passwordHash: r.password_hash,
      salt: r.salt,
      profile: r.profile ? (typeof r.profile === 'string' ? JSON.parse(r.profile) : r.profile) : null,
      createdAt: r.created_at
    };
  }

  const users = await readJsonUsers();
  return users.find((u) => u.id === userId) || null;
}

export async function dbCreateUser(user) {
  const { pool: p, isMySqlActive: active } = await getDb();

  if (active && p) {
    await p.query(
      `INSERT INTO users (id, name, email, phone, password_hash, salt, profile)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.phone || '',
        user.passwordHash,
        user.salt,
        JSON.stringify(user.profile || {})
      ]
    );
    return user;
  }

  const users = await readJsonUsers();
  users.push(user);
  await writeJsonUsers(users);
  return user;
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
