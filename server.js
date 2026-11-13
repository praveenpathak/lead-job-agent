// Lead & Job Agent – zero-dependency local web app.  Run:  node server.js
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findLeads, CATEGORIES } from './lib/leads.js';
import { findJobs, REGIONS } from './lib/jobs.js';
import { analyzeSite, pool } from './lib/detect.js';
import { execFile } from 'node:child_process';
import { getProfile, saveProfile, getApplications, upsertApplication, deleteApplication, coverLetter, pitchEmail } from './lib/apply.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3777;

async function body(req) {
  let s = '';
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
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
      try {
        const r = await findLeads({ ...b, maxScan: Math.min(Number(b.maxScan) || 80, 300), onProgress: send });
        send({ stage: 'result', ...r });
      } catch (e) { send({ stage: 'error', msg: e.message }); }
      return res.end();
    }
    if (req.method === 'POST' && req.url === '/api/check-urls') {
      const b = await body(req);
      const urls = String(b.urls || '').split(/[\s,]+/).filter(Boolean).slice(0, 300);
      const send = stream(res);
      let done = 0;
      await pool(urls, 8, async (u) => {
        const a = await analyzeSite(u);
        done++;
        send({ stage: 'lead', lead: { name: a.title || u, category: '', address: '', website: a.finalUrl || u, ...a } });
        send({ stage: 'progress', done, total: urls.length });
      });
      send({ stage: 'done', msg: `Checked ${urls.length} websites.` });
      return res.end();
    }
    if (req.method === 'POST' && req.url === '/api/jobs') {
      const b = await body(req);
      const send = stream(res);
      try {
        const r = await findJobs({ ...b, profile: await getProfile(), onProgress: send });
        send({ stage: 'result', ...r });
      } catch (e) { send({ stage: 'error', msg: e.message }); }
      return res.end();
    }
    // ----- Apply assistant -----
    const json = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/api/profile') {
      if (req.method === 'POST') { await saveProfile(await body(req)); }
      return json(await getProfile());
    }
    if (req.method === 'POST' && req.url === '/api/cover-letter') {
      const { job } = await body(req);
      return json(coverLetter(job, await getProfile()));
    }
    if (req.method === 'POST' && req.url === '/api/pitch') {
      const { lead } = await body(req);
      return json(pitchEmail(lead, await getProfile()));
    }
    if (req.url === '/api/applications') {
      if (req.method === 'POST') { const a = await body(req); return json(await upsertApplication(a)); }
      if (req.method === 'DELETE') { const a = await body(req); await deleteApplication(a.url); return json({ ok: true }); }
      return json(await getApplications());
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
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    if (!res.headersSent) res.writeHead(500);
    res.end(String(e.message || e));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Lead & Job Agent running →  http://localhost:${PORT}\n`);
});
