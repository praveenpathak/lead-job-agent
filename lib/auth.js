// User authentication & per-user storage (zero external dependencies)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { scryptSync, randomBytes, createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE } from './apply.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'auth_secret.key');

let AUTH_SECRET = '';

async function getSecret() {
  if (AUTH_SECRET) return AUTH_SECRET;
  if (process.env.AUTH_SECRET) {
    AUTH_SECRET = process.env.AUTH_SECRET.trim();
    return AUTH_SECRET;
  }
  try {
    AUTH_SECRET = (await readFile(SECRET_FILE, 'utf8')).trim();
  } catch {
    AUTH_SECRET = randomBytes(32).toString('hex');
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SECRET_FILE, AUTH_SECRET);
  }
  return AUTH_SECRET;
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

export async function createToken(userId) {
  const secret = await getSecret();
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = Buffer.from(JSON.stringify({ userId, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export async function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const secret = await getSecret();
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.userId || data.exp < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}

async function readUsers() {
  try {
    return JSON.parse(await readFile(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

function safeUser(u) {
  if (!u) return null;
  const { passwordHash, salt, ...safe } = u;
  return safe;
}

export async function registerUser({ name, email, phone = '', password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanPass = String(password || '');

  if (!cleanName) throw new Error('Name is required');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Valid email is required');
  if (cleanPass.length < 4) throw new Error('Password must be at least 4 characters');

  const users = await readUsers();
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(cleanPass, salt);
  const id = 'usr_' + Date.now() + '_' + randomBytes(4).toString('hex');

  const newUser = {
    id,
    name: cleanName,
    email: cleanEmail,
    phone: String(phone || '').trim(),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    profile: {
      ...DEFAULT_PROFILE,
      name: cleanName,
      email: cleanEmail,
      phone: String(phone || '').trim() || DEFAULT_PROFILE.phone,
    },
    applications: []
  };

  users.push(newUser);
  await writeUsers(users);

  const token = await createToken(id);
  return { user: safeUser(newUser), token };
}

export async function loginUser({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  const users = await readUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    throw new Error('No user found with this email. Please register first.');
  }

  const testHash = hashPassword(cleanPass, user.salt);
  if (testHash !== user.passwordHash) {
    throw new Error('Incorrect password. Please try again.');
  }

  const token = await createToken(user.id);
  return { user: safeUser(user), token };
}

export async function getUserById(userId) {
  const users = await readUsers();
  const user = users.find((u) => u.id === userId);
  return safeUser(user);
}

export async function getUserProfile(userId) {
  const users = await readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...(user.profile || {}) };
}

export async function saveUserProfile(userId, profile) {
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i < 0) return null;
  users[i].profile = { ...DEFAULT_PROFILE, ...(users[i].profile || {}), ...profile };
  if (profile.name) users[i].name = profile.name;
  if (profile.phone) users[i].phone = profile.phone;
  await writeUsers(users);
  return users[i].profile;
}

export async function getUserApplications(userId) {
  const users = await readUsers();
  const user = users.find((u) => u.id === userId);
  return user ? (user.applications || []) : [];
}

export async function upsertUserApplication(userId, app) {
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i < 0) return app;

  const apps = users[i].applications || [];
  const existingIdx = apps.findIndex((a) => a.url === app.url);
  const rec = {
    ...(existingIdx >= 0 ? apps[existingIdx] : { createdAt: new Date().toISOString() }),
    ...app,
    updatedAt: new Date().toISOString(),
    userId
  };

  if (existingIdx >= 0) apps[existingIdx] = rec;
  else apps.unshift(rec);

  users[i].applications = apps;
  await writeUsers(users);
  return rec;
}

export async function deleteUserApplication(userId, url) {
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i >= 0 && users[i].applications) {
    users[i].applications = users[i].applications.filter((a) => a.url !== url);
    await writeUsers(users);
  }
}

export async function upsertUserApplicationsBulk(userId, list) {
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === userId);
  if (i < 0) return list;

  const apps = users[i].applications || [];
  const map = new Map(apps.map((a) => [a.url, a]));

  for (const app of list) {
    if (!app || !app.url) continue;
    const prev = map.get(app.url);
    const rec = {
      ...(prev || { createdAt: new Date().toISOString() }),
      ...app,
      updatedAt: app.updatedAt || new Date().toISOString(),
      userId
    };
    map.set(app.url, rec);
  }

  const merged = [...map.values()].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  users[i].applications = merged;
  await writeUsers(users);
  return merged;
}
