const q = '[out:json][timeout:25];node["shop"="jewelry"]["website"](25.0,55.0,25.4,55.5);out tags 20;';
const eps = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
await Promise.all(eps.map(async (ep) => {
  const s = Date.now();
  try {
    const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': 'LeadJobAgent/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(40000) });
    const x = await r.text();
    console.log(ep, r.status, x.length, Date.now() - s, 'ms', x.slice(0, 120).replace(/\s+/g, ' '));
  } catch (e) { console.log(ep, 'ERR', e.name, e.message, Date.now() - s); }
}));
for (const u of ['https://remotive.com/api/remote-jobs?search=wordpress&limit=5', 'https://himalayas.app/jobs/api?limit=20&offset=0', 'https://weworkremotely.com/categories/remote-design-jobs.rss']) {
  const s = Date.now();
  try { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); await r.text(); console.log(u, r.status, Date.now() - s, 'ms'); } catch (e) { console.log(u, 'ERR', e.message, Date.now() - s); }
}
