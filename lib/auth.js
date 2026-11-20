// User authentication & persistent storage (MySQL + JSON fallback)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { scryptSync, randomBytes, createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE } from './apply.js';
import {
  dbFindUserByEmail,
  dbFindUserById,
  dbCreateUser,
  dbSaveUserProfile,
  dbGetUserApplications,
  dbUpsertUserApplication,
  dbDeleteUserApplication,
  dbUpsertApplicationsBulk,
  dbLogActivity,
  dbGetAllUsersWithStats,
  dbGetAllPitches,
  dbGetAdminStats,
  dbGetActivityLogs,
  dbGetUserQuota,
  dbIncrementLeadsUsed,
  dbUpdateUserPlan
} from './db.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
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

function safeUser(u) {
  if (!u) return null;
  const { passwordHash, salt, ...safe } = u;
  const isSuper = (safe.email && safe.email.toLowerCase() === 'parvpathak12@gmail.com') || safe.role === 'superadmin';
  return {
    ...safe,
    role: safe.role || (isSuper ? 'superadmin' : 'user'),
    plan: isSuper ? 'agency' : (safe.plan || 'free'),
    isSuperAdmin: isSuper
  };
}

export const getUserQuota = (userId) => dbGetUserQuota(userId);
export const incrementLeadsUsed = (userId, count) => dbIncrementLeadsUsed(userId, count);
export const updateUserPlan = (userId, plan) => dbUpdateUserPlan(userId, plan);

export async function registerUser({ name, email, phone = '', password, primaryService = 'web', targetNiches = [], targetCity = '' }, ip = '') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanPass = String(password || '');

  if (!cleanName) throw new Error('Name is required');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Valid email is required');
  if (cleanPass.length < 4) throw new Error('Password must be at least 4 characters');

  const existing = await dbFindUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(cleanPass, salt);
  const id = 'usr_' + Date.now() + '_' + randomBytes(4).toString('hex');

  const cleanNiches = Array.isArray(targetNiches)
    ? targetNiches.map((n) => String(n || '').trim()).filter(Boolean)
    : (targetNiches ? [String(targetNiches).trim()] : []);

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
      primaryService: String(primaryService || 'web').trim(),
      targetNiches: cleanNiches.length > 0 ? cleanNiches : ['restaurant'],
      targetCity: String(targetCity || '').trim() || 'Indore, India'
    },
    applications: []
  };

  await dbCreateUser(newUser);
  await dbLogActivity(id, 'REGISTER', `User ${cleanName} registered with email ${cleanEmail} (Service: ${primaryService || 'web'}, City: ${targetCity || 'Default'})`, ip);

  const token = await createToken(id);
  return { user: safeUser(newUser), token };
}

export async function loginUser({ email, password }, ip = '') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  const user = await dbFindUserByEmail(cleanEmail);
  if (!user) {
    throw new Error('No user found with this email. Please register first.');
  }

  const testHash = hashPassword(cleanPass, user.salt);
  if (testHash !== user.passwordHash) {
    await dbLogActivity(user.id, 'LOGIN_FAILED', `Failed login attempt for ${cleanEmail}`, ip);
    throw new Error('Incorrect password. Please try again.');
  }

  await dbLogActivity(user.id, 'LOGIN_SUCCESS', `User ${user.name} logged in`, ip);
  const token = await createToken(user.id);
  return { user: safeUser(user), token };
}

export async function getUserById(userId) {
  const user = await dbFindUserById(userId);
  return safeUser(user);
}

export async function getUserProfile(userId) {
  const user = await dbFindUserById(userId);
  if (!user) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...(user.profile || {}) };
}

export async function saveUserProfile(userId, profile) {
  const current = await getUserProfile(userId);
  const merged = { ...current, ...profile };
  await dbSaveUserProfile(userId, merged);
  return merged;
}

export async function getUserApplications(userId) {
  return await dbGetUserApplications(userId);
}

export async function upsertUserApplication(userId, app) {
  return await dbUpsertUserApplication(userId, app);
}

export async function deleteUserApplication(userId, url) {
  return await dbDeleteUserApplication(userId, url);
}

export async function upsertUserApplicationsBulk(userId, list) {
  return await dbUpsertApplicationsBulk(userId, list);
}

// ----------------- SUPER ADMIN AUTHORIZATION & APIS -----------------

export async function isUserSuperAdmin(userId) {
  if (!userId) return false;
  const user = await dbFindUserById(userId);
  if (!user) return false;
  return Boolean(user.isSuperAdmin || user.role === 'superadmin' || (user.email && user.email.toLowerCase() === 'parvpathak12@gmail.com'));
}

export async function getAdminUsers(requesterId) {
  const isSuper = await isUserSuperAdmin(requesterId);
  if (!isSuper) throw new Error('Forbidden: Super Admin access required');
  return await dbGetAllUsersWithStats();
}

export async function getAdminPitches(requesterId, filters = {}) {
  const isSuper = await isUserSuperAdmin(requesterId);
  if (!isSuper) throw new Error('Forbidden: Super Admin access required');
  return await dbGetAllPitches(filters);
}

export async function getAdminStats(requesterId) {
  const isSuper = await isUserSuperAdmin(requesterId);
  if (!isSuper) throw new Error('Forbidden: Super Admin access required');
  return await dbGetAdminStats();
}

export async function getAdminActivity(requesterId, options = {}) {
  const isSuper = await isUserSuperAdmin(requesterId);
  if (!isSuper) throw new Error('Forbidden: Super Admin access required');
  return await dbGetActivityLogs(options);
}

