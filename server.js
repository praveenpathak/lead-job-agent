// Lead & Job Agent – zero-dependency local web app.  Run:  node server.js
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findLeads, CATEGORIES } from './lib/leads.js';
import { findJobs, REGIONS } from './lib/jobs.js';
import { analyzeSite, pool } from './lib/detect.js';
import { execFile } from 'node:child_process';
import { getProfile, saveProfile, getApplications, upsertApplication, upsertApplications, deleteApplication, coverLetter, pitchEmail } from './lib/apply.js';
import {
  registerUser,
  loginUser,
  verifyToken,
  getUserById,
  getUserProfile,
  saveUserProfile,
  getUserApplications,
  upsertUserApplication,
  deleteUserApplication,
  upsertUserApplicationsBulk,
  isUserSuperAdmin,
  getAdminUsers,
  getAdminPitches,
  getAdminStats,
  getAdminActivity,
  getUserQuota,
  incrementLeadsUsed,
  updateUserPlan
} from './lib/auth.js';
import { dbSaveLead } from './lib/db.js';
import { createAuditRecord, getAuditRecord, renderAuditHTML } from './lib/audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3777;
const getIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

async function body(req) {
  let s = '';
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}

async function getAuthUserId(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  if (!token) return null;
  return await verifyToken(token);
}

function stream(res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' });
  return (obj) => res.write(JSON.stringify(obj) + '\n');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await readFile(path.join(__dirname, 'public', 'index.html')));
    }
    if (req.method === 'GET' && req.url === '/api/meta') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ categories: Object.keys(CATEGORIES), regions: Object.keys(REGIONS) }));
    }
    if (req.method === 'POST' && req.url === '/api/leads') {
      const b = await body(req);
      const send = stream(res);
      const ctrl = new AbortController();
      req.on('close', () => ctrl.abort());

      // Daily Quota Verification
      const uid = await getAuthUserId(req);
      const quota = await getUserQuota(uid);
      if (!quota.canSearch) {
        send({
          stage: 'limit_reached',
          plan: quota.plan,
          used: quota.usedToday,
          limit: quota.limit,
          msg: `Daily lead limit of ${quota.limit} reached for ${quota.plan.toUpperCase()} plan. Upgrade to Pro for unlimited leads!`
        });
        return res.end();
      }

      let leadsStreamedThisRun = 0;
      const maxAllowedThisRun = quota.isUnlimited ? 500 : quota.remaining;

      try {
        const r = await findLeads({
          ...b,
          maxScan: Math.min(Number(b.maxScan) || 200, 500),
          signal: ctrl.signal,
          onProgress: (m) => {
            if (m && m.stage === 'lead' && m.lead) {
              if (leadsStreamedThisRun >= maxAllowedThisRun) {
                if (!res.writableEnded) {
                  send({
                    stage: 'limit_reached',
                    plan: quota.plan,
                    used: quota.limit,
                    limit: quota.limit,
                    msg: `Daily lead limit of ${quota.limit} reached for ${quota.plan.toUpperCase()} plan. Upgrade to Pro for unlimited leads!`
                  });
                }
                ctrl.abort();
                return;
              }
              leadsStreamedThisRun++;
              dbSaveLead(m.lead);
            }
            if (!res.writableEnded) send(m);
          }
        });
        if (leadsStreamedThisRun > 0 && uid) {
          await incrementLeadsUsed(uid, leadsStreamedThisRun);
        }
        if (r && Array.isArray(r.leads)) {
          for (const ld of r.leads) dbSaveLead(ld);
        }
        if (!res.writableEnded) send({ stage: 'result', ...r });
      } catch (e) {
        if (!res.writableEnded && e.name !== 'AbortError') send({ stage: 'error', msg: e.message });
      }
      return !res.writableEnded && res.end();
    }
    if (req.method === 'POST' && req.url === '/api/check-urls') {
      const b = await body(req);
      const urls = String(b.urls || '').split(/[\s,]+/).filter(Boolean).slice(0, 300);
      const send = stream(res);
      let done = 0;
      await pool(urls, 8, async (u) => {
        const a = await analyzeSite(u);
        done++;
        const ld = { name: a.title || u, category: '', address: '', website: a.finalUrl || u, ...a };
        dbSaveLead(ld);
        send({ stage: 'lead', lead: ld });
        send({ stage: 'progress', done, total: urls.length });
      });
      send({ stage: 'done', msg: `Checked ${urls.length} websites.` });
      return res.end();
    }
    if (req.method === 'POST' && req.url === '/api/jobs') {
      const b = await body(req);
      const send = stream(res);
      try {
        const uid = await getAuthUserId(req);
        const prof = uid ? await getUserProfile(uid) : await getProfile();
        const r = await findJobs({ ...b, profile: prof, onProgress: send });
        send({ stage: 'result', ...r });
      } catch (e) { send({ stage: 'error', msg: e.message }); }
      return res.end();
    }
    // ----- Apply assistant & Auth -----
    const json = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

    // Auth endpoints
    if (req.method === 'POST' && req.url === '/api/auth/register') {
      const b = await body(req);
      try {
        const r = await registerUser(b, getIp(req));
        return json(r);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
    if (req.method === 'POST' && req.url === '/api/auth/login') {
      const b = await body(req);
      try {
        const r = await loginUser(b, getIp(req));
        return json(r);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
    if (req.method === 'GET' && req.url === '/api/auth/me') {
      const uid = await getAuthUserId(req);
      if (!uid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const user = await getUserById(uid);
      const profile = await getUserProfile(uid);
      const quota = await getUserQuota(uid);
      return json({ user, profile, quota });
    }

    if (req.method === 'POST' && req.url === '/api/user/upgrade') {
      const uid = await getAuthUserId(req);
      if (!uid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const b = await body(req);
      const plan = b.plan || 'pro';
      await updateUserPlan(uid, plan);
      const user = await getUserById(uid);
      const quota = await getUserQuota(uid);
      return json({ success: true, user, quota });
    }

    // ----- Super Admin Endpoints -----
    if (req.method === 'GET' && req.url === '/api/admin/stats') {
      const uid = await getAuthUserId(req);
      if (!uid) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      try {
        const stats = await getAdminStats(uid);
        return json(stats);
      } catch (err) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
    if (req.method === 'GET' && req.url === '/api/admin/users') {
      const uid = await getAuthUserId(req);
      if (!uid) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      try {
        const users = await getAdminUsers(uid);
        return json(users);
      } catch (err) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
    if (req.method === 'GET' && req.url.startsWith('/api/admin/pitches')) {
      const uid = await getAuthUserId(req);
      if (!uid) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const userId = parsedUrl.searchParams.get('userId') || '';
        const channel = parsedUrl.searchParams.get('channel') || '';
        const search = parsedUrl.searchParams.get('search') || '';
        const limit = Number(parsedUrl.searchParams.get('limit')) || 500;
        const pitches = await getAdminPitches(uid, { userId, channel, search, limit });
        return json(pitches);
      } catch (err) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
    if (req.method === 'GET' && req.url.startsWith('/api/admin/activity')) {
      const uid = await getAuthUserId(req);
      if (!uid) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Unauthorized' })); }
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const limit = Number(parsedUrl.searchParams.get('limit')) || 50;
        const activity = await getAdminActivity(uid, { limit });
        return json(activity);
      } catch (err) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (req.url === '/api/profile') {
      const uid = await getAuthUserId(req);
      if (req.method === 'POST') {
        const b = await body(req);
        if (uid) {
          await saveUserProfile(uid, b);
          return json(await getUserProfile(uid));
        } else {
          await saveProfile(b);
          return json(await getProfile());
        }
      }
      if (uid) return json(await getUserProfile(uid));
      return json(await getProfile());
    }
    if (req.method === 'POST' && req.url === '/api/cover-letter') {
      const uid = await getAuthUserId(req);
      const prof = uid ? await getUserProfile(uid) : await getProfile();
      const { job } = await body(req);
      return json(coverLetter(job, prof));
    }
    if (req.method === 'POST' && req.url === '/api/pitch') {
      const uid = await getAuthUserId(req);
      const prof = uid ? await getUserProfile(uid) : await getProfile();
      const { lead, tone } = await body(req);
      return json(pitchEmail(lead, prof, tone));
    }
    if (req.url === '/api/applications') {
      const uid = await getAuthUserId(req);
      if (req.method === 'POST') {
        const a = await body(req);
        if (uid) return json(await upsertUserApplication(uid, a));
        return json(await upsertApplication(a));
      }
      if (req.method === 'DELETE') {
        const a = await body(req);
        if (uid) await deleteUserApplication(uid, a.url);
        else await deleteApplication(a.url);
        return json({ ok: true });
      }
      if (uid) return json(await getUserApplications(uid));
      return json(await getApplications());
    }
    if (req.url === '/api/applications/bulk' && req.method === 'POST') {
      const uid = await getAuthUserId(req);
      const { list } = await body(req);
      if (uid) return json(await upsertUserApplicationsBulk(uid, list || []));
      return json(await upsertApplications(list || []));
    }
    if (req.method === 'POST' && req.url === '/api/open-resume') {
      const p = await getProfile();
      const file = path.resolve(__dirname, p.resumeFile || '');
      if (process.platform === 'win32') execFile('explorer.exe', [`/select,${file}`]);
      return json({ ok: true, file });
    }
    if (req.method === 'GET' && req.url === '/api/resume') {
      const p = await getProfile();
      const file = path.resolve(__dirname, p.resumeFile || '');
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
      });
      return res.end(await readFile(file));
    }
    if (req.method === 'POST' && req.url === '/api/audit/create') {
      const uid = await getAuthUserId(req);
      const prof = uid ? await getUserProfile(uid) : await getProfile();
      const { lead } = await body(req);
      if (!lead) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Lead data required' }));
      }
      const audit = createAuditRecord(lead, prof);
      const host = req.headers.host || `localhost:${PORT}`;
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      return json({ ...audit, fullUrl: `${protocol}://${host}${audit.url}` });
    }
    if (req.method === 'GET' && req.url.startsWith('/audit')) {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const auditId = segments[1];
      let record = auditId ? getAuditRecord(auditId) : null;

      if (!record && parsedUrl.searchParams.get('data')) {
        try {
          const decoded = JSON.parse(Buffer.from(parsedUrl.searchParams.get('data'), 'base64url').toString('utf8'));
          record = { lead: decoded.lead, profile: decoded.profile || {} };
        } catch {}
      }

      if (!record) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>Audit Report Not Found or Expired</h2><p>Please regenerate the audit report from the <a href="/">Lead & Job Agent Dashboard</a>.</p></body></html>`);
      }

      const html = renderAuditHTML(record.lead, record.profile, req.headers.host);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    if (!res.headersSent) res.writeHead(500);
    res.end(String(e.message || e));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Lead & Job Agent running →  http://localhost:${PORT}\n`);
});
